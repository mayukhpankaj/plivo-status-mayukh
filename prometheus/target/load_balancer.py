#!/usr/bin/env python3
"""
Load Balancer Service - Simulates load balancer metrics for service-100
"""

import time
import random
import os
from flask import Flask, request, jsonify
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Load balancer specific metrics
LB_REQUESTS_TOTAL = Counter(
    'loadbalancer_requests_total',
    'Total requests through load balancer',
    ['backend', 'status']
)

LB_REQUEST_DURATION = Histogram(
    'loadbalancer_request_duration_seconds',
    'Request duration through load balancer',
    ['backend']
)

LB_ACTIVE_CONNECTIONS = Gauge(
    'loadbalancer_active_connections',
    'Active connections to load balancer'
)

LB_BACKEND_UP = Gauge(
    'loadbalancer_backend_up',
    'Backend server status (1=up, 0=down)',
    ['backend']
)

LB_BACKEND_RESPONSE_TIME = Gauge(
    'loadbalancer_backend_response_time_seconds',
    'Backend server response time',
    ['backend']
)

LB_QUEUE_SIZE = Gauge(
    'loadbalancer_queue_size',
    'Number of requests in queue'
)

LB_THROUGHPUT = Gauge(
    'loadbalancer_throughput_requests_per_second',
    'Current throughput in requests per second'
)

LB_ERROR_RATE = Gauge(
    'loadbalancer_error_rate',
    'Current error rate percentage'
)

LB_SSL_CONNECTIONS = Counter(
    'loadbalancer_ssl_connections_total',
    'Total SSL connections'
)

# Global state
active_connections = 0
backends = ['backend-1', 'backend-2', 'backend-3']
start_time = time.time()
request_count = 0

@app.before_request
def before_request():
    """Simulate load balancer request handling"""
    global active_connections, request_count
    
    active_connections += 1
    request_count += 1
    LB_ACTIVE_CONNECTIONS.set(active_connections)
    
    # Update backend status (simulate occasional backend failures)
    for backend in backends:
        is_up = random.random() > 0.05  # 95% uptime
        LB_BACKEND_UP.labels(backend=backend).set(1 if is_up else 0)
        
        # Update backend response times
        if is_up:
            response_time = random.uniform(0.01, 0.5)
        else:
            response_time = 10.0  # High response time for down backends
        LB_BACKEND_RESPONSE_TIME.labels(backend=backend).set(response_time)
    
    # Update queue size
    LB_QUEUE_SIZE.set(random.randint(0, 50))
    
    # Calculate throughput (requests per second over last minute)
    current_time = time.time()
    uptime = current_time - start_time
    if uptime > 0:
        throughput = request_count / uptime
        LB_THROUGHPUT.set(throughput)
    
    # Simulate SSL connections
    if random.random() < 0.8:  # 80% of connections use SSL
        LB_SSL_CONNECTIONS.inc()
    
    request.start_time = time.time()
    request.selected_backend = random.choice(backends)

@app.after_request
def after_request(response):
    """Track load balancer request completion"""
    global active_connections
    
    active_connections = max(0, active_connections - 1)
    LB_ACTIVE_CONNECTIONS.set(active_connections)
    
    if hasattr(request, 'start_time') and hasattr(request, 'selected_backend'):
        duration = time.time() - request.start_time
        backend = request.selected_backend
        
        # Record request duration for the selected backend
        LB_REQUEST_DURATION.labels(backend=backend).observe(duration)
        
        # Record request count by backend and status
        status = 'success' if response.status_code < 400 else 'error'
        LB_REQUESTS_TOTAL.labels(backend=backend, status=status).inc()
    
    # Calculate current error rate
    if request_count > 0:
        # Simulate error rate between 1-5%
        error_rate = random.uniform(1, 5)
        LB_ERROR_RATE.set(error_rate)
    
    return response

@app.route('/')
def index():
    """Load balancer status"""
    time.sleep(random.uniform(0.01, 0.03))  # Simulate routing time
    
    # Check backend health
    healthy_backends = sum(1 for backend in backends 
                          if random.random() > 0.05)  # 95% chance each is healthy
    
    return jsonify({
        'service': 'Load Balancer',
        'type': 'HAProxy',
        'status': 'healthy',
        'active_connections': active_connections,
        'healthy_backends': healthy_backends,
        'total_backends': len(backends),
        'uptime_seconds': round(time.time() - start_time, 2)
    })

@app.route('/api/route/<path:path>')
def route_request(path):
    """Simulate routing requests to backends"""
    # Simulate backend selection and routing time
    backend = random.choice(backends)
    routing_time = random.uniform(0.05, 0.2)
    time.sleep(routing_time)
    
    # Simulate backend response
    if random.random() < 0.95:  # 95% success rate
        return jsonify({
            'routed_to': backend,
            'path': path,
            'routing_time_ms': routing_time * 1000,
            'status': 'success'
        })
    else:
        return jsonify({
            'error': 'Backend unavailable',
            'attempted_backend': backend
        }), 502

@app.route('/api/health-check')
def health_check():
    """Health check for all backends"""
    backend_status = {}
    
    for backend in backends:
        # Simulate health check
        is_healthy = random.random() > 0.1  # 90% chance of being healthy
        response_time = random.uniform(0.01, 0.1) if is_healthy else 5.0
        
        backend_status[backend] = {
            'healthy': is_healthy,
            'response_time_ms': response_time * 1000
        }
    
    return jsonify({
        'backends': backend_status,
        'overall_health': 'healthy' if any(b['healthy'] for b in backend_status.values()) else 'unhealthy'
    })

@app.route('/stats')
def stats():
    """Load balancer statistics"""
    return jsonify({
        'active_connections': active_connections,
        'total_requests': request_count,
        'uptime_seconds': round(time.time() - start_time, 2),
        'backends': len(backends),
        'ssl_percentage': 80
    })

@app.route('/health')
def health():
    """Load balancer health"""
    return jsonify({
        'status': 'healthy',
        'active_connections': active_connections
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

def simulate_background_lb_activity():
    """Simulate background load balancer activity"""
    import threading
    
    def background_worker():
        while True:
            # Simulate traffic spikes
            if random.random() < 0.1:  # 10% chance of traffic spike
                spike_connections = random.randint(50, 200)
                LB_ACTIVE_CONNECTIONS.set(spike_connections)
                time.sleep(2)  # Spike lasts 2 seconds
            
            # Simulate backend health changes
            for backend in backends:
                if random.random() < 0.02:  # 2% chance of status change
                    current_status = LB_BACKEND_UP.labels(backend=backend)._value._value
                    new_status = 0 if current_status == 1 else 1
                    LB_BACKEND_UP.labels(backend=backend).set(new_status)
            
            # Update queue size based on load
            current_connections = LB_ACTIVE_CONNECTIONS._value._value
            queue_size = max(0, current_connections - 100 + random.randint(-10, 20))
            LB_QUEUE_SIZE.set(queue_size)
            
            time.sleep(5)  # Update every 5 seconds
    
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8082))
    host = os.getenv('HOST', '0.0.0.0')
    
    print(f"⚖️  Starting Load Balancer Service...")
    print(f"🌐 Server: http://{host}:{port}")
    print(f"📊 Metrics: http://{host}:{port}/metrics")
    
    simulate_background_lb_activity()
    
    app.run(host=host, port=port, debug=True)
