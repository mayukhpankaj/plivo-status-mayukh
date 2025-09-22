#!/usr/bin/env python3
"""
Script to check existing users in the database
"""

import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def check_users():
    """Check existing users in the database"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("Connected to database successfully!")
        
        # Check users in auth.users table
        try:
            cursor.execute("SELECT id, email FROM auth.users LIMIT 5")
            users = cursor.fetchall()
            
            if users:
                print(f"\n👥 Found {len(users)} users:")
                for user in users:
                    print(f"  - ID: {user[0]}, Email: {user[1]}")
                
                # Use the first user for our services
                first_user_id = users[0][0]
                print(f"\n✅ Will use user ID: {first_user_id}")
                return first_user_id
            else:
                print("❌ No users found in auth.users table")
                return None
                
        except Exception as e:
            print(f"❌ Error accessing auth.users: {e}")
            return None
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return None

if __name__ == '__main__':
    print("🔍 Checking users in database...")
    check_users()
