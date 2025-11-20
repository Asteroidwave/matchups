/**
 * Admin routes for track data management
 * Part of Phase 3: New Contest Flow
 */

import { Router, Request, Response } from 'express';
import { getEquibaseEntries, getEquibaseResults } from '../utils/mongodb';
import { getCache, setCache } from '../utils/redis';
import { supabase, isSupabaseInitialized } from '../utils/supabase';
import { transformRaceDocs, calculateMetadata } from '../utils/trackDataTransform';
import { mergeEntriesWithResults } from '../utils/mergeEntriesWithResults';

export const adminTrackDataRouter = Router();

// Admin authentication middleware (same as adminRouter)
adminTrackDataRouter.use(async (req: Request, res: Response, next) => {
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
 * POST /api/admin/tracks/fetch
 * 
 * Fetch track data from MongoDB, cache in Redis and Supabase, return preview
 * 
 * Request body:
 * {
 *   track: "GP",
 *   date: "2025-11-02"
 * }
 */
adminTrackDataRouter.post('/fetch', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.body;

    // Validate required fields
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

    const trackUpper = track.toUpperCase();
    const operationId = `fetch-${trackUpper}-${date}-${Date.now()}`;
    console.log(`[${operationId}] Starting track data fetch...`);

    // Check if already exists in Supabase track_data table
    if (isSupabaseInitialized()) {
      const { data: existingData } = await supabase
        .from('track_data')
        .select('id, metadata, fetched_at')
        .eq('track_code', trackUpper)
        .eq('date', date)
        .single();

      if (existingData) {
        console.log(`[${operationId}] ✅ Track data already exists in Supabase`);
        return res.json({
          success: true,
          track_data_id: existingData.id,
          preview: existingData.metadata || {},
          cached: true,
          message: 'Track data already cached',
        });
      }
    }

    // Fetch entries from MongoDB (reuse existing logic)
    const entriesCacheKey = `entries:${trackUpper}:${date}`;
    let entries = await getCache<any>(entriesCacheKey);

    if (!entries) {
      console.log(`[${operationId}] Fetching entries from MongoDB...`);
      const entriesCollection = await getEquibaseEntries();
      const query = {
        raceNameForDB: {
          $regex: `^${trackUpper}-${date}-`,
        },
      };

      const raceDocs = await entriesCollection.find(query).toArray();

      if (raceDocs.length === 0) {
        return res.status(404).json({
          error: 'No entries found for this track and date',
          track: trackUpper,
          date,
        });
      }

      // Transform using shared utility
      let records = transformRaceDocs(raceDocs, trackUpper);
      
      // Store entries before merging (for caching)
      entries = {
        track: trackUpper,
        records,
      };

      // Cache entries in Redis
      const isPastDate = new Date(date) < new Date();
      const ttl = isPastDate ? 24 * 60 * 60 : 60 * 60;
      await setCache(entriesCacheKey, entries, ttl);
    }

    // Fetch results from MongoDB (reuse existing logic)
    const resultsCacheKey = `results:${trackUpper}:${date}`;
    let results = await getCache<any>(resultsCacheKey);

    if (!results) {
      console.log(`[${operationId}] Fetching results from MongoDB...`);
      const resultsCollection = await getEquibaseResults();
      const query = {
        raceNameForDB: {
          $regex: `^${trackUpper}-${date}-`,
        },
      };

      const resultsDocs = await resultsCollection.find(query).toArray();
      
      results = {
        track: trackUpper,
        date,
        results: resultsDocs.map((doc: any) => ({
          race: parseInt(doc.raceNameForDB?.split('-').pop() || '0'),
          starters: doc.starters || [],
          ...doc,
        })),
      };

      // Cache results in Redis
      const isPastDate = new Date(date) < new Date();
      const ttl = isPastDate ? 24 * 60 * 60 : 60 * 60;
      await setCache(resultsCacheKey, results, ttl);
    }

    // Merge entries with results and calculate points (matching Python logic)
    const mergedRecords = mergeEntriesWithResults(
      entries.records || [],
      results.results || [],
      trackUpper
    );
    
    const recordsWithPoints = mergedRecords.filter(r => r.points > 0).length;
    const recordsWithPlace = mergedRecords.filter(r => r.place !== null).length;
    const recordsNotScratched = mergedRecords.filter(r => !r.scratched).length;
    
    console.log(`[${operationId}] Merged ${mergedRecords.length} records with results`);
    console.log(`[${operationId}] Records with points: ${recordsWithPoints}`);
    console.log(`[${operationId}] Records with place: ${recordsWithPlace}`);
    console.log(`[${operationId}] Records not scratched: ${recordsNotScratched}`);
    console.log(`[${operationId}] Results docs count: ${results.results?.length || 0}`);
    
    // Warn if no results found but this is past data
    if (recordsWithPlace === 0 && results.results && results.results.length > 0) {
      console.warn(`[${operationId}] ⚠️ Results found but no horses matched! Check name/race matching.`);
    }

    // Combine merged entries and results
    const fullData = {
      entries: mergedRecords,
      results: results.results || [],
    };

    // Calculate metadata using merged records
    const metadata = calculateMetadata(mergedRecords, trackUpper, date);

    // Store in Supabase track_data table
    let trackDataId: string | null = null;
    if (isSupabaseInitialized()) {
      const { data: trackData, error: trackDataError } = await supabase
        .from('track_data')
        .insert([{
          track_code: trackUpper,
          date,
          data: fullData,
          metadata,
        }])
        .select()
        .single();

      if (trackDataError) {
        console.error(`[${operationId}] ❌ Error storing in Supabase:`, trackDataError);
        // Don't fail the request, but log the error
      } else {
        trackDataId = trackData.id;
        console.log(`[${operationId}] ✅ Stored track data in Supabase:`, trackDataId);
      }
    }

    // Return preview
    res.json({
      success: true,
      track_data_id: trackDataId,
      preview: metadata,
      message: 'Track data fetched and cached successfully',
    });
  } catch (error) {
    console.error('Error fetching track data:', error);
    res.status(500).json({
      error: 'Failed to fetch track data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/tracks/:track/:date/preview
 * 
 * Get preview metadata for track data (without full data)
 */
adminTrackDataRouter.get('/:track/:date/preview', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const trackUpper = track.toUpperCase();

    // Try to get from Supabase first
    if (isSupabaseInitialized()) {
      const { data, error } = await supabase
        .from('track_data')
        .select('id, metadata, fetched_at')
        .eq('track_code', trackUpper)
        .eq('date', date)
        .single();

      if (!error && data) {
        return res.json({
          success: true,
          track_data_id: data.id,
          preview: data.metadata || {},
          fetched_at: data.fetched_at,
        });
      }
    }

    // Fallback: try Redis cache
    const entriesCacheKey = `entries:${trackUpper}:${date}`;
    const entries = await getCache<any>(entriesCacheKey);

    if (entries && entries.records) {
      const metadata = calculateMetadata(entries.records, trackUpper, date);

      return res.json({
        success: true,
        preview: metadata,
        from_cache: true,
      });
    }

    // Not found
    res.status(404).json({
      error: 'Track data not found',
      track: trackUpper,
      date,
    });
  } catch (error) {
    console.error('Error fetching preview:', error);
    res.status(500).json({
      error: 'Failed to fetch preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

