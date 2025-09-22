#!/usr/bin/env python3
"""
Simple Flask app that configures Prometheus server - Demo version with mock data
"""

import os
import yaml
import subprocess
import signal
import psutil
import time
from urllib.parse import urlparse
from flask import Flask, jsonify, render_template_string
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
PROMETHEUS_CONFIG_PATH = os.getenv('PROMETHEUS_CONFIG_PATH', './prometheus.yml')
PROMETHEUS_BINARY_PATH = os.getenv('PROMETHEUS_BINARY_PATH', 'prometheus')
PROMETHEUS_DATA_DIR = os.getenv('PROMETHEUS_DATA_DIR', './prometheus_data')
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))

# Global variables
prometheus_process = None

def get_mock_services():
    """Get mock services data (simulating database query)"""
    return [
        {
            'service_id': 'Service-20',
            'metric_url': 'https://abc.com/metrics',
            'organization_id': '550e8400-e29b-41d4-a716-446655440001',
            'name': 'Web API'
        },
        {
            'service_id': 'Service-40',
            'metric_url': 'https://xyz.com/metrics',
            'organization_id': '550e8400-e29b-41d4-a716-446655440001',
            'name': 'Database Service'
        },
        {
            'service_id': 'service-100',
            'metric_url': 'https://mno.com/metrics',
            'organization_id': '550e8400-e29b-41d4-a716-446655440002',
            'name': 'Load Balancer'
        }
    ]

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
    """Generate Prometheus configuration based on services"""
    services = get_mock_services()
    
    if not services:
        print("No services found")
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
        'static_configs': [{'targets': ['localhost:9090']}]
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

def start_prometheus():
    """Start Prometheus server"""
    global prometheus_process
    
    try:
        # Check if already running
        if prometheus_process and prometheus_process.poll() is None:
            print("Prometheus is already running")
            return True
        
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
            '--web.listen-address=0.0.0.0:9090'
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
    services = get_mock_services()
    
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
        <title>Prometheus Multi-Org Manager - Demo</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .org-section { background: #fff; border: 1px solid #ddd; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .service { background: #f9f9f9; margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #007cba; }
            .status-running { color: #28a745; font-weight: bold; }
            .status-stopped { color: #dc3545; font-weight: bold; }
            button { padding: 12px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
            .btn-start { background: #28a745; color: white; }
            .btn-stop { background: #dc3545; color: white; }
            .btn-reload { background: #007bff; color: white; }
            .btn-prometheus { background: #ff6b35; color: white; }
            .demo-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .config-preview { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin-top: 20px; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        </style>
    </head>
    <body>
        <div class="demo-notice">
            <strong>🚀 Demo Mode:</strong> This is running with mock data. In production, it would connect to your PostgreSQL database.
        </div>
        
        <div class="header">
            <h1>🔥 Prometheus Multi-Organization Manager</h1>
            <p>Status: <span class="{{ 'status-running' if is_running else 'status-stopped' }}">
                {{ 'Running' if is_running else 'Stopped' }}
            </span></p>
            <button class="btn-start" onclick="controlPrometheus('start')">▶️ Start</button>
            <button class="btn-reload" onclick="controlPrometheus('reload')">🔄 Reload</button>
            <button class="btn-stop" onclick="controlPrometheus('stop')">⏹️ Stop</button>
            <a href="http://localhost:9090" target="_blank">
                <button class="btn-prometheus">📊 Open Prometheus UI</button>
            </a>
        </div>
        
        <h2>📋 Organizations & Services ({{ total_services }} services)</h2>
        
        {% for org_id, services in org_services.items() %}
        <div class="org-section">
            <h3>🏢 Organization: {{ org_id[:8] }}...</h3>
            {% for service in services %}
            <div class="service">
                <strong>🔧 {{ service.service_id }}</strong> - {{ service.name }}<br>
                <small>🌐 URL: <a href="{{ service.metric_url }}" target="_blank">{{ service.metric_url }}</a></small>
            </div>
            {% endfor %}
        </div>
        {% endfor %}
        
        <div class="config-preview">
            <h3>📄 Generated Prometheus Configuration Preview</h3>
            <button onclick="showConfig()" style="background: #6c757d; color: white; padding: 8px 15px; border: none; border-radius: 3px;">View Config</button>
            <pre id="configContent" style="display: none; margin-top: 10px;"></pre>
        </div>
        
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
            
            function showConfig() {
                const configContent = document.getElementById('configContent');
                if (configContent.style.display === 'none') {
                    fetch('/api/config')
                        .then(response => response.json())
                        .then(data => {
                            configContent.textContent = JSON.stringify(data, null, 2);
                            configContent.style.display = 'block';
                        })
                        .catch(error => {
                            configContent.textContent = 'Error loading config: ' + error;
                            configContent.style.display = 'block';
                        });
                } else {
                    configContent.style.display = 'none';
                }
            }
        </script>
    </body>
    </html>
    """
    
    return render_template_string(html_template, 
                                org_services=org_services, 
                                is_running=is_running,
                                total_services=len(services))

@app.route('/api/services')
def api_services():
    """Get all services"""
    services = get_mock_services()
    return jsonify(services)

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

@app.route('/api/config')
def api_config():
    """Get current Prometheus configuration"""
    config = generate_prometheus_config()
    if config:
        return jsonify(config)
    else:
        return jsonify({'error': 'Failed to generate configuration'}), 500

if __name__ == '__main__':
    print("🚀 Starting Prometheus Multi-Organization Manager (Demo Mode)...")
    print(f"📊 Prometheus config will be written to: {PROMETHEUS_CONFIG_PATH}")
    print(f"🌐 Web interface: http://localhost:{FLASK_PORT}")
    print(f"📈 Prometheus UI: http://localhost:9090 (after starting)")
    
    # Generate initial configuration
    write_prometheus_config()
    
    # Start Flask app
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=True)
