# Target Flask App - Prometheus Metrics Generator

This is a simple Flask application that generates sample metrics for Prometheus scraping. It uses `@app.before_request` and `@app.after_request` decorators to track request metrics and simulate system metrics.

## Features

- **Request Metrics**: Tracks HTTP requests, duration, and status codes
- **System Metrics**: Simulates CPU usage, memory usage, database connections
- **Error Simulation**: Generates random errors for realistic monitoring
- **Background Activity**: Simulates background processes affecting metrics
- **Multiple Endpoints**: Different endpoints with varying response times

## Metrics Generated

### Request Metrics
- `flask_requests_total` - Total HTTP requests by method, endpoint, status
- `flask_request_duration_seconds` - Request duration histogram
- `flask_active_connections` - Current active connections

### System Metrics
- `system_cpu_usage_percent` - Simulated CPU usage (10-80%)
- `system_memory_usage_bytes` - Simulated memory usage (1-4GB)
- `database_connections_active` - Simulated DB connections (5-25)
- `task_queue_size` - Simulated task queue size (0-100)

### Error Metrics
- `application_errors_total` - Application errors by type

## Setup

1. **Install dependencies**:
   ```bash
   cd target
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Run the application**:
   ```bash
   python app.py
   ```

3. **Access the application**:
   - Main app: http://localhost:8080
   - Metrics: http://localhost:8080/metrics
   - Health: http://localhost:8080/health

## Endpoints

- `GET /` - Main endpoint with service info
- `GET /api/data` - API endpoint with variable response time
- `GET /api/slow` - Slow endpoint (1-3 seconds)
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics endpoint

## Usage with Main Prometheus Manager

This target app is designed to work with the main Prometheus manager. To integrate:

1. **Update the services table** in your database:
   ```sql
   UPDATE public.services 
   SET metric_url = 'http://localhost:8080/metrics' 
   WHERE service_id = 'Service-20';
   ```

2. **Or add a new service**:
   ```sql
   INSERT INTO public.services (service_id, name, metric_url, user_id, organization_id)
   VALUES ('target-app', 'Target Flask App', 'http://localhost:8080/metrics', 'your-user-id', 'your-org-id');
   ```

3. **Reload Prometheus configuration** from the main app dashboard

## Generating Traffic

To generate interesting metrics, you can create some traffic:

```bash
# Generate requests
for i in {1..100}; do
  curl http://localhost:8080/ &
  curl http://localhost:8080/api/data &
  curl http://localhost:8080/health &
done

# Generate slow requests
for i in {1..10}; do
  curl http://localhost:8080/api/slow &
done
```

## Environment Variables

- `HOST` - Server host (default: 0.0.0.0)
- `PORT` - Server port (default: 8080)

## How It Works

### @app.before_request
- Increments active connection counter
- Records request start time
- Updates simulated system metrics (CPU, memory, etc.)

### @app.after_request
- Decrements active connection counter
- Calculates and records request duration
- Increments request counter with labels
- Simulates occasional errors

### Background Thread
- Continuously updates system metrics
- Simulates database connection changes
- Simulates queue size fluctuations
- Creates realistic CPU usage patterns

This creates a realistic target service that generates meaningful metrics for your Prometheus monitoring setup!
