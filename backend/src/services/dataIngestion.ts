/**
 * Data Ingestion Service
 * Transforms MongoDB data into relational structure
 */
import { MongoClient, Db } from 'mongodb';
import { supabase } from '../utils/supabase';
import { getCommonDb, getStagingDb } from '../utils/mongodb';

export interface TrackDataIngestionResult {
  raceCardId: string;
  racesCreated: number;
  horsesProcessed: number;
  connectionsProcessed: number;
  entriesCreated: number;
  resultsCreated: number;
}

export class RelationalDataIngestionService {
  private commonDb: Db | null = null;
  private stagingDb: Db | null = null;

  constructor() {}

  /**
   * Main entry point: Ingest complete track data for a date
   */
  async ingestTrackData(trackCode: string, date: string): Promise<TrackDataIngestionResult> {
    console.log(`🏇 Starting ingestion: ${trackCode} on ${date}`);
    
    const ingestionLog = await this.createIngestionLog(trackCode, date);
    
    try {
      console.log(`Step 1: Fetching raw data...`);
      // 1. Get raw data from MongoDB
      const rawData = await this.fetchRawTrackData(trackCode, date);
      console.log(`   Found ${rawData.entries.length} entries, ${rawData.results.length} results`);
      
      console.log(`Step 2: Ensuring track exists...`);
      // 2. Create/get track record
      const track = await this.ensureTrackExists(trackCode);
      console.log(`   Track: ${track.name} (${track.id})`);
      
      console.log(`Step 3: Creating race card...`);
      // 3. Create race card
      const raceCard = await this.createRaceCard(track.id, date, rawData);
      console.log(`   Race card: ${raceCard.id}`);
      
      console.log(`Step 4: Creating races...`);
      // 4. Create races
      const races = await this.createRaces(raceCard.id, rawData);
      console.log(`   Created ${races.length} races`);
      
      console.log(`Step 5: Processing horses and connections...`);
      // 5. Process horses and connections (from races, not rawData.entries)
      const { horses, connections } = await this.processHorsesAndConnections(races);
      console.log(`   Processed ${Object.keys(horses).length} horses, ${Object.keys(connections).length} connections`);
      
      console.log(`Step 6: Creating race entries...`);
      // 6. Create race entries  
      const raceEntries = await this.createRaceEntries(races, horses, connections);
      console.log(`   Created ${raceEntries.length} race entries`);
      
      console.log(`Step 7: Creating race results...`);
      // 7. Create race results (if available)
      let resultsCreated = 0;
      if (rawData.results && rawData.results.length > 0) {
        resultsCreated = await this.createRaceResults(raceEntries, rawData.results);
      }
      console.log(`   Created ${resultsCreated} race results`);
      
      const result: TrackDataIngestionResult = {
        raceCardId: raceCard.id,
        racesCreated: races.length,
        horsesProcessed: Object.keys(horses).length,
        connectionsProcessed: Object.keys(connections).length,
        entriesCreated: raceEntries.length,
        resultsCreated
      };
      
      await this.updateIngestionLog(ingestionLog.id, 'completed', result);
      console.log(`✅ Ingestion complete:`, result);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Ingestion failed at unknown step:`, error);
      console.error(`Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      });
      await this.updateIngestionLog(ingestionLog.id, 'failed', { 
        error: error.message,
        errorName: error.name,
        errorStack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Fetch raw data from MongoDB collections
   */
  private async fetchRawTrackData(trackCode: string, date: string) {
    if (!this.commonDb) {
      this.commonDb = await getCommonDb();
    }

    console.log(`  📊 Fetching raw data for ${trackCode} ${date}`);

    // Get entries from equibase_entries - handle your actual field structure
    const entriesCollection = this.commonDb.collection('equibase_entries');
    
    // Your data uses raceDate as ISO date and track info in raceNameForDB
    const dateObj = new Date(date);
    const entries = await entriesCollection.find({
      raceDate: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      },
      raceNameForDB: { $regex: `^${trackCode.toUpperCase()}-` }
    }).toArray();

    // Get results from equibase_results - handle your actual field structure
    const resultsCollection = this.commonDb.collection('equibase_results');
    const results = await resultsCollection.find({
      raceDate: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      },
      // Try to match results by track pattern
      $or: [
        { track: trackCode.toUpperCase() },
        { raceNameForDB: { $regex: `^${trackCode.toUpperCase()}-` } }
      ]
    }).toArray();

    console.log(`  Found ${entries.length} entries, ${results.length} results`);

    return { entries, results };
  }

