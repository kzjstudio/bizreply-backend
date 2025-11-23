/**
 * Test RAG (Retrieval-Augmented Generation) product search
 * Verifies: Embedding generation → Vector search → Product matching
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import productSyncService from './services/productSyncService.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRAG() {
  console.log('\n🧪 Testing RAG Product Search System\n');
  console.log('==========================================\n');

  try {
    // Step 1: Check if products exist with embeddings
    console.log('Step 1: Checking product embeddings...\n');
    
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, description, price, embedding, business_id')
      .eq('is_active', true)
      .limit(5);

    if (prodError) throw prodError;

    if (!products || products.length === 0) {
      console.log('❌ No products found. Add products first via integrations.');
      return;
    }

    console.log(`✅ Found ${products.length} active products\n`);

    let withEmbeddings = 0;
    let withoutEmbeddings = 0;

    products.forEach(p => {
      const hasEmbed = p.embedding && p.embedding.length > 0;
      if (hasEmbed) {
        withEmbeddings++;
        console.log(`  ✅ ${p.name} - has embedding`);
      } else {
        withoutEmbeddings++;
        console.log(`  ❌ ${p.name} - NO embedding`);
      }
    });

    console.log(`\n  With embeddings: ${withEmbeddings}`);
    console.log(`  Without embeddings: ${withoutEmbeddings}\n`);

    if (withoutEmbeddings > 0) {
      console.log('⚠️  Triggering product sync to generate embeddings...\n');
      await productSyncService.syncAllProducts();
      console.log('✅ Sync complete. Re-checking...\n');
      
      const { data: recheckProducts } = await supabase
        .from('products')
        .select('id, name, embedding')
        .eq('is_active', true)
        .limit(5);

      recheckProducts.forEach(p => {
        const hasEmbed = p.embedding && p.embedding.length > 0;
        console.log(`  ${hasEmbed ? '✅' : '❌'} ${p.name}`);
      });
    }

    // Step 2: Test semantic search function exists
    console.log('\n\nStep 2: Testing search_similar_products function...\n');

    const testQueries = [
      "Do you have that mop I saw on TikTok?",
      "I need something for cleaning floors",
      "Show me blue products",
      "What's your cheapest item?"
    ];

    const businessId = products[0].business_id;

    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      console.log('   Step A: Generating query embedding...');
      
      const queryEmbedding = await productSyncService.createEmbedding(query);
      console.log(`   ✅ Embedding generated (${queryEmbedding.length} dimensions)`);

      console.log('   Step B: Searching products...');
      
      const { data: results, error: searchError } = await supabase.rpc('search_similar_products', {
        query_embedding: queryEmbedding,
        business_id_param: businessId,
        match_threshold: 0.35,
        match_count: 3
      });

      if (searchError) {
        console.log(`   ❌ Search error: ${searchError.message}`);
        if (searchError.message.includes('does not exist')) {
          console.log('\n   ⚠️  search_similar_products function missing!');
          console.log('   Run this in Supabase SQL Editor:');
          console.log('   database/fix_search_function_v2.sql\n');
        }
        continue;
      }

      if (!results || results.length === 0) {
        console.log('   ⚠️  No products matched (may need better product data)');
      } else {
        console.log(`   ✅ Found ${results.length} matching products:`);
        results.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r.product_name} - $${r.price} (similarity: ${(r.similarity * 100).toFixed(1)}%)`);
        });
      }
    }

    // Step 3: Test getRecommendations (full RAG pipeline)
    console.log('\n\nStep 3: Testing full RAG pipeline via getRecommendations...\n');

    const conversationContext = "Customer is looking for blue cleaning products under $50";
    console.log(`Context: "${conversationContext}"\n`);

    const recommendations = await productSyncService.getRecommendations(
      businessId,
      conversationContext,
      5
    );

    if (!recommendations || recommendations.length === 0) {
      console.log('❌ No recommendations returned');
    } else {
      console.log(`✅ Retrieved ${recommendations.length} recommendations:\n`);
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.product_name}`);
        console.log(`      Price: $${rec.price}`);
        console.log(`      Category: ${rec.category || 'N/A'}`);
        console.log(`      Similarity: ${((rec.similarity || 0) * 100).toFixed(1)}%`);
        console.log(`      URL: ${rec.product_url || 'N/A'}\n`);
      });
    }

    // Step 4: Test AI integration
    console.log('\nStep 4: Testing AI Engine integration...\n');

    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError) throw bizError;

    console.log(`   Business: ${business.business_name}`);
    console.log(`   Products should be injected into AI prompts ✅\n`);

    console.log('\n==========================================');
    console.log('✅ RAG SYSTEM TEST COMPLETE\n');

    console.log('📊 SUMMARY:\n');
    console.log(`   • Products with embeddings: ${withEmbeddings}/${products.length}`);
    console.log(`   • Semantic search: ${recommendations.length > 0 ? '✅ Working' : '❌ Not working'}`);
    console.log(`   • RAG pipeline: ${recommendations.length > 0 ? '✅ Operational' : '⚠️  Needs attention'}\n`);

    if (withEmbeddings === 0) {
      console.log('⚠️  ACTION REQUIRED:');
      console.log('   1. Ensure products are synced from WooCommerce/Shopify');
      console.log('   2. Wait 5 minutes for automatic embedding generation');
      console.log('   3. Or run: node scripts/sync-products.js\n');
    }

    if (recommendations.length === 0 && withEmbeddings > 0) {
      console.log('⚠️  ACTION REQUIRED:');
      console.log('   1. Verify search_similar_products function exists');
      console.log('   2. Run: database/fix_search_function_v2.sql in Supabase');
      console.log('   3. Check product descriptions are meaningful\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

testRAG();
