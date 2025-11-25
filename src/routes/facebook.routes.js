import express from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/facebook.controller.js';

const router = express.Router();

// GET /webhook/facebook - Facebook webhook verification
router.get('/', verifyWebhook);

// POST /webhook/facebook - Receive Facebook Messenger messages and page events
router.post('/', handleWebhook);

export default router;
