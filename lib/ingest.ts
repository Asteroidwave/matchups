import { Connection, Starter, ConnectionRole, TrackData } from "@/types";

export async function loadTrackData(track: string): Promise<TrackData> {
  const response = await fetch(`/v0_${track}_ext.json`);
  if (!response.ok) {
    throw new Error(`Failed to load ${track} data`);
  }
  return response.json();
}

export function createConnectionId(name: string, role: ConnectionRole): string {
  return `${name.toLowerCase().replace(/\s+/g, "-")}-${role}`;
}

export function mergeTrackData(allTracks: TrackData[]): Connection[] {
  const connectionMap = new Map<string, Connection>();
  
  for (const trackData of allTracks) {
    for (const record of trackData.records) {
      // Skip scratched horses
      if (record.scratched) continue;
      
      // Process jockey
      if (record.jockey) {
        const id = createConnectionId(record.jockey, "jockey");
        let conn = connectionMap.get(id);
        
        if (!conn) {
          conn = {
            id,
            name: record.jockey,
            role: "jockey",
            trackSet: [],
            apps: 0,
            avgOdds: 0,
            salarySum: 0,
            pointsSum: 0,
            avpa30d: 0,
            avpaRace: 0,
            starters: [],
          };
          connectionMap.set(id, conn);
        }
        
        // Add track if not present
        if (!conn.trackSet.includes(trackData.track)) {
          conn.trackSet.push(trackData.track);
        }
        
        // Add starter
        const starter: Starter = {
          track: trackData.track,
          race: record.race,
          horseName: record.horse,
          jockey: record.jockey,
          trainer: record.trainer,
          sire1: record.sire1,
          sire2: record.sire2,
          mlOddsFrac: record.ml_odds_frac,
          decimalOdds: record.ml_odds_decimal,
          salary: record.salary || 0,
          points: record.points || 0,
          pos: record.place || 0,
          scratched: false,
        };
        
        conn.starters.push(starter);
        conn.apps++;
        conn.salarySum += starter.salary || 0;
        
        // Only count points for top 3 finishes
        if (starter.pos && starter.pos >= 1 && starter.pos <= 3) {
          conn.pointsSum += starter.points || 0;
        }
        
        // Update average odds
        if (starter.decimalOdds && starter.decimalOdds > 0) {
          const currentTotal = conn.avgOdds * (conn.apps - 1);
          conn.avgOdds = (currentTotal + starter.decimalOdds) / conn.apps;
        }
      }
      
      // Process trainer
      if (record.trainer) {
        const id = createConnectionId(record.trainer, "trainer");
        let conn = connectionMap.get(id);
        
        if (!conn) {
          conn = {
            id,
            name: record.trainer,
            role: "trainer",
            trackSet: [],
            apps: 0,
            avgOdds: 0,
            salarySum: 0,
            pointsSum: 0,
            avpa30d: 0,
            avpaRace: 0,
            starters: [],
          };
          connectionMap.set(id, conn);
        }
        
        if (!conn.trackSet.includes(trackData.track)) {
          conn.trackSet.push(trackData.track);
        }
        
        const starter: Starter = {
          track: trackData.track,
          race: record.race,
          horseName: record.horse,
          jockey: record.jockey,
          trainer: record.trainer,
          sire1: record.sire1,
          sire2: record.sire2,
          mlOddsFrac: record.ml_odds_frac,
          decimalOdds: record.ml_odds_decimal,
          salary: record.salary || 0,
          points: record.points || 0,
          pos: record.place || 0,
          scratched: false,
        };
        
        conn.starters.push(starter);
        conn.apps++;
        conn.salarySum += starter.salary || 0;
        
        if (starter.pos && starter.pos >= 1 && starter.pos <= 3) {
          conn.pointsSum += starter.points || 0;
        }
        
        if (starter.decimalOdds && starter.decimalOdds > 0) {
          const currentTotal = conn.avgOdds * (conn.apps - 1);
          conn.avgOdds = (currentTotal + starter.decimalOdds) / conn.apps;
        }
      }
      
      // Process sire1
      if (record.sire1) {
        const id = createConnectionId(record.sire1, "sire");
        let conn = connectionMap.get(id);
        
        if (!conn) {
          conn = {
            id,
            name: record.sire1,
            role: "sire",
            trackSet: [],
            apps: 0,
            avgOdds: 0,
            salarySum: 0,
            pointsSum: 0,
            avpa30d: 0,
            avpaRace: 0,
            starters: [],
          };
          connectionMap.set(id, conn);
        }
        
        if (!conn.trackSet.includes(trackData.track)) {
          conn.trackSet.push(trackData.track);
        }
        
        const starter: Starter = {
          track: trackData.track,
          race: record.race,
          horseName: record.horse,
          jockey: record.jockey,
          trainer: record.trainer,
          sire1: record.sire1,
          sire2: record.sire2,
          mlOddsFrac: record.ml_odds_frac,
          decimalOdds: record.ml_odds_decimal,
          salary: record.salary || 0,
          points: record.points || 0,
          pos: record.place || 0,
          scratched: false,
        };
        
        conn.starters.push(starter);
        conn.apps++;
        conn.salarySum += starter.salary || 0;
        
        if (starter.pos && starter.pos >= 1 && starter.pos <= 3) {
          conn.pointsSum += starter.points || 0;
        }
        
        if (starter.decimalOdds && starter.decimalOdds > 0) {
          const currentTotal = conn.avgOdds * (conn.apps - 1);
          conn.avgOdds = (currentTotal + starter.decimalOdds) / conn.apps;
        }
      }
      
      // Process sire2
      if (record.sire2) {
        const id = createConnectionId(record.sire2, "sire");
        let conn = connectionMap.get(id);
        
        if (!conn) {
          conn = {
            id,
            name: record.sire2,
            role: "sire",
            trackSet: [],
            apps: 0,
            avgOdds: 0,
            salarySum: 0,
            pointsSum: 0,
            avpa30d: 0,
            avpaRace: 0,
            starters: [],
          };
          connectionMap.set(id, conn);
        }
        
        if (!conn.trackSet.includes(trackData.track)) {
          conn.trackSet.push(trackData.track);
        }
        
        const starter: Starter = {
          track: trackData.track,
          race: record.race,
          horseName: record.horse,
          jockey: record.jockey,
          trainer: record.trainer,
          sire1: record.sire1,
          sire2: record.sire2,
          mlOddsFrac: record.ml_odds_frac,
          decimalOdds: record.ml_odds_decimal,
          salary: record.salary || 0,
          points: record.points || 0,
          pos: record.place || 0,
          scratched: false,
        };
        
        conn.starters.push(starter);
        conn.apps++;
        conn.salarySum += starter.salary || 0;
        
        if (starter.pos && starter.pos >= 1 && starter.pos <= 3) {
          conn.pointsSum += starter.points || 0;
        }
        
        if (starter.decimalOdds && starter.decimalOdds > 0) {
          const currentTotal = conn.avgOdds * (conn.apps - 1);
          conn.avgOdds = (currentTotal + starter.decimalOdds) / conn.apps;
        }
      }
    }
  }
  
  // Now load aggregated data for avpa30d
  // We'll need to enhance this with the aggregated data from JSON
  // For now, compute avpaRace and leave avpa30d as 0 (will be enhanced)
  
  const connections = Array.from(connectionMap.values());
  
  // Compute AVPA Race for each connection
  for (const conn of connections) {
    if (conn.salarySum > 0) {
      conn.avpaRace = (1000 * conn.pointsSum) / conn.salarySum;
    }
  }
  
  // Filter out connections with 0 apps (shouldn't happen, but safety check)
  return connections.filter(c => c.apps > 0);
}

