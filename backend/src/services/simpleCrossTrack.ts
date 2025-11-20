/**
 * Simple Cross-Track Matchup Generation
 * For testing with 2-4 tracks
 * 
 * This is a simplified implementation that works with existing infrastructure
 * without requiring multi-contest bundles
 */

import { supabase } from '../utils/supabase';
import { Connection, Matchup } from '../types/backend';
import { generateUnifiedMatchups, buildConnectionHorseMap, DEFAULT_UNIFIED_SETTINGS } from './unifiedMatchupGenerator';

/**
 * Generate cross-track matchups for a specific date
 * Loads data from all contests on that date and creates cross-track matchups
 * Now supports unlimited tracks (no hard limit)
 */
export async function generateCrossTrackMatchupsForDate(
  date: string,
  maxTracks: number = 20 // Increased from 4 to 20 (effectively unlimited for US racing)
): Promise<{
  success: boolean;
  matchups: Matchup[];
  tracks: string[];
  error?: string;
}> {
  try {
    console.log(`[CrossTrack] Generating cross-track matchups for date: ${date} (max tracks: ${maxTracks})`);
    
    // 1. Find all contests on this date (up to maxTracks)
    const { data: contests, error: contestError } = await supabase
      .from('contests')
      .select('id, track, date, track_data_id, status')
      .eq('date', date)
      .eq('is_active', true)
      .limit(maxTracks);
    
    if (contestError || !contests || contests.length < 2) {
      return {
        success: false,
        matchups: [],
        tracks: [],
        error: `Need at least 2 contests on ${date}. Found: ${contests?.length || 0}`
      };
    }
    
    console.log(`[CrossTrack] Found ${contests.length} contests:`, contests.map(c => c.track));
    
    // 2. Load track data for each contest
    const allRecords: any[] = [];
    const tracks: string[] = [];
    
    for (const contest of contests) {
      if (!contest.track_data_id) {
        console.warn(`[CrossTrack] Contest ${contest.id} has no track_data_id, skipping`);
        continue;
      }
      
      const { data: trackData, error: tdError } = await supabase
        .from('track_data')
        .select('data, metadata')
        .eq('id', contest.track_data_id)
        .single();
      
      if (tdError || !trackData) {
        console.warn(`[CrossTrack] Failed to load track data for ${contest.track}:`, tdError);
        continue;
      }
      
      // Extract records
      let records: any[] = [];
      if (trackData.data && trackData.data.entries) {
        records = trackData.data.entries;
      } else if (trackData.data) {
        records = trackData.data;
      }
      
      console.log(`[CrossTrack] Loaded ${records.length} records from ${contest.track}`);
      
      allRecords.push(...records);
      tracks.push(contest.track);
    }
    
    if (allRecords.length === 0) {
      return {
        success: false,
        matchups: [],
        tracks,
        error: 'No track data found for any contest'
      };
    }
    
    console.log(`[CrossTrack] Total records: ${allRecords.length} from ${tracks.length} tracks`);
    
    // 3. Generate connections from all records
    const { connections: allConnections } = await generateConnectionsFromRecords(
      allRecords,
      tracks,
      date
    );
    
    console.log(`[CrossTrack] Generated ${allConnections.length} total connections`);
    
    // Log connections per track
    const connsPerTrack: Record<string, number> = {};
    for (const conn of allConnections) {
      for (const track of conn.trackSet) {
        connsPerTrack[track] = (connsPerTrack[track] || 0) + 1;
      }
    }
    console.log(`[CrossTrack] Connections per track:`, connsPerTrack);
    
    // 4. Generate cross-track matchups
    const horseMap = buildConnectionHorseMap(allConnections);
    const settings = {
      ...DEFAULT_UNIFIED_SETTINGS.cross_track,
      num_matchups: 40, // Generate 40 for pool
    };
    
    const matchups = generateUnifiedMatchups(
      allConnections,
      settings,
      horseMap,
      false, // not mixed
      true   // is cross-track
    );
    
    console.log(`[CrossTrack] Generated ${matchups.length} cross-track matchups`);
    
    // Verify they're actually cross-track
    let validCount = 0;
    for (const matchup of matchups) {
      const tracksA = new Set(matchup.setA.connections.flatMap(c => c.trackSet));
      const tracksB = new Set(matchup.setB.connections.flatMap(c => c.trackSet));
      const hasOverlap = Array.from(tracksA).some(t => tracksB.has(t));
      
      if (!hasOverlap) {
        validCount++;
      }
    }
    
    console.log(`[CrossTrack] Verified ${validCount}/${matchups.length} are truly cross-track`);
    
    return {
      success: true,
      matchups,
      tracks,
    };
    
  } catch (error) {
    console.error('[CrossTrack] Error generating cross-track matchups:', error);
    return {
      success: false,
      matchups: [],
      tracks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate cross-track matchups for explicitly selected contests
 */
type MultiTrackOptions = {
  numMatchups?: number;
  matchupTypes?: string[];
  enforceCrossTrack?: boolean;
};

const ROLE_MAP: Record<string, string | null> = {
  jockey_vs_jockey: 'jockey',
  trainer_vs_trainer: 'trainer',
  sire_vs_sire: 'sire',
  mixed: null,
  cross_track: null,
};

export async function generateCrossTrackMatchupsForContestIds(
  contestIds: string[],
  options: MultiTrackOptions = {}
): Promise<{
  success: boolean;
  matchups: Matchup[];
  tracks: string[];
  bundleId?: string;
  error?: string;
}> {
  if (!contestIds || contestIds.length < 2) {
    return {
      success: false,
      matchups: [],
      tracks: [],
      error: 'Select at least 2 contests to build cross-track matchups.',
    };
  }

  try {
    const { data: contests, error: contestError } = await supabase
      .from('contests')
      .select('id, track, date, track_data_id, status')
      .in('id', contestIds);

    if (contestError || !contests || contests.length < 2) {
      return {
        success: false,
        matchups: [],
        tracks: [],
        error: `Need at least 2 valid contests. Found ${contests?.length || 0}`,
      };
    }

    const contestMap = new Map(contests.map((contest) => [contest.id, contest]));
    const orderedContests = contestIds
      .map((id) => contestMap.get(id))
      .filter((contest): contest is typeof contests[number] => Boolean(contest));

    const allRecords: any[] = [];
    const tracks: string[] = [];

    for (const contest of orderedContests) {
      if (!contest.track_data_id) {
        console.warn(`[CrossTrack] Contest ${contest.id} has no track_data_id, skipping`);
        continue;
      }

      const { data: trackData, error: tdError } = await supabase
        .from('track_data')
        .select('data, metadata')
        .eq('id', contest.track_data_id)
        .single();

      if (tdError || !trackData) {
        console.warn(`[CrossTrack] Failed to load track data for ${contest.track}:`, tdError);
        continue;
      }

      let records: any[] = [];
      if (trackData.data && trackData.data.entries) {
        records = trackData.data.entries;
      } else if (trackData.data) {
        records = trackData.data;
      }

      allRecords.push(...records);
      tracks.push(contest.track);
    }

    if (allRecords.length === 0) {
      return {
        success: false,
        matchups: [],
        tracks,
        error: 'No track data found for selected contests',
      };
    }

    const date = orderedContests[0]?.date || new Date().toISOString().slice(0, 10);
    const { connections: allConnections } = await generateConnectionsFromRecords(allRecords, tracks, date);

    const typeList =
      options.matchupTypes && options.matchupTypes.length > 0
        ? options.matchupTypes
        : ['cross_track'];

    const bundleMatchups: Matchup[] = [];
    
    // PER-TYPE EXCLUSION: Track connections used per matchup type in this bundle
    // Once a connection appears in a matchup type, exclude it from other matchups of the SAME type
    // Connections CAN appear across different matchup types (e.g., jockey_vs_jockey and mixed)
    const usedConnectionsPerType = new Map<string, Set<string>>();

    for (const type of typeList) {
      const role = ROLE_MAP[type] ?? null;
      let filteredConnections = allConnections;

      if (role) {
        filteredConnections = allConnections.filter((conn) => conn.role === role);
      }

      if (filteredConnections.length < 2) {
        console.warn(`[CrossTrack] Not enough connections for ${type}`);
        continue;
      }

      const horseMap = buildConnectionHorseMap(filteredConnections);
      const baseSettings =
        DEFAULT_UNIFIED_SETTINGS[type as keyof typeof DEFAULT_UNIFIED_SETTINGS] ||
        DEFAULT_UNIFIED_SETTINGS.cross_track;

      const settings = {
        ...baseSettings,
        num_matchups: options.numMatchups ?? baseSettings.num_matchups ?? 40,
      };

      // PER-TYPE EXCLUSION: Get connections excluded within this matchup type only
      // Connections used in OTHER matchup types are NOT excluded (can appear in multiple types)
      const excludedForThisType = usedConnectionsPerType.get(type) || new Set<string>();
      
      const typeMatchups = generateUnifiedMatchups(
        filteredConnections,
        settings,
        horseMap,
        type === 'mixed',
        options.enforceCrossTrack !== false,
        excludedForThisType // Pass per-type exclusion set (only excludes within same type)
      );
      
      // PER-TYPE EXCLUSION: Mark all connections used in this matchup type as excluded
      // This prevents the same connection from appearing in multiple matchups of the SAME type
      // But allows it to appear in DIFFERENT matchup types
      const usedInThisType = usedConnectionsPerType.get(type) || new Set<string>();
      
      for (const matchup of typeMatchups) {
        // Add all connections from Set A
        for (const conn of matchup.setA.connections) {
          usedInThisType.add(conn.id);
        }
        // Add all connections from Set B
        for (const conn of matchup.setB.connections) {
          usedInThisType.add(conn.id);
        }
      }
      
      // Update the per-type exclusion set
      usedConnectionsPerType.set(type, usedInThisType);
      
      if (typeMatchups.length > 0) {
        const connectionsUsed = usedInThisType.size;
        console.log(`[CrossTrack] 🔒 Per-Type Exclusion (${type}): ${connectionsUsed} connections excluded within this type (can still appear in other types)`);
      }

      typeMatchups.forEach((matchup) => {
        matchup.matchupType = type;
        bundleMatchups.push(matchup);
      });
    }

    // DEDUPLICATION: Remove duplicate matchups across types based on connection content
    // A matchup is a duplicate if it has the same connections in Set A and Set B (regardless of type)
    const seenMatchups = new Map<string, { matchup: Matchup; type: string }>();
    const deduplicatedMatchups: Matchup[] = [];
    
    for (const matchup of bundleMatchups) {
      // Create a unique signature based on connection IDs (not matchup ID or type)
      const setAIds = matchup.setA.connections.map(c => c.id).sort().join(',');
      const setBIds = matchup.setB.connections.map(c => c.id).sort().join(',');
      // Combine in a consistent order (lexicographically smaller first)
      const signature = setAIds < setBIds ? `${setAIds}|${setBIds}` : `${setBIds}|${setAIds}`;
      
      if (!seenMatchups.has(signature)) {
        // First occurrence - keep it and remember its type
        seenMatchups.set(signature, { matchup, type: matchup.matchupType || 'unknown' });
        deduplicatedMatchups.push(matchup);
      } else {
        // Duplicate found - prefer the more specific type (e.g., sire_vs_sire over mixed)
        const existing = seenMatchups.get(signature)!;
        const typePriority: Record<string, number> = {
          'jockey_vs_jockey': 1,
          'trainer_vs_trainer': 2,
          'sire_vs_sire': 3,
          'mixed': 4,
          'cross_track': 5,
        };
        const existingPriority = typePriority[existing.type] || 999;
        const newPriority = typePriority[matchup.matchupType || 'unknown'] || 999;
        
        // Keep the more specific type (lower priority number)
        if (newPriority < existingPriority) {
          // Replace with more specific type
          const index = deduplicatedMatchups.findIndex(m => m === existing.matchup);
          if (index >= 0) {
            deduplicatedMatchups[index] = matchup;
            seenMatchups.set(signature, { matchup, type: matchup.matchupType || 'unknown' });
          }
        }
        // Otherwise, ignore this duplicate (keep the existing one)
      }
    }
    
    const duplicateCount = bundleMatchups.length - deduplicatedMatchups.length;
    if (duplicateCount > 0) {
      console.log(`[CrossTrack] Removed ${duplicateCount} duplicate matchups across types (kept ${deduplicatedMatchups.length} unique matchups)`);
    }
    
    bundleMatchups.length = 0;
    bundleMatchups.push(...deduplicatedMatchups);

    if (bundleMatchups.length === 0) {
      return {
        success: false,
        matchups: [],
        tracks,
        error: 'No matchups generated for the selected configuration.',
      };
    }

    const bundleId = await persistMultiTrackBundle({
      contestIds,
      trackCodes: tracks,
      matchupTypes: typeList,
      matchups: bundleMatchups,
      numMatchups: options.numMatchups ?? bundleMatchups.length,
    });

    return {
      success: true,
      matchups: bundleMatchups,
      tracks,
      bundleId,
    };
  } catch (error) {
    console.error('[CrossTrack] Error generating multi-track matchups:', error);
    return {
      success: false,
      matchups: [],
      tracks: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function persistMultiTrackBundle(params: {
  contestIds: string[];
  trackCodes: string[];
  matchupTypes: string[];
  matchups: Matchup[];
  numMatchups: number;
}): Promise<string | undefined> {
  try {
    const payload = {
      matchup_count: params.matchups.length,
      num_matchups: params.numMatchups,
      matchups: params.matchups,
    };

    const { data, error } = await supabase
      .from('multi_track_bundles')
      .insert({
        contest_ids: params.contestIds,
        track_codes: params.trackCodes,
        matchup_types: params.matchupTypes, // FIXED: Now as top-level column
        matchup_data: payload,
        status: 'ready',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[CrossTrack] Failed to persist multi-track bundle:', error);
      return undefined;
    }

    return data?.id;
  } catch (error) {
    console.error('[CrossTrack] Exception while persisting multi-track bundle:', error);
    return undefined;
  }
}

/**
 * Generate connections from records (similar to matchupCalculation.ts)
 */
async function generateConnectionsFromRecords(
  records: any[],
  tracks: string[],
  date: string
): Promise<{
  connections: Connection[];
  jockeys: Connection[];
  trainers: Connection[];
  sires: Connection[];
}> {
  // Import performance data loading
  const { loadJockeyPerformanceData, loadTrainerPerformanceData, loadSirePerformanceData } = 
    await import('../utils/performanceData');
  
  const [jockeyPerf, trainerPerf, sirePerf] = await Promise.all([
    loadJockeyPerformanceData(),
    loadTrainerPerformanceData(),
    loadSirePerformanceData(),
  ]);
  
  // Create connection maps for each role
  const jockeyMap = new Map<string, Connection>();
  const trainerMap = new Map<string, Connection>();
  const sireMap = new Map<string, Connection>();
  
  // Process records
  for (const record of records) {
    const isScratched = record.scratched === true;
    const isAlsoEligible = record.is_also_eligible === true || record.isAlsoEligible === true;
    const countForApps = !isScratched;
    
    // Process jockey
    if (record.jockey) {
      processConnection(jockeyMap, record, 'jockey', countForApps, date);
    }
    
    // Process trainer
    if (record.trainer) {
      processConnection(trainerMap, record, 'trainer', countForApps, date);
    }
    
    // Process sire
    if (record.sire1) {
      processConnection(sireMap, record, 'sire', countForApps, date);
    }
  }
  
  // Load AVPA for all connections
  await loadAVPAForConnections(jockeyMap, jockeyPerf, 'jockey');
  await loadAVPAForConnections(trainerMap, trainerPerf, 'trainer');
  await loadAVPAForConnections(sireMap, sirePerf, 'sire');
  
  const jockeys = Array.from(jockeyMap.values());
  const trainers = Array.from(trainerMap.values());
  const sires = Array.from(sireMap.values());
  
  return {
    connections: [...jockeys, ...trainers, ...sires],
    jockeys,
    trainers,
    sires
  };
}

function processConnection(
  map: Map<string, Connection>,
  record: any,
  role: 'jockey' | 'trainer' | 'sire',
  countForApps: boolean,
  date: string
) {
  const name = role === 'jockey' ? record.jockey :
               role === 'trainer' ? record.trainer :
               record.sire1;
  
  if (!name) return;
  
  const id = `${role}:${name}`;
  let conn = map.get(id);
  
  if (!conn) {
    conn = {
      id,
      name,
      role,
      trackSet: [],
      apps: 0,
      avgOdds: 0,
      salarySum: 0,
      pointsSum: 0,
      avpa30d: 0,
      avpa90d: 0,
      pastRaces: [],
      starters: [],
    };
    map.set(id, conn);
  }
  
  if (!conn.trackSet.includes(record.track)) {
    conn.trackSet.push(record.track);
  }
  
  conn.starters.push({
    track: record.track,
    race: record.race,
    horseName: record.horse,
    salary: record.salary || 0,
    points: record.points || 0,
    pos: record.place || 0,
    program_number: record.program_number ?? null,
    mlOddsFrac: record.ml_odds_frac || null,
    decimalOdds: record.ml_odds_decimal || null,
    jockey: record.jockey || null,
    trainer: record.trainer || null,
    sire1: record.sire1 || null,
    sire2: record.sire2 || null,
    scratched: record.scratched || false,
    isAlsoEligible: record.is_also_eligible || record.isAlsoEligible || false,
    date,
  });
  
  if (countForApps) {
    conn.apps++;
    conn.salarySum += record.salary || 0;
    
    const odds = record.ml_odds_decimal || 0;
    if (odds > 0) {
      const currentTotal = conn.avgOdds * (conn.apps - 1);
      conn.avgOdds = (currentTotal + odds) / conn.apps;
    }
  }
  
  const actuallyRaced = !record.scratched && !record.is_also_eligible && record.place !== null;
  if (actuallyRaced) {
    conn.pointsSum += record.points || 0;
  }
}

async function loadAVPAForConnections(
  map: Map<string, Connection>,
  perfData: Map<string, any>,
  role: 'jockey' | 'trainer' | 'sire'
) {
  for (const [name, conn] of map.entries()) {
    // Try to find performance data
    // This is simplified - in real implementation, would need proper key matching
    const perf = perfData.get(name);
    if (perf) {
      conn.avpa30d = perf.avpa30 || 0;
      conn.avpa90d = perf.avpa90 || 0;
    }
  }
}

