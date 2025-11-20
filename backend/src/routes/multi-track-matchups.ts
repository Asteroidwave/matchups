import { Router, Request, Response } from 'express';
import { generateCrossTrackMatchupsForContestIds } from '../services/simpleCrossTrack';
import { getSupabase } from '../utils/supabase';

const multiTrackRouter = Router();

// POST: Generate new multi-track bundles
multiTrackRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { contestIds, numMatchups, matchupTypes, enforceCrossTrack } = req.body;

    if (!Array.isArray(contestIds) || contestIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Select at least two contests to build multi-track matchups.',
      });
    }

    const result = await generateCrossTrackMatchupsForContestIds(contestIds, {
      numMatchups: typeof numMatchups === 'number' ? numMatchups : undefined,
      matchupTypes:
        Array.isArray(matchupTypes) && matchupTypes.length > 0 ? matchupTypes : undefined,
      enforceCrossTrack,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Error generating multi-track matchups:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate multi-track matchups.',
    });
  }
});

// GET: Fetch multi-track bundles for a specific date or contest IDs
multiTrackRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { date, contestIds } = req.query;
    const supabase = getSupabase();
    
    if (!supabase) {
      return res.status(500).json({
        error: 'Database connection not available',
      });
    }

    let query = supabase
      .from('multi_track_bundles')
      .select('id, contest_ids, track_codes, matchup_types, matchup_data, status, created_at')
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    // Filter by date if provided (need to check contests table)
    if (date) {
      const { data: contests } = await supabase
        .from('contests')
        .select('id')
        .eq('date', date)
        .eq('is_active', true);
      
      if (contests && contests.length > 0) {
        const contestIdsForDate = contests.map(c => c.id);
        query = query.overlaps('contest_ids', contestIdsForDate);
      } else {
        return res.json({ bundles: [] });
      }
    }

    // Filter by contest IDs if provided
    if (contestIds) {
      const ids = Array.isArray(contestIds) ? contestIds : [contestIds];
      query = query.overlaps('contest_ids', ids);
    }

    const { data: bundles, error } = await query;

    if (error) {
      console.error('[API] Error fetching multi-track bundles:', error);
      return res.status(500).json({
        error: 'Failed to fetch multi-track bundles',
        message: error.message,
      });
    }

    // Transform bundles to include matchups
    const transformedBundles = (bundles || []).map(bundle => {
      const matchupData = bundle.matchup_data || {};
      const matchups = Array.isArray(matchupData.matchups) ? matchupData.matchups : [];
      
      return {
        id: bundle.id,
        contestIds: bundle.contest_ids,
        trackCodes: bundle.track_codes,
        matchupTypes: bundle.matchup_types,
        matchups: matchups.map((m: any, idx: number) => ({
          ...m,
          id: m?.id || `multi-track-${bundle.id}-${idx}`,
          matchupType: m?.matchupType || m?.matchup_type || 'cross_track',
        })),
        count: matchups.length,
        createdAt: bundle.created_at,
      };
    });

    res.json({ bundles: transformedBundles });
  } catch (error) {
    console.error('[API] Error in GET /api/admin/multi-track-matchups:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default multiTrackRouter;

