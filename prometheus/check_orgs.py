#!/usr/bin/env python3
"""
Script to check existing organizations in the database
"""

import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def check_organizations():
    """Check existing organizations in the database"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("Connected to database successfully!")
        
        # Check organizations table
        try:
            cursor.execute("SELECT id, name FROM organizations LIMIT 10")
            orgs = cursor.fetchall()
            
            if orgs:
                print(f"\n🏢 Found {len(orgs)} organizations:")
                for org in orgs:
                    print(f"  - ID: {org[0]}, Name: {org[1]}")
                return orgs
            else:
                print("❌ No organizations found")
                return []
                
        except Exception as e:
            print(f"❌ Error accessing organizations: {e}")
            return []
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return []

if __name__ == '__main__':
    print("🔍 Checking organizations in database...")
    check_organizations()
