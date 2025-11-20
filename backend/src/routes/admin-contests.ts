/**
 * Enhanced admin contest routes
 * Part of Phase 3: New Contest Flow
 * Handles contest status, matchup types, and visibility
 * 
 * NOTE: These routes should be mounted under /api/admin/contests
 * and will inherit admin authentication from the parent adminRouter
 */

import { Router, Request, Response } from 'express';
import { supabase, isSupabaseInitialized } from '../utils/supabase';
import { deleteCache } from '../utils/redis';
import { calculateContestMatchups } from '../services/matchupCalculation';

export const adminContestsRouter = Router();

// Admin authentication middleware
adminContestsRouter.use(async (req: Request, res: Response, next) => {
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
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
 * PUT /api/admin/contests/:id/matchup-types
 * 
 * Set matchup types for a contest and trigger calculation
 * 
 * Request body:
 * {
 *   matchup_types: ['jockey_vs_jockey', 'trainer_vs_trainer']
 * }
 */
adminContestsRouter.put('/:id/matchup-types', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { matchup_types } = req.body;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    // Validate matchup_types
    if (!Array.isArray(matchup_types)) {
      return res.status(400).json({
        error: 'matchup_types must be an array',
      });
    }

    const validTypes = ['jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed'];
    const invalidTypes = matchup_types.filter((t: string) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        error: `Invalid matchup types: ${invalidTypes.join(', ')}`,
        valid_types: validTypes,
      });
    }

    // Extract calculation settings from request body
    const { calculation_settings } = req.body;
    
    // Update contest with matchup types and set status to 'processing'
    const { data: contest, error: updateError } = await supabase
      .from('contests')
      .update({
        matchup_types,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating contest:', updateError);
      return res.status(500).json({
        error: 'Failed to update contest',
        message: updateError.message,
      });
    }

    if (!contest) {
      return res.status(404).json({
        error: 'Contest not found',
      });
    }

    console.log(`✅ Contest ${id} updated with matchup types:`, matchup_types);

    // Create operation for tracking
    const userId = (req as any).user?.id;
    let operationId: string | null = null;
    
    if (userId) {
      const { data: operation } = await supabase
        .from('operations')
        .insert([{
          user_id: userId,
          operation_type: 'calculate_matchups',
          status: 'processing',
          progress: 0,
          input_data: {
            contest_id: id,
            matchup_types,
          },
        }])
        .select()
        .single();
      
      operationId = operation?.id || null;
    }

    // Trigger async matchup calculation (non-blocking)
    calculateContestMatchups(id, matchup_types, operationId || undefined, calculation_settings)
      .then(async (result) => {
        if (result.success) {
          console.log(`✅ Matchup calculation completed for contest ${id}: ${result.matchupsCount} matchups`);
          
          // Update operation status with stats
          if (operationId) {
            await supabase
              .from('operations')
              .update({
                status: 'completed',
                progress: 100,
                result_data: {
                  matchups_count: result.matchupsCount,
                  contest_id: id,
                  stats: result.stats || [], // Include matchup stats
                },
                completed_at: new Date().toISOString(),
              })
              .eq('id', operationId);
          }
        } else {
          console.error(`❌ Matchup calculation failed for contest ${id}:`, result.error);
          
          // Update operation status
          if (operationId) {
            await supabase
              .from('operations')
              .update({
                status: 'failed',
                error_message: result.error,
                completed_at: new Date().toISOString(),
              })
              .eq('id', operationId);
          }
        }
      })
      .catch(async (error) => {
        console.error(`❌ Exception in matchup calculation for contest ${id}:`, error);
        
        if (operationId) {
          await supabase
            .from('operations')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
            })
            .eq('id', operationId);
        }
      });

    res.json({
      success: true,
      contest,
      operation_id: operationId,
      message: 'Matchup types set. Calculation started in background.',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/contests/:id/matchup-types:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/contests/:id/status
 * 
 * Get contest status and calculation progress
 */
adminContestsRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    // Get contest with status
    const { data: contest, error } = await supabase
      .from('contests')
      .select('id, status, matchup_types, matchups_calculated_at, track_data_id')
      .eq('id', id)
      .single();

    if (error || !contest) {
      return res.status(404).json({
        error: 'Contest not found',
      });
    }

    // Get matchup count if ready - sum all matchups across all types
    let matchups_count = 0;
    if (contest.status === 'ready') {
      // @ts-ignore - Supabase type inference issue
      const { data: matchupRows, error: matchupError } = await supabase
        .from('matchups')
        .select('matchup_data')
        .eq('contest_id', id);
      
      if (matchupError) {
        console.error(`Error fetching matchups for contest ${id}:`, matchupError);
      } else if (matchupRows) {
        // Sum the length of all matchup pools (handle legacy array format and new object format)
        matchups_count = matchupRows.reduce((total: number, row: any) => {
          const data = row.matchup_data;
          if (!data) {
            return total;
          }
          
          if (Array.isArray(data)) {
            return total + data.length;
          }
          
          if (Array.isArray(data.matchups)) {
            return total + data.matchups.length;
          }
          
          return total;
        }, 0);
        console.log(`[Status] Contest ${id} has ${matchups_count} total matchups (${matchupRows.length} types)`);
      }
    }

    res.json({
      success: true,
      status: contest.status,
      matchup_types: contest.matchup_types || [],
      matchups_count,
      matchups_calculated_at: contest.matchups_calculated_at,
      has_track_data: !!contest.track_data_id,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/contests/:id/status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/admin/contests/:id/visibility
 * 
 * Toggle contest visibility (is_active)
 * 
 * Request body:
 * {
 *   is_active: true/false
 * }
 */
adminContestsRouter.put('/:id/visibility', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({
        error: 'Supabase not configured',
      });
    }

    // Validate that contest is ready before making it active
    if (is_active === true) {
      const { data: contest } = await supabase
        .from('contests')
        .select('status')
        .eq('id', id)
        .single();

      if (contest && contest.status !== 'ready') {
        return res.status(400).json({
          error: 'Contest must be ready before it can be made active',
          current_status: contest.status,
        });
      }
    }

    const { data, error } = await supabase
      .from('contests')
      .update({
        is_active: is_active === true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating contest visibility:', error);
      return res.status(500).json({
        error: 'Failed to update contest visibility',
        message: error.message,
      });
    }

    // Clear contests cache so lobby reflects changes
    await deleteCache('contests:active');
    console.log('🗑️  Cleared contests cache');

    res.json({
      success: true,
      contest: data,
      message: `Contest ${is_active ? 'shown in' : 'hidden from'} lobby`,
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/contests/:id/visibility:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

