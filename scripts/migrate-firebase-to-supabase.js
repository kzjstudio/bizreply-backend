import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Initialize Supabase (with service role key to bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function migrateBusinesses() {
  console.log('Starting business migration from Firebase to Supabase...\n');
  
  try {
    // Get all businesses from Firebase
    const businessesSnapshot = await db.collection('businesses').get();
    
    if (businessesSnapshot.empty) {
      console.log('No businesses found in Firebase.');
      return;
    }
    
    console.log(`Found ${businessesSnapshot.size} business(es) in Firebase\n`);
    
    for (const doc of businessesSnapshot.docs) {
      const firebaseData = doc.data();
      
      console.log(`Migrating business: ${firebaseData.businessName || 'Unnamed'}`);
      console.log(`  Firebase ID: ${doc.id}`);
      console.log(`  Phone Number ID: ${firebaseData.phoneNumberId || 'N/A'}`);
      console.log(`  Owner/User ID: ${firebaseData.userId || firebaseData.ownerId || 'N/A'}`);
      
      // Use Firebase document ID as owner_id for now
      // Later, after migrating users to Supabase Auth, this will be the auth.users.id
      const ownerId = firebaseData.userId || firebaseData.ownerId || doc.id;
      
      // Transform Firebase data to Supabase format
      const supabaseData = {
        owner_id: ownerId,
        business_name: firebaseData.businessName || 'Unnamed Business',
        phone_number_id: firebaseData.phoneNumberId,
        whatsapp_number: firebaseData.whatsappNumber,
        
        // Business info
        description: firebaseData.description || null,
        business_hours: firebaseData.businessHours || null,
        location: firebaseData.location || null,
        
        // AI Configuration
        ai_greeting_message: firebaseData.aiGreetingMessage || null,
        ai_instructions: firebaseData.aiInstructions || null,
        ai_faqs: firebaseData.aiFaqs || null,
        ai_special_offers: firebaseData.aiSpecialOffers || null,
        ai_do_not_mention: firebaseData.aiDoNotMention || null,
        ai_tone: firebaseData.aiTone || 'Professional and friendly',
        
        // Metadata
        is_active: firebaseData.isActive !== false,
        message_count: firebaseData.messageCount || 0
      };
      
      // Insert into Supabase
      const { data, error } = await supabase
        .from('businesses')
        .insert(supabaseData)
        .select()
        .single();
      
      if (error) {
        console.error(`  ❌ Error migrating business:`, error.message);
        if (error.code === '23503') {
          console.error(`     Foreign key constraint failed: owner_id '${ownerId}' does not exist in auth.users`);
          console.error(`     Solution: Create a user in Supabase Auth first, or temporarily disable the foreign key constraint`);
        }
      } else {
        console.log(`  ✅ Successfully migrated to Supabase ID: ${data.id}`);
        console.log(`     Business Name: ${data.business_name}`);
        console.log(`     Phone Number ID: ${data.phone_number_id}\n`);
      }
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Supabase dashboard');
    console.log('2. Test WhatsApp webhook with: +18583608131');
    console.log('3. Migrate users to Supabase Auth (for proper owner_id references)');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateBusinesses()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
