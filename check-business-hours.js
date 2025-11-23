/**
 * Quick diagnostic to check business hours configuration
 * Run: node check-business-hours.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkBusinessHours() {
  console.log('\n🔍 Checking Business Hours Configuration\n');
  console.log('==========================================\n');

  try {
    // Get all businesses
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, business_name, store_hours, business_hours');

    if (error) throw error;

    if (!businesses || businesses.length === 0) {
      console.log('❌ No businesses found in database');
      return;
    }

    businesses.forEach((business, index) => {
      console.log(`\n📊 Business ${index + 1}: ${business.business_name}`);
      console.log(`   ID: ${business.id}`);
      console.log(`\n   store_hours field:`);
      
      if (business.store_hours) {
        console.log(JSON.stringify(business.store_hours, null, 2));
        
        // Check format
        if (business.store_hours.days) {
          console.log('\n   ✅ Format: Correct (has "days" object)');
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          days.forEach(day => {
            const dayData = business.store_hours.days[day];
            if (dayData) {
              if (dayData.closed) {
                console.log(`   ${day}: CLOSED`);
              } else {
                console.log(`   ${day}: ${dayData.open} - ${dayData.close}`);
              }
            } else {
              console.log(`   ${day}: ⚠️  NOT CONFIGURED`);
            }
          });
        } else {
          console.log('\n   ❌ Format: Incorrect (missing "days" object)');
        }
      } else {
        console.log('   ❌ NULL or not set');
      }

      console.log(`\n   business_hours field (legacy text):`);
      if (business.business_hours) {
        console.log(`   "${business.business_hours}"`);
      } else {
        console.log('   ❌ NULL or not set');
      }

      // Test isBusinessOpen function
      console.log(`\n   Testing isBusinessOpen function...`);
      testIsOpen(business.id);

      console.log('\n------------------------------------------');
    });

    console.log('\n\n💡 DIAGNOSIS:\n');
    console.log('If store_hours is NULL or missing "days", the AI cannot');
    console.log('access your hours and will make up answers.\n');
    console.log('Expected format:');
    console.log(JSON.stringify({
      days: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { closed: true },
        sunday: { closed: true }
      },
      timezone: 'America/New_York'
    }, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

async function testIsOpen(businessId) {
  try {
    const { data, error } = await supabase.rpc('is_business_open', {
      business_id_param: businessId
    });
    if (error) {
      console.log(`   ❌ Function error: ${error.message}`);
    } else {
      console.log(`   Current status: ${data ? '🟢 OPEN' : '🔴 CLOSED'}`);
    }
  } catch (e) {
    console.log(`   ⚠️  is_business_open function not found (needs migration)`);
  }
}

checkBusinessHours();
