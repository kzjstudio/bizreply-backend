import express from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/instagram.controller.js';

const router = express.Router();

// GET /webhook/instagram - Instagram webhook verification
router.get('/', verifyWebhook);

// POST /webhook/instagram - Receive Instagram Direct messages and comments
router.post('/', handleWebhook);

export default router;
