#!/usr/bin/env python3
"""
Script to run all target services simultaneously
"""

import subprocess
import time
import os
import signal
import sys
from multiprocessing import Process

def run_service(script_name, port):
    """Run a single service"""
    env = os.environ.copy()
    env['PORT'] = str(port)
    
    try:
        subprocess.run([sys.executable, script_name], env=env)
    except KeyboardInterrupt:
        print(f"\n🛑 Stopping {script_name}...")

def main():
    """Run all target services"""
    services = [
        ('app.py', 8090, 'Web API Service'),
        ('database_service.py', 8091, 'Database Service'),
        ('load_balancer.py', 8092, 'Load Balancer Service')
    ]
    
    processes = []
    
    print("🚀 Starting all target services...")
    print("=" * 50)
    
    try:
        for script, port, name in services:
            print(f"▶️  Starting {name} on port {port}")
            
            env = os.environ.copy()
            env['PORT'] = str(port)
            
            process = subprocess.Popen(
                [sys.executable, script],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            processes.append((process, name, port))
            time.sleep(2)  # Give each service time to start
        
        print("\n✅ All services started!")
        print("=" * 50)
        print("📊 Metrics endpoints:")
        for _, name, port in [(s[0], s[2], s[1]) for s in services]:
            print(f"  - {name}: http://localhost:{port}/metrics")
        
        print("\n🌐 Service endpoints:")
        for _, name, port in [(s[0], s[2], s[1]) for s in services]:
            print(f"  - {name}: http://localhost:{port}")
        
        print("\n⚠️  Press Ctrl+C to stop all services")
        print("=" * 50)
        
        # Wait for all processes
        while True:
            time.sleep(1)
            # Check if any process has died
            for process, name, port in processes:
                if process.poll() is not None:
                    print(f"❌ {name} has stopped unexpectedly")
    
    except KeyboardInterrupt:
        print("\n🛑 Stopping all services...")
        
        for process, name, port in processes:
            print(f"  Stopping {name}...")
            process.terminate()
            
        # Wait for processes to terminate
        for process, name, port in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print(f"  Force killing {name}...")
                process.kill()
        
        print("✅ All services stopped")

if __name__ == '__main__':
    main()
