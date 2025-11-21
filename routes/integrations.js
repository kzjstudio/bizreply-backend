
import express from 'express';
import axios from 'axios';
import pkg from '@woocommerce/woocommerce-rest-api';
const WooCommerce = pkg.default;
import { supabase } from '../src/services/supabase.service.js';
import productSyncService from '../services/productSyncService.js';

const router = express.Router();

// All route definitions must come after router is initialized
// GET /api/integrations/status/:businessId
// Aggregates integration status, credential keys, policy availability, and diagnostics
router.get('/status/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', businessId);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch integrations', details: error.message });
    }

    const active = (integrations || []).filter(i => i.is_active);
    const inactive = (integrations || []).filter(i => !i.is_active);
    const credentialKeys = integrations.map(i => ({ platform: i.platform, keys: Object.keys(i.credentials || {}) }));

    // Check if policies are available (simulate by checking if at least one active integration)
    const policiesAvailable = active.length > 0;

    res.json({
      business_id: businessId,
      integrations_count: integrations.length,
      active_count: active.length,
      inactive_count: inactive.length,
      credential_keys: credentialKeys,
      policies_available: policiesAvailable,
      integrations,
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', details: e.message });
  }
});

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
 * GET /api/integrations/:businessId/policies
 * Import store policies from connected integration
 */
