
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class ProductSyncService {
  constructor() {
    this.embeddingModel = 'text-embedding-3-small';
    this.embeddingDimensions = 1536;
    this.syncInterval = 300000; // 5 minutes in milliseconds
    this.isRunning = false;
  }

  startPeriodicSync() {
    if (this.isRunning) {
      console.log('Product sync service already running');
      return;
    }

    this.isRunning = true;
    console.log(' Starting product sync service...');

    this.syncAllProducts();

    this.syncTimer = setInterval(() => {
      this.syncAllProducts();
    }, this.syncInterval);

    console.log(`Product sync service started (interval: ${this.syncInterval / 60000} minutes`);
  }

  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.isRunning = false;
      console.log(' Product sync service stopped');
    }
  }

  async syncAllProducts() {
    try {
      console.log(' Starting product sync...');

      const { data: products, error } = await supabase
        .from('products')
        .select('id, business_id, name, description, price, category, image_url, updated_at, last_embedded_at')
        .is(`embedding`, null)
        .eq('is_active', true)
        .limit(100);

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      if (!products || products.length === 0) {
        console.log(' No products need syncing');
        return;
      }

      console.log(`Found ${products.length} products to sync`);

      const batchSize = 10;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await Promise.all(batch.map(product => this.syncProduct(product)));
      }

      console.log(`Product sync completed: ${products.length} products processed`);
    } catch (error) {
      console.error('Error in syncAllProducts:', error);
    }
  }


  async syncProduct(product) {
    try {
      // Fetch permalink from WooCommerce API
      let productUrl = null;
      try {
        const wooBaseUrl = process.env.WC_API_BASE_URL;
        const wooConsumerKey = process.env.WC_CONSUMER_KEY;
        const wooConsumerSecret = process.env.WC_CONSUMER_SECRET;
        if (wooBaseUrl && wooConsumerKey && wooConsumerSecret && product.external_id) {
          const wcRes = await axios.get(
            `${wooBaseUrl}/wp-json/wc/v3/products/${product.external_id}`,
            {
              auth: {
                username: wooConsumerKey,
                password: wooConsumerSecret
              }
            }
          );
          productUrl = wcRes.data.permalink || null;
        }
      } catch (err) {
        console.warn('Could not fetch WooCommerce permalink for product', product.id, err.message);
      }

      // Always include product_url in update
      const updatePayload = { ...product };
      if (productUrl) {
        updatePayload.product_url = productUrl;
      }

      await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', product.id);

      const normalizedData = this.normalizeProductData({ ...product, product_url: productUrl });
      const embeddingText = this.createEmbeddingText(normalizedData);
      const embedding = await this.createEmbedding(embeddingText);

      await this.saveProductEmbedding(product.id, product.business_id, embedding, embeddingText);
      await this.updateProductEmbedding(product.id, embedding);

      console.log(`Synced product: ${product.name} (${product.id})`);
    } catch (error) {
      console.error(`Error syncing product ${product.id}:`, error.message);
    }
  }

  normalizeProductData(product) {
    return {
      name: this.normalizeText(product.name),
      description: this.normalizeText(product.description),
      price: this.normalizePrice(product.price),
      category: this.normalizeText(product.category),
      imageUrl: product.image_url,
      has_variants: product.has_variants || false,
      variant_options: product.variant_options || null,
    };
  }

  normalizeText(text) {
    if (!text) return '';

    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s\-.,!?]/g, '')
      .substring(0, 1000);
  }

  normalizePrice(price) {
    if (!price) return 0;
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  createEmbeddingText(productData) {
    const parts = [];

    if (productData.name) {
      parts.push(`Product: ${productData.name}`);
      // Repeat product name for better matching
      parts.push(productData.name);
    }

    if (productData.category) {
      parts.push(`Category: ${productData.category}`);
    }

    if (productData.price > 0) {
      parts.push(`Price: $${productData.price.toFixed(2)}`);
    }

    if (productData.description) {
      parts.push(`Description: ${productData.description}`);
    }

    // EMPHASIZE color/variant information for better semantic search matching
    if (productData.has_variants && productData.variant_options) {
      // Only include actual options from the store, not generic guesses
      const optionEntries = Object.entries(productData.variant_options)
        .map(([key, values]) => {
          // Filter out empty or null values
          const filtered = Array.isArray(values) ? values.filter(v => v && v.trim()) : values;
          if (!filtered || (Array.isArray(filtered) && filtered.length === 0)) return null;
          return { key, values: filtered };
        })
        .filter(Boolean);
      
      if (optionEntries.length > 0) {
        // Add multiple mentions for better semantic matching
        optionEntries.forEach(({ key, values }) => {
          const valueStr = Array.isArray(values) ? values.join(', ') : values;
          parts.push(`${key}: ${valueStr}`);
          parts.push(`Available ${key.toLowerCase()}: ${valueStr}`);
          // Add individual color mentions for even better matching
          if (/color|colou?r/i.test(key) && Array.isArray(values)) {
            values.forEach(color => parts.push(`${color} color available`));
          }
        });
      }
    }

    return parts.join('. ');
  }

  async createEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error.message);
      throw error;
    }
  }

  async saveProductEmbedding(productId, businessId, embedding, embeddingText) {
    try {
      await supabase
        .from('product_embeddings')
        .delete()
        .eq('product_id', productId);

      const { error } = await supabase
        .from('product_embeddings')
        .insert({
          product_id: productId,
          business_id: businessId,
          embedding: embedding,
          embedding_text: embeddingText,
          embedding_model: this.embeddingModel,
        });

      if (error) {
        console.error('Error saving product embedding:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in saveProductEmbedding:', error);
      throw error;
    }
  }

  async updateProductEmbedding(productId, embedding) {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          embedding: embedding,
          embedding_model: this.embeddingModel,
          last_embedded_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (error) {
        console.error('Error updating product embedding:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in updateProductEmbedding:', error);
      throw error;
    }
  }

  async searchProducts(businessId, query, limit = 10) {
    try {
      const queryEmbedding = await this.createEmbedding(query);

      const { data, error } = await supabase.rpc('search_similar_products', {
        query_embedding: queryEmbedding,
        business_id_param: businessId,
        match_threshold: 0.7,
        match_count: limit,
      });

      if (error) {
        console.error('Error searching products:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchProducts:', error);
      throw error;
    }
  }

  async getRecommendations(businessId, conversationContext, limit = 5) {
    try {      const contextEmbedding = await this.createEmbedding(conversationContext);

      const { data, error } = await supabase.rpc('search_similar_products', {
        query_embedding: contextEmbedding,
        business_id_param: businessId,
        match_threshold: 0.35, // Optimized for semantic product search
        match_count: limit,
      });

      if (error) {
        console.error('Error getting recommendations:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecommendations:', error);
      throw error;
    }
  }

  async syncBusinessProducts(businessId) {
    try {
    console.log(`Syncing products for business: ${businessId}`);

      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true);

      if (error) throw error;

      if (!products || products.length === 0) {
        return { success: true, count: 0 };
      }

      await Promise.all(products.map(product => this.syncProduct(product)));

    console.log(`Synced ${products.length} products for business ${businessId}`);

      return { success: true, count: products.length };
    } catch (error) {
      console.error('Error in syncBusinessProducts:', error);
      throw error;
    }
  }
}

const productSyncService = new ProductSyncService();

export default productSyncService;
