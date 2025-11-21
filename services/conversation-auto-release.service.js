import { createClient } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Auto-release conversations that have been in human mode 
 * with no activity for more than the timeout period
 */
class ConversationAutoReleaseService {
  constructor() {
    // Default timeout: 30 minutes
    this.timeoutMinutes = parseInt(process.env.CONVERSATION_TIMEOUT_MINUTES) || 30;
  }

  /**
   * Check and auto-release stale conversations
   * This should be called periodically (e.g., every 5 minutes via cron)
   */
  async checkAndReleaseStaleConversations() {
    try {
      logger.info('🔄 Checking for stale human-mode conversations...');

      const timeoutDate = new Date();
      timeoutDate.setMinutes(timeoutDate.getMinutes() - this.timeoutMinutes);

      // Find conversations that:
      // 1. Are in human mode
      // 2. Last message was sent more than timeout minutes ago
      const { data: staleConversations, error } = await supabase
        .from('conversations')
        .select('id, business_id, customer_phone, customer_name, assigned_to, last_message_at')
        .eq('mode', 'human')
        .lt('last_message_at', timeoutDate.toISOString());

      if (error) {
        logger.error('Error fetching stale conversations:', error);
        throw error;
      }

      if (!staleConversations || staleConversations.length === 0) {
        logger.info('✅ No stale conversations found');
        return { released: 0, conversations: [] };
      }

      logger.info(`Found ${staleConversations.length} stale conversation(s)`);

      // Release each conversation
      const releasedConversations = [];
      for (const conversation of staleConversations) {
        try {
          await this.releaseConversation(conversation);
          releasedConversations.push(conversation);
        } catch (error) {
          logger.error(`Error releasing conversation ${conversation.id}:`, error);
        }
      }

      logger.info(`✅ Auto-released ${releasedConversations.length} conversation(s)`);

      return {
        released: releasedConversations.length,
        conversations: releasedConversations,
      };
    } catch (error) {
      logger.error('Error in checkAndReleaseStaleConversations:', error);
      throw error;
    }
  }

  /**
   * Release a single conversation back to AI
   */
  async releaseConversation(conversation) {
    logger.info(`Releasing conversation ${conversation.id} (${conversation.customer_phone})`);

    // Update conversation to AI mode
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        mode: 'ai',
        assigned_to: null,
        assigned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    if (updateError) throw updateError;

    // Send a handback message to customer
    await this.sendHandbackMessage(conversation);

    logger.info(`✅ Conversation ${conversation.id} released to AI`);
  }

  /**
   * Send a message to the customer informing them about the handback
   */
  async sendHandbackMessage(conversation) {
    try {
      const handbackMessage = 
        "Thank you for your patience! Our AI assistant will continue helping you. " +
        "Feel free to request human assistance anytime if needed.";

      // Save the handback message to database
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          message_text: handbackMessage,
          sender: 'business',
          sent_by: 'system',
          direction: 'outgoing',
          timestamp: new Date().toISOString(),
        });

      if (error) {
        logger.error('Error saving handback message:', error);
      }

      // TODO: Send via WhatsApp API
      // This would use Twilio or Meta WhatsApp API to actually send the message
      // For now, we just log it
      logger.info(`Handback message saved for conversation ${conversation.id}`);
    } catch (error) {
      logger.error('Error sending handback message:', error);
    }
  }

  /**
   * Start the auto-release cron job
   * Runs every 5 minutes by default
   */
  startCronJob() {
    const intervalMinutes = parseInt(process.env.AUTO_RELEASE_CHECK_INTERVAL) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info(`🚀 Starting conversation auto-release cron (checking every ${intervalMinutes} minutes)`);
    logger.info(`⏱️  Timeout threshold: ${this.timeoutMinutes} minutes of inactivity`);

    // Run immediately on start
    this.checkAndReleaseStaleConversations();

    // Then run periodically
    setInterval(() => {
      this.checkAndReleaseStaleConversations();
    }, intervalMs);
  }
}

export default new ConversationAutoReleaseService();
