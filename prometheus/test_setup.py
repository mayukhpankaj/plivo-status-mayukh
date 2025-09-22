#!/usr/bin/env python3
"""
Test script to verify the setup is working correctly
"""

import requests
import json
import sys
import time

def test_backend():
    """Test backend API endpoints"""
    print("🧪 Testing Backend API...")
    
    try:
        # Test main endpoint
        response = requests.get('http://localhost:5000/')
        if response.status_code == 200:
            print("✅ Backend main endpoint working")
        else:
            print(f"❌ Backend main endpoint failed: {response.status_code}")
            return False
            
        # Test services API
        response = requests.get('http://localhost:5000/api/services')
        if response.status_code == 200:
            services = response.json()
            print(f"✅ Services API working - found {len(services)} services")
            
            # Test organization endpoints if services exist
            if services:
                org_id = services[0]['organization_id']
                
                # Test organization info
                response = requests.get(f'http://localhost:5000/api/organizations/{org_id}')
                if response.status_code == 200:
                    org_info = response.json()
                    print(f"✅ Organization API working - org: {org_info.get('name', 'Unknown')}")
                else:
                    print(f"⚠️  Organization API failed: {response.status_code}")
                
                # Test organization services
                response = requests.get(f'http://localhost:5000/api/organizations/{org_id}/services')
                if response.status_code == 200:
                    org_services = response.json()
                    print(f"✅ Organization services API working - {len(org_services)} services")
                else:
                    print(f"⚠️  Organization services API failed: {response.status_code}")
            else:
                print("⚠️  No services found - add some services to test organization endpoints")
        else:
            print(f"❌ Services API failed: {response.status_code}")
            return False
            
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend - make sure Flask app is running on port 5000")
        return False
    except Exception as e:
        print(f"❌ Backend test failed: {e}")
        return False

def test_frontend():
    """Test frontend is accessible"""
    print("\n🧪 Testing Frontend...")
    
    try:
        response = requests.get('http://localhost:3000/')
        if response.status_code == 200:
            print("✅ Frontend accessible")
            return True
        else:
            print(f"❌ Frontend failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to frontend - make sure React dev server is running on port 3000")
        return False
    except Exception as e:
        print(f"❌ Frontend test failed: {e}")
        return False

def test_prometheus():
    """Test Prometheus is accessible"""
    print("\n🧪 Testing Prometheus...")
    
    try:
        response = requests.get('http://localhost:9090/')
        if response.status_code == 200:
            print("✅ Prometheus accessible")
            
            # Test metrics endpoint
            response = requests.get('http://localhost:9090/api/v1/query?query=up')
            if response.status_code == 200:
                print("✅ Prometheus API working")
                return True
            else:
                print(f"⚠️  Prometheus API failed: {response.status_code}")
                return False
        else:
            print(f"❌ Prometheus failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("⚠️  Cannot connect to Prometheus - it may not be running")
        return False
    except Exception as e:
        print(f"❌ Prometheus test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Prometheus Status Monitor Setup")
    print("=" * 50)
    
    backend_ok = test_backend()
    frontend_ok = test_frontend()
    prometheus_ok = test_prometheus()
    
    print("\n📊 Test Results:")
    print("=" * 20)
    print(f"Backend:    {'✅ PASS' if backend_ok else '❌ FAIL'}")
    print(f"Frontend:   {'✅ PASS' if frontend_ok else '❌ FAIL'}")
    print(f"Prometheus: {'✅ PASS' if prometheus_ok else '⚠️  OPTIONAL'}")
    
    if backend_ok and frontend_ok:
        print("\n🎉 Setup is working! You can now:")
        print("   • Visit http://localhost:3000 to browse organizations")
        print("   • Visit http://localhost:5000 for backend management")
        if prometheus_ok:
            print("   • Visit http://localhost:9090 for Prometheus UI")
    else:
        print("\n❌ Some components are not working. Check the errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()
