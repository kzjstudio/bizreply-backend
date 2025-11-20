import express from 'express';
import { createClient } from '@supabase/supabase-js';
import productSyncService from '../services/productSyncService.js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/sync/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: business, error } = await supabase
      .from('businesses')
      .select('id, business_name')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found',
      });
    }

    const result = await productSyncService.syncBusinessProducts(businessId);

    res.json({
      success: true,
      message: Successfully synced ${result.count} products,
      count: result.count,
    });
  } catch (error) {
    console.error('Error in sync endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync products',
      error: error.message,
    });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { businessId, query, limit = 10 } = req.body;

    if (!businessId || !query) {
      return res.status(400).json({
        success: false,
        message: 'businessId and query are required',
      });
    }

    const results = await productSyncService.searchProducts(businessId, query, limit);

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message,
    });
  }
});

router.post('/recommendations', async (req, res) => {
  try {
    const { businessId, context, limit = 5 } = req.body;

    if (!businessId || !context) {
      return res.status(400).json({
        success: false,
        message: 'businessId and context are required',
      });
    }

    const recommendations = await productSyncService.getRecommendations(
      businessId,
      context,
      limit
    );

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error('Error in recommendations endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message,
    });
  }
});

router.get('/sync/status', (req, res) => {
  res.json({
    success: true,
    status: {
      isRunning: productSyncService.isRunning,
      interval: productSyncService.syncInterval,
      model: productSyncService.embeddingModel,
      dimensions: productSyncService.embeddingDimensions,
    },
  });
});

export default router;
