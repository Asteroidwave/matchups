/**
 * Complete Ingestion - Final working version with all components
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getCommonDb } from '../utils/mongodb';

export const completeIngestionRouter = Router();

/**
 * POST /api/complete/ingest/:track/:date
 * Complete end-to-end ingestion: MongoDB → Full Relational Database
 */
completeIngestionRouter.post('/ingest/:track/:date', async (req: Request, res: Response) => {
  const { track, date } = req.params;
  const logId = `complete_${Date.now()}`;
  
  console.log(`[${logId}] 🏇 COMPLETE INGESTION: ${track} ${date}`);
  
  try {
    // Get all MongoDB race documents for this track/date
    const db = await getCommonDb();
    const collection = db.collection('equibase_entries');
    
    const dateObj = new Date(date);
    const mongoRaces = await collection.find({
      raceDate: {
        $gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
        $lt: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1)
      },
      raceNameForDB: { $regex: `^${track.toUpperCase()}-` }
    }).toArray();
    
    console.log(`[${logId}] Found ${mongoRaces.length} races in MongoDB`);
    
    if (mongoRaces.length === 0) {
      return res.json({
        success: false,
        message: `No race data found for ${track} ${date}`
      });
    }
    
    let totalEntries = 0;
    
    // Process each race completely
    for (const mongoRace of mongoRaces) {
      console.log(`[${logId}] Processing Race ${mongoRace.raceNumber}...`);
      
      if (!mongoRace.starters || mongoRace.starters.length === 0) {
        console.warn(`[${logId}] No starters in race ${mongoRace.raceNumber}`);
        continue;
      }
      
      // Find the corresponding race in our database
      const { data: dbRace } = await supabase
        .from('races')
        .select('id')
        .eq('race_number', mongoRace.raceNumber)
        .single();
      
      if (!dbRace) {
        console.warn(`[${logId}] Race ${mongoRace.raceNumber} not found in database`);
        continue;
      }
      
      // Process each starter in this race
      for (const starter of mongoRace.starters) {
        try {
          // Find horse by name
          const { data: horse } = await supabase
            .from('horses')
            .select('id')
            .ilike('name', starter.horse?.name)
            .single();
          
          if (!horse) {
            console.warn(`[${logId}] Horse not found: ${starter.horse?.name}`);
            continue;
          }
          
          // Find jockey
          const jockeyName = `${starter.jockey?.firstName || ''} ${starter.jockey?.lastName || ''}`.trim();
          const { data: jockey } = await supabase
            .from('connections')
            .select('id')
            .eq('role', 'jockey')
            .ilike('name', jockeyName)
            .single();
          
          // Find trainer
          const trainerName = `${starter.trainer?.firstName || ''} ${starter.trainer?.lastName || ''}`.trim();
          const { data: trainer } = await supabase
            .from('connections')
            .select('id')
            .eq('role', 'trainer')
            .ilike('name', trainerName)
            .single();
          
          // Create race entry
          const { data: raceEntry, error } = await supabase
            .from('race_entries')
            .insert({
              race_id: dbRace.id,
              horse_id: horse.id,
              program_number: parseInt(starter.program_number) || starter.postPosition,
              post_position: starter.postPosition,
              jockey_id: jockey?.id || null,
              trainer_id: trainer?.id || null,
              morning_line_odds: starter.morningLineOdds,
              status: (starter.scratchIndicator?.trim() !== '' && starter.scratchIndicator?.trim() !== ' ') ? 'scratched' : 'entered'
            })
            .select()
            .single();
          
          if (error) {
            console.error(`[${logId}] Entry error for ${starter.horse?.name}:`, error.message);
          } else {
            totalEntries++;
            if (totalEntries % 20 === 0) {
              console.log(`[${logId}] ✅ Created ${totalEntries} race entries...`);
            }
          }
          
        } catch (err) {
          console.warn(`[${logId}] Exception for starter:`, err.message);
        }
      }
    }
    
    console.log(`[${logId}] ✅ COMPLETE SUCCESS: Created ${totalEntries} race entries`);
    
    res.json({
      success: true,
      message: `Complete ingestion successful for ${track} ${date}`,
      result: {
        racesProcessed: mongoRaces.length,
        totalEntries: totalEntries
      }
    });
    
  } catch (error) {
    console.error(`[${logId}] ❌ Complete ingestion error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
