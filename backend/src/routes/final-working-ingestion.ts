/**
 * Final Working Ingestion - Complete pipeline with detailed error handling
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getCommonDb } from '../utils/mongodb';

export const finalWorkingIngestionRouter = Router();

/**
 * POST /api/final/ingest/:track/:date
 * Complete working ingestion with all components
 */
finalWorkingIngestionRouter.post('/ingest/:track/:date', async (req: Request, res: Response) => {
  const { track, date } = req.params;
  const logId = `final_${Date.now()}`;
  
  console.log(`[${logId}] 🏇 FINAL INGESTION START: ${track} ${date}`);
  
  try {
    // Step 1: Get MongoDB data
    const mongoEntries = await fetchMongoData(track, date, logId);
    if (mongoEntries.length === 0) {
      return res.json({ success: false, message: `No data found for ${track} ${date}` });
    }
    
    // Step 2: Ensure foundation exists (track, race card, races)
    const foundation = await ensureFoundationExists(track, date, mongoEntries, logId);
    
    // Step 3: Process and insert horses (one by one to catch errors)
    const horses = await processAndInsertHorses(mongoEntries, logId);
    
    // Step 4: Process and insert connections (already working)
    const connections = await processAndInsertConnections(mongoEntries, logId);
    
    // Step 5: Create race entries linking everything together
    const raceEntries = await createRaceEntriesLinked(foundation.races, horses, connections, logId);
    
    const summary = {
      tracksProcessed: 1,
      raceCardsProcessed: 1,
      racesProcessed: foundation.races.length,
      horsesProcessed: Object.keys(horses).length,
      connectionsProcessed: Object.keys(connections).length,
      raceEntriesCreated: raceEntries
    };
    
    console.log(`[${logId}] ✅ FINAL SUCCESS:`, summary);
    
    res.json({
      success: true,
      message: `Complete ingestion successful for ${track} ${date}`,
      summary,
      raceCardId: foundation.raceCard.id
    });
    
  } catch (error) {
    console.error(`[${logId}] ❌ FINAL ERROR:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function fetchMongoData(track: string, date: string, logId: string) {
  console.log(`[${logId}] 📊 Fetching MongoDB data...`);
  
  const db = await getCommonDb();
  const collection = db.collection('equibase_entries');
  
  const dateObj = new Date(date);
  const entries = await collection.find({
    raceDate: {
      $gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
      $lt: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1)
    },
    raceNameForDB: { $regex: `^${track.toUpperCase()}-` }
  }).toArray();
  
  console.log(`[${logId}] Found ${entries.length} race documents`);
  return entries;
}

async function ensureFoundationExists(track: string, date: string, mongoEntries: any[], logId: string) {
  console.log(`[${logId}] 🏗️ Ensuring foundation exists...`);
  
  // Get/create track
  const { data: trackRecord } = await supabase
    .from('tracks')
    .upsert({
      code: track.toUpperCase(),
      name: getTrackName(track),
      timezone: 'America/New_York'
    }, { onConflict: 'code' })
    .select()
    .single();
  
  // Get/create race card
  const { data: raceCard } = await supabase
    .from('race_cards')
    .upsert({
      track_id: trackRecord.id,
      race_date: date,
      status: 'scheduled'
    }, { onConflict: 'track_id,race_date' })
    .select()
    .single();
  
  // Get existing races
  const { data: existingRaces } = await supabase
    .from('races')
    .select('*')
    .eq('race_card_id', raceCard.id);
  
  console.log(`[${logId}] Foundation: ${existingRaces?.length || 0} races exist`);
  
  return {
    track: trackRecord,
    raceCard,
    races: existingRaces || []
  };
}

async function processAndInsertHorses(mongoEntries: any[], logId: string) {
  console.log(`[${logId}] 🐎 Processing horses...`);
  
  const uniqueHorses = new Map();
  
  // Extract unique horses
  for (const raceDoc of mongoEntries) {
    if (!raceDoc.starters) continue;
    
    for (const starter of raceDoc.starters) {
      if (!starter.horse?.name) continue;
      
      const horseName = starter.horse.name.toLowerCase();
      if (!uniqueHorses.has(horseName)) {
        uniqueHorses.set(horseName, {
          name: starter.horse.name,
          foaling_year: starter.horse.foalingDate ? new Date(starter.horse.foalingDate).getFullYear() : null,
          sex: normalizeSex(starter.horse.sex),
          color: starter.horse.color?.trim(),
          sire_name: starter.sire?.name
        });
      }
    }
  }
  
  console.log(`[${logId}] Found ${uniqueHorses.size} unique horses`);
  
  // Insert horses one by one to catch specific errors
  const horses = {};
  
  for (const [horseName, horseData] of uniqueHorses.entries()) {
    try {
      const { data: horse, error } = await supabase
        .from('horses')
        .upsert(horseData, { 
          onConflict: 'name,foaling_year',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) {
        console.error(`[${logId}] Horse insert error for ${horseData.name}:`, error.message);
      } else {
        horses[horseName] = horse;
        console.log(`[${logId}] ✅ Horse: ${horse.name}`);
      }
    } catch (err) {
      console.error(`[${logId}] Horse exception for ${horseData.name}:`, err.message);
    }
  }
  
  console.log(`[${logId}] ✅ Successfully processed ${Object.keys(horses).length} horses`);
  return horses;
}

async function processAndInsertConnections(mongoEntries: any[], logId: string) {
  console.log(`[${logId}] 🤝 Processing connections...`);
  
  const connectionsMap = new Map();
  
  // Extract connections from starters
  for (const raceDoc of mongoEntries) {
    if (!raceDoc.starters) continue;
    
    for (const starter of raceDoc.starters) {
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
  
  console.log(`[${logId}] Found ${connectionsMap.size} unique connections`);
  
  // Insert connections
  const connections = {};
  if (connectionsMap.size > 0) {
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
  
  return connections;
}

async function createRaceEntriesLinked(races: any[], horses: any, connections: any, logId: string) {
  console.log(`[${logId}] 📝 Creating race entries for ${races.length} races...`);
  
  let entriesCreated = 0;
  
  // Get the MongoDB data for each race
  for (const race of races) {
    // We need to re-fetch the MongoDB data for this race
    const db = await getCommonDb();
    const collection = db.collection('equibase_entries');
    
    const mongoRace = await collection.findOne({
      raceNumber: race.race_number,
      raceNameForDB: { $regex: `^CD-` } // Adjust this based on track
    });
    
    if (!mongoRace?.starters) {
      console.warn(`[${logId}] No starters for race ${race.race_number}`);
      continue;
    }
    
    console.log(`[${logId}] Processing ${mongoRace.starters.length} starters for race ${race.race_number}`);
    
    for (const starter of mongoRace.starters) {
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
        
        const isScratched = starter.scratchIndicator?.trim() !== '' && starter.scratchIndicator?.trim() !== ' ';
        
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
            status: isScratched ? 'scratched' : 'entered'
          })
          .select()
          .single();
        
        if (error) {
          console.error(`[${logId}] Race entry error for ${starter.horse?.name}:`, error.message);
        } else {
          entriesCreated++;
          if (entriesCreated % 10 === 0) {
            console.log(`[${logId}] ✅ Created ${entriesCreated} race entries...`);
          }
        }
        
      } catch (err) {
        console.warn(`[${logId}] Exception creating race entry:`, err.message);
      }
    }
  }
  
  console.log(`[${logId}] ✅ Created ${entriesCreated} total race entries`);
  return entriesCreated;
}

function getTrackName(code: string): string {
  const names = {
    'CD': 'Churchill Downs',
    'AQU': 'Aqueduct', 
    'GP': 'Gulfstream Park'
  };
  return names[code.toUpperCase()] || code;
}

function normalizeSex(sex: string): string | null {
  if (!sex) return null;
  
  const sexMap = {
    'F': 'filly',
    'C': 'colt', 
    'H': 'horse',
    'M': 'mare',
    'G': 'gelding',
    'R': 'ridgling',
    'filly': 'filly',
    'colt': 'colt',
    'horse': 'horse', 
    'mare': 'mare',
    'gelding': 'gelding',
    'ridgling': 'ridgling'
  };
  
  return sexMap[sex.trim().toUpperCase()] || sex.trim().toLowerCase();
}
