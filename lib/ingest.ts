import { Connection, Starter, ConnectionRole, TrackData } from "@/types";
import { getTrackEntries, getTrackResults } from "./api/backend";

export const FALLBACK_TRACKS = ["BAQ", "GP", "KEE", "SA", "CD", "DMR", "LRL", "MNR", "IND"];
const TRACK_SPLIT_REGEX = /[,\|\+]/;

const sanitizeTrackCode = (track: string) => track.trim().toUpperCase();

function parseTrackList(specifier: string): string[] {
  const trimmed = specifier.trim();
  if (!trimmed) return [];

  // JSON array string
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? sanitizeTrackCode(item) : ""))
          .filter(Boolean);
      }
    } catch (error) {
      console.warn("Unable to parse track list JSON:", error);
    }
  }

  // Delimiter separated lists
  if (TRACK_SPLIT_REGEX.test(trimmed)) {
    return trimmed
      .split(TRACK_SPLIT_REGEX)
      .map(sanitizeTrackCode)
      .filter(Boolean);
  }

  if (trimmed.includes(" ")) {
    return trimmed
      .split(" ")
      .map(sanitizeTrackCode)
      .filter(Boolean);
  }

  return [sanitizeTrackCode(trimmed)];
}

function normalizeTrackSelection(selected: string | string[] | null | undefined): string[] {
  if (Array.isArray(selected)) {
    return Array.from(new Set(selected.map(sanitizeTrackCode).filter(Boolean)));
  }

  if (!selected) return [];

  const trimmed = selected.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return [];

  if (["ALL", "ALL_TRACKS", "MULTI"].includes(trimmed.toUpperCase())) {
    return [...FALLBACK_TRACKS];
  }

  return Array.from(new Set(parseTrackList(trimmed)));
}

/**
 * Load track data from backend API
 */