// Enhanced merge that includes avpa30d from aggregated data
export async function loadAndMergeAllTracks(): Promise<Connection[]> {
  const tracks = ["BAQ", "GP", "KEE", "SA"];
  const allTrackData: TrackData[] = [];
  
  // Load aggregated data for avpa30d lookup
  const aggregatedData = new Map<string, { avpa30d: number }>();
  
  for (const track of tracks) {
    try {
      const data = await loadTrackData(track);
      allTrackData.push(data);
      
      // Extract aggregated connection data for avpa30d
      const roles = ["jockeys", "trainers", "sires"] as const;
      for (const role of roles) {
        if (data[role as keyof typeof data] && Array.isArray(data[role as keyof typeof data])) {
          const arr = data[role as keyof typeof data] as Array<{ name: string; avpa_30_days?: number }>;
          for (const item of arr) {
            const lookupKey = `${item.name.toLowerCase()}-${role.slice(0, -1)}`; // jockeys -> jockey
            if (item.avpa_30_days !== undefined && item.avpa_30_days !== null) {
              aggregatedData.set(lookupKey, { avpa30d: item.avpa_30_days });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error loading ${track}:`, error);
    }
  }
  
  // Merge all track data
  let connections = mergeTrackData(allTrackData);
  
  // Enhance with avpa30d
  for (const conn of connections) {
    const lookupKey = `${conn.name.toLowerCase()}-${conn.role}`;
    const agg = aggregatedData.get(lookupKey);
    if (agg) {
      conn.avpa30d = agg.avpa30d;
    }
  }
  
  return connections;
}

