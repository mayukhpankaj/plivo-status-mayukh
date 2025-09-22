#!/usr/bin/env python3
"""
Database Service - Simulates database metrics for Service-40
"""

import time
import random
import os
from flask import Flask, request, jsonify
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Database-specific metrics
DB_CONNECTIONS_TOTAL = Counter(
    'database_connections_total',
    'Total database connections created'
)

DB_QUERY_DURATION = Histogram(
    'database_query_duration_seconds',
    'Database query duration in seconds',
    ['query_type']
)

DB_ACTIVE_CONNECTIONS = Gauge(
    'database_active_connections',
    'Currently active database connections'
)

DB_SLOW_QUERIES = Counter(
    'database_slow_queries_total',
    'Total number of slow queries'
)

DB_DEADLOCKS = Counter(
    'database_deadlocks_total',
    'Total number of deadlocks'
)

DB_CACHE_HIT_RATIO = Gauge(
    'database_cache_hit_ratio',
    'Database cache hit ratio'
)

DB_TABLE_SIZE = Gauge(
    'database_table_size_bytes',
    'Database table size in bytes',
    ['table_name']
)

DB_TRANSACTIONS_TOTAL = Counter(
    'database_transactions_total',
    'Total database transactions',
    ['status']
)

# Global state
active_connections = 0
start_time = time.time()

@app.before_request
def before_request():
    """Simulate database connection and metrics updates"""
    global active_connections
    
    # Simulate new connection
    active_connections += random.randint(1, 3)
    DB_ACTIVE_CONNECTIONS.set(active_connections)
    DB_CONNECTIONS_TOTAL.inc()
    
    # Update cache hit ratio (typically high for healthy DB)
    DB_CACHE_HIT_RATIO.set(random.uniform(0.85, 0.98))
    
    # Update table sizes (simulate growth)
    tables = ['users', 'orders', 'products', 'logs']
    for table in tables:
        size = random.uniform(1e8, 1e10)  # 100MB to 10GB
        DB_TABLE_SIZE.labels(table_name=table).set(size)
    
    request.start_time = time.time()

@app.after_request
def after_request(response):
    """Track database operations completion"""
    global active_connections
    
    # Simulate connection release
    active_connections = max(0, active_connections - random.randint(1, 2))
    DB_ACTIVE_CONNECTIONS.set(active_connections)
    
    # Simulate query execution
    if hasattr(request, 'start_time'):
        duration = time.time() - request.start_time
        
        # Classify query type based on endpoint
        if 'read' in request.path:
            query_type = 'SELECT'
        elif 'write' in request.path:
            query_type = 'INSERT'
        else:
            query_type = 'SELECT'
        
        DB_QUERY_DURATION.labels(query_type=query_type).observe(duration)
        
        # Simulate slow queries (queries > 1 second)
        if duration > 1.0:
            DB_SLOW_QUERIES.inc()
    
    # Simulate transaction outcomes
    if random.random() < 0.95:  # 95% success rate
        DB_TRANSACTIONS_TOTAL.labels(status='committed').inc()
    else:
        DB_TRANSACTIONS_TOTAL.labels(status='rolled_back').inc()
    
    # Simulate occasional deadlocks
    if random.random() < 0.001:  # 0.1% chance
        DB_DEADLOCKS.inc()
    
    return response

@app.route('/')
def index():
    """Database service status"""
    time.sleep(random.uniform(0.01, 0.05))  # Simulate DB query time
    
    return jsonify({
        'service': 'Database Service',
        'type': 'PostgreSQL',
        'status': 'healthy',
        'active_connections': active_connections,
        'uptime_seconds': round(time.time() - start_time, 2)
    })

@app.route('/api/read')
def read_data():
    """Simulate database read operations"""
    # Simulate SELECT query time
    time.sleep(random.uniform(0.1, 0.5))
    
    return jsonify({
        'operation': 'SELECT',
        'rows_returned': random.randint(1, 1000),
        'execution_time_ms': random.uniform(100, 500)
    })

@app.route('/api/write')
def write_data():
    """Simulate database write operations"""
    # Simulate INSERT/UPDATE query time
    time.sleep(random.uniform(0.2, 0.8))
    
    return jsonify({
        'operation': 'INSERT',
        'rows_affected': random.randint(1, 10),
        'execution_time_ms': random.uniform(200, 800)
    })

@app.route('/api/heavy-query')
def heavy_query():
    """Simulate heavy database operations"""
    # Simulate complex query
    time.sleep(random.uniform(2, 5))
    
    return jsonify({
        'operation': 'COMPLEX_JOIN',
        'rows_processed': random.randint(10000, 100000),
        'execution_time_ms': random.uniform(2000, 5000)
    })

@app.route('/health')
def health():
    """Database health check"""
    return jsonify({
        'status': 'healthy',
        'connections': active_connections,
        'cache_hit_ratio': random.uniform(0.85, 0.98)
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

def simulate_background_db_activity():
    """Simulate background database activity"""
    import threading
    
    def background_worker():
        while True:
            # Simulate background maintenance
            if random.random() < 0.1:  # 10% chance of maintenance activity
                DB_QUERY_DURATION.labels(query_type='VACUUM').observe(random.uniform(5, 30))
            
            # Simulate periodic cache updates
            DB_CACHE_HIT_RATIO.set(random.uniform(0.80, 0.99))
            
            # Simulate connection pool fluctuations
            global active_connections
            active_connections = max(5, active_connections + random.randint(-2, 3))
            DB_ACTIVE_CONNECTIONS.set(active_connections)
            
            time.sleep(10)  # Update every 10 seconds
    
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8081))
    host = os.getenv('HOST', '0.0.0.0')
    
    print(f"🗄️  Starting Database Service...")
    print(f"🌐 Server: http://{host}:{port}")
    print(f"📊 Metrics: http://{host}:{port}/metrics")
    
    simulate_background_db_activity()
    
    app.run(host=host, port=port, debug=True)
