/**
 * Super simple debug routes to test basic functionality
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const debugSimpleRouter = Router();

/**
 * GET /api/debug/simple/tables
 * List all tables and their row counts
 */
debugSimpleRouter.get('/tables', async (req: Request, res: Response) => {
  try {
    const tables = [
      'tracks', 'race_cards', 'races', 'horses', 'connections',
      'race_entries', 'race_results', 'user_entries', 'user_picks', 'rounds'
    ];
    
    const tableCounts = {};
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
          
        tableCounts[table] = error ? `Error: ${error.message}` : count;
      } catch (err) {
        tableCounts[table] = `Error: ${err.message}`;
      }
    }
    
    res.json({
      success: true,
      tableCounts,
      message: "Row counts for all new relational tables"
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/debug/simple/race-card/:track/:date
 * Simple race card lookup
 */
debugSimpleRouter.get('/race-card/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    // First find the track
    const { data: trackData, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('code', track.toUpperCase())
      .single();
    
    if (trackError || !trackData) {
      return res.json({
        success: false,
        step: 'track_lookup',
        error: trackError?.message || 'Track not found'
      });
    }
    
    // Then find the race card
    const { data: raceCard, error: cardError } = await supabase
      .from('race_cards')
      .select('*')
      .eq('track_id', trackData.id)
      .eq('race_date', date)
      .single();
    
    if (cardError || !raceCard) {
      return res.json({
        success: false,
        step: 'race_card_lookup',
        track: trackData,
        error: cardError?.message || 'Race card not found',
        raceCardsForTrack: await getRaceCardsForTrack(trackData.id)
      });
    }
    
    res.json({
      success: true,
      track: trackData,
      raceCard: raceCard
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

async function getRaceCardsForTrack(trackId: string) {
  const { data } = await supabase
    .from('race_cards')
    .select('race_date, status')
    .eq('track_id', trackId)
    .order('race_date', { ascending: false })
    .limit(5);
  
  return data || [];
}
