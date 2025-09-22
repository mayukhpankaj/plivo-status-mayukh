#!/usr/bin/env python3
"""
Standalone script to kill any processes using the Prometheus port (9090 by default)
"""

import subprocess
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

PROMETHEUS_PORT = int(os.getenv('PROMETHEUS_PORT', 9090))

def kill_processes_on_port(port):
    """Kill any processes using the specified port"""
    try:
        print(f"🔍 Checking for processes using port {port}...")
        
        # Find processes using the port
        result = subprocess.run(['lsof', '-ti', f':{port}'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            print(f"📋 Found {len(pids)} process(es) using port {port}:")
            
            # Show process details first
            for pid in pids:
                if pid.strip():
                    try:
                        ps_result = subprocess.run(['ps', '-p', pid.strip(), '-o', 'pid,ppid,cmd'], 
                                                 capture_output=True, text=True, timeout=5)
                        if ps_result.returncode == 0:
                            print(f"   {ps_result.stdout.strip()}")
                    except:
                        print(f"   PID: {pid}")
            
            print(f"\n💀 Killing processes...")
            
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
            
            # Verify port is now free
            verify_result = subprocess.run(['lsof', '-ti', f':{port}'], 
                                         capture_output=True, text=True, timeout=10)
            if verify_result.returncode == 0 and verify_result.stdout.strip():
                print(f"⚠️  Warning: Port {port} still has processes after cleanup")
                return False
            else:
                print(f"✅ Port {port} is now free")
                return True
        else:
            print(f"✅ Port {port} is already free")
            return True
            
    except subprocess.TimeoutExpired:
        print(f"⚠️  Timeout while checking port {port}")
        return False
    except FileNotFoundError:
        # lsof not available, try alternative method
        print("⚠️  lsof command not found, trying netstat...")
        try:
            result = subprocess.run(['netstat', '-tlnp'], 
                                  capture_output=True, text=True, timeout=10)
            if f':{port} ' in result.stdout:
                print(f"⚠️  Port {port} appears to be in use, but cannot kill processes (lsof not available)")
                print("Try manually killing Prometheus processes:")
                print("  pkill -f prometheus")
                print("  or")
                print("  sudo killall prometheus")
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

def main():
    """Main function"""
    print("🧹 Prometheus Port Cleanup Tool")
    print("=" * 40)
    
    success = kill_processes_on_port(PROMETHEUS_PORT)
    
    if success:
        print(f"\n🎉 Port {PROMETHEUS_PORT} cleanup completed successfully!")
        print("You can now start Prometheus without port conflicts.")
    else:
        print(f"\n❌ Failed to fully clean port {PROMETHEUS_PORT}")
        print("You may need to manually kill Prometheus processes:")
        print("  pkill -f prometheus")
        print("  sudo killall prometheus")
        print(f"  sudo lsof -ti:{PROMETHEUS_PORT} | xargs kill -9")

if __name__ == '__main__':
    main()
