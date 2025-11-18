import express from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/whatsapp.controller.js';

const router = express.Router();

// GET /webhook - WhatsApp webhook verification
router.get('/', verifyWebhook);

// POST /webhook - Receive WhatsApp messages
router.post('/', handleWebhook);

export default router;
