import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import whatsappRoutes from './routes/whatsapp.routes.js';
import facebookRoutes from './routes/facebook.routes.js';
import instagramRoutes from './routes/instagram.routes.js';
import businessRoutes from './routes/business.routes.js';
import { initializeFirebase } from './config/firebase.config.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

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
app.use('/webhook/facebook', facebookRoutes);
app.use('/webhook/instagram', instagramRoutes);
app.use('/api/business', businessRoutes);

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
  logger.info(`🚀 BizReply Backend Server running on port ${PORT}`);
  logger.info(`📱 WhatsApp webhook endpoint: http://localhost:${PORT}/webhook`);
  logger.info(`📘 Facebook webhook endpoint: http://localhost:${PORT}/webhook/facebook`);
  logger.info(`📸 Instagram webhook endpoint: http://localhost:${PORT}/webhook/instagram`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
