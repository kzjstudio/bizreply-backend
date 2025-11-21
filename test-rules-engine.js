/**
 * Test Script for Business Rules Engine
 * 
 * This script helps test all the new rules engine features.
 * Run with: node test-rules-engine.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test business ID (replace with your actual test business ID)
const TEST_BUSINESS_ID = 'your-test-business-id';

async function setupTestBusinessRules() {
  console.log('🔧 Setting up test business rules...\n');

  // Store Hours
  const storeHours = {
    days: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '21:00' },
      saturday: { open: '10:00', close: '18:00' },
      sunday: { closed: true }
    },
    timezone: 'America/New_York'
  };

  // Delivery Rules
  const deliveryRules = {
    min_order_amount: 25,
    free_shipping_threshold: 50,
    standard_delivery_time: '3-5 business days',
    express_delivery_time: '1-2 business days',
    express_delivery_cost: 15,
    delivery_areas: ['New York', 'New Jersey', 'Connecticut'],
    restrictions: 'Some items may require additional shipping time'
  };

  // Update business with all rules
  const { data, error } = await supabase
    .from('businesses')
    .update({
      store_hours: storeHours,
      delivery_rules: deliveryRules,
      return_policy: 'We accept returns within 30 days of purchase. Items must be unused and in original packaging. Customer pays return shipping.',
      refund_policy: 'Refunds are processed within 5-7 business days after we receive the returned item. Original shipping costs are non-refundable.',
      shipping_policy: 'Orders are processed within 1-2 business days. Standard shipping is $5.99, free on orders over $50.',
      privacy_policy: 'We respect your privacy and will never share your personal information with third parties.',
      terms_of_service: 'By using our services, you agree to our terms and conditions.',
      forbidden_responses: ['medical advice', 'legal advice', 'competitor products', 'political topics'],
      custom_rules: [
        'Always ask for order number before processing returns',
        'Never promise delivery dates shorter than standard times',
        'Offer discount code WELCOME10 to first-time customers'
      ],
      escalation_keywords: ['refund', 'complaint', 'manager', 'speak to human', 'lawyer', 'legal', 'sue', 'cancel account'],
      ai_language: 'en',
      ai_max_response_length: 500,
      contact_phone: '+1-555-123-4567',
      contact_email: 'support@testbusiness.com',
      support_hours: 'Monday-Friday 9AM-6PM EST'
    })
    .eq('id', TEST_BUSINESS_ID);

  if (error) {
    console.error('❌ Error setting up rules:', error);
    return false;
  }

  console.log('✅ Business rules configured successfully!\n');
  return true;
}

async function testBusinessHours() {
  console.log('🕐 Testing business hours check...\n');

  const { data, error } = await supabase.rpc('is_business_open', {
    business_id_param: TEST_BUSINESS_ID
  });

  if (error) {
    console.error('❌ Error checking business hours:', error);
    return;
  }

  console.log(`Status: ${data ? '🟢 OPEN' : '🔴 CLOSED'}\n`);
}

async function testNextOpeningTime() {
  console.log('⏰ Testing next opening time...\n');

  const { data, error } = await supabase.rpc('get_next_opening_time', {
    business_id_param: TEST_BUSINESS_ID
  });

  if (error) {
    console.error('❌ Error getting next opening time:', error);
    return;
  }

  console.log(`Next opening: ${data ? new Date(data).toLocaleString() : 'Unknown'}\n`);
}

async function viewRecentAudits() {
  console.log('📊 Recent AI response audits...\n');

  const { data, error } = await supabase
    .from('ai_response_audit')
    .select('*')
    .eq('business_id', TEST_BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching audits:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No audit records yet (expected if no conversations happened)\n');
    return;
  }

  console.log(`Found ${data.length} recent audits:`);
  data.forEach((audit, i) => {
    console.log(`\n${i + 1}. ${new Date(audit.created_at).toLocaleString()}`);
    console.log(`   Customer: "${audit.customer_message.substring(0, 50)}..."`);
    console.log(`   Response: "${audit.ai_response.substring(0, 50)}..."`);
    console.log(`   Products: ${audit.products_recommended?.length || 0}`);
    console.log(`   Time: ${audit.response_time_ms}ms`);
    console.log(`   Tokens: ${audit.tokens_used}`);
    console.log(`   Cost: $${audit.cost_usd?.toFixed(4) || '0.0000'}`);
  });
  console.log('\n');
}

async function viewEscalations() {
  console.log('⚠️  Recent escalations...\n');

  const { data, error } = await supabase
    .from('conversation_escalations')
    .select('*')
    .eq('business_id', TEST_BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching escalations:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No escalations yet (good news!)\n');
    return;
  }

  console.log(`Found ${data.length} escalations:`);
  data.forEach((esc, i) => {
    console.log(`\n${i + 1}. ${new Date(esc.created_at).toLocaleString()}`);
    console.log(`   Customer: ${esc.customer_phone}`);
    console.log(`   Keyword: "${esc.triggered_keyword}"`);
    console.log(`   Reason: ${esc.reason}`);
    console.log(`   Status: ${esc.status}`);
    console.log(`   Priority: ${esc.priority}`);
    if (esc.resolved_at) {
      console.log(`   Resolved: ${new Date(esc.resolved_at).toLocaleString()}`);
    }
  });
  console.log('\n');
}

async function viewBusinessRules() {
  console.log('📋 Current business rules configuration...\n');

  const { data, error } = await supabase
    .from('businesses')
    .select(`
      store_hours,
      delivery_rules,
      return_policy,
      refund_policy,
      shipping_policy,
      forbidden_responses,
      custom_rules,
      escalation_keywords,
      ai_language,
      ai_max_response_length,
      contact_phone,
      contact_email,
      support_hours
    `)
    .eq('id', TEST_BUSINESS_ID)
    .single();

  if (error) {
    console.error('❌ Error fetching rules:', error);
    return;
  }

  console.log('Store Hours:', JSON.stringify(data.store_hours, null, 2));
  console.log('\nDelivery Rules:', JSON.stringify(data.delivery_rules, null, 2));
  console.log('\nReturn Policy:', data.return_policy);
  console.log('\nRefund Policy:', data.refund_policy);
  console.log('\nShipping Policy:', data.shipping_policy);
  console.log('\nForbidden Topics:', data.forbidden_responses);
  console.log('\nCustom Rules:', data.custom_rules);
  console.log('\nEscalation Keywords:', data.escalation_keywords);
  console.log('\nAI Language:', data.ai_language);
  console.log('\nMax Response Length:', data.ai_max_response_length);
  console.log('\nContact Phone:', data.contact_phone);
  console.log('\nContact Email:', data.contact_email);
  console.log('\nSupport Hours:', data.support_hours);
  console.log('\n');
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('    BUSINESS RULES ENGINE - TEST SCRIPT');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check if test business ID is set
  if (TEST_BUSINESS_ID === 'your-test-business-id') {
    console.log('❌ Please set TEST_BUSINESS_ID at the top of this script\n');
    console.log('To find your business ID:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open the businesses table');
    console.log('3. Copy the ID of your test business');
    console.log('4. Replace "your-test-business-id" with that ID\n');
    return;
  }

  console.log(`Testing with business ID: ${TEST_BUSINESS_ID}\n`);

  // Run all tests
  await setupTestBusinessRules();
  await viewBusinessRules();
  await testBusinessHours();
  await testNextOpeningTime();
  await viewRecentAudits();
  await viewEscalations();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('    TESTS COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Next steps:');
  console.log('1. Send a test WhatsApp message to trigger AI response');
  console.log('2. Run this script again to see audit logs');
  console.log('3. Try sending message with "refund" to trigger escalation');
  console.log('4. Check ai_response_audit and conversation_escalations tables\n');
}

// Run the tests
runTests().catch(console.error);