export async function loadTrackData(track: string, date?: string): Promise<TrackData> {
  // Use provided date or default to 2025-11-02 (date we know has data)
  // TODO: Make this configurable or use a date picker
  const raceDate = date || '2025-11-02';
  
  try {
    // Fetch entries and results in parallel
    const [entries, results] = await Promise.all([
      getTrackEntries(track, raceDate),
      getTrackResults(track, raceDate).catch(() => []), // Results might not exist yet
    ]);
    
    // Create a map of results by track-race-horse for quick lookup
    const resultsMap = new Map<string, { points: number; place: number | null }>();
    for (const result of results) {
      if (result.starters && Array.isArray(result.starters)) {
        for (const starter of result.starters) {
          // Handle nested structure: starter.starter or just starter
          const st = starter.starter || starter;
          const horse = st.horse || {};
          const horseName = (horse.name || '').trim();
          if (horseName) {
            const key = `${track}-${result.race}-${horseName}`;
            const finishPos = st.finishPosition || st.finish || st.place || null;
            const points = st.points || 0;
            resultsMap.set(key, { points, place: finishPos });
          }
        }
      }
    }
    
    // Merge entries with results data
    const records = entries.map((entry: any) => {
      const key = `${entry.track}-${entry.race}-${entry.horse}`;
      const resultData = resultsMap.get(key);
      
      return {
        track: entry.track,
        race: entry.race,
        horse: entry.horse,
        jockey: entry.jockey || null,
        trainer: entry.trainer || null,
        sire1: entry.sire1 || null,
        sire2: entry.sire2 || null,
        ml_odds_frac: entry.ml_odds_frac || null,
        ml_odds_decimal: entry.ml_odds_decimal || null,
        is_also_eligible: entry.is_also_eligible || false,
        scratched: entry.scratched || false,
        salary: entry.salary || 0,
        points: resultData?.points || entry.points || 0,
        place: resultData?.place || entry.place || null,
        // Parse program_number - handle string, number, or null/undefined
        program_number: (() => {
          if (entry.program_number === null || entry.program_number === undefined) return null;
          const parsed = parseInt(String(entry.program_number), 10);
          return !isNaN(parsed) && parsed > 0 ? parsed : null;
        })(),
        // post_position removed - we only use program_number
        post_time: entry.post_time || null,
      };
    });
    
    // Return in the same format as the old JSON files
    return {
      track,
      records,
      jockeys: [], // We'll calculate these if needed
      trainers: [],
      sires: [],
    };
  } catch (error) {
    console.error(`Error loading ${track} data:`, error);
    throw error;
  }
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
        // Parse program_number - handle string, number, or null/undefined
        let programNumber: number | null = null;
        if (record.program_number !== null && record.program_number !== undefined) {
          const parsed = parseInt(String(record.program_number), 10);
          programNumber = !isNaN(parsed) && parsed > 0 ? parsed : null;
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
          scratched: record.scratched || false,
          program_number: programNumber,
          // post_position removed - we only use program_number
          postTime: record.post_time || null,
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
        
        // Parse program_number - handle string, number, or null/undefined
        let programNumber: number | null = null;
        if (record.program_number !== null && record.program_number !== undefined) {
          const parsed = parseInt(String(record.program_number), 10);
          programNumber = !isNaN(parsed) && parsed > 0 ? parsed : null;
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
          program_number: programNumber,
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
        
        // Parse program_number - handle string, number, or null/undefined
        let programNumber: number | null = null;
        if (record.program_number !== null && record.program_number !== undefined) {
          const parsed = parseInt(String(record.program_number), 10);
          programNumber = !isNaN(parsed) && parsed > 0 ? parsed : null;
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
          program_number: programNumber,
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
        
        // Parse program_number - handle string, number, or null/undefined
        let programNumber: number | null = null;
        if (record.program_number !== null && record.program_number !== undefined) {
          const parsed = parseInt(String(record.program_number), 10);
          programNumber = !isNaN(parsed) && parsed > 0 ? parsed : null;
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
          program_number: programNumber,
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
  const filtered = connections.filter(c => c.apps > 0);
  console.log(`🔗 Total connections: ${filtered.length}`);
  return filtered;
}

// Enhanced merge that includes avpa30d from aggregated data
export async function loadAndMergeAllTracks(
  date?: string,
  selectedTrack?: string | string[] | null
): Promise<Connection[]> {
  let trackSpecifier: string | string[] | null | undefined = selectedTrack;

  if (typeof window !== "undefined") {
    const storedList =
      window.sessionStorage.getItem("selectedTracks") ||
      window.sessionStorage.getItem("selectedTrackList");

    if (storedList) {
      const shouldUseStored =
        !trackSpecifier ||
        (typeof trackSpecifier === "string" &&
          ["ALL", "ALL_TRACKS", "MULTI"].includes(trackSpecifier.toUpperCase()));
      if (shouldUseStored) {
        trackSpecifier = storedList;
      }
    }
  }

  const tracks = normalizeTrackSelection(trackSpecifier);

  if (tracks.length === 0) {
    console.log(
      "⚠️ No track selection provided. Provide a track or set sessionStorage.selectedTracks to load multiple tracks."
    );
    return [];
  }

  const uniqueTracks = Array.from(new Set(tracks));
  const allTrackData: TrackData[] = [];

  await Promise.all(
    uniqueTracks.map(async (track) => {
      try {
        console.log(`📊 Loading ${track} data for ${date || "default date"}...`);
        const data = await loadTrackData(track, date);
        console.log(`✅ Loaded ${track}: ${data.records.length} records`);
        allTrackData.push(data);
      } catch (error) {
        console.error(`❌ Error loading ${track} data:`, error);
        if (selectedTrack && !Array.isArray(selectedTrack)) {
          throw error;
        }
      }
    })
  );

  if (allTrackData.length === 0) {
    throw new Error(`No track data loaded. Tried tracks: ${uniqueTracks.join(", ")}`);
  }

  console.log(`📈 Total tracks loaded: ${allTrackData.length}/${uniqueTracks.length}`);

  const connections = mergeTrackData(allTrackData);

  return connections;
}

