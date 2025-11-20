/**
 * Fixed Track Summary API - Simple working version
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const fixedSummaryRouter = Router();

/**
 * GET /api/fixed/summary/:track/:date
 * Working track summary with simple queries
 */
fixedSummaryRouter.get('/summary/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    console.log(`🔍 Getting summary for ${track} ${date}`);
    
    // Step 1: Get track
    const { data: trackData, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('code', track.toUpperCase())
      .single();
    
    if (trackError || !trackData) {
      return res.status(404).json({ 
        error: 'Track not found',
        trackCode: track,
        step: 'track_lookup'
      });
    }
    
    console.log(`Found track: ${trackData.name} (${trackData.id})`);
    
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
        step: 'race_card_lookup',
        cardError: cardError?.message
      });
    }
    
    console.log(`Found race card: ${raceCard.id}`);
    
    // Step 3: Get races
    const { data: races, error: racesError } = await supabase
      .from('races')
      .select('*')
      .eq('race_card_id', raceCard.id)
      .order('race_number');
    
    if (racesError) {
      throw racesError;
    }
    
    console.log(`Found ${races?.length || 0} races`);
    
    // Step 4: Get race entries for each race - simplified query
    const racesWithEntries = [];
    
    for (const race of races || []) {
      console.log(`Getting entries for race ${race.race_number} (${race.id})`);
      
      const { data: entries, error: entriesError } = await supabase
        .from('race_entries')
        .select(`
          *,
          horses (name, sire_name)
        `)
        .eq('race_id', race.id);
      
      console.log(`Race ${race.race_number}: Found ${entries?.length || 0} entries`);
      
      if (entriesError) {
        console.error(`Error getting entries for race ${race.race_number}:`, entriesError.message);
      }
      
      // Get jockey and trainer names separately to avoid query conflicts
      const entriesWithConnections = [];
      
      for (const entry of entries || []) {
        let jockeyName = null;
        let trainerName = null;
        
        if (entry.jockey_id) {
          const { data: jockey } = await supabase
            .from('connections')
            .select('name')
            .eq('id', entry.jockey_id)
            .single();
          jockeyName = jockey?.name;
        }
        
        if (entry.trainer_id) {
          const { data: trainer } = await supabase
            .from('connections')
            .select('name')
            .eq('id', entry.trainer_id)
            .single();
          trainerName = trainer?.name;
        }
        
        entriesWithConnections.push({
          ...entry,
          jockey_name: jockeyName,
          trainer_name: trainerName
        });
      }
      
      racesWithEntries.push({
        ...race,
        entryCount: entries?.length || 0,
        entries: entriesWithConnections
      });
    }
    
    // Build summary
    const allEntries = racesWithEntries.flatMap(race => race.entries);
    
    const summary = {
      track: trackData,
      raceCard: {
        id: raceCard.id,
        date: raceCard.race_date,
        status: raceCard.status,
        totalRaces: races?.length || 0
      },
      races: racesWithEntries,
      statistics: {
        totalEntries: allEntries.length,
        uniqueHorses: new Set(allEntries.map(e => e.horses?.name).filter(Boolean)).size,
        uniqueJockeys: new Set(allEntries.map(e => e.connections?.name).filter(Boolean)).size
      }
    };
    
    console.log(`✅ Summary built: ${summary.statistics.totalEntries} entries across ${summary.raceCard.totalRaces} races`);
    
    res.json(summary);
    
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({
      error: 'Failed to get track summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
