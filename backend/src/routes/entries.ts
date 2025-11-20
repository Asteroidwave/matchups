import { Router, Request, Response } from 'express';
import { supabase, isSupabaseInitialized } from '../utils/supabase';
import { getCache, setCache } from '../utils/redis';
import { calculateRoundOutcome, hasResultsData } from '../services/outcomeCalculator';

export const entriesRouter = Router();

/**
 * POST /api/entries/:contestId
 * Submit entry for a contest
 */
entriesRouter.post('/:contestId', async (req: Request, res: Response) => {
  const submissionId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[Entries ${submissionId}] Starting entry submission:`, {
    contestId: req.params.contestId,
    userId: req.body.userId,
    picksCount: req.body.picks?.length,
    entryAmount: req.body.entryAmount
  });
  
  try {
    const { contestId } = req.params;
    const { userId, picks, entryAmount, multiplier, isFlex, pickCount, multiplierSchedule } = req.body;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({ 
        error: 'Entry submission not available',
        message: 'Database not configured'
      });
    }

    // Validate required fields
    if (!userId || !picks || !entryAmount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'picks', 'entryAmount']
      });
    }

    // Get contest details
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Check if contest is locked (skip for past contests to allow simulation testing)
    const now = new Date();
    const contestDate = new Date(contest.date);
    const isPastContest = contestDate < new Date(new Date().setHours(0, 0, 0, 0));
    const lockTime = contest.lock_time ? new Date(contest.lock_time) : null;
    
    // Allow entries for past contests (for simulation testing)
    if (!isPastContest && lockTime && now >= lockTime) {
      return res.status(403).json({ 
        error: 'Contest is locked',
        message: 'Entries are closed for this contest',
        lockTime: contest.lock_time
      });
    }

    // Validate entry_amount FIRST to ensure it's a valid number (not infinity or NaN)
    let validatedEntryAmount = Number.parseFloat(entryAmount);
    if (!Number.isFinite(validatedEntryAmount) || validatedEntryAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid entry amount',
        message: 'Entry amount must be a positive number'
      });
    }

    // Validate and clamp multiplier to prevent astronomical values
    // Ensure multiplier is a valid integer between 1 and 1000
    let validatedMultiplier = 2; // Default
    if (multiplier !== undefined && multiplier !== null) {
      if (typeof multiplier === 'number' && Number.isFinite(multiplier)) {
        validatedMultiplier = Math.max(1, Math.min(1000, Math.round(multiplier)));
      } else if (typeof multiplier === 'string') {
        const parsed = Number.parseFloat(multiplier);
        if (Number.isFinite(parsed) && parsed > 0) {
          validatedMultiplier = Math.max(1, Math.min(1000, Math.round(parsed)));
        }
      }
    }

    // Verify user has sufficient bankroll (with better logging)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bankroll')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error(`[Entries ${submissionId}] Profile error:`, profileError);
      return res.status(404).json({ error: 'User profile not found' });
    }

    console.log(`[Entries ${submissionId}] Submitting entry: userId=${userId}, entryAmount=${validatedEntryAmount}, currentBankroll=${profile.bankroll}`);

    if (profile.bankroll < validatedEntryAmount) {
      console.warn(`[Entries ${submissionId}] Insufficient bankroll: required=${validatedEntryAmount}, available=${profile.bankroll}`);
      return res.status(400).json({
        error: 'Insufficient bankroll',
        required: validatedEntryAmount,
        available: profile.bankroll
      });
    }
    
    const entryData: any = {
      contest_id: contestId,
      user_id: userId,
      picks: picks, // Array of { matchupId, side }
      entry_amount: validatedEntryAmount, // Validated entry amount
      multiplier: validatedMultiplier, // Max possible multiplier (actual calculated at settlement)
      status: 'pending'
      // Don't set created_at - let Supabase handle it automatically to ensure unique timestamps
    };
    
    // Store flex option and multiplier schedule for settlement calculation
    if (isFlex !== undefined) {
      entryData.is_flex = isFlex;
    }
    if (pickCount !== undefined) {
      entryData.pick_count = pickCount;
    }
    if (multiplierSchedule) {
      entryData.multiplier_schedule = multiplierSchedule; // Store schedule JSON for settlement
    }
    
    // Pre-calculate outcome if results are available
    try {
      const resultsAvailable = await hasResultsData(contestId);
      if (resultsAvailable) {
        console.log(`[Entries ${submissionId}] Results available, pre-calculating outcome...`);
        const outcome = await calculateRoundOutcome(
          contestId,
          picks,
          validatedEntryAmount,
          isFlex || false,
          pickCount || picks.length,
          multiplierSchedule || {}
        );
        entryData.precalculated_outcome = outcome;
        console.log(`[Entries ${submissionId}] Pre-calculated outcome:`, {
          correctPicks: outcome.correctPicks,
          totalPicks: outcome.totalPicks,
          outcome: outcome.outcome,
          winnings: outcome.finalWinnings
        });
      } else {
        console.log(`[Entries ${submissionId}] No results available yet, skipping pre-calculation`);
      }
    } catch (precalcError) {
      console.error(`[Entries ${submissionId}] Error pre-calculating outcome:`, precalcError);
      // Don't fail the entry submission if pre-calculation fails
      // The simulation can still calculate it later
    }

    // Ensure we're not accidentally including an ID (which would cause an upsert)
    if (entryData.id) {
      console.warn(`[Entries ${submissionId}] WARNING: entryData contains an ID, removing it to ensure insert:`, entryData.id);
      delete entryData.id;
    }
    
    // Create entry record first
    console.log(`[Entries ${submissionId}] Inserting entry data:`, {
      contest_id: entryData.contest_id,
      user_id: entryData.user_id,
      entry_amount: entryData.entry_amount,
      picks_count: entryData.picks?.length,
      has_id: !!entryData.id, // Should be false
      status: entryData.status
    });
    
    // Use insert with explicit conflict resolution to ensure we always create a new entry
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert([entryData], { 
        onConflict: undefined // Explicitly don't use upsert
      })
      .select()
      .single();

    if (entryError) {
      console.error(`[Entries ${submissionId}] Error creating entry:`, {
        error: entryError,
        code: entryError.code,
        message: entryError.message,
        details: entryError.details,
        hint: entryError.hint
      });
      return res.status(500).json({ 
        error: 'Failed to create entry',
        message: entryError.message,
        code: entryError.code,
        details: entryError.details
      });
    }

    if (!entry || !entry.id) {
      console.error(`[Entries ${submissionId}] Entry created but no ID returned:`, entry);
      return res.status(500).json({ 
        error: 'Failed to create entry',
        message: 'Entry was created but no ID was returned'
      });
    }

    console.log(`[Entries ${submissionId}] Entry created successfully: id=${entry.id}, contestId=${contestId}, userId=${userId}, created_at=${entry.created_at}`);
    
    // Verify the entry was actually created (not updated) by checking if it's a new ID
    // Also verify there are multiple entries for this user/contest
    const { count: entryCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('contest_id', contestId)
      .eq('status', 'pending');
    
    console.log(`[Entries ${submissionId}] Total pending entries for user ${userId} in contest ${contestId}: ${entryCount}`);
    
    if (entryCount && entryCount > 1) {
      // Get all entry IDs to verify they're different
      const { data: allEntries } = await supabase
        .from('entries')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('contest_id', contestId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      console.log(`[Entries ${submissionId}] All pending entry IDs:`, allEntries?.map(e => ({ id: e.id, created_at: e.created_at })));
    }

    // Atomically deduct entry amount from bankroll
    // Use conditional update: only update if bankroll is still >= entryAmount
    // This prevents race conditions when multiple entries are submitted quickly
    const newBankroll = profile.bankroll - validatedEntryAmount;
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ bankroll: newBankroll })
      .eq('id', userId)
      .gte('bankroll', validatedEntryAmount) // Only update if bankroll is still sufficient
      .select('bankroll')
      .single();

    if (updateError || !updatedProfile) {
      // Rollback entry if bankroll update fails (likely due to race condition)
      console.error(`[Entries ${submissionId}] Bankroll update failed for entry ${entry.id}, rolling back:`, updateError);
      const { error: deleteError } = await supabase.from('entries').delete().eq('id', entry.id);
      if (deleteError) {
        console.error(`[Entries ${submissionId}] Failed to rollback entry ${entry.id}:`, deleteError);
      } else {
        console.log(`[Entries ${submissionId}] Entry ${entry.id} rolled back successfully`);
      }
      
      // Re-check bankroll to provide accurate error message
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('bankroll')
        .eq('id', userId)
        .single();
      
      return res.status(400).json({ 
        error: 'Insufficient bankroll (concurrent transaction)',
        message: 'Another entry was processed simultaneously. Please try again.',
        required: validatedEntryAmount,
        available: currentProfile?.bankroll || 0
      });
    }

    console.log(`[Entries ${submissionId}] Bankroll updated successfully: userId=${userId}, newBankroll=${updatedProfile.bankroll}`);

    // Clear user's entries cache
    await deleteCache(`entries:${userId}`);
    
    console.log(`[Entries ${submissionId}] Entry submission successful: entryId=${entry.id}, newBankroll=${updatedProfile.bankroll}`);
    
    res.status(201).json({
      success: true,
      entry: {
        id: entry.id,
        contestId: entry.contest_id,
        picks: entry.picks,
        entryAmount: entry.entry_amount,
        multiplier: entry.multiplier,
        status: entry.status
      },
      newBankroll: updatedProfile.bankroll
    });

  } catch (error) {
    console.error(`[Entries ${submissionId}] Error submitting entry:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/entries/user/:userId
 * Get all entries for a user
 */
entriesRouter.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { contestId, status } = req.query;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({ 
        error: 'Entries not available',
        message: 'Database not configured'
      });
    }

    // Build query
    let query = supabase
      .from('entries')
      .select(`
        *,
        contests (
          id,
          track,
          date,
          first_post_time,
          lifecycle_status
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (contestId) {
      query = query.eq('contest_id', contestId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Error fetching entries:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch entries',
        message: error.message 
      });
    }

    res.json({
      entries: entries || [],
      count: entries?.length || 0
    });

  } catch (error) {
    console.error('Error fetching user entries:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/entries/pending
 * Get all pending entries grouped by contest (for simulation)
 * Supports optional userId query parameter to filter by user
 */
entriesRouter.get('/pending', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseInitialized()) {
      return res.status(503).json({ 
        error: 'Entries not available',
        message: 'Database not configured'
      });
    }

    const { userId } = req.query;

    // Build query - filter by user if userId provided
    let query = supabase
      .from('entries')
      .select(`
        id,
        contest_id,
        user_id,
        picks,
        entry_amount,
        multiplier,
        is_flex,
        pick_count,
        multiplier_schedule,
        status,
        created_at,
        contests (
          id,
          track,
          date,
          first_post_time,
          lifecycle_status
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Filter by user if userId provided
    if (userId && typeof userId === 'string') {
      query = query.eq('user_id', userId);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Error fetching pending entries:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch pending entries',
        message: error.message 
      });
    }

    // If userId is provided, return entries directly (for user view)
    // Otherwise, return grouped by contest (for admin view)
    if (userId && typeof userId === 'string') {
      // User view - return entries directly WITH matchup details populated
      const entriesWithMatchups = await Promise.all((entries || []).map(async (entry: any) => {
        // Get contest info to fetch post times
        const { data: contest } = await supabase
          .from('contests')
          .select('track, date, track_data_id')
          .eq('id', entry.contest_id)
          .single();
        
        // Fetch matchups for this contest
        const { data: matchupRows } = await supabase
          .from('matchups')
          .select('*')
          .eq('contest_id', entry.contest_id);
        
        // Build matchup lookup
        const matchupLookup = new Map<string, any>();
        if (matchupRows) {
          for (const row of matchupRows) {
            const matchupData = row.matchup_data;
            if (matchupData && matchupData.matchups) {
              for (const matchup of matchupData.matchups) {
                if (matchup.id) {
                  matchupLookup.set(matchup.id, matchup);
                }
              }
            }
          }
        }
        
        // Populate matchups for each pick
        let matchups = (entry.picks || []).map((pick: any) => {
          const matchupId = pick.matchupId || pick.matchup_id;
          return matchupLookup.get(matchupId) || null;
        }).filter(Boolean);
        
        // Enrich matchups with post times from track_data if available
        if (contest && contest.track_data_id) {
          try {
            const { data: trackData } = await supabase
              .from('track_data')
              .select('data')
              .eq('id', contest.track_data_id)
              .single();
            
            if (trackData && trackData.data && trackData.data.entries && Array.isArray(trackData.data.entries)) {
              // Build a map of track-race to post time from entries
              const postTimeMap = new Map<string, string>();
              
              // track_data.data.entries is an array of records, each with track, race, and post_time
              for (const record of trackData.data.entries) {
                if (record.track && record.race && record.post_time) {
                  const key = `${record.track}-${record.race}`;
                  // Only set if not already in map (first occurrence wins, or we could use the most common one)
                  if (!postTimeMap.has(key)) {
                    postTimeMap.set(key, record.post_time);
                  }
                }
              }
              
              console.log(`[Entries] Built post time map with ${postTimeMap.size} entries for contest ${contest.track_data_id}`);
              
              // Add post times to starter objects in matchups
              matchups = matchups.map((matchup: any) => {
                if (!matchup) return matchup;
                
                const enrichStarters = (starters: any[]) => {
                  return starters.map((starter: any) => {
                    if (!starter.postTime && !starter.post_time) {
                      const key = `${starter.track}-${starter.race || starter.raceNumber}`;
                      const postTime = postTimeMap.get(key);
                      if (postTime) {
                        return { ...starter, postTime, post_time: postTime };
                      }
                    }
                    return starter;
                  });
                };
                
                // Enrich starters in setA connections
                if (matchup.setA?.connections) {
                  matchup.setA.connections = matchup.setA.connections.map((conn: any) => {
                    if (conn.starters) {
                      conn.starters = enrichStarters(conn.starters);
                    }
                    return conn;
                  });
                }
                
                // Enrich starters in setB connections
                if (matchup.setB?.connections) {
                  matchup.setB.connections = matchup.setB.connections.map((conn: any) => {
                    if (conn.starters) {
                      conn.starters = enrichStarters(conn.starters);
                    }
                    return conn;
                  });
                }
                
                return matchup;
              });
            } else {
              console.log('[Entries] Track data structure unexpected:', {
                hasData: !!trackData?.data,
                hasEntries: !!trackData?.data?.entries,
                entriesIsArray: Array.isArray(trackData?.data?.entries)
              });
            }
          } catch (err) {
            console.error('[Entries] Error enriching post times:', err);
            // Continue without post times if fetch fails
          }
        }
        
        return {
          ...entry,
          matchups, // Add populated matchups with post times
        };
      }));
      
      res.json({
        entries: entriesWithMatchups,
        count: entriesWithMatchups.length
      });
      return;
    }

    // Admin view - group entries by contest
    const entriesByContest = new Map<string, typeof entries>();
    const contestInfo = new Map<string, any>();
    
    entries?.forEach((entry: any) => {
      const contestId = entry.contest_id;
      if (!entriesByContest.has(contestId)) {
        entriesByContest.set(contestId, []);
        contestInfo.set(contestId, entry.contests);
      }
      entriesByContest.get(contestId)!.push(entry);
    });

    // Format response
    const groupedEntries = await Promise.all(
      Array.from(entriesByContest.entries()).map(async ([contestId, contestEntries]) => {
        // Extract tracks from matchups for this contest
        const tracks = new Set<string>();
        
        // Fetch matchups to extract tracks
        const { data: matchupsData } = await supabase
          .from('matchups')
          .select('matchup_data')
          .eq('contest_id', contestId)
          .limit(1); // Just need one to get track info
        
        if (matchupsData && matchupsData.length > 0) {
          const matchupData = matchupsData[0]?.matchup_data;
          if (matchupData?.matchups) {
            matchupData.matchups.forEach((m: any) => {
              [...(m.setA?.connections || []), ...(m.setB?.connections || [])].forEach((conn: any) => {
                if (conn.trackSet && Array.isArray(conn.trackSet)) {
                  conn.trackSet.forEach((t: string) => tracks.add(t));
                }
                if (conn.starters && Array.isArray(conn.starters)) {
                  conn.starters.forEach((s: any) => {
                    if (s.track) tracks.add(s.track);
                  });
                }
              });
            });
          }
        }
        
        // Also check contest track
        const contest = contestInfo.get(contestId);
        if (contest?.track) {
          tracks.add(contest.track);
        }
        
        return {
          contestId,
          contest,
          entries: contestEntries,
          count: contestEntries.length,
          totalEntryAmount: contestEntries.reduce((sum: number, e: any) => sum + (e.entry_amount || 0), 0),
          tracks: Array.from(tracks).sort()
        };
      })
    );

    res.json({
      entriesByContest: groupedEntries,
      totalEntries: entries?.length || 0,
      totalContests: groupedEntries.length
    });

  } catch (error) {
    console.error('Error fetching pending entries:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/entries/:entryId
 * Get single entry details
 */
entriesRouter.get('/:entryId', async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;

    if (!isSupabaseInitialized()) {
      return res.status(503).json({ 
        error: 'Entry details not available',
        message: 'Database not configured'
      });
    }

    const { data: entry, error } = await supabase
      .from('entries')
      .select(`
        *,
        contests (
          id,
          track,
          date,
          first_post_time,
          lifecycle_status
        ),
        profiles (
          id,
          display_name,
          username
        )
      `)
      .eq('id', entryId)
      .single();

    if (error || !entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(entry);

  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper to delete cache entries
async function deleteCache(key: string) {
  try {
    const redis = await import('../utils/redis');
    if (redis.deleteCache) {
      await redis.deleteCache(key);
    }
  } catch (err) {
    console.warn('Could not clear cache:', err);
  }
}
