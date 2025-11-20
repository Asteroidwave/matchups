/**
 * New Relational Data API Routes
 * These endpoints use the new relational database structure
 */
import { Router, Request, Response } from 'express';
import { RelationalDataIngestionService } from '../services/dataIngestion';
import { supabase } from '../utils/supabase';
import { getCache, setCache } from '../utils/redis';

export const relationalDataRouter = Router();
const ingestionService = new RelationalDataIngestionService();

/**
 * POST /api/v2/data/ingest/:track/:date
 * Ingest track data into relational structure
 */
relationalDataRouter.post('/data/ingest/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    console.log(`🏇 Starting data ingestion: ${track} ${date}`);
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if already processed
    const { data: existingCard } = await supabase
      .from('race_cards')
      .select('id, status')
      .eq('track_id', track)
      .eq('race_date', date)
      .single();

    if (existingCard && req.query.force !== 'true') {
      return res.json({
        message: 'Data already ingested',
        raceCardId: existingCard.id,
        status: existingCard.status,
        note: 'Use ?force=true to re-ingest'
      });
    }

    // Perform ingestion
    const result = await ingestionService.ingestTrackData(track.toUpperCase(), date);
    
    res.json({
      success: true,
      message: `Ingested ${track} data for ${date}`,
      result
    });

  } catch (error) {
    console.error('Ingestion error:', error);
    console.error('Full error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({
      error: 'Failed to ingest data',
      message: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name,
      details: error instanceof Error ? error.stack : null
    });
  }
});

/**
 * GET /api/v2/contests/:contestId/relational
 * Get contest data using relational queries
 */
