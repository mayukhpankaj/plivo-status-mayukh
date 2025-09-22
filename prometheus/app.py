#!/usr/bin/env python3
"""
Simple Flask app that configures Prometheus server based on services in PostgreSQL database
"""

import os
import yaml
import psycopg2
import subprocess
import signal
import psutil
import time
import threading
import hashlib
from urllib.parse import urlparse
from flask import Flask, jsonify, render_template_string
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
PROMETHEUS_CONFIG_PATH = os.getenv('PROMETHEUS_CONFIG_PATH', './prometheus.yml')
PROMETHEUS_BINARY_PATH = os.getenv('PROMETHEUS_BINARY_PATH', 'prometheus')
PROMETHEUS_DATA_DIR = os.getenv('PROMETHEUS_DATA_DIR', './prometheus_data')
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
PROMETHEUS_PORT = int(os.getenv('PROMETHEUS_PORT', 9090))
MONITOR_INTERVAL = int(os.getenv('MONITOR_INTERVAL', 30))  # Check every 30 seconds by default

# Global variables
prometheus_process = None
monitoring_thread = None
monitoring_active = False
last_services_hash = None

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def fetch_services():
    """Fetch all services from database"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cursor = conn.cursor()
        query = """
        SELECT service_id, metric_url, organization_id, name
        FROM public.services
        ORDER BY organization_id, service_id
        """
        cursor.execute(query)
        services = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert to list of dictionaries
        service_list = []
        for service in services:
            service_list.append({
                'service_id': service[0],
                'metric_url': service[1],
                'organization_id': service[2],
                'name': service[3]
            })
        
        return service_list
    except Exception as e:
        print(f"Error fetching services: {e}")
        if conn:
            conn.close()
        return []

def get_services_hash(services):
    """Generate a hash of the services list to detect changes"""
    if not services:
        return None

    # Create a consistent string representation of services
    services_str = str(sorted([
        (s['service_id'], s['metric_url'], s['organization_id'], s['name'])
        for s in services
    ]))

    return hashlib.md5(services_str.encode()).hexdigest()

def check_for_service_changes():
    """Check if services have changed since last check"""
    global last_services_hash

    current_services = fetch_services()
    current_hash = get_services_hash(current_services)

    if last_services_hash is None:
        # First time checking
        last_services_hash = current_hash
        return False, current_services

    if current_hash != last_services_hash:
        print(f"🔄 Service changes detected! Hash changed from {last_services_hash[:8]}... to {current_hash[:8]}...")
        last_services_hash = current_hash
        return True, current_services

    return False, current_services

def monitor_services():
    """Background thread function to monitor service changes"""
    global monitoring_active, prometheus_process

    print(f"🔍 Starting service monitoring (checking every {MONITOR_INTERVAL} seconds)...")

    while monitoring_active:
        try:
            changes_detected, current_services = check_for_service_changes()

            if changes_detected:
                print(f"📊 Found {len(current_services)} services, reconfiguring Prometheus...")

                # Only reload if Prometheus is running
                if prometheus_process and prometheus_process.poll() is None:
                    success = reload_prometheus()
                    if success:
                        print("✅ Prometheus configuration reloaded successfully")
                    else:
                        print("❌ Failed to reload Prometheus configuration")
                else:
                    print("ℹ️  Prometheus is not running, skipping reload")

            # Wait for the specified interval
            time.sleep(MONITOR_INTERVAL)

        except Exception as e:
            print(f"❌ Error in service monitoring: {e}")
            time.sleep(MONITOR_INTERVAL)  # Continue monitoring even after errors

def start_monitoring():
    """Start the background monitoring thread"""
    global monitoring_thread, monitoring_active

    if monitoring_thread and monitoring_thread.is_alive():
        print("⚠️  Monitoring is already running")
        return

    monitoring_active = True
    monitoring_thread = threading.Thread(target=monitor_services, daemon=True)
    monitoring_thread.start()
    print("🚀 Background service monitoring started")

def stop_monitoring():
    """Stop the background monitoring thread"""
    global monitoring_active, monitoring_thread

    if monitoring_active:
        monitoring_active = False
        print("🛑 Stopping background service monitoring...")

        if monitoring_thread and monitoring_thread.is_alive():
            monitoring_thread.join(timeout=5)  # Wait up to 5 seconds

        print("✅ Background service monitoring stopped")

def extract_target_from_url(url):
    """Extract host:port from URL for Prometheus target"""
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port
        
        if port:
            return f"{host}:{port}"
        else:
            # Default ports based on scheme
            if parsed.scheme == 'https':
                return f"{host}:443"
            elif parsed.scheme == 'http':
                return f"{host}:80"
            else:
                return host
    except Exception as e:
        print(f"Error parsing URL {url}: {e}")
        return url

def generate_prometheus_config():
    """Generate Prometheus configuration based on services in database"""
    services = fetch_services()
    
    if not services:
        print("No services found in database")
        return None
    
    # Base configuration
    config = {
        'global': {
            'scrape_interval': '15s',
            'evaluation_interval': '15s'
        },
        'scrape_configs': []
    }
    
    # Add Prometheus self-monitoring
    config['scrape_configs'].append({
        'job_name': 'prometheus',
        'static_configs': [{'targets': [f'localhost:{PROMETHEUS_PORT}']}]
    })
    
    # Group services by organization
    org_services = {}
    for service in services:
        org_id = service['organization_id']
        if org_id not in org_services:
            org_services[org_id] = []
        org_services[org_id].append(service)
    
    # Create scrape configs for each organization
    for org_id, org_service_list in org_services.items():
        targets = []
        for service in org_service_list:
            target = extract_target_from_url(service['metric_url'])
            targets.append(target)
        
        # Create job for this organization
        job_config = {
            'job_name': f'org_{org_id}',
            'scrape_interval': '30s',
            'metrics_path': '/metrics',
            'static_configs': [{
                'targets': targets,
                'labels': {
                    'organization_id': str(org_id)
                }
            }]
        }
        
        config['scrape_configs'].append(job_config)
    
    return config

def write_prometheus_config():
    """Generate and write Prometheus configuration file"""
    try:
        config = generate_prometheus_config()
        if not config:
            return False
        
        # Ensure data directory exists
        os.makedirs(PROMETHEUS_DATA_DIR, exist_ok=True)
        
        # Write configuration file
        with open(PROMETHEUS_CONFIG_PATH, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, indent=2)
        
        print(f"Prometheus configuration written to {PROMETHEUS_CONFIG_PATH}")
        return True
    except Exception as e:
        print(f"Error writing Prometheus config: {e}")
        return False

def kill_processes_on_port(port):
    """Kill any processes using the specified port"""
    try:
        # Find processes using the port
        result = subprocess.run(['lsof', '-ti', f':{port}'],
                              capture_output=True, text=True, timeout=10)

        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            print(f"🔍 Found {len(pids)} process(es) using port {port}")

            for pid in pids:
                if pid.strip():
                    try:
                        # Try graceful termination first
                        subprocess.run(['kill', '-TERM', pid.strip()], timeout=5)
                        print(f"📤 Sent SIGTERM to process {pid}")
                        time.sleep(2)

                        # Check if process is still running
                        check_result = subprocess.run(['kill', '-0', pid.strip()],
                                                    capture_output=True, timeout=5)
                        if check_result.returncode == 0:
                            # Process still running, force kill
                            subprocess.run(['kill', '-KILL', pid.strip()], timeout=5)
                            print(f"💀 Force killed process {pid}")
                        else:
                            print(f"✅ Process {pid} terminated gracefully")

                    except subprocess.TimeoutExpired:
                        print(f"⚠️  Timeout killing process {pid}")
                    except subprocess.CalledProcessError:
                        print(f"⚠️  Process {pid} may have already terminated")

            # Wait a moment for ports to be released
            time.sleep(3)
            print(f"🧹 Port {port} cleanup completed")
            return True
        else:
            print(f"✅ Port {port} is already free")
            return True

    except subprocess.TimeoutExpired:
        print(f"⚠️  Timeout while checking port {port}")
        return False
    except FileNotFoundError:
        # lsof not available, try alternative method
        try:
            result = subprocess.run(['netstat', '-tlnp'],
                                  capture_output=True, text=True, timeout=10)
            if f':{port} ' in result.stdout:
                print(f"⚠️  Port {port} appears to be in use, but cannot kill processes (lsof not available)")
                return False
            else:
                print(f"✅ Port {port} appears to be free")
                return True
        except:
            print(f"⚠️  Cannot check port {port} status")
            return False
    except Exception as e:
        print(f"❌ Error checking/killing processes on port {port}: {e}")
        return False

def start_prometheus():
    """Start Prometheus server"""
    global prometheus_process

    try:
        # Check if already running
        if prometheus_process and prometheus_process.poll() is None:
            print("Prometheus is already running")
            return True

        # Kill any existing processes on the Prometheus port
        print(f"🧹 Cleaning up port {PROMETHEUS_PORT}...")
        if not kill_processes_on_port(PROMETHEUS_PORT):
            print(f"⚠️  Warning: Could not fully clean port {PROMETHEUS_PORT}, attempting to start anyway...")

        # Generate configuration
        if not write_prometheus_config():
            print("Failed to generate Prometheus configuration")
            return False

        # Start Prometheus
        cmd = [
            PROMETHEUS_BINARY_PATH,
            f'--config.file={PROMETHEUS_CONFIG_PATH}',
            f'--storage.tsdb.path={PROMETHEUS_DATA_DIR}',
            '--web.enable-lifecycle',
            f'--web.listen-address=0.0.0.0:{PROMETHEUS_PORT}'
        ]
        
        prometheus_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        
        # Wait a moment to check if process started
        time.sleep(2)
        
        if prometheus_process.poll() is None:
            print(f"Prometheus started successfully with PID {prometheus_process.pid}")
            return True
        else:
            stdout, stderr = prometheus_process.communicate()
            print(f"Prometheus failed to start: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"Error starting Prometheus: {e}")
        return False

def stop_prometheus():
    """Stop Prometheus server"""
    global prometheus_process
    
    try:
        if prometheus_process and prometheus_process.poll() is None:
            # Terminate gracefully
            os.killpg(os.getpgid(prometheus_process.pid), signal.SIGTERM)
            
            # Wait for process to terminate
            for _ in range(10):
                if prometheus_process.poll() is not None:
                    break
                time.sleep(1)
            
            # Force kill if still running
            if prometheus_process.poll() is None:
                os.killpg(os.getpgid(prometheus_process.pid), signal.SIGKILL)
            
            print("Prometheus stopped")
            prometheus_process = None
            return True
        else:
            print("Prometheus is not running")
            return True
            
    except Exception as e:
        print(f"Error stopping Prometheus: {e}")
        return False

def reload_prometheus():
    """Reload Prometheus configuration"""
    global prometheus_process
    
    try:
        if not prometheus_process or prometheus_process.poll() is not None:
            print("Prometheus is not running")
            return False
        
        # Generate new configuration
        if not write_prometheus_config():
            print("Failed to generate new configuration")
            return False
        
        # Send reload signal
        os.kill(prometheus_process.pid, signal.SIGHUP)
        print("Prometheus configuration reloaded")
        return True
        
    except Exception as e:
        print(f"Error reloading Prometheus: {e}")
        return False

# Flask routes
@app.route('/')
def index():
    """Main dashboard"""
    services = fetch_services()
    
    # Group services by organization
    org_services = {}
    for service in services:
        org_id = service['organization_id']
        if org_id not in org_services:
            org_services[org_id] = []
        org_services[org_id].append(service)
    
    # Check Prometheus status
    is_running = prometheus_process and prometheus_process.poll() is None
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Prometheus Multi-Org Manager</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
            .org-section { border: 1px solid #ddd; margin: 20px 0; padding: 15px; border-radius: 5px; }
            .monitoring-section { background: #e8f5e8; border: 1px solid #4CAF50; margin: 20px 0; padding: 15px; border-radius: 5px; }
            .service { background: #f9f9f9; margin: 10px 0; padding: 10px; border-radius: 3px; }
            .status-running { color: green; font-weight: bold; }
            .status-stopped { color: red; font-weight: bold; }
            button { padding: 10px 15px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
            .btn-start { background: #4CAF50; color: white; }
            .btn-stop { background: #f44336; color: white; }
            .btn-reload { background: #2196F3; color: white; }
            .btn-kill { background: #9C27B0; color: white; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Prometheus Multi-Organization Manager</h1>
            <p>Status: <span class="{{ 'status-running' if is_running else 'status-stopped' }}">
                {{ 'Running' if is_running else 'Stopped' }}
            </span></p>
            <button class="btn-start" onclick="controlPrometheus('start')">Start</button>
            <button class="btn-reload" onclick="controlPrometheus('reload')">Reload</button>
            <button class="btn-stop" onclick="controlPrometheus('stop')">Stop</button>
            <button class="btn-kill" onclick="controlPrometheus('kill-port')" title="Kill processes using port {{ PROMETHEUS_PORT }}">Kill Port {{ PROMETHEUS_PORT }}</button>
            <a href="http://localhost:{{ PROMETHEUS_PORT }}" target="_blank">
                <button style="background: #FF9800; color: white;">Open Prometheus UI</button>
            </a>
        </div>

        <div class="monitoring-section">
            <h2>Service Monitoring</h2>
            <p>Auto-monitoring: <span id="monitoring-status">Loading...</span></p>
            <button class="btn-start" onclick="controlMonitoring('start')">Start Monitoring</button>
            <button class="btn-stop" onclick="controlMonitoring('stop')">Stop Monitoring</button>
            <button class="btn-reload" onclick="checkMonitoringStatus()">Refresh Status</button>
        </div>

        <h2>Organizations & Services ({{ total_services }} services)</h2>
        
        {% for org_id, services in org_services.items() %}
        <div class="org-section">
            <h3>Organization: {{ org_id }}</h3>
            {% for service in services %}
            <div class="service">
                <strong>{{ service.service_id }}</strong> - {{ service.name }}<br>
                <small>URL: <a href="{{ service.metric_url }}" target="_blank">{{ service.metric_url }}</a></small>
            </div>
            {% endfor %}
        </div>
        {% endfor %}
        
        {% if not org_services %}
        <p>No services found in database. Please add services to the 'services' table.</p>
        {% endif %}
        
        <script>
            function controlPrometheus(action) {
                fetch(`/api/prometheus/${action}`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        alert(data.message || data.error);
                        if (data.message) {
                            setTimeout(() => location.reload(), 2000);
                        }
                    })
                    .catch(error => {
                        alert('Error: ' + error);
                    });
            }

            function controlMonitoring(action) {
                fetch(`/api/monitoring/${action}`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        alert(data.message || data.error);
                        if (data.message) {
                            setTimeout(() => checkMonitoringStatus(), 1000);
                        }
                    })
                    .catch(error => {
                        alert('Error: ' + error);
                    });
            }

            function checkMonitoringStatus() {
                fetch('/api/monitoring/status')
                    .then(response => response.json())
                    .then(data => {
                        const statusElement = document.getElementById('monitoring-status');
                        if (data.active) {
                            statusElement.innerHTML = `<span style="color: green;">Active (${data.interval}s interval)</span>`;
                        } else {
                            statusElement.innerHTML = '<span style="color: red;">Inactive</span>';
                        }
                    })
                    .catch(error => {
                        document.getElementById('monitoring-status').innerHTML = '<span style="color: red;">Error loading status</span>';
                    });
            }

            // Check monitoring status on page load
            document.addEventListener('DOMContentLoaded', checkMonitoringStatus);
        </script>
    </body>
    </html>
    """
    
    return render_template_string(html_template,
                                org_services=org_services,
                                is_running=is_running,
                                total_services=len(services),
                                PROMETHEUS_PORT=PROMETHEUS_PORT)

