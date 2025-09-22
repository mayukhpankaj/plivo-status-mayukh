const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Running migration 009_update_services_for_entities.sql...');
    
    const migration = fs.readFileSync('./migrations/009_update_services_for_entities.sql', 'utf8');
    
    console.log('Migration SQL:');
    console.log(migration);
    console.log('\n⚠️  Please run this migration manually in your Supabase SQL editor');
    console.log('Or use the Supabase CLI: supabase db push');
    
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigration();
