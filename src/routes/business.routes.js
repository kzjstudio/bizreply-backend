import express from 'express';
import {
  createBusiness,
  getBusiness,
  updateBusiness,
  deleteBusiness,
  listBusinesses
} from '../controllers/business.controller.js';
import { supabase } from '../services/supabase.service.js';

const router = express.Router();

// Business CRUD operations
router.post('/', createBusiness);
router.get('/:businessId', getBusiness);
router.put('/:businessId', updateBusiness);
router.delete('/:businessId', deleteBusiness);
router.get('/', listBusinesses);

// =============================================
// Policies endpoints (Supabase-backed)
// =============================================

// GET business policies
router.get('/:businessId/policies', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { data, error } = await supabase
      .from('businesses')
      .select('return_policy, refund_policy, shipping_policy, privacy_policy, terms_of_service')
      .eq('id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Business not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch policies', details: error.message });
    }

    res.json({ success: true, business_id: businessId, policies: data });
  } catch (e) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// PUT (upsert) business policies
router.put('/:businessId/policies', async (req, res) => {
  try {
    const { businessId } = req.params;
    const {
      return_policy,
      refund_policy,
      shipping_policy,
      privacy_policy,
      terms_of_service
    } = req.body;

    const updates = {
      return_policy: return_policy || null,
      refund_policy: refund_policy || null,
      shipping_policy: shipping_policy || null,
      privacy_policy: privacy_policy || null,
      terms_of_service: terms_of_service || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId)
      .select('return_policy, refund_policy, shipping_policy, privacy_policy, terms_of_service')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Business not found' });
      }
      return res.status(500).json({ error: 'Failed to update policies', details: error.message });
    }

    res.json({ success: true, business_id: businessId, policies: data });
  } catch (e) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

export default router;