@app.route('/api/services')
def api_services():
    """Get all services"""
    services = fetch_services()
    return jsonify(services)

@app.route('/api/organizations/<organization_id>')
def api_organization(organization_id):
    """Get organization information by ID"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor()
        query = """
        SELECT id, name
        FROM organizations
        WHERE id = %s
        """
        cursor.execute(query, (organization_id,))
        org = cursor.fetchone()
        cursor.close()
        conn.close()

        if org:
            return jsonify({
                'id': org[0],
                'name': org[1]
            })
        else:
            return jsonify({'error': 'Organization not found'}), 404

    except Exception as e:
        print(f"Error fetching organization: {e}")
        if conn:
            conn.close()
        return jsonify({'error': 'Failed to fetch organization'}), 500

@app.route('/api/organizations/<organization_id>/services')
def api_organization_services(organization_id):
    """Get services for a specific organization"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor()
        query = """
        SELECT service_id, metric_url, organization_id, name
        FROM public.services
        WHERE organization_id = %s
        ORDER BY service_id
        """
        cursor.execute(query, (organization_id,))
        services = cursor.fetchall()
        cursor.close()
        conn.close()

        # Convert to list of dictionaries
        service_list = []
        for service in services:
            service_list.append({
                'service_id': service[0],
                'metric_url': service[1],
                'organization_id': service[2],
                'name': service[3]
            })

        return jsonify(service_list)

    except Exception as e:
        print(f"Error fetching organization services: {e}")
        if conn:
            conn.close()
        return jsonify({'error': 'Failed to fetch services'}), 500

