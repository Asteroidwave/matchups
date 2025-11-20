/**
 * Debug Ingestion Routes - Step by step testing
 */
import { Router, Request, Response } from 'express';
import { getCommonDb } from '../utils/mongodb';
import { supabase } from '../utils/supabase';

export const debugIngestionRouter = Router();

/**
 * GET /api/debug/ingestion/step1/:track/:date
 * Test step 1: MongoDB data fetching
 */
debugIngestionRouter.get('/step1/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    console.log(`🔍 Testing Step 1: MongoDB fetch for ${track} ${date}`);
    
    const db = await getCommonDb();
    const entriesCollection = db.collection('equibase_entries');
    
    const dateObj = new Date(date);
    const entries = await entriesCollection.find({
      raceDate: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      },
      raceNameForDB: { $regex: `^${track.toUpperCase()}-` }
    }).toArray();
    
    console.log(`Found ${entries.length} entries`);
    
    res.json({
      success: true,
      step: 1,
      description: 'MongoDB data fetching',
      entriesFound: entries.length,
      sampleEntry: entries.length > 0 ? {
        raceNameForDB: entries[0].raceNameForDB,
        raceNumber: entries[0].raceNumber,
        startersCount: entries[0].starters?.length || 0
      } : null
    });
    
  } catch (error) {
    console.error('Step 1 error:', error);
    res.status(500).json({
      success: false,
      step: 1,
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

/**
 * GET /api/debug/ingestion/step2/:track/:date  
 * Test step 2: Track creation
 */
debugIngestionRouter.get('/step2/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track } = req.params;
    
    console.log(`🔍 Testing Step 2: Track creation for ${track}`);
    
    // Check if track exists
    const { data: existingTrack } = await supabase
      .from('tracks')
      .select('id, name')
      .eq('code', track.toUpperCase())
      .single();

    if (existingTrack) {
      return res.json({
        success: true,
        step: 2,
        description: 'Track already exists',
        track: existingTrack
      });
    }

    // Create track
    const trackName = getTrackName(track);
    const { data: newTrack, error } = await supabase
      .from('tracks')
      .insert({
        code: track.toUpperCase(),
        name: trackName,
        timezone: 'America/New_York',
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created track: ${newTrack.name}`);

    res.json({
      success: true,
      step: 2,
      description: 'Track creation',
      track: newTrack
    });
    
  } catch (error) {
    console.error('Step 2 error:', error);
    res.status(500).json({
      success: false,
      step: 2,
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

/**
 * GET /api/debug/ingestion/step3/:track/:date
 * Test step 3: Race card creation  
 */
debugIngestionRouter.get('/step3/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    console.log(`🔍 Testing Step 3: Race card creation for ${track} ${date}`);
    
    // Get track
    const { data: trackRecord } = await supabase
      .from('tracks')
      .select('id')
      .eq('code', track.toUpperCase())
      .single();

    if (!trackRecord) {
      throw new Error(`Track ${track} not found`);
    }

    // Check if race card exists
    const { data: existingCard } = await supabase
      .from('race_cards')
      .select('id')
      .eq('track_id', trackRecord.id)
      .eq('race_date', date)
      .single();

    if (existingCard) {
      return res.json({
        success: true,
        step: 3,
        description: 'Race card already exists',
        raceCard: existingCard
      });
    }

    // Create race card
    const { data: newRaceCard, error } = await supabase
      .from('race_cards')
      .insert({
        track_id: trackRecord.id,
        race_date: date,
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created race card: ${newRaceCard.id}`);

    res.json({
      success: true,
      step: 3,
      description: 'Race card creation',
      raceCard: newRaceCard
    });
    
  } catch (error) {
    console.error('Step 3 error:', error);
    res.status(500).json({
      success: false,
      step: 3,
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

function getTrackName(code: string): string {
  const trackNames = {
    'CD': 'Churchill Downs',
    'AQU': 'Aqueduct',
    'FL': 'Finger Lakes',
    'MVR': 'Mountaineer Park',
    'PRX': 'Parx Racing',
    'GP': 'Gulfstream Park',
    'SA': 'Santa Anita Park', 
    'KEE': 'Keeneland'
  };
  return trackNames[code.toUpperCase()] || code;
}
