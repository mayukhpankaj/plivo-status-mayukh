#!/usr/bin/env python3
"""
Script to add sample data to the services table
"""

import psycopg2
import uuid
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def add_sample_data():
    """Add sample organizations and services to the database"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("Connected to database successfully!")
        
        # Get real user ID and organization ID from database
        cursor.execute("SELECT id FROM auth.users LIMIT 1")
        user_result = cursor.fetchone()
        if not user_result:
            print("❌ No users found in auth.users table. Please create a user first.")
            return
        user_id = user_result[0]

        cursor.execute("SELECT id FROM organizations LIMIT 1")
        org_result = cursor.fetchone()
        if not org_result:
            print("❌ No organizations found. Please create an organization first.")
            return
        org1_id = org_result[0]  # Use the same org for all services for simplicity
        
        print(f"Using org_id: {org1_id}")
        print(f"Using user_id: {user_id}")
        
        # Skip organizations table for now, just add services directly
        
        # Add sample services (all using the same organization for simplicity)
        services_data = [
            ('Service-20', 'Web API', 'https://abc.com/metrics', user_id, org1_id),
            ('Service-40', 'Database Service', 'https://xyz.com/metrics', user_id, org1_id),
            ('service-100', 'Load Balancer', 'https://mno.com/metrics', user_id, org1_id)
        ]
        
        for service_id, name, metric_url, uid, oid in services_data:
            cursor.execute("""
                INSERT INTO public.services (service_id, name, metric_url, user_id, organization_id, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (service_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    metric_url = EXCLUDED.metric_url,
                    updated_at = NOW()
            """, (service_id, name, metric_url, uid, oid))
            print(f"✅ Added service: {service_id} - {name}")
        
        # Commit the transaction
        conn.commit()
        
        # Verify the data was added
        cursor.execute("SELECT service_id, name, metric_url, organization_id FROM public.services ORDER BY service_id")
        services = cursor.fetchall()
        
        print(f"\n📋 Current services in database ({len(services)} total):")
        for service in services:
            print(f"  - {service[0]}: {service[1]} -> {service[2]} (Org: {service[3]})")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Sample data added successfully!")
        print("You can now refresh your Flask app to see the services.")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    print("🚀 Adding sample data to services table...")
    add_sample_data()
