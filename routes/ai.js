import express from 'express';
import { createClient } from '@supabase/supabase-js';
import aiEngine from '../services/aiEngine.js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/ai/generate
 * Generate AI response for a customer message
 */
router.post('/generate', async (req, res) => {
  try {
    const { businessId, conversationId, message } = req.body;

    if (!businessId || !conversationId || !message) {
      return res.status(400).json({
        success: false,
        message: 'businessId, conversationId, and message are required',
      });
    }

    const result = await aiEngine.generateResponse(
      businessId,
      conversationId,
      message
    );

    res.json(result);
  } catch (error) {
    console.error('Error in AI generate endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI response',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/greeting
 * Generate greeting message for new conversation
 */
router.post('/greeting', async (req, res) => {
  try {
    const { businessId } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'businessId is required',
      });
    }

    const greeting = await aiEngine.generateGreeting(businessId);

    res.json({
      success: true,
      greeting,
    });
  } catch (error) {
    console.error('Error in AI greeting endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate greeting',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/intent
 * Analyze customer message intent
 */
router.post('/intent', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required',
      });
    }

    const intent = aiEngine.analyzeIntent(message);

    res.json({
      success: true,
      intent,
    });
  } catch (error) {
    console.error('Error in AI intent endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze intent',
      error: error.message,
    });
  }
});

/**
 * GET /api/ai/config/:businessId
 * Get AI configuration for a business
 */
router.get('/config/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;

    const config = await aiEngine.getBusinessConfig(businessId);

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error in AI config endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI configuration',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/test
 * Test AI response with custom parameters
 */
router.post('/test', async (req, res) => {
  try {
    const {
      businessId,
      message,
      includeProducts = true,
      includeHistory = false,
    } = req.body;

    if (!businessId || !message) {
      return res.status(400).json({
        success: false,
        message: 'businessId and message are required',
      });
    }

    // Create a test conversation
    const testConversationId = 'test-' + Date.now();

    // Get business config
    const businessConfig = await aiEngine.getBusinessConfig(businessId);

    // Get products if requested
    let products = [];
    if (includeProducts) {
      products = await aiEngine.getRelevantProducts(businessId, message, 5);
    }

    // Build system prompt
    const systemPrompt = aiEngine.buildSystemPrompt(businessConfig, products);

    // Build messages
    const messages = aiEngine.buildConversationMessages([], message, systemPrompt);

    res.json({
      success: true,
      test: {
        businessConfig,
        productsFound: products.length,
        products: products.slice(0, 3), // Show first 3 products
        systemPrompt: systemPrompt.substring(0, 500) + '...', // Preview
        messagesCount: messages.length,
      },
    });
  } catch (error) {
    console.error('Error in AI test endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test AI',
      error: error.message,
    });
  }
});

export default router;