relationalDataRouter.get('/contests/:contestId/relational', async (req: Request, res: Response) => {
  try {
    const { contestId } = req.params;
    const cacheKey = `contest_relational:${contestId}`;
    
    // Check cache first
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get contest with related data using proper joins
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select(`
        *,
        contest_races!inner (
          race_id,
          races (
            id,
            race_number,
            post_time,
            race_cards (
              track_id,
              race_date,
              tracks (
                code,
                name,
                timezone
              )
            )
          )
        )
      `)
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Get race entries for all contest races
    const raceIds = contest.contest_races.map(cr => cr.race_id);
    
    const { data: raceEntries, error: entriesError } = await supabase
      .from('race_entries')
      .select(`
        *,
        horses (name, sire_name),
        connections!race_entries_jockey_id_fkey (id, name, role),
        connections!race_entries_trainer_id_fkey (id, name, role),
        race_results (points_earned, finish_position)
      `)
      .in('race_id', raceIds)
      .eq('status', 'entered');

    if (entriesError) {
      throw entriesError;
    }

    // Build response with proper structure
    const response = {
      contest,
      races: contest.contest_races.map(cr => cr.races),
      entries: raceEntries,
      summary: {
        totalRaces: contest.contest_races.length,
        totalEntries: raceEntries.length,
        uniqueHorses: new Set(raceEntries.map(e => e.horses.name)).size,
        uniqueJockeys: new Set(raceEntries.map(e => e.connections?.name).filter(Boolean)).size
      }
    };

    // Cache for 5 minutes
    await setCache(cacheKey, response, 5 * 60);

    res.json(response);

  } catch (error) {
    console.error('Error fetching relational contest:', error);
    res.status(500).json({
      error: 'Failed to fetch contest data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v2/connections/performance/:connectionId
 * Get detailed performance data for a connection using relational queries
 */
relationalDataRouter.get('/connections/performance/:connectionId', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { days = 90 } = req.query;

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Get performance data with proper joins
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));

    const { data: performances, error: perfError } = await supabase
      .from('race_entries')
      .select(`
        *,
        horses (name),
        races (
          race_number,
          post_time,
          race_cards (
            race_date,
            tracks (code, name)
          )
        ),
        race_results (
          finish_position,
          points_earned,
          final_odds
        )
      `)
      .or(`jockey_id.eq.${connectionId},trainer_id.eq.${connectionId}`)
      .gte('races.race_cards.race_date', cutoffDate.toISOString().split('T')[0])
      .order('races.race_cards.race_date', { ascending: false });

    if (perfError) {
      throw perfError;
    }

    // Calculate statistics
    const stats = this.calculateConnectionStats(performances);

    res.json({
      connection,
      performances: performances.slice(0, 50), // Limit to recent 50
      statistics: stats,
      summary: {
        totalRaces: performances.length,
        dateRange: {
          from: cutoffDate.toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('Error fetching connection performance:', error);
    res.status(500).json({
      error: 'Failed to fetch connection performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v2/tracks/:trackCode/summary/:date
 * Get complete track summary using relational data
 */
relationalDataRouter.get('/tracks/:trackCode/summary/:date', async (req: Request, res: Response) => {
  try {
    const { trackCode, date } = req.params;

    // Get track first, then race card - simplified query  
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, code, name, timezone')
      .eq('code', trackCode.toUpperCase())
      .single();
      
    if (trackError || !track) {
      return res.status(404).json({ 
        error: 'Track not found',
        trackCode,
        message: `Track ${trackCode} does not exist`
      });
    }
    
    const { data: raceCard, error: cardError } = await supabase
      .from('race_cards')
      .select(`
        *,
        races (
          *,
          race_entries (
            *,
            horses (name, sire_name),
            jockey:connections (name, role),
            trainer:connections (name, role),
            race_results (points_earned, finish_position)
          )
        )
      `)
      .eq('track_id', track.id)
      .eq('race_date', date)
      .single();

    if (cardError || !raceCard) {
      return res.status(404).json({ 
        error: 'Race card not found',
        trackCode,
        date
      });
    }

    // Process data for summary
    const summary = {
      track: raceCard.tracks,
      raceCard: {
        id: raceCard.id,
        date: raceCard.race_date,
        status: raceCard.status,
        totalRaces: raceCard.races.length
      },
      races: raceCard.races.map(race => ({
        id: race.id,
        raceNumber: race.race_number,
        postTime: race.post_time,
        status: race.status,
        entryCount: race.race_entries.length,
        entries: race.race_entries
      })),
      statistics: {
        totalEntries: raceCard.races.reduce((sum, race) => sum + race.race_entries.length, 0),
        uniqueHorses: new Set(
          raceCard.races.flatMap(race => 
            race.race_entries.map(entry => entry.horses.name)
          )
        ).size,
        uniqueJockeys: new Set(
          raceCard.races.flatMap(race => 
            race.race_entries
              .map(entry => entry.connections?.name)
              .filter(Boolean)
          )
        ).size
      }
    };

    res.json(summary);

  } catch (error) {
    console.error('Error fetching track summary:', error);
    res.status(500).json({
      error: 'Failed to fetch track summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper function to calculate connection statistics
 */
function calculateConnectionStats(performances: any[]) {
  const withResults = performances.filter(p => p.race_results);
  
  if (withResults.length === 0) {
    return {
      totalRaces: 0,
      averagePoints: 0,
      winPercentage: 0,
      top3Percentage: 0
    };
  }

  const totalPoints = withResults.reduce((sum, p) => sum + (p.race_results.points_earned || 0), 0);
  const wins = withResults.filter(p => p.race_results.finish_position === 1).length;
  const top3s = withResults.filter(p => p.race_results.finish_position <= 3).length;

  return {
    totalRaces: withResults.length,
    averagePoints: totalPoints / withResults.length,
    winPercentage: (wins / withResults.length) * 100,
    top3Percentage: (top3s / withResults.length) * 100,
    totalPoints
  };
}

/**
 * GET /api/v2/validation/compare/:track/:date
 * Compare old vs new data structure for validation
 */
relationalDataRouter.get('/validation/compare/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;

    // Get data from both systems for comparison
    const [oldData, newData] = await Promise.all([
      getOldSystemData(track, date),
      getNewRelationalData(track, date)
    ]);

    const comparison = {
      track,
      date,
      oldSystem: {
        entryCount: oldData?.entries?.length || 0,
        resultCount: oldData?.results?.length || 0
      },
      newSystem: {
        entryCount: newData?.entries?.length || 0,
        resultCount: newData?.results?.length || 0
      },
      matches: {
        entriesMatch: (oldData?.entries?.length || 0) === (newData?.entries?.length || 0),
        resultsMatch: (oldData?.results?.length || 0) === (newData?.results?.length || 0)
      }
    };

    res.json(comparison);

  } catch (error) {
    console.error('Validation comparison error:', error);
    res.status(500).json({
      error: 'Failed to compare data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions for validation
async function getOldSystemData(track: string, date: string) {
  // Implementation to fetch from current MongoDB system
  // This would use existing MongoDB queries
  return null; // TODO: Implement
}

async function getNewRelationalData(track: string, date: string) {
  const { data } = await supabase
    .from('race_cards')
    .select(`
      *,
      races (
        race_entries (
          *,
          race_results (*)
        )
      )
    `)
    .eq('race_date', date)
    .eq('tracks.code', track.toUpperCase());

  return data?.[0] || null;
}