@app.route('/api/prometheus/start', methods=['POST'])
def api_start_prometheus():
    """Start Prometheus"""
    success = start_prometheus()
    if success:
        return jsonify({'message': 'Prometheus started successfully'})
    else:
        return jsonify({'error': 'Failed to start Prometheus'}), 500

@app.route('/api/prometheus/stop', methods=['POST'])
def api_stop_prometheus():
    """Stop Prometheus"""
    success = stop_prometheus()
    if success:
        return jsonify({'message': 'Prometheus stopped successfully'})
    else:
        return jsonify({'error': 'Failed to stop Prometheus'}), 500

@app.route('/api/prometheus/reload', methods=['POST'])
def api_reload_prometheus():
    """Reload Prometheus configuration"""
    success = reload_prometheus()
    if success:
        return jsonify({'message': 'Prometheus configuration reloaded successfully'})
    else:
        return jsonify({'error': 'Failed to reload Prometheus configuration'}), 500

@app.route('/api/prometheus/kill-port', methods=['POST'])
def api_kill_prometheus_port():
    """Kill any processes using the Prometheus port"""
    try:
        success = kill_processes_on_port(PROMETHEUS_PORT)
        if success:
            return jsonify({'message': f'Successfully cleaned port {PROMETHEUS_PORT}'})
        else:
            return jsonify({'error': f'Failed to clean port {PROMETHEUS_PORT}'}), 500
    except Exception as e:
        return jsonify({'error': f'Error cleaning port {PROMETHEUS_PORT}: {str(e)}'}), 500

