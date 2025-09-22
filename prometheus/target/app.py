#!/usr/bin/env python3
"""
Simple Flask app with Prometheus metrics - Target service for scraping
"""

import time
import random
import os
from flask import Flask, request, jsonify
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    'flask_requests_total',
    'Total number of HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'flask_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

ACTIVE_CONNECTIONS = Gauge(
    'flask_active_connections',
    'Number of active connections'
)

CPU_USAGE = Gauge(
    'system_cpu_usage_percent',
    'System CPU usage percentage'
)

MEMORY_USAGE = Gauge(
    'system_memory_usage_bytes',
    'System memory usage in bytes'
)

DATABASE_CONNECTIONS = Gauge(
    'database_connections_active',
    'Number of active database connections'
)

QUEUE_SIZE = Gauge(
    'task_queue_size',
    'Number of tasks in queue'
)

ERROR_COUNT = Counter(
    'application_errors_total',
    'Total number of application errors',
    ['error_type']
)

# Global variables for tracking
active_connections = 0
start_time = time.time()

@app.before_request
def before_request():
    """Track request start time and increment active connections"""
    global active_connections
    
    # Increment active connections
    active_connections += 1
    ACTIVE_CONNECTIONS.set(active_connections)
    
    # Store request start time
    request.start_time = time.time()
    
    # Simulate some system metrics with realistic values
    CPU_USAGE.set(random.uniform(10, 80))  # CPU usage between 10-80%
    MEMORY_USAGE.set(random.uniform(1e9, 4e9))  # Memory usage between 1-4GB
    DATABASE_CONNECTIONS.set(random.randint(5, 25))  # DB connections 5-25
    QUEUE_SIZE.set(random.randint(0, 100))  # Queue size 0-100

@app.after_request
def after_request(response):
    """Track request completion and metrics"""
    global active_connections
    
    # Decrement active connections
    active_connections -= 1
    ACTIVE_CONNECTIONS.set(active_connections)
    
    # Calculate request duration
    if hasattr(request, 'start_time'):
        duration = time.time() - request.start_time
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.endpoint or 'unknown'
        ).observe(duration)
    
    # Count requests by method, endpoint, and status
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.endpoint or 'unknown',
        status=response.status_code
    ).inc()
    
    # Simulate occasional errors
    if random.random() < 0.05:  # 5% chance of error
        error_types = ['database_error', 'timeout_error', 'validation_error']
        ERROR_COUNT.labels(error_type=random.choice(error_types)).inc()
    
    return response

@app.route('/')
def index():
    """Main endpoint"""
    # Simulate some processing time
    time.sleep(random.uniform(0.01, 0.1))
    
    uptime = time.time() - start_time
    
    return jsonify({
        'service': 'Target Flask App',
        'status': 'healthy',
        'uptime_seconds': round(uptime, 2),
        'active_connections': active_connections,
        'message': 'This is a target service for Prometheus scraping'
    })

@app.route('/api/data')
def api_data():
    """API endpoint that returns some data"""
    # Simulate variable processing time
    time.sleep(random.uniform(0.05, 0.3))
    
    # Simulate occasional errors
    if random.random() < 0.1:  # 10% chance of error
        ERROR_COUNT.labels(error_type='api_error').inc()
        return jsonify({'error': 'Simulated API error'}), 500
    
    return jsonify({
        'data': [
            {'id': i, 'value': random.randint(1, 1000)}
            for i in range(random.randint(5, 20))
        ],
        'timestamp': time.time(),
        'processing_time': random.uniform(0.05, 0.3)
    })

@app.route('/api/slow')
def slow_endpoint():
    """Slow endpoint to generate interesting metrics"""
    # Simulate slow processing
    time.sleep(random.uniform(1, 3))
    
    return jsonify({
        'message': 'This was a slow operation',
        'duration': 'variable'
    })

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time()
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    ERROR_COUNT.labels(error_type='not_found').inc()
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    ERROR_COUNT.labels(error_type='internal_error').inc()
    return jsonify({'error': 'Internal server error'}), 500

# Background task simulation
def simulate_background_activity():
    """Simulate background activity that affects metrics"""
    import threading
    import time
    
    def background_worker():
        while True:
            # Simulate background database operations
            DATABASE_CONNECTIONS.set(random.randint(3, 30))
            
            # Simulate queue processing
            current_queue = QUEUE_SIZE._value._value if hasattr(QUEUE_SIZE._value, '_value') else 0
            new_queue_size = max(0, current_queue + random.randint(-5, 10))
            QUEUE_SIZE.set(new_queue_size)
            
            # Simulate CPU spikes
            if random.random() < 0.1:  # 10% chance of CPU spike
                CPU_USAGE.set(random.uniform(80, 95))
            else:
                CPU_USAGE.set(random.uniform(15, 60))
            
            time.sleep(5)  # Update every 5 seconds
    
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    host = os.getenv('HOST', '0.0.0.0')
    
    print(f"🎯 Starting Target Flask App...")
    print(f"🌐 Server: http://{host}:{port}")
    print(f"📊 Metrics: http://{host}:{port}/metrics")
    print(f"❤️  Health: http://{host}:{port}/health")
    
    # Start background activity simulation
    simulate_background_activity()
    
    app.run(host=host, port=port, debug=True)
