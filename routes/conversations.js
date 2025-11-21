import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger.js';
import { sendWhatsAppMessage } from '../src/services/whatsapp.service.js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/conversations/:businessId
 * Get all conversations for a business
 */
router.get('/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { status = 'all', limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('business_id', businessId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status === 'escalated') {
      query = query.eq('escalation_requested', true).neq('mode', 'human');
    } else if (status === 'human') {
      query = query.eq('mode', 'human');
    } else if (status === 'ai') {
      query = query.eq('mode', 'ai');
    }

    const { data: conversations, error } = await query;

    if (error) throw error;

    // Get last message for each conversation
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);
        
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        return {
          ...conv,
          message_count: count || 0,
          last_message: lastMessage || null
        };
      })
    );

    res.json({
      success: true,
      data: conversationsWithCounts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: conversationsWithCounts.length
      }
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations/:businessId/escalated
 * Get all escalated conversations needing human attention
 */
router.get('/:businessId/escalated', async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', businessId)
      .eq('escalation_requested', true)
      .neq('mode', 'human')
      .order('escalation_requested_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: conversations, count: conversations.length });
  } catch (error) {
    logger.error('Error fetching escalated conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations/:businessId/:conversationId/messages
 * Get all messages in a conversation
 */
router.get('/:businessId/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/conversations/:businessId/:conversationId/takeover
 * Business owner takes over conversation from AI
 */
router.post('/:businessId/:conversationId/takeover', async (req, res) => {
  try {
    const { conversationId, businessId } = req.params;
    const { userId } = req.body; // User ID from auth

    // Update conversation mode to human
    const { data: conversation, error } = await supabase
      .from('conversations')
      .update({
        mode: 'human',
        assigned_to: userId,
        assigned_at: new Date().toISOString(),
        escalation_requested: false, // Clear escalation flag
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw error;

    // Send acknowledgment message to customer
    const { data: business } = await supabase
      .from('businesses')
      .select('phone_number_id')
      .eq('id', businessId)
      .single();

    if (business?.phone_number_id && conversation?.customer_phone) {
      await sendWhatsAppMessage({
        to: conversation.customer_phone,
        message: "Thanks for your patience! A team member is now handling your conversation. 👤",
        phoneNumberId: business.phone_number_id
      });

      // Save the takeover message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        business_id: businessId,
        direction: 'outgoing',
        message_text: "Thanks for your patience! A team member is now handling your conversation. 👤",
        from_phone: business.phone_number_id,
        to_phone: conversation.customer_phone,
        sent_by: 'automation',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`✅ Conversation ${conversationId} taken over by user ${userId}`);
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Error taking over conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/conversations/:businessId/:conversationId/release
 * Release conversation back to AI control
 */
router.post('/:businessId/:conversationId/release', async (req, res) => {
  try {
    const { conversationId, businessId } = req.params;

    const { data: conversation, error } = await supabase
      .from('conversations')
      .update({
        mode: 'ai',
        assigned_to: null,
        assigned_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw error;

    logger.info(`✅ Conversation ${conversationId} released back to AI`);
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Error releasing conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/conversations/:businessId/:conversationId/send
 * Send manual message from business owner
 */
router.post('/:businessId/:conversationId/send', async (req, res) => {
  try {
    const { conversationId, businessId } = req.params;
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Get conversation and business details
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    const { data: business } = await supabase
      .from('businesses')
      .select('phone_number_id')
      .eq('id', businessId)
      .single();

    if (!conversation || !business?.phone_number_id) {
      return res.status(404).json({ success: false, error: 'Conversation or business not found' });
    }

    // Send message via WhatsApp
    const result = await sendWhatsAppMessage({
      to: conversation.customer_phone,
      message: message,
      phoneNumberId: business.phone_number_id
    });

    if (result.success) {
      // Save message to database
      const { data: savedMessage, error: saveError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          business_id: businessId,
          direction: 'outgoing',
          message_text: message,
          from_phone: business.phone_number_id,
          to_phone: conversation.customer_phone,
          sent_by: 'manual',
          message_sid: result.messageId,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      logger.info(`✅ Manual message sent by user ${userId} in conversation ${conversationId}`);
      res.json({ success: true, data: savedMessage });
    } else {
      throw new Error(result.error || 'Failed to send message');
    }
  } catch (error) {
    logger.error('Error sending manual message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/conversations/:businessId/:conversationId
 * Update conversation details (notes, archive, etc.)
 */
router.patch('/:businessId/:conversationId', async (req, res) => {
  try {
    const { conversationId, businessId } = req.params;
    const updates = req.body;

    // Only allow certain fields to be updated
    const allowedUpdates = ['customer_name', 'customer_notes', 'is_archived'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    filteredUpdates.updated_at = new Date().toISOString();

    const { data: conversation, error } = await supabase
      .from('conversations')
      .update(filteredUpdates)
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Error updating conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations/:businessId/stats
 * Get conversation statistics for dashboard
 */
router.get('/:businessId/stats', async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: stats } = await supabase.rpc('get_conversation_stats', {
      p_business_id: businessId
    });

    // Fallback if RPC doesn't exist
    if (!stats) {
      const { count: totalConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      const { count: escalatedCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('escalation_requested', true);

      const { count: humanModeCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('mode', 'human');

      return res.json({
        success: true,
        data: {
          total_conversations: totalConversations || 0,
          pending_escalations: escalatedCount || 0,
          active_human_chats: humanModeCount || 0
        }
      });
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching conversation stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