  /**
   * Ensure track exists in tracks table
   */
  private async ensureTrackExists(trackCode: string) {
    const trackName = this.getTrackName(trackCode);
    
    const { data: existingTrack } = await supabase
      .from('tracks')
      .select('id')
      .eq('code', trackCode.toUpperCase())
      .single();

    if (existingTrack) {
      return existingTrack;
    }

    const { data: newTrack, error } = await supabase
      .from('tracks')
      .insert({
        code: trackCode.toUpperCase(),
        name: trackName,
        timezone: this.getTrackTimezone(trackCode),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    return newTrack;
  }

  /**
   * Create race card for the date
   */
  private async createRaceCard(trackId: string, date: string, rawData: any) {
    // Extract post times from entries
    const postTimes = this.extractPostTimes(rawData.entries);
    
    const { data: raceCard, error } = await supabase
      .from('race_cards')
      .insert({
        track_id: trackId,
        race_date: date,
        status: rawData.results?.length > 0 ? 'completed' : 'scheduled',
        post_times: postTimes,
        first_post_time: postTimes[0] || null,
        last_post_time: postTimes[postTimes.length - 1] || null
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`  🏁 Created race card: ${raceCard.id}`);
    return raceCard;
  }

  /**
   * Create individual race records - each MongoDB doc is one race
   */
  private async createRaces(raceCardId: string, rawData: any) {
    console.log(`  🏆 Creating races from ${rawData.entries.length} MongoDB race documents...`);
    
    const races = [];
    
    // Each entry in rawData.entries is actually a complete race document
    for (const raceDoc of rawData.entries) {
      console.log(`    Processing race ${raceDoc.raceNumber}: ${raceDoc.raceNameForDB}`);
      
      const { data: race, error } = await supabase
        .from('races')
        .insert({
          race_card_id: raceCardId,
          race_number: raceDoc.raceNumber,
          post_time: raceDoc.postTime,
          distance: raceDoc.distanceText,
          surface: raceDoc.surface,
          race_type: raceDoc.raceType,
          purse: raceDoc.purse,
          status: 'scheduled'
        })
        .select()
        .single();

      if (error) {
        console.error(`    ❌ Error creating race ${raceDoc.raceNumber}:`, error.message);
        throw error;
      }

      console.log(`    ✅ Created race ${raceDoc.raceNumber}: ${race.id}`);
      races.push({ ...race, starters: raceDoc.starters });
    }

    console.log(`  🏆 Created ${races.length} races total`);
    return races;
  }

  /**
   * Process horses and connections from entries - handle nested structure
   */
  private async processHorsesAndConnections(entries: any[]) {
    const horsesMap = new Map();
    const connectionsMap = new Map();

    console.log(`  🐎 Processing horses and connections from ${entries.length} race entries...`);

    // Extract unique horses and connections from races (which contain starters)
    for (const race of entries) {
      if (!race.starters || !Array.isArray(race.starters)) {
        console.warn(`No starters found for race ${race.race_number}`);
        continue;
      }

      for (const starter of race.starters) {
        // Process horse
        if (starter.horse && starter.horse.name) {
          const horseName = starter.horse.name.toLowerCase();
          if (!horsesMap.has(horseName)) {
            horsesMap.set(horseName, {
              name: starter.horse.name,
              foaling_year: starter.horse.foalingDate ? new Date(starter.horse.foalingDate).getFullYear() : null,
              sex: starter.horse.sex?.trim(),
              color: starter.horse.color?.trim(),
              sire_name: starter.sire?.name || null,
              dam_name: starter.dam?.name || null
            });
          }
        }

        // Process jockey
        if (starter.jockey) {
          const jockeyName = `${starter.jockey.firstName || ''} ${starter.jockey.lastName || ''}`.trim();
          if (jockeyName) {
            const key = `jockey:${jockeyName.toLowerCase()}`;
            if (!connectionsMap.has(key)) {
              connectionsMap.set(key, {
                name: jockeyName,
                role: 'jockey'
              });
            }
          }
        }

        // Process trainer  
        if (starter.trainer) {
          const trainerName = `${starter.trainer.firstName || ''} ${starter.trainer.lastName || ''}`.trim();
          if (trainerName) {
            const key = `trainer:${trainerName.toLowerCase()}`;
            if (!connectionsMap.has(key)) {
              connectionsMap.set(key, {
                name: trainerName,
                role: 'trainer'
              });
            }
          }
        }

        // Process sire
        if (starter.sire?.name) {
          const key = `sire:${starter.sire.name.toLowerCase()}`;
          if (!connectionsMap.has(key)) {
            connectionsMap.set(key, {
              name: starter.sire.name,
              role: 'sire'
            });
          }
        }
      }
    }

    // Insert horses
    const horses = {};
    if (horsesMap.size > 0) {
      const horseInserts = Array.from(horsesMap.values());
      const { data: insertedHorses, error: horsesError } = await supabase
        .from('horses')
        .upsert(horseInserts, { 
          onConflict: 'name,foaling_year',
          ignoreDuplicates: true
        })
        .select();

      if (horsesError) throw horsesError;
      
      // Create lookup map
      for (const horse of insertedHorses || []) {
        horses[horse.name.toLowerCase()] = horse;
      }
    }

    // Insert connections
    const connections = {};
    if (connectionsMap.size > 0) {
      const connectionInserts = Array.from(connectionsMap.values());
      const { data: insertedConnections, error: connectionsError } = await supabase
        .from('connections')
        .upsert(connectionInserts, {
          onConflict: 'name,role',
          ignoreDuplicates: true  
        })
        .select();

      if (connectionsError) throw connectionsError;

      // Create lookup map  
      for (const conn of insertedConnections || []) {
        const key = `${conn.role}:${conn.name.toLowerCase()}`;
        connections[key] = conn;
      }
    }

    console.log(`    ${Object.keys(horses).length} horses, ${Object.keys(connections).length} connections`);
    return { horses, connections };
  }

  /**
   * Create race entries linking horses, connections, and races - handle nested structure
   */
  private async createRaceEntries(races: any[], horses: any, connections: any) {
    const raceEntries = [];
    
    console.log(`  📝 Creating race entries from ${races.length} races...`);

    for (const race of races) {
      if (!race.starters || !Array.isArray(race.starters)) {
        console.warn(`    ⚠️ No starters for race ${race.race_number}`);
        continue;
      }

      for (const starter of race.starters) {
        // Get horse
        const horseName = starter.horse?.name?.toLowerCase();
        const horse = horses[horseName];
        if (!horse) {
          console.warn(`    ⚠️ Horse not found: ${starter.horse?.name}`);
          continue;
        }

        // Get connections
        const jockeyName = `${starter.jockey?.firstName || ''} ${starter.jockey?.lastName || ''}`.trim();
        const trainerName = `${starter.trainer?.firstName || ''} ${starter.trainer?.lastName || ''}`.trim();
        
        const jockey = connections[`jockey:${jockeyName.toLowerCase()}`];
        const trainer = connections[`trainer:${trainerName.toLowerCase()}`];

        // Determine if scratched
        const isScratched = starter.scratchIndicator?.trim() !== '' && starter.scratchIndicator?.trim() !== ' ';

        const raceEntry = {
          race_id: race.id,
          horse_id: horse.id,
          program_number: parseInt(starter.program_number) || starter.postPosition,
          post_position: starter.postPosition,
          jockey_id: jockey?.id || null,
          trainer_id: trainer?.id || null,
          morning_line_odds: starter.morningLineOdds || null,
          ml_decimal_odds: this.convertOddsToDecimal(starter.morningLineOdds),
          status: isScratched ? 'scratched' : 'entered',
          is_also_eligible: false // Will need to determine this from data
        };

        const { data: insertedEntry, error } = await supabase
          .from('race_entries')
          .insert(raceEntry)
          .select()
          .single();

        if (error) {
          console.error(`    ❌ Error creating race entry for ${starter.horse?.name}:`, error.message);
          continue;
        }

        raceEntries.push(insertedEntry);
      }
    }

    console.log(`    Created ${raceEntries.length} race entries`);
    return raceEntries;
  }

  /**
   * Create race results from MongoDB results data
   */
  private async createRaceResults(raceEntries: any[], rawResults: any[]) {
    console.log(`  🏆 Creating race results...`);
    
    let resultsCreated = 0;
    
    for (const result of rawResults) {
      // Find matching race entry
      const raceEntry = raceEntries.find(entry => 
        entry.horse_id && 
        // Match by horse name and race - need to implement proper matching
        true // TODO: Implement proper matching logic
      );

      if (!raceEntry) continue;

      const { error } = await supabase
        .from('race_results')
        .insert({
          race_entry_id: raceEntry.id,
          finish_position: result.finish_position || result.place,
          points_earned: result.points,
          final_odds: result.final_odds
        });

      if (!error) {
        resultsCreated++;
      }
    }

    console.log(`    Created ${resultsCreated} race results`);
    return resultsCreated;
  }

  // Helper methods
  private async createIngestionLog(trackCode: string, date: string) {
    const { data, error } = await supabase
      .from('data_ingestion_logs')
      .insert({
        source: 'mongodb',
        data_type: 'track_data',
        track_code: trackCode,
        race_date: date,
        status: 'processing'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async updateIngestionLog(logId: string, status: string, resultData?: any) {
    await supabase
      .from('data_ingestion_logs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        result_data: resultData
      })
      .eq('id', logId);
  }

  private getTrackName(code: string): string {
    const trackNames = {
      'GP': 'Gulfstream Park',
      'SA': 'Santa Anita Park', 
      'KEE': 'Keeneland',
      'BAQ': 'Belmont At The Big A',
      'CD': 'Churchill Downs',
      'DMR': 'Del Mar',
      'LRL': 'Laurel Park'
    };
    return trackNames[code.toUpperCase()] || code;
  }

  private getTrackTimezone(code: string): string {
    const timezones = {
      'GP': 'America/New_York',
      'SA': 'America/Los_Angeles',
      'KEE': 'America/New_York', 
      'BAQ': 'America/New_York',
      'CD': 'America/New_York',
      'DMR': 'America/Los_Angeles',
      'LRL': 'America/New_York'
    };
    return timezones[code.toUpperCase()] || 'America/New_York';
  }

  private extractPostTimes(entries: any[]): string[] {
    const times = new Set<string>();
    entries.forEach(entry => {
      if (entry.post_time) {
        times.add(entry.post_time);
      }
    });
    return Array.from(times).sort();
  }

  private convertOddsToDecimal(fractionalOdds: string): number | null {
    if (!fractionalOdds) return null;
    
    // Handle formats like "5/2", "3-1", "even"
    if (fractionalOdds.toLowerCase() === 'even') return 2.0;
    
    const match = fractionalOdds.match(/(\d+)[-\/](\d+)/);
    if (match) {
      const numerator = parseInt(match[1]);
      const denominator = parseInt(match[2]);
      return (numerator / denominator) + 1;
    }
    
    return null;
  }

  private normalizeSurface(surface: string): string | null {
    if (!surface) return null;
    
    const normalized = surface.toString().toLowerCase().trim();
    
    // Map common surface values
    const surfaceMap = {
      'd': 'dirt',
      'dirt': 'dirt',
      't': 'turf',
      'turf': 'turf',
      'synthetic': 'synthetic',
      'poly': 'synthetic',
      'tapeta': 'synthetic',
      'fast': 'dirt',
      'good': 'turf',
      'firm': 'turf'
    };
    
    return surfaceMap[normalized] || normalized;
  }
}
