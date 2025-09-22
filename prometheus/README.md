# Prometheus Multi-Organization Status Monitor

A comprehensive monitoring solution that provides organization-specific status pages for Prometheus-monitored services. The system consists of a Flask backend that manages Prometheus configuration and a React frontend that displays real-time status information for each organization.

## Features

### Backend
- **Database-driven Configuration**: Reads services from PostgreSQL database
- **Multi-Organization Support**: Groups services by organization_id
- **Dynamic Prometheus Config**: Automatically generates prometheus.yml
- **Automatic Service Monitoring**: Background monitoring detects new/changed services
- **Auto-reconfiguration**: Automatically reloads Prometheus when services change
- **Web Interface**: Simple dashboard to view services and control Prometheus
- **REST API**: Endpoints to start, stop, and reload Prometheus
- **Organization APIs**: Endpoints to fetch organization and service data

### Frontend
- **Organization-specific URLs**: Each organization has its own status page at `/:organizationId`
- **Real-time Monitoring**: Displays service status, uptime, and performance metrics
- **Interactive Timeline**: Navigate through different time periods (24-hour windows)
- **Service Health Visualization**: Color-coded status bars for each service
- **Responsive Design**: Built with React and Tailwind CSS

## Database Schema

The application expects a `services` table with the following structure:

```sql
create table public.services (
  id uuid not null default gen_random_uuid (),
  service_id text not null,
  name text not null,
  metric_url text not null,
  user_id uuid not null,
  organization_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint services_pkey primary key (id),
  constraint services_service_id_key unique (service_id),
  constraint services_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint services_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
);
```

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   Edit `.env` file and set your database URL:
   ```
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.bjrtseecqtwenrebmkbx.supabase.co:5432/postgres
   ```

3. **Install Prometheus**:
   - Download from https://prometheus.io/download/
   - Or install via package manager:
     ```bash
     # Ubuntu/Debian
     sudo apt-get install prometheus
     
     # macOS
     brew install prometheus
     ```

4. **Add sample data** (optional):
   ```sql
   -- Insert sample organizations (if organizations table exists)
   INSERT INTO organizations (id, name) VALUES 
   ('550e8400-e29b-41d4-a716-446655440001', 'Development Team'),
   ('550e8400-e29b-41d4-a716-446655440002', 'Production Team');
   
   -- Insert sample services
   INSERT INTO services (service_id, name, metric_url, user_id, organization_id) VALUES 
   ('Service-20', 'Web API', 'https://abc.com/metrics', 'your-user-id', '550e8400-e29b-41d4-a716-446655440001'),
   ('Service-40', 'Database', 'https://xyz.com/metrics', 'your-user-id', '550e8400-e29b-41d4-a716-446655440001'),
   ('service-100', 'Load Balancer', 'https://mno.com/metrics', 'your-user-id', '550e8400-e29b-41d4-a716-446655440002');
   ```

5. **Run the application**:
   ```bash
   python app.py
   ```

## Quick Start

1. **Start the development environment**:
   ```bash
   ./start_dev.sh
   ```

2. **Or start manually**:

   **Backend**:
   ```bash
   source venv/bin/activate
   python app.py
   ```

   **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Usage

### Backend Web Interface
Open http://localhost:5000
- View all organizations and their services
- Start, stop, or reload Prometheus server
- Access Prometheus UI directly

### Frontend Status Pages
Open http://localhost:3000
- Browse available organizations
- Click on an organization to view its status page
- Each organization has a unique URL: `http://localhost:3000/{organizationId}`

### API Endpoints

**Service Management**:
- `GET /api/services` - List all services
- `GET /api/organizations/{orgId}` - Get organization information
- `GET /api/organizations/{orgId}/services` - Get services for an organization

**Prometheus Control**:
- `POST /api/prometheus/start` - Start Prometheus (with automatic port cleanup)
- `POST /api/prometheus/stop` - Stop Prometheus
- `POST /api/prometheus/reload` - Reload configuration
- `POST /api/prometheus/kill-port` - Kill any processes using the Prometheus port
- `GET /api/config` - View generated Prometheus config

**Service Monitoring Control**:
- `POST /api/monitoring/start` - Start background service monitoring
- `POST /api/monitoring/stop` - Stop background service monitoring
- `GET /api/monitoring/status` - Get monitoring status and configuration

## How it Works

1. **App Startup**:
   - Connects to PostgreSQL database
   - Queries all services from the `services` table
   - Generates initial Prometheus configuration
   - Starts background service monitoring

2. **Configuration Generation**:
   - Groups services by `organization_id`
   - Creates separate Prometheus jobs for each organization
   - Extracts host:port from `metric_url` for targets
   - Adds organization labels for better metric organization

3. **Automatic Service Monitoring**:
   - Background thread monitors the services table for changes
   - Detects new services, updated services, or removed services
   - Automatically regenerates Prometheus configuration when changes are detected
   - Hot-reloads Prometheus configuration without downtime

4. **Prometheus Management**:
   - Starts Prometheus with generated config
   - Supports hot-reloading when services change
   - Graceful shutdown and cleanup
   - Manages Prometheus process lifecycle

