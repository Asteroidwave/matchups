/**
 * Simple Track Summary API - Works with current data
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const simpleSummaryRouter = Router();

/**
 * GET /api/simple/summary/:track/:date
 * Get track summary with simple, working queries
 */
simpleSummaryRouter.get('/summary/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    console.log(`🔍 Getting simple summary for ${track} ${date}`);
    
    // Step 1: Get track
    const { data: trackData, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('code', track.toUpperCase())
      .single();
    
    if (trackError || !trackData) {
      return res.status(404).json({
        error: 'Track not found',
        trackCode: track
      });
    }
    
    // Step 2: Get race card
    const { data: raceCard, error: cardError } = await supabase
      .from('race_cards')
      .select('*')
      .eq('track_id', trackData.id)
      .eq('race_date', date)
      .single();
    
    if (cardError || !raceCard) {
      return res.status(404).json({
        error: 'Race card not found',
        trackCode: track,
        date: date,
        trackId: trackData.id,
        availableRaceCards: await getAvailableRaceCards(trackData.id)
      });
    }
    
    // Step 3: Get races for this race card
    const { data: races, error: racesError } = await supabase
      .from('races')
      .select('*')
      .eq('race_card_id', raceCard.id)
      .order('race_number');
    
    if (racesError) {
      throw racesError;
    }
    
    // Step 4: Get race entries for these races
    const raceIds = races.map(r => r.id);
    let raceEntries = [];
    
    if (raceIds.length > 0) {
      const { data: entries, error: entriesError } = await supabase
        .from('race_entries')
        .select(`
          *,
          horses (name, sire_name),
          jockey:connections!race_entries_jockey_id_fkey (name, role),
          trainer:connections!race_entries_trainer_id_fkey (name, role)
        `)
        .in('race_id', raceIds);
      
      if (!entriesError) {
        raceEntries = entries || [];
      }
    }
    
    // Build summary response
    const summary = {
      track: trackData,
      raceCard: raceCard,
      races: races.map(race => {
        const raceEntries_ = raceEntries.filter(entry => entry.race_id === race.id);
        return {
          ...race,
          entryCount: raceEntries_.length,
          entries: raceEntries_
        };
      }),
      statistics: {
        totalRaces: races.length,
        totalEntries: raceEntries.length,
        uniqueHorses: new Set(raceEntries.map(e => e.horses?.name)).size,
        uniqueJockeys: new Set(raceEntries.map(e => e.jockey?.name).filter(Boolean)).size
      }
    };
    
    res.json(summary);
    
  } catch (error) {
    console.error('Simple summary error:', error);
    res.status(500).json({
      error: 'Failed to get track summary',
      message: error.message
    });
  }
});

async function getAvailableRaceCards(trackId: string) {
  const { data } = await supabase
    .from('race_cards')
    .select('race_date, status')
    .eq('track_id', trackId)
    .order('race_date', { ascending: false })
    .limit(5);
  
  return data || [];
}
