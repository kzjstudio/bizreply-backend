import express from 'express';
import { supabase } from '../src/services/supabase.service.js';

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

    // Enrich with owner email and live message counts
    const enriched = await Promise.all((data || []).map(async (b) => {
      let owner_email = null;
      try {
        const ownerRes = await supabase.auth.admin.getUserById(b.owner_id);
        owner_email = ownerRes.data?.user?.email || null;
      } catch (_) {}
      let message_count = 0;
      try {
        const { count: msgCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', b.id);
        message_count = msgCount || 0;
      } catch (_) {}
      return { ...b, email: owner_email, owner_email, message_count };
    }));

    res.json({
      businesses: enriched,
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

    // Base business record
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    if (businessError) throw businessError;

    // Owner email
    let owner_email = null;
    try {
      const ownerRes = await supabase.auth.admin.getUserById(business.owner_id);
      owner_email = ownerRes.data?.user?.email || null;
    } catch (_) {}

    // Integrations
    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', businessId);

    // Products count
    const { count: products_count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    // Assigned number (try by assigned_to first, fallback to phone_number_id match)
    let assigned_number = null;
    const { data: numberByAssignment } = await supabase
      .from('twilio_numbers')
      .select('*')
      .eq('assigned_to', businessId)
      .maybeSingle();
    
    if (numberByAssignment) {
      assigned_number = numberByAssignment;
    } else if (business.phone_number_id) {
      // Fallback: find by phone_number_id if assigned_to isn't set
      const { data: numberById } = await supabase
        .from('twilio_numbers')
        .select('*')
        .eq('phone_number_id', business.phone_number_id)
        .maybeSingle();
      assigned_number = numberById;
    }

    // If still no number found but business has phone_number_id, create a minimal record
    if (!assigned_number && business.phone_number_id) {
      assigned_number = {
        phone_number_id: business.phone_number_id,
        phone_number: business.phone_number_id, // Display the ID as fallback
        assigned_at: business.updated_at,
        source: 'business_record' // Flag that this came from business table
      };
    }

    // Message count (live)
    const { count: messages_count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    const full = {
      business: { ...business, email: owner_email, owner_email, message_count: messages_count || 0 },
      integrations: integrations || [],
      products_count: products_count || 0,
      assigned_number: assigned_number || null
    };

    res.json(full);
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
        business:businesses(id, business_name, owner_id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error querying twilio_numbers:', error);
      throw error;
    }

    // Return empty array if no numbers exist
    const numbers = data || [];
    
    // Enrich with owner email and usage statistics
    const enriched = [];
    const usage = [];
    
    for (const n of numbers) {
      let message_count = 0;
      let owner_email = null;
      
      if (n.assigned_to) {
        // Get message count
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', n.assigned_to);
        message_count = count || 0;
        
        // Get owner email if business exists
        if (n.business?.owner_id) {
          try {
            const ownerRes = await supabase.auth.admin.getUserById(n.business.owner_id);
            owner_email = ownerRes.data?.user?.email || null;
          } catch (_) {}
        }
      }
      
      usage.push({ id: n.id, message_count });
      enriched.push({
        ...n,
        business: n.business ? { ...n.business, email: owner_email } : null
      });
    }

    res.json({ numbers: enriched, usage });
  } catch (error) {
    console.error('Error fetching Twilio numbers:', error);
    res.status(500).json({ error: 'Failed to fetch Twilio numbers', details: error.message });
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

    // Update business with phone_number_id and activate
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .update({
        phone_number_id: numberData.phone_number_id,
        is_active: true, // Activate business when number is assigned
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

    // Update business to remove phone_number_id and deactivate
    if (currentNumber?.assigned_to) {
      await supabase
        .from('businesses')
        .update({
          phone_number_id: null,
          is_active: false, // Deactivate business when number is unassigned
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

/**
 * GET /api/admin/number-usage
 * Aggregate usage statistics for Twilio numbers
 */
router.get('/number-usage', isAdmin, async (req, res) => {
  try {
    // Total numbers
    const { count: totalNumbers } = await supabase
      .from('twilio_numbers')
      .select('id', { count: 'exact', head: true });

    // Assigned numbers
    const { count: assignedNumbers } = await supabase
      .from('twilio_numbers')
      .select('id', { count: 'exact', head: true })
      .not('assigned_to', 'is', null);

    // Unassigned numbers
    const unassignedNumbers = (totalNumbers || 0) - (assignedNumbers || 0);

    // Total messages across all businesses with assigned numbers
    const { data: assignedList } = await supabase
      .from('twilio_numbers')
      .select('assigned_to')
      .not('assigned_to', 'is', null);

    let totalMessages = 0;
    if (assignedList && assignedList.length > 0) {
      const businessIds = [...new Set(assignedList.map(r => r.assigned_to))];
      for (const bId of businessIds) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', bId);
        totalMessages += count || 0;
      }
    }

    res.json({
      total_numbers: totalNumbers || 0,
      assigned_numbers: assignedNumbers || 0,
      unassigned_numbers: unassignedNumbers,
      total_messages: totalMessages,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error building number usage stats:', error);
    res.status(500).json({ error: 'Failed to build number usage stats' });
  }
});

/**
 * GET /api/admin/system-health
 * Basic system health snapshot
 */
router.get('/system-health', isAdmin, async (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    const [{ count: businessCount }, { count: messageCount }, { count: productCount }, { count: integrationCount }] = await Promise.all([
      supabase.from('businesses').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('integrations').select('id', { count: 'exact', head: true })
    ]);

    const [{ count: totalNumbers }, { count: assignedNumbers }] = await Promise.all([
      supabase.from('twilio_numbers').select('id', { count: 'exact', head: true }),
      supabase.from('twilio_numbers').select('id', { count: 'exact', head: true }).not('assigned_to', 'is', null)
    ]);

    res.json({
      status: 'ok',
      timestamp,
      stats: {
        businesses: businessCount || 0,
        messages: messageCount || 0,
        products: productCount || 0,
        integrations: integrationCount || 0,
        numbers_total: totalNumbers || 0,
        numbers_assigned: assignedNumbers || 0,
        numbers_unassigned: (totalNumbers || 0) - (assignedNumbers || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ status: 'error', error: 'Failed to fetch system health' });
  }
});

/**
 * GET /api/admin/webhook-logs
 * Get recent webhook logs with stats
 */
router.get('/webhook-logs', isAdmin, async (req, res) => {
  try {
    const { hours = 24, limit = 50, source } = req.query;

    // Get webhook stats
    const { data: stats, error: statsError } = await supabase
      .rpc('get_webhook_stats', { hours_back: parseInt(hours) });

    // If table doesn't exist yet, return empty data
    if (statsError && statsError.code === '42P01') {
      return res.json({ stats: [], logs: [] });
    }
    if (statsError) throw statsError;

    // Get recent webhook logs
    let query = supabase
      .from('system_logs')
      .select('*')
      .eq('log_type', 'webhook')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (source) {
      query = query.eq('source', source);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError && logsError.code === '42P01') {
      return res.json({ stats: [], logs: [] });
    }
    if (logsError) throw logsError;

    res.json({
      stats: stats || [],
      logs: logs || []
    });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

/**
 * GET /api/admin/error-logs
 * Get recent error logs
 */
router.get('/error-logs', isAdmin, async (req, res) => {
  try {
    const { hours = 24, limit = 100, severity } = req.query;

    // Get error summary
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_error_summary', { hours_back: parseInt(hours) });

    // If table doesn't exist yet, return empty data
    if (summaryError && summaryError.code === '42P01') {
      return res.json({ summary: [], logs: [] });
    }
    if (summaryError) throw summaryError;

    // Get recent error logs
    let query = supabase
      .from('system_logs')
      .select('*')
      .in('severity', ['error', 'critical'])
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError && logsError.code === '42P01') {
      return res.json({ summary: [], logs: [] });
    }
    if (logsError) throw logsError;

    res.json({
      summary: summary || [],
      logs: logs || []
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

/**
 * GET /api/admin/sync-status
 * Get sync job status
 */
router.get('/sync-status', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_sync_job_status');

    // If table doesn't exist yet, return empty data
    if (error && error.code === '42P01') {
      return res.json({ jobs: [] });
    }
    if (error) throw error;

    res.json({ jobs: data || [] });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

/**
 * POST /api/admin/logs/resolve/:id
 * Mark a log as resolved
 */
router.post('/logs/resolve/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('system_logs')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: req.admin.email
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving log:', error);
    res.status(500).json({ error: 'Failed to resolve log' });
  }
});

export default router;
