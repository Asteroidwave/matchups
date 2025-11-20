import { Router, Request, Response } from 'express';
import { getSupabase } from '../utils/supabase';
import { getCache, setCache } from '../utils/redis';

export const matchupsRouter = Router();

/**
 * GET /api/matchups/:contestId
 * 
 * Get all matchups for a specific contest
 * Returns matchups grouped by type, with a random subset for display
 */
matchupsRouter.get('/:contestId', async (req: Request, res: Response) => {
  try {
    const { contestId } = req.params;
    const { type, count = '10' } = req.query;
    
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({
        error: 'Database connection not available',
      });
    }

    const cacheKey = `matchups:${contestId}${type ? `:${type}` : ''}`;
    
    // Check cache first
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Build query
    // @ts-ignore - Supabase type inference issue
    let query = supabase
      .from('matchups')
      .select('matchup_type, matchup_data')
      .eq('contest_id', contestId);

    if (type) {
      query = query.eq('matchup_type', type);
    }

    const { data: matchupRows, error } = await query;

    if (error) {
      console.error('Error fetching matchups:', error);
      return res.status(500).json({
        error: 'Failed to fetch matchups',
        message: error.message,
      });
    }

    if (!matchupRows || matchupRows.length === 0) {
      return res.json({
        matchups: [],
        count: 0,
        types: [],
      });
    }

    const groups: Array<{
      type: string;
      matchups: any[];
      displayCount: number;
      poolCount: number;
      settings: any;
      stats: any;
    }> = [];
    const typesSet = new Set<string>();
    let totalAvailable = 0;

    const fallbackCount = parseInt(count as string, 10);

    for (const row of matchupRows) {
      const data = row.matchup_data;
      let matchupsArray: any[] = [];
      let displayCountForType = 0;
      let poolCountForType = 0;
      let settingsForType: any = null;
      let statsForType: any = null;

      if (Array.isArray(data)) {
        matchupsArray = data;
        poolCountForType = data.length;
        if (!isNaN(fallbackCount) && fallbackCount > 0) {
          displayCountForType = Math.min(fallbackCount, matchupsArray.length);
        } else {
          displayCountForType = matchupsArray.length;
        }
      } else if (data && typeof data === 'object') {
        matchupsArray = Array.isArray(data.matchups) ? data.matchups : [];
        poolCountForType = typeof data.pool_count === 'number' ? data.pool_count : matchupsArray.length;
        const storedDisplay = typeof data.display_count === 'number' ? data.display_count : null;
        if (storedDisplay !== null) {
          displayCountForType = Math.min(storedDisplay, matchupsArray.length);
        } else if (!isNaN(fallbackCount) && fallbackCount > 0) {
          displayCountForType = Math.min(fallbackCount, matchupsArray.length);
        } else {
          displayCountForType = matchupsArray.length;
        }
        settingsForType = data.settings || null;
        statsForType = data.stats || null;
      }

      if (!matchupsArray || matchupsArray.length === 0) {
        continue;
      }

      typesSet.add(row.matchup_type);
      totalAvailable += poolCountForType;

      const matchupsWithType = matchupsArray.map((m: any, idx: number) => ({
        ...m,
        matchup_type: row.matchup_type,
        matchupType: row.matchup_type, // Add camelCase for frontend compatibility
        id: m?.id || `matchup-${row.matchup_type}-${idx}`,
      }));

      groups.push({
        type: row.matchup_type,
        matchups: matchupsWithType,
        displayCount: Math.max(0, Math.min(displayCountForType, matchupsWithType.length)),
        poolCount: poolCountForType,
        settings: settingsForType,
        stats: statsForType,
      });
    }

    if (groups.length === 0) {
      const emptyResponse = {
        matchups: [],
        count: 0,
        types: [],
        totalAvailable: 0,
        groups: [],
      };
      await setCache(cacheKey, emptyResponse, 5 * 60);
      return res.json(emptyResponse);
    }

    const flattenedForDisplay = groups.flatMap(group => {
      if (!group.displayCount || group.displayCount <= 0) {
        return [];
      }
      const sliceCount = Math.min(group.displayCount, group.matchups.length);
      return group.matchups.slice(0, sliceCount);
    });

    const response = {
      matchups: flattenedForDisplay,
      count: flattenedForDisplay.length,
      types: Array.from(typesSet),
      totalAvailable,
      groups,
    };

    // Cache for 5 minutes
    await setCache(cacheKey, response, 5 * 60);

    res.json(response);
  } catch (error) {
    console.error('Error in GET /api/matchups/:contestId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