## Example Generated Configuration

For the sample data above, the app generates:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: org_550e8400-e29b-41d4-a716-446655440001
    scrape_interval: 30s
    metrics_path: /metrics
    static_configs:
      - targets: ['abc.com:443', 'xyz.com:443']
        labels:
          organization_id: '550e8400-e29b-41d4-a716-446655440001'
  
  - job_name: org_550e8400-e29b-41d4-a716-446655440002
    scrape_interval: 30s
    metrics_path: /metrics
    static_configs:
      - targets: ['mno.com:443']
        labels:
          organization_id: '550e8400-e29b-41d4-a716-446655440002'
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PROMETHEUS_CONFIG_PATH`: Path to prometheus.yml (default: ./prometheus.yml)
- `PROMETHEUS_BINARY_PATH`: Path to prometheus binary (default: prometheus)
- `PROMETHEUS_DATA_DIR`: Prometheus data directory (default: ./prometheus_data)
- `FLASK_HOST`: Flask host (default: 0.0.0.0)
- `FLASK_PORT`: Flask port (default: 5000)
- `MONITOR_INTERVAL`: Service monitoring interval in seconds (default: 30)

## Troubleshooting

1. **Database Connection Issues**: 
   - Verify DATABASE_URL is correct
   - Check network connectivity to Supabase
   - Ensure database credentials are valid

2. **Prometheus Not Starting**:
   - Verify prometheus binary is in PATH
   - Check if port is available (default: 9090)
   - Use the "Kill Port" button in the web interface to clean up port conflicts
   - Run `python kill_prometheus_port.py` to manually clean the port
   - Review generated prometheus.yml for syntax errors

3. **No Services Found**:
   - Verify services table exists and has data
   - Check database permissions
   - Review table schema matches expected format

## File Structure

```
prometheus-manager/
├── app.py                    # Main Flask application
├── requirements.txt          # Python dependencies
├── .env                     # Environment variables
├── README.md                # This file
├── prometheus.yml           # Generated Prometheus config
├── prometheus_data/         # Prometheus data directory
├── start_dev.sh            # Development startup script
└── frontend/               # React frontend application
    ├── package.json        # Frontend dependencies
    ├── vite.config.js      # Vite configuration
    ├── tailwind.config.js  # Tailwind CSS configuration
    ├── src/
    │   ├── App.jsx         # Main React app with routing
    │   ├── main.jsx        # React entry point
    │   ├── index.css       # Global styles
    │   └── components/
    │       ├── PrometheusStatusPage.jsx  # Organization status page
    │       └── OrganizationList.jsx      # Organization browser
    └── README.md           # Frontend documentation
```

## Frontend URLs

The React frontend provides organization-specific status pages:

- `http://localhost:3000/` - Organization browser/list
- `http://localhost:3000/{organizationId}` - Status page for specific organization

Example:
```
http://localhost:3000/550e8400-e29b-41d4-a716-446655440001
```

## Status Types

The frontend displays five different status types:

- **Operational** (Green) - Service is running normally
- **Degraded** (Yellow) - Service has performance issues
- **Partial Outage** (Orange) - Service is partially unavailable
- **Major Outage** (Red) - Service is completely down
- **No Data** (Gray) - No monitoring data available

## Testing Automatic Service Monitoring

To test the automatic service monitoring functionality:

1. **Start the Flask app** with monitoring enabled (it starts automatically)
2. **Run the test script** to simulate service changes:
   ```bash
   python test_monitoring.py
   ```
3. **Watch the Flask app logs** to see automatic reconfigurations
4. **Check the generated prometheus.yml** to see configuration changes
5. **Use the web interface** to control monitoring:
   - Visit `http://localhost:5000`
   - Use the "Service Monitoring" section to start/stop monitoring
   - Check monitoring status and interval

The monitoring system will:
- Detect new services added to the database
- Detect changes to existing services (URL, name changes)
- Detect removed services
- Automatically regenerate and reload Prometheus configuration
- Log all changes and actions for debugging

## Port Management

The application includes robust port management to handle conflicts:

### Automatic Port Cleanup
- When starting Prometheus, the app automatically kills any existing processes using the configured port
- Uses graceful termination (SIGTERM) first, then force kill (SIGKILL) if needed
- Waits for ports to be released before starting Prometheus

### Manual Port Cleanup
If you encounter port conflicts, you have several options:

1. **Web Interface**: Use the "Kill Port" button in the dashboard
2. **API Endpoint**: `POST /api/prometheus/kill-port`
3. **Standalone Script**: Run `python kill_prometheus_port.py`
4. **Manual Commands**:
   ```bash
   # Find processes using the port
   lsof -ti :9090

   # Kill processes gracefully
   pkill -f prometheus

   # Force kill if needed
   sudo killall prometheus

   # Kill specific port (replace 9090 with your port)
   sudo lsof -ti:9090 | xargs kill -9
   ```

### Configurable Port
- Set `PROMETHEUS_PORT` environment variable to use a different port
- Default is 9090
- The web interface and all configurations automatically adapt to the configured port
