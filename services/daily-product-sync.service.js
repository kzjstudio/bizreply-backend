import cron from 'node-cron';
import axios from 'axios';
import { logger } from '../src/utils/logger.js';

/**
 * Daily Product Sync Service
 * 
 * This is a FALLBACK sync that runs once daily at 3 AM
 * to catch any products that webhooks might have missed.
 * 
 * Primary sync method is WooCommerce webhooks (real-time)
 * This daily sync ensures no products are ever missed
 */
class DailyProductSyncService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Start the daily sync cron job
   * Runs at 3:00 AM every day
   */
  startCronJob() {
    if (this.isRunning) {
      logger.info('📦 Daily product sync service already running');
      return;
    }

    // Run at 3:00 AM every day
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      await this.syncAllBusinessProducts();
    });

    this.isRunning = true;
    logger.info('📦 Daily product sync service started (runs at 3:00 AM)');
  }

  /**
   * Stop the cron job
   */
  stopCronJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      logger.info('📦 Daily product sync service stopped');
    }
  }

  /**
   * Sync products for all active WooCommerce integrations
   */
  async syncAllBusinessProducts() {
    try {
      logger.info('📦 Starting daily product sync fallback...');

      // Call our own API to sync all businesses
      const apiUrl = process.env.API_URL || 'http://localhost:3000';
      
      const response = await axios.post(`${apiUrl}/api/integrations/sync-all`, {
        // This will be a new endpoint we'll add
      });

      logger.info(`✅ Daily sync completed: ${response.data.message}`);
    } catch (error) {
      logger.error('❌ Error in daily product sync:', error.message);
    }
  }

  /**
   * Manually trigger sync (for testing)
   */
  async triggerSync() {
    await this.syncAllBusinessProducts();
  }
}

// Create singleton instance
const dailyProductSyncService = new DailyProductSyncService();

export default dailyProductSyncService;
