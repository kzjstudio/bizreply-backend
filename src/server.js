import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import whatsappRoutes from './routes/whatsapp.routes.js';
import businessRoutes from './routes/business.routes.js';
import productsRoutes from '../routes/products.js';
import aiRoutes from '../routes/ai.js';
import conversationsRoutes from '../routes/conversations.js';
import billingRoutes from '../routes/billing.js';
import webhookRoutes from '../routes/webhooks.js';
import instagramRoutes from '../routes/instagram.js';
import woocommerceRoutes from '../routes/woocommerce.js';
import adminRoutes from '../routes/admin.js';
import { initializeFirebase } from './config/firebase.config.js';
import { logger } from './utils/logger.js';
import productSyncService from '../services/productSyncService.js';
import conversationAutoReleaseService from '../services/conversation-auto-release.service.js';
import subscriptionManagementService from '../services/subscription-management.service.js';
import dailyProductSyncService from '../services/daily-product-sync.service.js';
import integrationsRoutes from '../routes/integrations.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Fix for express-rate-limit: trust proxy for correct IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (privacy policy, terms, etc.)
app.use(express.static('public'));

// Initialize Firebase
initializeFirebase();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'BizReply Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/webhook', whatsappRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/woocommerce', woocommerceRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`BizReply Backend Server running on port ${PORT}`);
  logger.info(`WhatsApp webhook endpoint: http://localhost:${PORT}/webhook`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  
  // Start product sync service (embeddings every 5 minutes)
  productSyncService.startPeriodicSync();
  
  // Start daily product sync from WooCommerce (fallback)
  dailyProductSyncService.startCronJob();
  
  // Start conversation auto-release cron job
  conversationAutoReleaseService.startCronJob();
  
  // Start subscription management cron job
  subscriptionManagementService.startCronJob();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  productSyncService.stopPeriodicSync();
  conversationAutoReleaseService.stopCronJob();
  subscriptionManagementService.stopCronJob();
  process.exit(0);
});

export default app;

