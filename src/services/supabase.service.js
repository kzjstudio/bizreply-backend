import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Initialize Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// =====================================================
// BUSINESS FUNCTIONS
// =====================================================

/**
 * Get business by phone number ID (Twilio WhatsApp number)
 */
export const getBusinessByPhone = async (phoneNumberId) => {
  try {
    console.log('[Supabase] Looking up business by phoneNumberId:', phoneNumberId);
    
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .single();
    
    if (error) {
      console.error('[Supabase] Error fetching business:', error);
      return null;
    }
    
    console.log('[Supabase] Business found:', data?.business_name);
    return data;
  } catch (error) {
    console.error('[Supabase] Exception in getBusinessByPhone:', error);
    return null;
  }
};

/**
 * Update business information
 */
export const updateBusiness = async (businessId, updates) => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Supabase] Error updating business:', error);
    throw error;
  }
};

// =====================================================
// CONVERSATION FUNCTIONS
// =====================================================

/**
 * Get or create conversation for a customer
 */
export const getOrCreateConversation = async (businessId, customerPhone) => {
  try {
    // Try to find existing conversation
    let { data: conversation, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('business_id', businessId)
      .eq('customer_phone', customerPhone)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    // Create new conversation if not found
    if (!conversation) {
      const { data: newConversation, error: insertError } = await supabase
        .from('conversations')
        .insert({
          business_id: businessId,
          customer_phone: customerPhone
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      conversation = newConversation;
    }
    
    return conversation.id;
  } catch (error) {
    console.error('[Supabase] Error in getOrCreateConversation:', error);
    throw error;
  }
};

/**
 * Get conversation history (last N messages)
 */
export const getConversationHistory = async (businessId, customerPhone, limit = 5) => {
  try {
    // First get the conversation ID
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('business_id', businessId)
      .eq('customer_phone', customerPhone)
      .single();
    
    if (!conversation) return [];
    
    // Get messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    // Return in chronological order (oldest first)
    return (messages || []).reverse();
  } catch (error) {
    console.error('[Supabase] Error fetching conversation history:', error);
    return [];
  }
};

/**
 * Get conversation mode (check if human is handling it)
 */
export const getConversationMode = async (conversationId) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('mode, escalation_requested')
      .eq('id', conversationId)
      .single();
    
    if (error) {
      console.error('[Supabase] Error getting conversation mode:', error);
      return { mode: 'ai', escalationRequested: false }; // Default to AI mode
    }
    
    return {
      mode: data?.mode || 'ai',
      escalationRequested: data?.escalation_requested || false
    };
  } catch (error) {
    console.error('[Supabase] Error in getConversationMode:', error);
    return { mode: 'ai', escalationRequested: false };
  }
};

/**
 * Update conversation escalation status
 */
export const updateConversationEscalation = async (conversationId, escalationData) => {
  try {
    const { escalationRequested, escalationReason, escalationCount } = escalationData;
    
    const updateData = {
      escalation_requested: escalationRequested,
      escalation_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (escalationReason) {
      updateData.escalation_reason = escalationReason;
    }
    
    if (escalationCount !== undefined) {
      updateData.escalation_count = escalationCount;
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[Supabase] Conversation escalated:', conversationId);
    return data;
  } catch (error) {
    console.error('[Supabase] Error updating escalation:', error);
    throw error;
  }
};

// =====================================================
// MESSAGE FUNCTIONS
// =====================================================

/**
 * Save a message to the database
 */
export const saveMessage = async (messageData) => {
  try {
    const {
      businessId,
      customerPhone,
      direction,
      messageText,
      fromPhone,
      toPhone,
      messageSid,
      sentBy = 'ai',
      aiConfidence = null
    } = messageData;
    
    // Get or create conversation
    const conversationId = await getOrCreateConversation(businessId, customerPhone);
    
    // Insert message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        business_id: businessId,
        message_sid: messageSid,
        direction,
        message_text: messageText,
        from_phone: fromPhone,
        to_phone: toPhone,
        sent_by: sentBy,
        ai_confidence: aiConfidence
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    console.log('[Supabase] Message saved:', data.id);
    return data;
  } catch (error) {
    console.error('[Supabase] Error saving message:', error);
    throw error;
  }
};

// =====================================================
// PRODUCT FUNCTIONS (for future use)
// =====================================================

/**
 * Get products for a business
 */
export const getBusinessProducts = async (businessId, filters = {}) => {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true);
    
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters.inStock) {
      query = query.gt('inventory_quantity', 0);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase] Error fetching products:', error);
    return [];
  }
};

/**
 * Search products by text (full-text search)
 */
export const searchProducts = async (businessId, searchQuery) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .textSearch('name', searchQuery)
      .limit(10);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase] Error searching products:', error);
    return [];
  }
};

export default {
  supabase,
  getBusinessByPhone,
  updateBusiness,
  getOrCreateConversation,
  getConversationHistory,
  getConversationMode,
  updateConversationEscalation,
  saveMessage,
  getBusinessProducts,
  searchProducts
};

