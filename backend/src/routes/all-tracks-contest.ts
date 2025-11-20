/**
 * All Tracks Contest API
 * Creates a virtual contest that includes matchups from ALL tracks for a given date
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../utils/supabase';

export const allTracksContestRouter = Router();

/**
 * POST /api/all-tracks-contest
 * Create or get an "ALL TRACKS" contest for a specific date
 * This contest aggregates matchups from all individual track contests
 */
allTracksContestRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const supabase = getSupabase();
    
    // Check if ALL TRACKS contest already exists for this date
    const { data: existing, error: existingError } = await supabase
      .from('contests')
      .select('*')
      .eq('track', 'ALL')
      .eq('date', date)
      .single();
    
    // Get all contests for this date first (needed for both new and existing contests)
    const { data: contests, error: contestsError } = await supabase
      .from('contests')
      .select('*')
      .eq('date', date)
      .eq('is_active', true);
    
    if (contestsError || !contests || contests.length === 0) {
      return res.status(404).json({ 
        error: 'No contests found for this date. Please create individual track contests first.' 
      });
    }
    
    console.log(`[AllTracks] Found ${contests.length} contests for date ${date}`);
    
    let allTracksContest;
    
    if (existing && !existingError) {
      console.log('[AllTracks] Found existing ALL TRACKS contest:', existing.id);
      console.log('[AllTracks] Reusing existing contest and updating matchups...');
      
      // Check if there are any entries for this contest
      const { count: entryCount } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', existing.id);
      
      if (entryCount && entryCount > 0) {
        console.log(`[AllTracks] Contest has ${entryCount} entries, will update matchups only (not delete contest)`);
      }
      
      // Delete old matchups for this contest (safe - doesn't affect entries)
      await supabase
        .from('matchups')
        .delete()
        .eq('contest_id', existing.id);
      
      // Reuse the existing contest
      allTracksContest = existing;
      console.log('[AllTracks] Reusing existing ALL TRACKS contest:', allTracksContest.id);
    } else {
      // Create new ALL TRACKS contest only if it doesn't exist
      const { data: newContest, error: createError } = await supabase
        .from('contests')
        .insert({
          track: 'ALL',
          date,
          is_active: true,
          status: 'ready',
          contest_type: 'multi_track',
        })
        .select()
        .single();
      
      if (createError || !newContest) {
        console.error('[AllTracks] Error creating contest:', createError);
        return res.status(500).json({ error: 'Failed to create ALL TRACKS contest' });
      }
      
      allTracksContest = newContest;
      console.log('[AllTracks] Created new ALL TRACKS contest:', allTracksContest.id);
    }
    
    // Now aggregate all matchups from all contests
    const allMatchups: any[] = [];
    const trackCodes: string[] = [];
    
    for (const contest of contests) {
      if (contest.track === 'ALL') continue; // Skip if somehow already exists
      
      trackCodes.push(contest.track);
      
      // Fetch matchups for this contest
      const { data: matchupRows, error: matchupError } = await supabase
        .from('matchups')
        .select('*')
        .eq('contest_id', contest.id);
      
      if (matchupError || !matchupRows) {
        console.warn(`[AllTracks] No matchups found for contest ${contest.id} (${contest.track})`);
        continue;
      }
      
      // Extract matchups from each row and ensure they have type property
      for (const row of matchupRows) {
        const matchupData = row.matchup_data;
        const matchupType = row.matchup_type; // Get type from the row
        
        if (matchupData && matchupData.matchups) {
          // Ensure each matchup has the type property
          const matchupsWithType = matchupData.matchups.map((m: any) => ({
            ...m,
            matchupType: m.matchupType || m.matchup_type || matchupType,
          }));
          allMatchups.push(...matchupsWithType);
        }
      }
    }
    
    // Also fetch cross-track matchups from multi_track_bundles
    // Note: multi_track_bundles doesn't have a date column, so we fetch all active bundles
    // and filter by checking if any contest_ids match our date's contests
    console.log('[AllTracks] Checking for cross-track bundles...');
    const contestIdsForDate = new Set(contests.map(c => c.id));
    
    const { data: bundles, error: bundleError } = await supabase
      .from('multi_track_bundles')
      .select('*')
      .eq('status', 'ready');
    
    // Filter bundles that have contest_ids matching our date
    const relevantBundles = bundles?.filter(bundle => {
      const bundleContestIds = bundle.contest_ids || [];
      return bundleContestIds.some((id: string) => contestIdsForDate.has(id));
    }) || [];
    
    console.log('[AllTracks] Found', relevantBundles.length, 'cross-track bundle(s) for this date');
    
    if (relevantBundles.length > 0) {
      for (const bundle of relevantBundles) {
        const bundleMatchups = bundle.matchup_data?.matchups || [];
        allMatchups.push(...bundleMatchups);
        console.log(`[AllTracks] Added ${bundleMatchups.length} cross-track matchups from bundle`);
      }
    }
    
    console.log(`[AllTracks] Aggregated ${allMatchups.length} matchups from ${trackCodes.length} tracks + cross-track bundles`);
    
    // Group matchups by type and store in matchups table
    const matchupsByType: Record<string, any[]> = {};
    
    for (const matchup of allMatchups) {
      const type = matchup.matchupType || matchup.matchup_type || 'unknown';
      if (!matchupsByType[type]) {
        matchupsByType[type] = [];
      }
      matchupsByType[type].push(matchup);
    }
    
    console.log('[AllTracks] Matchups grouped by type:', Object.entries(matchupsByType).map(([type, arr]) => `${type}: ${arr.length}`).join(', '));
    
    // Insert matchup groups into matchups table
    const matchupInserts = Object.entries(matchupsByType).map(([type, matchups]) => ({
      contest_id: allTracksContest.id,
      matchup_type: type,
      matchup_data: {
        matchups,
        pool_count: matchups.length,
        display_count: Math.min(50, matchups.length),
        settings: {},
        stats: {
          total: matchups.length,
          tracks: trackCodes,
        },
      },
    }));
    
    const { error: insertError } = await supabase
      .from('matchups')
      .insert(matchupInserts);
    
    if (insertError) {
      console.error('[AllTracks] Error inserting matchups:', insertError);
      return res.status(500).json({ error: 'Failed to store matchups for ALL TRACKS contest' });
    }
    
    console.log(`[AllTracks] Inserted ${matchupInserts.length} matchup types for ALL TRACKS contest`);
    
    // Update contest with matchup calculation timestamp
    await supabase
      .from('contests')
      .update({ matchups_calculated_at: new Date().toISOString() })
      .eq('id', allTracksContest.id);
    
    res.json({
      contest: allTracksContest,
      created: !existing || !!existingError, // true if newly created, false if reused
      matchupCount: allMatchups.length,
      tracks: trackCodes,
      types: Object.keys(matchupsByType),
    });
    
  } catch (error) {
    console.error('[AllTracks] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/all-tracks-contest/:date
 * Get the ALL TRACKS contest for a specific date
 */
allTracksContestRouter.get('/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    
    const supabase = getSupabase();
    
    const { data: contest, error } = await supabase
      .from('contests')
      .select('*')
      .eq('track', 'ALL')
      .eq('date', date)
      .single();
    
    if (error || !contest) {
      return res.status(404).json({ error: 'ALL TRACKS contest not found for this date' });
    }
    
    res.json({ contest });
    
  } catch (error) {
    console.error('[AllTracks] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default allTracksContestRouter;