router.get('/:businessId/policies', async (req, res) => {
  try {
    const { businessId } = req.params;

    // Fetch all integrations for diagnostics
    const { data: allIntegrations, error: allError } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', businessId);

    if (allError) {
      return res.status(500).json({
        error: 'Failed to fetch integrations',
        details: allError.message,
      });
    }

    const activeIntegrations = (allIntegrations || []).filter(i => i.is_active);

    if (!activeIntegrations.length) {
      // Differentiate between no integrations vs only inactive
      if (!allIntegrations || allIntegrations.length === 0) {
        return res.status(404).json({
          error: 'No integrations found for this business',
          diagnostics: {
            total_integrations: 0,
            active_integrations: 0,
            inactive_integrations: 0,
          },
        });
      } else {
        return res.status(409).json({
          error: 'Integrations found but none are active',
          diagnostics: {
            total_integrations: allIntegrations.length,
            active_integrations: 0,
            inactive_integrations: allIntegrations.length,
            platforms: allIntegrations.map(i => ({ id: i.id, platform: i.platform, is_active: i.is_active })),
          },
        });
      }
    }

    // Use the first active integration (could extend to allow selecting platform)
    const integration = activeIntegrations[0];
    const { platform, credentials } = integration;
    const totalIntegrations = allIntegrations.length;
    const activeCount = activeIntegrations.length;

    let policies = {};
    let provenance = [];

    if (platform === 'woocommerce') {
      try {
        const woocommerce = new WooCommerce({
          url: credentials.store_url,
          consumerKey: credentials.consumer_key,
          consumerSecret: credentials.consumer_secret,
          version: 'wc/v3',
        });

        // Fetch payment gateways for refund policy info
        const gateways = await woocommerce.get('payment_gateways');
        provenance.push({ source: 'woocommerce', endpoint: 'payment_gateways', fetched_at: new Date().toISOString() });
        // Fetch shipping zones and methods
        const shippingZones = await woocommerce.get('shipping/zones');
        provenance.push({ source: 'woocommerce', endpoint: 'shipping/zones', fetched_at: new Date().toISOString() });
        // Fetch store settings
        const settings = await woocommerce.get('settings/general');
        provenance.push({ source: 'woocommerce', endpoint: 'settings/general', fetched_at: new Date().toISOString() });

        // Build policies from WooCommerce data
        const baseUrl = credentials.store_url.replace(/\/$/, '');

        // --- Fetch WP policy pages ---
        let wpPages = {};
        const wpPolicySlugs = ['privacy-policy','refund','returns','terms','shipping','payment','warranty'];
        for (const slug of wpPolicySlugs) {
          try {
            const wpRes = await axios.get(`${baseUrl}/wp-json/wp/v2/pages?slug=${slug}`);
            if (Array.isArray(wpRes.data) && wpRes.data.length > 0) {
              wpPages[slug] = {
                title: wpRes.data[0].title?.rendered,
                html: wpRes.data[0].content?.rendered,
                plain: wpRes.data[0].content?.rendered?.replace(/<[^>]+>/g, ''),
                source: `${baseUrl}/wp-json/wp/v2/pages?slug=${slug}`,
                fetched_at: new Date().toISOString(),
              };
              provenance.push({ source: 'wordpress', endpoint: `wp/v2/pages?slug=${slug}`, fetched_at: new Date().toISOString() });
            }
          } catch (e) {
            // Ignore missing pages
          }
        }

        // Return policy (prefer WP page, else synthesize)
        policies.return_policy = wpPages['returns']?.plain || wpPages['refund']?.plain ||
          `We accept returns within 30 days of purchase for a full refund.\n\n` +
          `Items must be:\n` +
          `• Unused and in original condition\n` +
          `• In original packaging with all tags attached\n` +
          `• Accompanied by proof of purchase\n\n` +
          `To initiate a return, please contact us with your order number. ` +
          `Customer is responsible for return shipping costs unless the item is defective or we made an error.`;

        // Refund policy (prefer WP page, else synthesize)
        policies.refund_policy = wpPages['refund']?.plain ||
          `Refunds are processed within 5-7 business days after we receive and inspect the returned item.\n\n` +
          `Refund will be issued to the original payment method. Please note:\n` +
          `• Original shipping costs are non-refundable\n` +
          `• Partial refunds may apply if item shows signs of use\n` +
          `• Refund processing time depends on your bank (usually 3-5 business days)\n\n` +
          `For defective items, we cover return shipping and process refunds immediately upon receipt.`;

        // Shipping policy (prefer WP page, else synthesize from shipping zones)
        policies.shipping_policy = wpPages['shipping']?.plain || (await (async () => {
          let shippingText = 'We offer the following shipping options:\n\n';
          if (shippingZones.data && shippingZones.data.length > 0) {
            for (const zone of shippingZones.data) {
              if (zone.id !== 0) {
                try {
                  const methods = await woocommerce.get(`shipping/zones/${zone.id}/methods`);
                  if (methods.data && methods.data.length > 0) {
                    shippingText += `${zone.name}:\n`;
                    for (const method of methods.data) {
                      if (method.enabled) {
                        const cost = method.settings?.cost?.value || 'Free';
                        shippingText += `• ${method.title}: ${cost === 'Free' ? 'Free' : '$' + cost}\n`;
                      }
                    }
                    shippingText += '\n';
                  }
                } catch (e) {}
              }
            }
          } else {
            shippingText += `• Standard Shipping: Calculated at checkout\n\n`;
          }
          shippingText += `Orders are typically processed within 1-2 business days. ` +
            `You will receive a tracking number via email once your order ships.`;
          return shippingText;
        })());

        // Privacy policy (prefer WP page, else synthesize)
        policies.privacy_policy = wpPages['privacy-policy']?.plain ||
          `We respect your privacy and are committed to protecting your personal information.\n\n` +
          `Information We Collect:\n` +
          `• Name, email, phone number, and shipping address for order processing\n` +
          `• Payment information (processed securely through our payment provider)\n\n` +
          `How We Use Your Information:\n` +
          `• To process and fulfill your orders\n` +
          `• To communicate with you about your orders\n` +
          `• To improve our services\n\n` +
          `We NEVER share, sell, or rent your personal information to third parties for marketing purposes.\n\n` +
          `For more details, visit: ${baseUrl}/privacy-policy`;

        // Terms of service (prefer WP page, else synthesize)
        policies.terms_of_service = wpPages['terms']?.plain ||
          `By using our services and making a purchase, you agree to these terms:\n\n` +
          `1. All information provided must be accurate and complete\n` +
          `2. Prices and availability are subject to change without notice\n` +
          `3. We reserve the right to refuse service to anyone\n` +
          `4. Product images are for reference only; actual colors may vary\n` +
          `5. We are not liable for delays caused by shipping carriers\n\n` +
          `For complete terms, visit: ${baseUrl}/terms-of-service`;

        // Payment policy (prefer WP page, else synthesize)
        policies.payment_policy = wpPages['payment']?.plain ||
          'We accept the following payment methods: ' +
          (gateways.data ? gateways.data.filter(g => g.enabled).map(g => g.title).join(', ') : 'Credit Card, PayPal, and more.') +
          '. All payments are processed securely.';

        // Warranty policy (prefer WP page, else blank)
        policies.warranty_policy = wpPages['warranty']?.plain || '';

        res.json({
          success: true,
          requested_business_id: businessId,
          integration_business_id: integration.business_id,
          platform: 'woocommerce',
          policies,
          provenance,
          diagnostics: {
            total_integrations: totalIntegrations,
            active_integrations: activeCount,
            first_integration_id: integration.id,
          },
        });

      } catch (error) {
        console.error('WooCommerce API error:', error);
        return res.status(500).json({
          error: 'Failed to fetch policies from WooCommerce',
          details: error.message,
        });
      }
    } else {
      return res.status(400).json({
        error: `Policy import not yet supported for platform: ${platform}`,
        diagnostics: {
          platform,
          supported: ['woocommerce'],
        },
      });
    }

  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /api/integrations/debug/:businessId
 * Return all integration rows (sanitized) for a business for troubleshooting
 */
router.get('/debug/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', businessId);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch integrations', details: error.message });
    }

    const sanitized = (data || []).map(row => ({
      id: row.id,
      business_id: row.business_id,
      platform: row.platform,
      is_active: row.is_active,
      last_sync_at: row.last_sync_at,
      products_count: row.products_count,
      // Show credential keys present (not values) for quick validation
      credential_keys: row.credentials ? Object.keys(row.credentials) : [],
    }));

    res.json({ success: true, count: sanitized.length, integrations: sanitized });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', details: e.message });
  }
});

/**
 * GET /api/integrations/fk-status
 * Returns foreign key constraint metadata for integrations.business_id
 */
router.get('/fk-status', async (_req, res) => {
  try {
    const { data, error } = await supabase.rpc('list_integrations_fk');
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch FK status', details: error.message });
    }
    res.json({ success: true, rows: data });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', details: e.message });
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
