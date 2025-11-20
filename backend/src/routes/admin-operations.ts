/**
 * Admin operations tracking routes
 * Part of Phase 3: New Contest Flow
 * Tracks async operations (fetching data, calculating matchups)
 */

import { Router, Request, Response } from 'express';
import { supabase, isSupabaseInitialized } from '../utils/supabase';

export const adminOperationsRouter = Router();

// Admin authentication middleware
adminOperationsRouter.use(async (req: Request, res: Response, next) => {
  if (!isSupabaseInitialized()) {
    return res.status(503).json({ 
      error: 'Admin features not available',
      message: 'Supabase not configured'
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/admin/operations/:id
 * 
 * Get operation status by ID
 */
adminOperationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id; // Set by adminRouter middleware

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    const { data: operation, error } = await supabase
      .from('operations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !operation) {
      return res.status(404).json({
        error: 'Operation not found',
      });
    }

    // Check if user owns this operation or is admin
    if (operation.user_id !== userId) {
      // Check if user is admin (via profiles table)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (!profile?.is_admin) {
        return res.status(403).json({
          error: 'Forbidden - You can only view your own operations',
        });
      }
    }

    res.json({
      success: true,
      operation,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/operations/:id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/operations
 * 
 * List user's operations (or all operations if admin)
 */
adminOperationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; // Set by adminRouter middleware
    const { status, operation_type, limit = 50 } = req.query;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    let query = supabase
      .from('operations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string, 10));

    // If not admin, only show user's operations
    if (!profile?.is_admin) {
      query = query.eq('user_id', userId);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by operation_type if provided
    if (operation_type) {
      query = query.eq('operation_type', operation_type);
    }

    const { data: operations, error } = await query;

    if (error) {
      console.error('Error fetching operations:', error);
      return res.status(500).json({
        error: 'Failed to fetch operations',
        message: error.message,
      });
    }

    res.json({
      success: true,
      operations: operations || [],
      count: operations?.length || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/operations:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/operations
 * 
 * Create a new operation (for tracking async jobs)
 * 
 * Request body:
 * {
 *   operation_type: 'fetch_track_data' | 'calculate_matchups',
 *   input_data: { track, date, ... }
 * }
 */
adminOperationsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { operation_type, input_data } = req.body;

    if (!operation_type) {
      return res.status(400).json({
        error: 'Missing required field: operation_type',
      });
    }

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    const { data: operation, error } = await supabase
      .from('operations')
      .insert([{
        user_id: userId,
        operation_type,
        status: 'pending',
        progress: 0,
        input_data: input_data || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating operation:', error);
      return res.status(500).json({
        error: 'Failed to create operation',
        message: error.message,
      });
    }

    res.status(201).json({
      success: true,
      operation,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/operations:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/admin/operations/:id
 * 
 * Update operation status/progress
 * 
 * Request body:
 * {
 *   status: 'processing' | 'completed' | 'failed',
 *   progress: 0-100,
 *   result_data?: {...},
 *   error_message?: "..."
 * }
 */
adminOperationsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { status, progress, result_data, error_message } = req.body;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    // Verify operation exists and user owns it
    const { data: existing } = await supabase
      .from('operations')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        error: 'Operation not found',
      });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden - You can only update your own operations',
      });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) updateData.status = status;
    if (progress !== undefined) updateData.progress = Math.max(0, Math.min(100, progress));
    if (result_data) updateData.result_data = result_data;
    if (error_message) updateData.error_message = error_message;

    // Set completed_at if status is completed or failed
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: operation, error } = await supabase
      .from('operations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating operation:', error);
      return res.status(500).json({
        error: 'Failed to update operation',
        message: error.message,
      });
    }

    res.json({
      success: true,
      operation,
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/operations/:id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

