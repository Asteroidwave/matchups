/**
 * Working Ingestion Route - Complete pipeline with horses and race entries
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getCommonDb } from '../utils/mongodb';

export const workingIngestionRouter = Router();

/**
 * POST /api/working/ingest/:track/:date
 * Complete ingestion pipeline: races + horses + connections + race entries
 */
workingIngestionRouter.post('/ingest/:track/:date', async (req: Request, res: Response) => {
  const { track, date } = req.params;
  const logId = `ingest_${Date.now()}`;
  
  console.log(`[${logId}] 🚀 Starting complete ingestion: ${track} ${date}`);
  
  try {
    const result = {
      track,
      date,
      steps: {},
      errors: []
    };
    
    // STEP 1: Get MongoDB data
    console.log(`[${logId}] Step 1: Fetching MongoDB data...`);
    
    const db = await getCommonDb();
    const collection = db.collection('equibase_entries');
    
    const dateObj = new Date(date);
    const mongoEntries = await collection.find({
      raceDate: {
        $gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
        $lt: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1)
      },
      raceNameForDB: { $regex: `^${track.toUpperCase()}-` }
    }).toArray();
    
    result.steps['step1_mongo_fetch'] = {
      success: true,
      entriesFound: mongoEntries.length
    };
    
    console.log(`[${logId}] Found ${mongoEntries.length} race documents`);
    
    if (mongoEntries.length === 0) {
      return res.json({
        success: false,
        message: `No data found for ${track} on ${date}`,
        result
      });
    }
    
    // STEP 2: Ensure track exists
    console.log(`[${logId}] Step 2: Ensuring track exists...`);
    
    const trackRecord = await ensureTrackExists(track);
    result.steps['step2_track'] = {
      success: true,
      trackId: trackRecord.id,
      trackName: trackRecord.name
    };
    
    // STEP 3: Create/get race card
    console.log(`[${logId}] Step 3: Creating race card...`);
    
    const raceCard = await ensureRaceCardExists(trackRecord.id, date);
    result.steps['step3_race_card'] = {
      success: true,
      raceCardId: raceCard.id
    };
    
    // STEP 4: Create races
    console.log(`[${logId}] Step 4: Creating races...`);
    
    const { racesCreated, createdRaces } = await createRacesFromMongo(raceCard.id, mongoEntries, logId);
    result.steps['step4_races'] = {
      success: racesCreated > 0,
      racesCreated: racesCreated,
      racesAttempted: mongoEntries.length
    };
    
    // STEP 5: Process horses and connections
    console.log(`[${logId}] Step 5: Processing horses and connections...`);
    
    const { horses, connections } = await processHorsesAndConnections(mongoEntries, logId);
    result.steps['step5_horses_connections'] = {
      success: Object.keys(horses).length > 0 || Object.keys(connections).length > 0,
      horsesProcessed: Object.keys(horses).length,
      connectionsProcessed: Object.keys(connections).length
    };
    
    // STEP 6: Create race entries
    console.log(`[${logId}] Step 6: Creating race entries...`);
    
    const raceEntries = await createRaceEntries(createdRaces, horses, connections, logId);
    result.steps['step6_race_entries'] = {
      success: raceEntries > 0,
      entriesCreated: raceEntries
    };
    
    console.log(`[${logId}] ✅ Complete pipeline success!`);
    
    res.json({
      success: true,
      message: `Successfully ingested complete data for ${track} ${date}`,
      result: {
        track,
        date,
        summary: {
          racesCreated,
          horsesProcessed: Object.keys(horses).length,
          connectionsProcessed: Object.keys(connections).length,
          raceEntriesCreated: raceEntries
        },
        steps: result.steps
      }
    });
    
  } catch (error) {
    console.error(`[${logId}] ❌ Fatal error:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

// Helper functions
async function ensureTrackExists(trackCode: string) {
  const { data: existing } = await supabase
    .from('tracks')
    .select('*')
    .eq('code', trackCode.toUpperCase())
    .single();
  
  if (existing) return existing;
  
  const trackNames = {
    'CD': 'Churchill Downs',
    'AQU': 'Aqueduct',
    'GP': 'Gulfstream Park', 
    'SA': 'Santa Anita',
    'KEE': 'Keeneland'
  };
  
  const { data: newTrack, error } = await supabase
    .from('tracks')
    .insert({
      code: trackCode.toUpperCase(),
      name: trackNames[trackCode.toUpperCase()] || trackCode,
      timezone: 'America/New_York'
    })
    .select()
    .single();
  
  if (error) throw error;
  return newTrack;
}

async function ensureRaceCardExists(trackId: string, date: string) {
  const { data: existing } = await supabase
    .from('race_cards')
    .select('*')
    .eq('track_id', trackId)
    .eq('race_date', date)
    .single();
  
  if (existing) return existing;
  
  const { data: newCard, error } = await supabase
    .from('race_cards')
    .insert({
      track_id: trackId,
      race_date: date,
      status: 'scheduled'
    })
    .select()
    .single();
  
  if (error) throw error;
  return newCard;
}

async function createRacesFromMongo(raceCardId: string, mongoEntries: any[], logId: string) {
  let racesCreated = 0;
  const createdRaces = [];
  
  for (const mongoRace of mongoEntries) {
    try {
      const { data: existingRace } = await supabase
        .from('races')
        .select('id')
        .eq('race_card_id', raceCardId)
        .eq('race_number', mongoRace.raceNumber)
        .single();
      
      if (existingRace) {
        console.log(`[${logId}] Race ${mongoRace.raceNumber} already exists`);
        createdRaces.push({ ...existingRace, mongoData: mongoRace });
        continue;
      }
      
      const { data: race, error } = await supabase
        .from('races')
        .insert({
          race_card_id: raceCardId,
          race_number: mongoRace.raceNumber,
          post_time: mongoRace.postTime,
          distance: mongoRace.distanceText,
          surface: normalizeSurface(mongoRace.surface),
          race_type: mongoRace.raceType,
          purse: mongoRace.purse,
          status: 'scheduled'
        })
        .select()
        .single();
      
      if (error) {
        console.error(`[${logId}] ❌ Race ${mongoRace.raceNumber}:`, error.message);
      } else {
        racesCreated++;
        createdRaces.push({ ...race, mongoData: mongoRace });
        console.log(`[${logId}] ✅ Race ${mongoRace.raceNumber} created`);
      }
      
    } catch (err) {
      console.error(`[${logId}] ❌ Exception in race ${mongoRace.raceNumber}:`, err.message);
    }
  }
  
  return { racesCreated, createdRaces };
}

async function processHorsesAndConnections(mongoEntries: any[], logId: string) {
  const horsesMap = new Map();
  const connectionsMap = new Map();
  
  console.log(`[${logId}] Processing horses and connections from ${mongoEntries.length} races...`);
  
  // Extract from starters arrays
  for (const raceDoc of mongoEntries) {
    if (!raceDoc.starters || !Array.isArray(raceDoc.starters)) continue;
    
    for (const starter of raceDoc.starters) {
      // Process horse - with detailed logging
      if (starter.horse?.name) {
        const horseName = starter.horse.name.toLowerCase();
        console.log(`[${logId}] Processing horse: ${starter.horse.name}`);
        
        if (!horsesMap.has(horseName)) {
          const horseData = {
            name: starter.horse.name,
            foaling_year: starter.horse.foalingDate ? new Date(starter.horse.foalingDate).getFullYear() : null,
            sex: starter.horse.sex?.trim(),
            color: starter.horse.color?.trim(),
            sire_name: starter.sire?.name || null
          };
          
          console.log(`[${logId}] Horse data:`, horseData);
          horsesMap.set(horseName, horseData);
        }
      } else {
        console.warn(`[${logId}] No horse name found in starter:`, Object.keys(starter));
      }
      
      // Process jockey
      if (starter.jockey) {
        const jockeyName = `${starter.jockey.firstName || ''} ${starter.jockey.lastName || ''}`.trim();
        if (jockeyName) {
          const key = `jockey:${jockeyName.toLowerCase()}`;
          connectionsMap.set(key, {
            name: jockeyName,
            role: 'jockey'
          });
        }
      }
      
      // Process trainer
      if (starter.trainer) {
        const trainerName = `${starter.trainer.firstName || ''} ${starter.trainer.lastName || ''}`.trim();
        if (trainerName) {
          const key = `trainer:${trainerName.toLowerCase()}`;
          connectionsMap.set(key, {
            name: trainerName,
            role: 'trainer'
          });
        }
      }
      
      // Process sire
      if (starter.sire?.name) {
        const key = `sire:${starter.sire.name.toLowerCase()}`;
        connectionsMap.set(key, {
          name: starter.sire.name,
          role: 'sire'
        });
      }
    }
  }
  
  // Insert horses
  const horses = {};
  if (horsesMap.size > 0) {
    console.log(`[${logId}] Inserting ${horsesMap.size} horses...`);
    
    const horseInserts = Array.from(horsesMap.values());
    const { data: insertedHorses, error } = await supabase
      .from('horses')
      .upsert(horseInserts, { 
        onConflict: 'name,foaling_year',
        ignoreDuplicates: true
      })
      .select();
    
    if (error) {
      console.error(`[${logId}] Horse insert error:`, error.message);
    } else {
      for (const horse of insertedHorses || []) {
        horses[horse.name.toLowerCase()] = horse;
      }
      console.log(`[${logId}] ✅ Processed ${Object.keys(horses).length} horses`);
    }
  }
  
  // Insert connections
  const connections = {};
  if (connectionsMap.size > 0) {
    console.log(`[${logId}] Inserting ${connectionsMap.size} connections...`);
    
    const connectionInserts = Array.from(connectionsMap.values());
    const { data: insertedConnections, error } = await supabase
      .from('connections')
      .upsert(connectionInserts, {
        onConflict: 'name,role',
        ignoreDuplicates: true
      })
      .select();
    
    if (error) {
      console.error(`[${logId}] Connection insert error:`, error.message);
    } else {
      for (const conn of insertedConnections || []) {
        const key = `${conn.role}:${conn.name.toLowerCase()}`;
        connections[key] = conn;
      }
      console.log(`[${logId}] ✅ Processed ${Object.keys(connections).length} connections`);
    }
  }
  
  return { horses, connections };
}

async function createRaceEntries(createdRaces: any[], horses: any, connections: any, logId: string) {
  let entriesCreated = 0;
  
  console.log(`[${logId}] Creating race entries for ${createdRaces.length} races...`);
  
  for (const race of createdRaces) {
    if (!race.mongoData?.starters) continue;
    
    for (const starter of race.mongoData.starters) {
      try {
        const horseName = starter.horse?.name?.toLowerCase();
        const horse = horses[horseName];
        
        if (!horse) {
          console.warn(`[${logId}] Horse not found: ${starter.horse?.name}`);
          continue;
        }
        
        const jockeyName = `${starter.jockey?.firstName || ''} ${starter.jockey?.lastName || ''}`.trim().toLowerCase();
        const trainerName = `${starter.trainer?.firstName || ''} ${starter.trainer?.lastName || ''}`.trim().toLowerCase();
        
        const jockey = connections[`jockey:${jockeyName}`];
        const trainer = connections[`trainer:${trainerName}`];
        
        const { data: raceEntry, error } = await supabase
          .from('race_entries')
          .insert({
            race_id: race.id,
            horse_id: horse.id,
            program_number: parseInt(starter.program_number) || starter.postPosition,
            post_position: starter.postPosition,
            jockey_id: jockey?.id || null,
            trainer_id: trainer?.id || null,
            morning_line_odds: starter.morningLineOdds || null,
            status: (starter.scratchIndicator?.trim() !== '' && starter.scratchIndicator?.trim() !== ' ') ? 'scratched' : 'entered'
          })
          .select()
          .single();
        
        if (error) {
          console.warn(`[${logId}] Race entry error for ${starter.horse?.name}:`, error.message);
        } else {
          entriesCreated++;
        }
        
      } catch (err) {
        console.warn(`[${logId}] Exception creating race entry:`, err.message);
      }
    }
  }
  
  console.log(`[${logId}] ✅ Created ${entriesCreated} race entries`);
  return entriesCreated;
}

function normalizeSurface(surface: string): string | null {
  if (!surface) return null;
  
  const normalized = surface.toString().toLowerCase().trim();
  
  const surfaceMap = {
    'd': 'dirt',
    'dirt': 'dirt',
    't': 'turf', 
    'turf': 'turf',
    'fast': 'dirt',
    'good': 'turf',
    'firm': 'turf',
    'synthetic': 'synthetic'
  };
  
  return surfaceMap[normalized] || normalized;
}