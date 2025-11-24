import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * Middleware to verify admin access
 */
const isAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user is admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', user.email)
      .single();

    if (adminError || !admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Attach admin info to request
    req.admin = admin;
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/businesses
 * Get all businesses with pagination and search
 */
router.get('/businesses', isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('businesses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply search filter
    if (search) {
      query = query.or(`business_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply status filter
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      businesses: data,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

/**
 * GET /api/admin/businesses/:businessId
 * Get business details with all related data
 */
router.get('/businesses/:businessId', isAdmin, async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data, error } = await supabase.rpc('get_business_details', {
      business_id_param: businessId,
    });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching business details:', error);
    res.status(500).json({ error: 'Failed to fetch business details' });
  }
});

/**
 * PATCH /api/admin/businesses/:businessId
 * Update business details
 */
router.patch('/businesses/:businessId', isAdmin, async (req, res) => {
  try {
    const { businessId } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('businesses')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, business: data });
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

/**
 * DELETE /api/admin/businesses/:businessId
 * Delete business and all associated data
 */
router.delete('/businesses/:businessId', isAdmin, async (req, res) => {
  try {
    const { businessId } = req.params;

    // Delete in order: products, integrations, business (CASCADE will handle auth user)
    await supabase.from('products').delete().eq('business_id', businessId);
    await supabase.from('integrations').delete().eq('business_id', businessId);
    
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);

    if (error) throw error;

    res.json({ success: true, message: 'Business deleted successfully' });
  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

/**
 * GET /api/admin/twilio-numbers
 * Get all Twilio numbers
 */
router.get('/twilio-numbers', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('twilio_numbers')
      .select(`
        *,
        business:businesses(id, business_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ numbers: data });
  } catch (error) {
    console.error('Error fetching Twilio numbers:', error);
    res.status(500).json({ error: 'Failed to fetch Twilio numbers' });
  }
});

/**
 * POST /api/admin/twilio-numbers
 * Add new Twilio number to pool
 */
router.post('/twilio-numbers', isAdmin, async (req, res) => {
  try {
    const { phone_number, phone_number_id } = req.body;

    if (!phone_number || !phone_number_id) {
      return res.status(400).json({ error: 'Phone number and ID are required' });
    }

    const { data, error } = await supabase
      .from('twilio_numbers')
      .insert({
        phone_number,
        phone_number_id,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, number: data });
  } catch (error) {
    console.error('Error adding Twilio number:', error);
    res.status(500).json({ error: 'Failed to add Twilio number' });
  }
});

/**
 * POST /api/admin/assign-number
 * Assign Twilio number to business
 */
router.post('/assign-number', isAdmin, async (req, res) => {
  try {
    const { businessId, numberId } = req.body;

    if (!businessId || !numberId) {
      return res.status(400).json({ error: 'Business ID and Number ID are required' });
    }

    // Update twilio_numbers table
    const { data: numberData, error: numberError } = await supabase
      .from('twilio_numbers')
      .update({
        assigned_to: businessId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', numberId)
      .select()
      .single();

    if (numberError) throw numberError;

    // Update business with phone_number_id
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .update({
        phone_number_id: numberData.phone_number_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .select()
      .single();

    if (businessError) throw businessError;

    res.json({
      success: true,
      message: 'Number assigned successfully',
      number: numberData,
      business: businessData,
    });
  } catch (error) {
    console.error('Error assigning number:', error);
    res.status(500).json({ error: 'Failed to assign number' });
  }
});

/**
 * POST /api/admin/unassign-number
 * Unassign Twilio number from business
 */
router.post('/unassign-number', isAdmin, async (req, res) => {
  try {
    const { numberId } = req.body;

    if (!numberId) {
      return res.status(400).json({ error: 'Number ID is required' });
    }

    // Get current assignment
    const { data: currentNumber } = await supabase
      .from('twilio_numbers')
      .select('assigned_to')
      .eq('id', numberId)
      .single();

    // Update twilio_numbers table
    const { data: numberData, error: numberError } = await supabase
      .from('twilio_numbers')
      .update({
        assigned_to: null,
        assigned_at: null,
      })
      .eq('id', numberId)
      .select()
      .single();

    if (numberError) throw numberError;

    // Update business to remove phone_number_id
    if (currentNumber?.assigned_to) {
      await supabase
        .from('businesses')
        .update({
          phone_number_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentNumber.assigned_to);
    }

    res.json({
      success: true,
      message: 'Number unassigned successfully',
      number: numberData,
    });
  } catch (error) {
    console.error('Error unassigning number:', error);
    res.status(500).json({ error: 'Failed to unassign number' });
  }
});

export default router;
