import { Router, Request, Response } from 'express';
import { supabase, isSupabaseInitialized } from '../utils/supabase';
import { deleteCache } from '../utils/redis';

export const adminRouter = Router();

// Middleware to check admin status (simplified - in production, use proper JWT validation)
adminRouter.use(async (req: Request, res: Response, next) => {
  // Check if Supabase is configured
  if (!isSupabaseInitialized()) {
    return res.status(503).json({ 
      error: 'Admin features not available',
      message: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env'
    });
  }

  // TODO: Implement proper JWT token validation
  // For now, we'll trust the frontend (not secure for production)
  // In production, validate the Authorization header with Supabase JWT
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Extract token and validate with Supabase
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    // Attach user to request for use in routes
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/admin/contests
 * Create a new contest (admin only)
 */
adminRouter.post('/contests', async (req: Request, res: Response) => {
  try {
    const { track, date, track_data_id } = req.body;

    // Validate required fields (only track and date are required)
    if (!track || !date) {
      return res.status(400).json({
        error: 'Missing required fields: track, date',
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // If track_data_id is provided, verify it exists
    let firstPostTime: string | null = null;
    let lastPostTime: string | null = null;
    let lockTime: string | null = null;
    let lifecycleStatus: string = 'pending';
    let trackDataIdToUse = track_data_id || null;

    if (track_data_id) {
      const { data: trackData, error: trackDataError } = await supabase
        .from('track_data')
        .select('id, metadata')
        .eq('id', track_data_id)
        .single();

      if (trackDataError || !trackData) {
        return res.status(400).json({
          error: 'Invalid track_data_id',
          message: 'Track data not found',
        });
      }

      const metadata = trackData.metadata || {};
      firstPostTime = metadata.first_post_time || (Array.isArray(metadata.post_times) && metadata.post_times.length > 0 ? metadata.post_times[0] : null);
      lastPostTime = metadata.last_post_time || (Array.isArray(metadata.post_times) && metadata.post_times.length > 0 ? metadata.post_times[metadata.post_times.length - 1] : null);
      lockTime = metadata.lock_time || null;
    } else {
      // Attempt to find existing track data by track/date
      const { data: existingTrackData } = await supabase
        .from('track_data')
        .select('id, metadata')
        .eq('track_code', track.toUpperCase())
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingTrackData && existingTrackData.length > 0) {
        const metadata = existingTrackData[0]?.metadata || {};
        trackDataIdToUse = existingTrackData[0]?.id || trackDataIdToUse;
        firstPostTime = metadata.first_post_time || (Array.isArray(metadata.post_times) && metadata.post_times.length > 0 ? metadata.post_times[0] : null);
        lastPostTime = metadata.last_post_time || (Array.isArray(metadata.post_times) && metadata.post_times.length > 0 ? metadata.post_times[metadata.post_times.length - 1] : null);
        lockTime = metadata.lock_time || null;
      }
    }

    if (firstPostTime && !lockTime) {
      const firstDate = new Date(firstPostTime);
      if (!Number.isNaN(firstDate.getTime())) {
        const lockDate = new Date(firstDate.getTime() - 10 * 60 * 1000);
        lockTime = lockDate.toISOString();
      }
    }

    if (firstPostTime) {
      lifecycleStatus = 'scheduled';
      const now = Date.now();
      const firstMs = new Date(firstPostTime).getTime();
      const lockMs = lockTime ? new Date(lockTime).getTime() : NaN;

      if (!Number.isNaN(lockMs) && now >= lockMs && (Number.isNaN(firstMs) || now < firstMs)) {
        lifecycleStatus = 'locked';
      }
      if (!Number.isNaN(firstMs) && now >= firstMs) {
        lifecycleStatus = 'live';
      }
    }

    // Create contest in Supabase (contest_type, entry_fee, prize_pool are optional/nullable)
    const { data, error } = await supabase
      .from('contests')
      .insert([{
        track: track.toUpperCase(),
        date,
        contest_type: null, // No longer required
        entry_fee: null, // No longer required
        prize_pool: null, // No longer required
        track_data_id: trackDataIdToUse,
        status: 'draft', // New contests start as draft
        matchup_types: [], // Empty array initially
        is_active: false, // Not visible until ready
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        first_post_time: firstPostTime,
        last_post_time: lastPostTime,
        lock_time: lockTime,
        lifecycle_status: lifecycleStatus,
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating contest:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return res.status(500).json({
        error: 'Failed to create contest',
        message: error.message,
        code: error.code,
      });
    }

    console.log('✅ Contest created in Supabase:', {
      id: data.id,
      track: data.track,
      date: data.date,
      is_active: data.is_active,
    });

    // Invalidate contests cache so lobby shows new contest immediately
    await deleteCache('contests:active');
    console.log('🗑️  Cleared contests cache');

    res.status(201).json({
      success: true,
      contest: data,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/contests:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/contests
 * Get all contests (admin only)
 */
adminRouter.get('/contests', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      contests: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching contests:', error);
    res.status(500).json({
      error: 'Failed to fetch contests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/contests/cache/clear
 * Clear contests cache (admin only)
 * Called after contest updates to ensure lobby shows latest data
 */
adminRouter.post('/contests/cache/clear', async (req: Request, res: Response) => {
  try {
    await deleteCache('contests:active');
    console.log('🗑️  Cleared contests cache (admin request)');
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

