#!/bin/bash

# Setup script for target services

echo "🎯 Setting up Target Services..."
echo "================================"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start all services:"
echo "  source venv/bin/activate"
echo "  python run_all.py"
echo ""
echo "🔧 To start individual services:"
echo "  python app.py              # Web API (port 8080)"
echo "  python database_service.py # Database (port 8081)"
echo "  python load_balancer.py    # Load Balancer (port 8082)"
echo ""
echo "📊 Metrics will be available at:"
echo "  http://localhost:8080/metrics"
echo "  http://localhost:8081/metrics"
echo "  http://localhost:8082/metrics"