@app.route('/api/config')
def api_config():
    """Get current Prometheus configuration"""
    config = generate_prometheus_config()
    if config:
        return jsonify(config)
    else:
        return jsonify({'error': 'Failed to generate configuration'}), 500

@app.route('/api/monitoring/start', methods=['POST'])
def api_start_monitoring():
    """Start background service monitoring"""
    try:
        start_monitoring()
        return jsonify({'message': 'Service monitoring started successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to start monitoring: {str(e)}'}), 500

@app.route('/api/monitoring/stop', methods=['POST'])
def api_stop_monitoring():
    """Stop background service monitoring"""
    try:
        stop_monitoring()
        return jsonify({'message': 'Service monitoring stopped successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to stop monitoring: {str(e)}'}), 500

@app.route('/api/monitoring/status')
def api_monitoring_status():
    """Get monitoring status"""
    global monitoring_active, monitoring_thread, last_services_hash

    is_active = monitoring_active and monitoring_thread and monitoring_thread.is_alive()

    return jsonify({
        'active': is_active,
        'interval': MONITOR_INTERVAL,
        'last_check_hash': last_services_hash[:8] + '...' if last_services_hash else None,
        'thread_alive': monitoring_thread.is_alive() if monitoring_thread else False
    })

def cleanup_on_exit():
    """Cleanup function to stop monitoring and Prometheus on exit"""
    print("\n🧹 Cleaning up...")
    stop_monitoring()
    stop_prometheus()
    print("✅ Cleanup completed")

if __name__ == '__main__':
    import atexit

    print("Starting Prometheus Multi-Organization Manager...")
    print(f"Database URL: {DATABASE_URL}")
    print(f"Prometheus config will be written to: {PROMETHEUS_CONFIG_PATH}")
    print(f"Prometheus will run on port: {PROMETHEUS_PORT}")
    print(f"Service monitoring interval: {MONITOR_INTERVAL} seconds")

    # Register cleanup function
    atexit.register(cleanup_on_exit)

    # Generate initial configuration and set initial hash
    write_prometheus_config()
    initial_services = fetch_services()
    last_services_hash = get_services_hash(initial_services)
    print(f"📊 Initial services loaded: {len(initial_services)} services")

    # Start background monitoring
    start_monitoring()

    try:
        # Start Flask app
        app.run(host=FLASK_HOST, port=FLASK_PORT, debug=True)
    except KeyboardInterrupt:
        print("\n⚠️  Received interrupt signal")
        cleanup_on_exit()
