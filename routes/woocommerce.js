import express from 'express';
import crypto from 'crypto';
import { logger } from '../src/utils/logger.js';
import { supabase } from '../src/services/supabase.service.js';
import productSyncService from '../services/productSyncService.js';

const router = express.Router();

/**
 * WooCommerce Webhook Handler
 * Receives real-time product updates from WooCommerce
 * 
 * Webhook Events:
 * - product.created: New product added
 * - product.updated: Product modified
 * - product.deleted: Product removed
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    // Respond quickly to WooCommerce
    res.status(200).send('OK');

    const event = req.headers['x-wc-webhook-event'];
    const signature = req.headers['x-wc-webhook-signature'];
    const topic = req.headers['x-wc-webhook-topic'];
    const sourceUrl = req.headers['x-wc-webhook-source'];
    
    logger.info(`📦 WooCommerce webhook received: ${topic} from ${sourceUrl}`);

    // Verify webhook signature (optional but recommended)
    // const webhookSecret = process.env.WC_WEBHOOK_SECRET;
    // if (webhookSecret && signature) {
    //   const hash = crypto
    //     .createHmac('sha256', webhookSecret)
    //     .update(JSON.stringify(req.body))
    //     .digest('base64');
    //   
    //   if (hash !== signature) {
    //     logger.error('❌ Invalid WooCommerce webhook signature');
    //     return;
    //   }
    // }

    const product = req.body;

    // Find which business this webhook belongs to
    const businessId = await findBusinessByStoreUrl(sourceUrl);
    
    if (!businessId) {
      logger.warn(`⚠️ No business found for store URL: ${sourceUrl}`);
      return;
    }

    // Handle different webhook events
    switch (topic) {
      case 'product.created':
        await handleProductCreated(businessId, product);
        break;
      
      case 'product.updated':
        await handleProductUpdated(businessId, product);
        break;
      
      case 'product.deleted':
        await handleProductDeleted(businessId, product);
        break;
      
      default:
        logger.info(`ℹ️ Unhandled webhook topic: ${topic}`);
    }

  } catch (error) {
    logger.error('Error processing WooCommerce webhook:', error);
  }
});

/**
 * Find business by WooCommerce store URL
 */
async function findBusinessByStoreUrl(storeUrl) {
  try {
    // Extract domain from URL
    const domain = new URL(storeUrl).hostname;
    
    // Query integrations table to find matching business
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('business_id, credentials')
      .eq('platform', 'woocommerce')
      .eq('is_active', true);
    
    if (error) {
      logger.error('Error querying integrations:', error);
      return null;
    }
    
    // Find integration with matching store URL
    for (const integration of integrations) {
      const storeUrl = integration.credentials?.store_url;
      if (storeUrl) {
        const storeDomain = new URL(storeUrl).hostname;
        if (storeDomain === domain) {
          return integration.business_id;
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding business by store URL:', error);
    return null;
  }
}

/**
 * Handle product created/updated webhook
 */
async function handleProductCreated(businessId, product) {
  try {
    logger.info(`➕ Syncing product: ${product.name} (ID: ${product.id})`);
    
    // Extract variant/option data
    let has_variants = false;
    let variant_options = null;
    
    if (Array.isArray(product.variations) && product.variations.length > 0) {
      has_variants = true;
    }
    
    if (Array.isArray(product.attributes) && product.attributes.length > 0) {
      variant_options = {};
      product.attributes.forEach(attr => {
        if (attr.name && Array.isArray(attr.options)) {
          variant_options[attr.name] = attr.options;
        }
      });
    }
    
    // Upsert product to database
    const { error } = await supabase
      .from('products')
      .upsert({
        business_id: businessId,
        external_id: product.id.toString(),
        name: product.name,
        description: product.description || product.short_description || '',
        price: parseFloat(product.price) || 0,
        sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
        category: product.categories?.[0]?.name || 'Uncategorized',
        image_url: product.images?.[0]?.src || null,
        stock_quantity: product.stock_quantity,
        sku: product.sku || null,
        is_active: product.status === 'publish',
        source_platform: 'woocommerce',
        product_url: product.permalink || null,
        has_variants,
        variant_options,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,external_id',
      });
    
    if (error) {
      throw error;
    }
    
    // Trigger embedding generation
    setTimeout(() => {
      productSyncService.syncAllProducts();
    }, 1000);
    
    logger.info(`✅ Product synced: ${product.name}`);
  } catch (error) {
    logger.error('Error handling product created/updated:', error);
  }
}

/**
 * Handle product updated webhook (same as created)
 */
async function handleProductUpdated(businessId, product) {
  return handleProductCreated(businessId, product);
}

/**
 * Handle product deleted webhook
 */
async function handleProductDeleted(businessId, product) {
  try {
    logger.info(`🗑️ Deleting product: ${product.name} (ID: ${product.id})`);
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('business_id', businessId)
      .eq('external_id', product.id.toString());
    
    if (error) {
      throw error;
    }
    
    logger.info(`✅ Product deleted: ${product.name}`);
  } catch (error) {
    logger.error('Error handling product deleted:', error);
  }
}

/**
 * Test endpoint to verify webhook is accessible
 */
router.get('/webhook/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WooCommerce webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
  });
});

export default router;
