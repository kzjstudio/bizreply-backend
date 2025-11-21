import express from 'express';
import pkg from '@woocommerce/woocommerce-rest-api';
const WooCommerce = pkg.default;
import { supabase } from '../src/services/supabase.service.js';
import productSyncService from '../services/productSyncService.js';

const router = express.Router();

/**
 * POST /api/integrations/connect
 * Connect a new integration (WooCommerce, Shopify, etc.)
 */
router.post('/connect', async (req, res) => {
  try {
    const { business_id, platform, credentials } = req.body;

    if (!business_id || !platform || !credentials) {
      return res.status(400).json({
        error: 'Missing required fields: business_id, platform, credentials',
      });
    }

    // Test connection first
    let connectionValid = false;
    
    if (platform === 'woocommerce') {
      const { store_url, consumer_key, consumer_secret } = credentials;
      
      if (!store_url || !consumer_key || !consumer_secret) {
        return res.status(400).json({
          error: 'Missing WooCommerce credentials: store_url, consumer_key, consumer_secret',
        });
      }

      try {
        const woocommerce = new WooCommerce({
          url: store_url,
          consumerKey: consumer_key,
          consumerSecret: consumer_secret,
          version: 'wc/v3',
        });

        // Test connection by fetching store info
        await woocommerce.get('system_status');
        connectionValid = true;
      } catch (error) {
        return res.status(400).json({
          error: 'Failed to connect to WooCommerce store',
          details: error.message,
        });
      }
    } else {
      return res.status(400).json({
        error: `Platform ${platform} is not yet supported`,
      });
    }

    // Save integration to database
    const { data: integration, error: dbError } = await supabase
      .from('integrations')
      .upsert({
        business_id,
        platform,
        credentials, // Note: In production, encrypt these!
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,platform',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        error: 'Failed to save integration',
        details: dbError.message,
      });
    }

    res.status(201).json({
      success: true,
      integration,
      message: `${platform} connected successfully`,
    });
  } catch (error) {
    console.error('Integration connect error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * POST /api/integrations/sync
 * Sync products from an integration
 */
router.post('/sync', async (req, res) => {
  try {
    const { business_id, platform } = req.body;

    if (!business_id || !platform) {
      return res.status(400).json({
        error: 'Missing required fields: business_id, platform',
      });
    }

    // Get integration credentials
    const { data: integration, error: fetchError } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', business_id)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (fetchError || !integration) {
      return res.status(404).json({
        error: 'Integration not found or not active',
      });
    }

    let productsSynced = 0;

    if (platform === 'woocommerce') {
      const { store_url, consumer_key, consumer_secret } = integration.credentials;

      const woocommerce = new WooCommerce({
        url: store_url,
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        version: 'wc/v3',
      });

      // Fetch products from WooCommerce
      const response = await woocommerce.get('products', {
        per_page: 100,
        status: 'publish',
      });

      const products = response.data;

      // Sync each product to database, including product_url (permalink) and variants/options
      for (const product of products) {
        // Extract variant/option data
        let has_variants = false;
        let variant_options = null;
        let platform_variant_id = null;
        if (Array.isArray(product.variations) && product.variations.length > 0) {
          has_variants = true;
          // Fetch variant details from WooCommerce if needed (optional: can be expanded)
        }
        // Extract options/attributes (e.g., size, color)
        if (Array.isArray(product.attributes) && product.attributes.length > 0) {
          variant_options = {};
          product.attributes.forEach(attr => {
            if (attr.name && Array.isArray(attr.options)) {
              variant_options[attr.name] = attr.options;
            }
          });
        }
        // Upsert product with variant/option fields
        const { data, error } = await supabase
          .from('products')
          .upsert({
            business_id,
            external_id: product.id.toString(),
            name: product.name,
            description: product.description || product.short_description,
            price: parseFloat(product.price) || 0,
            sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
            category: product.categories?.[0]?.name || 'Uncategorized',
            image_url: product.images?.[0]?.src || null,
            stock_quantity: product.stock_quantity,
            sku: product.sku,
            is_active: product.status === 'publish',
            source_platform: 'woocommerce',
            updated_at: new Date().toISOString(),
            product_url: product.permalink || null,
            has_variants,
            variant_options,
            platform_variant_id: platform_variant_id || null,
          }, {
            onConflict: 'business_id,external_id',
          });

        if (!error) {
          productsSynced++;
        }
      }

      // Update last sync time
      await supabase
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          products_count: productsSynced,
        })
        .eq('business_id', business_id)
        .eq('platform', platform);

      // Trigger embedding generation for new products
      setTimeout(() => {
        productSyncService.syncAllProducts();
      }, 1000);
    }

    res.json({
      success: true,
      products_synced: productsSynced,
      message: `Synced ${productsSynced} products from ${platform}`,
    });
  } catch (error) {
    console.error('Integration sync error:', error);
    res.status(500).json({
      error: 'Sync failed',
      details: error.message,
    });
  }
});

/**
 * GET /api/integrations
 * Get all integrations for a business
 */
router.get('/', async (req, res) => {
  try {
    const { business_id } = req.query;

    if (!business_id) {
      return res.status(400).json({
        error: 'Missing required parameter: business_id',
      });
    }

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch integrations',
        details: error.message,
      });
    }

    // Don't expose credentials in the list
    const sanitized = integrations.map(int => ({
      id: int.id,
      platform: int.platform,
      is_active: int.is_active,
      last_sync_at: int.last_sync_at,
      products_count: int.products_count || 0,
      created_at: int.created_at,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/integrations/:businessId/:platform
 * Disconnect an integration
 */
router.delete('/:businessId/:platform', async (req, res) => {
  try {
    const { businessId, platform } = req.params;

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('business_id', businessId)
      .eq('platform', platform);

    if (error) {
      return res.status(500).json({
        error: 'Failed to delete integration',
        details: error.message,
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete integration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

export default router;
