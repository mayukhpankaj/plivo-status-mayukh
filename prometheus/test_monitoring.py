#!/usr/bin/env python3
"""
Test script to demonstrate automatic service monitoring and Prometheus reconfiguration
"""

import psycopg2
import time
import uuid
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def add_test_service(service_id, name, metric_url):
    """Add a test service to the database"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Get a real user ID and organization ID from database
        cursor.execute("SELECT id FROM auth.users LIMIT 1")
        user_result = cursor.fetchone()
        if not user_result:
            print("❌ No users found in auth.users table")
            return False
        user_id = user_result[0]

        cursor.execute("SELECT id FROM organizations LIMIT 1")
        org_result = cursor.fetchone()
        if not org_result:
            print("❌ No organizations found")
            return False
        org_id = org_result[0]
        
        # Insert the service
        cursor.execute("""
            INSERT INTO public.services (service_id, name, metric_url, user_id, organization_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (service_id) DO UPDATE SET
                name = EXCLUDED.name,
                metric_url = EXCLUDED.metric_url,
                updated_at = NOW()
        """, (service_id, name, metric_url, user_id, org_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Added service: {service_id} - {name}")
        return True
        
    except Exception as e:
        print(f"❌ Error adding service: {e}")
        if conn:
            conn.close()
        return False

def remove_test_service(service_id):
    """Remove a test service from the database"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM public.services WHERE service_id = %s", (service_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"🗑️  Removed service: {service_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error removing service: {e}")
        if conn:
            conn.close()
        return False

def list_services():
    """List all services in the database"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT service_id, name, metric_url FROM public.services ORDER BY service_id")
        services = cursor.fetchall()
        cursor.close()
        conn.close()
        
        print(f"📋 Current services ({len(services)} total):")
        for service in services:
            print(f"  - {service[0]}: {service[1]} -> {service[2]}")
        
        return services
        
    except Exception as e:
        print(f"❌ Error listing services: {e}")
        if conn:
            conn.close()
        return []

def main():
    """Main test function"""
    print("🧪 Testing automatic service monitoring...")
    print("Make sure your Flask app is running with monitoring enabled!")
    print("Watch the Flask app logs to see automatic reconfigurations.\n")
    
    # List current services
    print("1. Current services:")
    list_services()
    
    print("\n2. Adding a new test service...")
    test_service_id = f"test-service-{int(time.time())}"
    add_test_service(test_service_id, "Test Monitoring Service", "http://localhost:8099/metrics")
    
    print("\n3. Waiting 35 seconds for monitoring to detect the change...")
    print("   (Check your Flask app logs for automatic reconfiguration)")
    time.sleep(35)
    
    print("\n4. Services after addition:")
    list_services()
    
    print("\n5. Removing the test service...")
    remove_test_service(test_service_id)
    
    print("\n6. Waiting 35 seconds for monitoring to detect the removal...")
    print("   (Check your Flask app logs for automatic reconfiguration)")
    time.sleep(35)
    
    print("\n7. Final services list:")
    list_services()
    
    print("\n✅ Test completed! Check your Flask app logs to see the automatic reconfigurations.")
    print("You can also check the generated prometheus.yml file to see the changes.")

if __name__ == '__main__':
    main()
