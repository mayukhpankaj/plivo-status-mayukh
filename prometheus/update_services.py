#!/usr/bin/env python3
"""
Update services in database to point to actual running target services
"""

import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def update_services():
    """Update services to point to localhost target services"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("Connected to database successfully!")
        
        # Update services to point to localhost
        updates = [
            ('Service-20', 'http://localhost:8090/metrics', 'Web API Target Service'),
            ('Service-40', 'http://localhost:8091/metrics', 'Database Target Service'),
            ('service-100', 'http://localhost:8092/metrics', 'Load Balancer Target Service')
        ]
        
        for service_id, new_url, new_name in updates:
            cursor.execute("""
                UPDATE public.services 
                SET metric_url = %s, name = %s, updated_at = NOW()
                WHERE service_id = %s
            """, (new_url, new_name, service_id))
            print(f"✅ Updated {service_id}: {new_name} -> {new_url}")
        
        # Commit changes
        conn.commit()
        
        # Verify updates
        cursor.execute("SELECT service_id, name, metric_url FROM public.services ORDER BY service_id")
        services = cursor.fetchall()
        
        print(f"\n📋 Updated services ({len(services)} total):")
        for service in services:
            print(f"  - {service[0]}: {service[1]} -> {service[2]}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Services updated successfully!")
        print("Now you can:")
        print("1. Start the target services: cd target && python run_all.py")
        print("2. Reload Prometheus from the main dashboard")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    print("🔄 Updating services to point to localhost target services...")
    update_services()
