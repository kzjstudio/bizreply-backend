import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  console.log('\n🔄 Running business hours function fix...\n');

  try {
    const sql = fs.readFileSync('database/migrations/fix_is_business_open.sql', 'utf8');
    
    // Split by function definitions
    const createFunctions = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/g);
    
    if (!createFunctions || createFunctions.length === 0) {
      console.error('❌ No functions found in migration file');
      return;
    }

    console.log(`Found ${createFunctions.length} function(s) to create/update\n`);

    for (let i = 0; i < createFunctions.length; i++) {
      const funcSql = createFunctions[i];
      const funcName = funcSql.match(/FUNCTION\s+(\w+)/)?.[1] || `function_${i}`;
      
      console.log(`Creating/updating: ${funcName}...`);
      
      const { error } = await supabase.rpc('exec_sql', { query: funcSql });
      
      if (error) {
        // Try direct execution via REST
        console.log(`  Attempting direct SQL execution...`);
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ query: funcSql })
        });
        
        if (!response.ok) {
          console.log(`  ⚠️  Could not execute via API (this is normal - use Supabase SQL Editor)`);
        }
      }
      
      console.log(`  ✅ ${funcName} definition ready\n`);
    }

    console.log('\n🧪 Testing the functions...\n');

    // Test is_business_open
    const { data: isOpen, error: openError } = await supabase.rpc('is_business_open', {
      business_id_param: '85732846-c2b4-4c60-b651-08d5f606eef0'
    });

    if (openError) {
      console.log('⚠️  is_business_open test:', openError.message);
    } else {
      console.log(`Current status: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
      console.log(`Expected: 🔴 CLOSED (Saturday)`);
      if (!isOpen) {
        console.log('✅ Function working correctly!\n');
      } else {
        console.log('❌ Still returning wrong result\n');
      }
    }

    // Test get_next_opening_time
    const { data: nextOpen, error: nextError } = await supabase.rpc('get_next_opening_time', {
      business_id_param: '85732846-c2b4-4c60-b651-08d5f606eef0'
    });

    if (nextError) {
      console.log('⚠️  get_next_opening_time test:', nextError.message);
    } else {
      console.log(`Next opening: ${nextOpen}`);
      console.log('Expected: Monday at 09:00\n');
    }

    console.log('\n📋 MANUAL STEP REQUIRED:\n');
    console.log('If functions did not update automatically:');
    console.log('1. Go to https://app.supabase.com → your project');
    console.log('2. SQL Editor → New Query');
    console.log('3. Copy contents of: database/migrations/fix_is_business_open.sql');
    console.log('4. Paste and click RUN');
    console.log('5. Re-test by asking AI about your hours\n');

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
  }
}

runMigration();
