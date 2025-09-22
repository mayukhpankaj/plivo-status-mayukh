#!/usr/bin/env python3
"""
Test database connection and query services
"""

import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def test_connection():
    """Test database connection and query services"""
    try:
        print(f"Connecting to: {DATABASE_URL}")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("✅ Connected to database successfully!")
        
        # Test the exact query used in the Flask app
        query = """
        SELECT service_id, metric_url, organization_id, name
        FROM public.services
        ORDER BY organization_id, service_id
        """
        
        print(f"Executing query: {query}")
        cursor.execute(query)
        services = cursor.fetchall()
        
        print(f"📋 Found {len(services)} services:")
        for service in services:
            print(f"  - {service[0]}: {service[3]} -> {service[1]} (Org: {service[2]})")
        
        cursor.close()
        conn.close()
        
        return services
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        if 'conn' in locals():
            conn.close()
        return []

if __name__ == '__main__':
    print("🔍 Testing database connection...")
    test_connection()
