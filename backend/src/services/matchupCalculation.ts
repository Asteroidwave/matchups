/**
 * Async Matchup Calculation Service
 * Part of Phase 3: New Contest Flow
 * 
 * Calculates matchups for contests based on matchup types
 * and stores them in Supabase
 */

import { supabase, isSupabaseInitialized } from '../utils/supabase';
import { getCache } from '../utils/redis';
import { Connection, Matchup, Starter } from '../types/backend';
import { generateUnifiedMatchups, buildConnectionHorseMap, DEFAULT_UNIFIED_SETTINGS, UnifiedMatchupSettings } from './unifiedMatchupGenerator';
import { loadJockeyPerformanceData, loadTrainerPerformanceData, loadSirePerformanceData } from '../utils/performanceData';
import { formatMatchupStats, MatchupStats } from '../utils/matchupStats';

/**
 * Generate connections from track data records
 * Similar to frontend mergeTrackData but for backend
 */
/**
 * Generate connections from track data records
 * Uses Talha's salary calculation method (lowest odds per race for jockeys)
 * Fetches AVPA from MongoDB performance collections
 */
async function generateConnections(
  records: any[], 
  matchupType: string,
  trackCode: string,
  date: string
): Promise<Connection[]> {
  const connectionMap = new Map<string, Connection>();
  const normalizedType = matchupType.toLowerCase();
  const role =
    normalizedType === 'jockey_vs_jockey' || normalizedType === 'jockey'
      ? 'jockey'
      : normalizedType === 'trainer_vs_trainer' || normalizedType === 'trainer'
      ? 'trainer'
      : normalizedType === 'sire_vs_sire' || normalizedType === 'sire'
      ? 'sire'
      : 'jockey';

  // Load performance data for AVPA
  const [jockeyPerf, trainerPerf, sirePerf] = await Promise.all([
    loadJockeyPerformanceData(),
    loadTrainerPerformanceData(),
    loadSirePerformanceData(),
  ]);

  // For Talha's salary method: track odds per race (jockeys use lowest odds per race)
  const jockeyRaceOdds = new Map<string, Map<number, Array<{ odds: number; isAE: boolean }>>>();
  const trainerOdds = new Map<string, Array<{ odds: number; isAE: boolean }>>();
  const sireOdds = new Map<string, Array<{ odds: number; isAE: boolean }>>();

  // Track keys for matching with performance data
  const jockeyKeys = new Map<string, string>(); // name -> key
  const trainerKeys = new Map<string, string>();
  const sireKeys = new Map<string, string>();

  // First pass: collect all data
  for (const record of records) {
    const isScratched = record.scratched === true;
    const isAlsoEligible = record.is_also_eligible === true || record.isAlsoEligible === true;
    const countForApps = !isScratched; // AE horses count for apps
    const actuallyRaced = !isScratched && !isAlsoEligible && record.place !== null && record.place !== undefined;

    let name: string | null = null;
    let key: string | null = null;
    
    if (role === 'jockey') {
      name = record.jockey;
      key = record.jockey_key || record.jockey?.key || null;
    } else if (role === 'trainer') {
      name = record.trainer;
      key = record.trainer_key || record.trainer?.key || null;
    } else if (role === 'sire') {
      name = record.sire1;
      key = record.sire1_key || record.sire1?.referenceNumber || record.sire1?.key || null;
    }

    if (!name) continue;

    // Store key for performance lookup
    if (key && name) {
      if (role === 'jockey') jockeyKeys.set(name, key);
      else if (role === 'trainer') trainerKeys.set(name, key);
      else if (role === 'sire') sireKeys.set(name, key);
    }

    const id = `${role}:${name}`;
    let conn = connectionMap.get(id);

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
      connectionMap.set(id, conn);
    }

    if (!conn.trackSet.includes(record.track)) {
      conn.trackSet.push(record.track);
    }

    const starter: Starter = {
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
    };
    conn.starters.push(starter);

    // Count apps from entries (all non-scratched horses, including AE)
    // Apps = total number of appearances (including scratched and AE)
    if (countForApps) {
      conn.apps++;
      
      // Add salary for ALL horses (including scratched and AE)
      // Connection's total salary = sum of all horse salaries
      conn.salarySum += record.salary || 0;

      // Track average odds for ALL horses (including scratched and AE)
      // Avg Odds = sum of all decimal odds / apps
      const odds = record.ml_odds_decimal || 0;
      if (odds > 0) {
        const currentTotal = conn.avgOdds * (conn.apps - 1);
        conn.avgOdds = (currentTotal + odds) / conn.apps;
      }
    }
    
    // Only count points from horses that actually raced (has results)
    if (actuallyRaced) {
      conn.pointsSum += record.points || 0;
    }
  }

  // Second pass: Load AVPA
  // Note: Salary is already calculated in first pass (sum of all horse salaries)
  for (const [name, conn] of connectionMap.entries()) {
    // Load AVPA from performance collections
    const perfKey = role === 'jockey' ? jockeyKeys.get(name) :
                    role === 'trainer' ? trainerKeys.get(name) :
                    sireKeys.get(name);
    
    if (perfKey) {
      const perf = role === 'jockey' ? jockeyPerf.get(perfKey) :
                   role === 'trainer' ? trainerPerf.get(perfKey) :
                   sirePerf.get(perfKey);
      
      if (perf) {
        conn.avpa30d = perf.avpa30;
        conn.avpa90d = perf.avpa90;
      }
    }
    
    // Past race data - disabled for now (will be implemented later)
    // For now, just set empty array
    conn.pastRaces = [];
  }

  return Array.from(connectionMap.values());
}

/**
 * Generate matchups from connections pool
 * Simplified version of frontend generateMatchups
 */
function generateMatchupsFromPool(
  pool: Connection[],
  options: { count?: number; tolerance?: number; maxAttempts?: number; prefer1v1?: number } = {}
): Matchup[] {
  const { count = 10, tolerance = 500, maxAttempts = 500, prefer1v1 = 0.8 } = options;
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  // Filter eligible connections
  const eligible = pool.filter(c => c.apps >= 2 && c.pointsSum > 0);

  if (eligible.length < 2) {
    console.warn('Not enough eligible connections for matchup generation');
    return matchups;
  }

  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    let matchup: Matchup | null = null;
    let attempts = 0;

    while (!matchup && attempts < maxAttempts) {
      attempts++;

      // Prefer 1v1 based on settings
      const sizeA = Math.random() < prefer1v1 ? 1 : (Math.random() < 0.5 ? 1 : 2);
      const sizeB = Math.random() < prefer1v1 ? 1 : (Math.random() < 0.5 ? 1 : 2);

      const available = shuffled.filter(c => 
        i < 5 ? !usedConnections.has(c.id) : true
      );

      if (available.length < sizeA + sizeB) break;

      // Build Set A
      const setA: Connection[] = [];
      const setAIds = new Set<string>();
      const candidates = [...available].sort(() => Math.random() - 0.3);

      for (const conn of candidates) {
        if (setA.length < sizeA && !setAIds.has(conn.id)) {
          setA.push(conn);
          setAIds.add(conn.id);
        }
      }

      if (setA.length !== sizeA) continue;

      const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);

      // Build Set B
      const remaining = candidates.filter(c => !setAIds.has(c.id));
      
      if (sizeB === 1) {
        const bestMatch = remaining
          .map(c => ({ conn: c, diff: Math.abs(salaryA - c.salarySum) }))
          .sort((a, b) => a.diff - b.diff)[0];

        if (bestMatch && bestMatch.diff <= tolerance) {
          const setB: Connection[] = [bestMatch.conn];
          const pointsA = setA.reduce((sum, c) => sum + c.pointsSum, 0);
          const pointsB = setB.reduce((sum, c) => sum + c.pointsSum, 0);

          matchup = {
            id: crypto.randomUUID(),
            setA: {
              connections: setA,
              totalSalary: salaryA,
              totalPoints: pointsA,
            },
            setB: {
              connections: setB,
              totalSalary: bestMatch.conn.salarySum,
              totalPoints: pointsB,
            },
          };

          if (i < 5) {
            [...setA, bestMatch.conn].forEach(c => usedConnections.add(c.id));
          }
          matchups.push(matchup);
        }
      } else {
        // Multiple connections in Set B
        const setB: Connection[] = [];
        const setBIds = new Set<string>();
        let currentSalary = 0;

        const sorted = remaining
          .map(c => ({ conn: c, diff: Math.abs(salaryA - currentSalary - c.salarySum) }))
          .sort((a, b) => a.diff - b.diff);

        for (const item of sorted) {
          if (setB.length < sizeB && !setBIds.has(item.conn.id)) {
            setB.push(item.conn);
            setBIds.add(item.conn.id);
            currentSalary += item.conn.salarySum;
          }
        }

        if (setB.length === sizeB && Math.abs(salaryA - currentSalary) <= tolerance) {
          const pointsA = setA.reduce((sum, c) => sum + c.pointsSum, 0);
          const pointsB = setB.reduce((sum, c) => sum + c.pointsSum, 0);

          matchup = {
            id: crypto.randomUUID(),
            setA: {
              connections: setA,
              totalSalary: salaryA,
              totalPoints: pointsA,
            },
            setB: {
              connections: setB,
              totalSalary: currentSalary,
              totalPoints: pointsB,
            },
          };

          if (i < 5) {
            [...setA, ...setB].forEach(c => usedConnections.add(c.id));
          }
          matchups.push(matchup);
        }
      }
    }
  }

  return matchups;
}

/**
 * Calculate matchups for a contest
 * This is the main async function that gets called when matchup types are set
 */
export async function calculateContestMatchups(
  contestId: string,
  matchupTypes: string[],
  operationId?: string,
  settings?: {
    count?: number;
    tolerance?: number;
    sizes?: number[];
    prefer1v1?: number;
    maxAttempts?: number;
  }
): Promise<{ 
  success: boolean; 
  matchupsCount: number; 
  error?: string;
  stats?: MatchupStats[]; // Stats for each matchup type
}> {
  const opId = operationId || `calc-${contestId}-${Date.now()}`;
  console.log(`[${opId}] Starting matchup calculation for contest ${contestId}`);

  try {
    if (!isSupabaseInitialized()) {
      throw new Error('Supabase not initialized');
    }

    // Get contest details
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, track, date, track_data_id, status')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      throw new Error(`Contest not found: ${contestId}`);
    }

    // Type assertion for contest data
    const contestData = contest as { id: string; track: string; date: string; track_data_id: string | null; status: string };

    console.log(`[${opId}] Contest found: ${contestData.track} on ${contestData.date}`);

    // Get track data
    let trackData: any = null;

    if (contestData.track_data_id) {
      // Get from Supabase track_data table
      const { data: td, error: tdError } = await supabase
        .from('track_data')
        .select('data, metadata')
        .eq('id', contestData.track_data_id)
        .single();

      if (tdError || !td) {
        throw new Error(`Track data not found: ${contestData.track_data_id}`);
      }

      // Type assertion for track data
      const trackDataRecord = td as { data: any; metadata: any };
      trackData = trackDataRecord.data;
      console.log(`[${opId}] Loaded track data from Supabase`);
    } else {
      // Fallback: try Redis cache
      const cacheKey = `entries:${contestData.track}:${contestData.date}`;
      const cached = await getCache<any>(cacheKey);
      if (cached && cached.records) {
        trackData = { data: { entries: cached.records } };
        console.log(`[${opId}] Loaded track data from Redis cache`);
      } else {
        throw new Error('Track data not found in Supabase or cache');
      }
    }

    // Handle data structure: trackData.data.entries or trackData.entries
    let records: any[] = [];
    if (trackData && trackData.data && trackData.data.entries) {
      records = trackData.data.entries;
    } else if (trackData && trackData.entries) {
      records = trackData.entries;
    }
    
    // Log stats about records
    const recordsWithPoints = records.filter((r: any) => r.points > 0).length;
    const recordsWithPlace = records.filter((r: any) => r.place !== null).length;
    const recordsNotScratched = records.filter((r: any) => !r.scratched).length;
    const recordsAE = records.filter((r: any) => r.is_also_eligible).length;
    const recordsScratched = records.filter((r: any) => r.scratched).length;
    
    // Count unique connections from entries (including scratched/AE)
    const jockeysFromEntries = new Set(records.filter(r => r.jockey).map(r => r.jockey));
    const trainersFromEntries = new Set(records.filter(r => r.trainer).map(r => r.trainer));
    const siresFromEntries = new Set([
      ...records.filter(r => r.sire1).map(r => r.sire1),
      ...records.filter(r => r.sire2).map(r => r.sire2)
    ]);
    
    console.log(`[${opId}] 📊 Track Data Stats (from entries):`);
    console.log(`[${opId}]   Total Horses: ${records.length} (including scratched and AE)`);
    console.log(`[${opId}]   Not Scratched: ${recordsNotScratched} (includes AE)`);
    console.log(`[${opId}]   Scratched: ${recordsScratched}`);
    console.log(`[${opId}]   Also Eligible: ${recordsAE}`);
    console.log(`[${opId}]   Jockeys: ${jockeysFromEntries.size}`);
    console.log(`[${opId}]   Trainers: ${trainersFromEntries.size}`);
    console.log(`[${opId}]   Sires: ${siresFromEntries.size}`);
    console.log(`[${opId}] 📊 Results Data Stats:`);
    console.log(`[${opId}]   Records with points: ${recordsWithPoints}`);
    console.log(`[${opId}]   Records with place: ${recordsWithPlace}`);

    if (records.length === 0) {
      throw new Error('No track data entries found');
    }
    console.log(`[${opId}] Processing ${records.length} records`);

    // Clear existing matchups for this contest before recalculating
    const { error: deleteError } = await supabase
      .from('matchups')
      .delete()
      .eq('contest_id', contestId);

    if (deleteError) {
      console.error(`[${opId}] Error clearing previous matchups for contest ${contestId}:`, deleteError);
    } else {
      console.log(`[${opId}] 🧹 Cleared existing matchups for contest ${contestId}`);
    }

    // Calculate matchups for each type
    // PER-TYPE EXCLUSION: Track connections used per matchup type
    // Once a connection appears in a matchup type, exclude it from other matchups of the SAME type
    // Connections CAN appear across different matchup types (jockey_vs_jockey vs mixed)
    const usedConnectionsPerType = new Map<string, Set<string>>();
    let totalMatchups = 0;
    const totalTypes = matchupTypes.length;
    let processedTypes = 0;
    const matchupStats: MatchupStats[] = [];

    // Update progress periodically
    const updateProgress = async (progress: number) => {
      if (operationId) {
        const { error } = await supabase
          .from('operations')
          // @ts-ignore - Supabase type inference issue
          .update({ progress })
          .eq('id', operationId);
        if (error) {
          console.error(`[${opId}] Error updating progress:`, error);
        }
      }
    };

    for (const matchupType of matchupTypes) {
      processedTypes++;
      const typeProgress = Math.round((processedTypes / totalTypes) * 100);
      await updateProgress(typeProgress);
      
      console.log(`[${opId}] Calculating ${matchupType} matchups... (${processedTypes}/${totalTypes})`);

      // Generate connections for this type (with AVPA and Talha's salary method)
      let connections: Connection[] = [];
      
      if (matchupType === 'mixed') {
        // For mixed, combine all three types of connections
        const jockeyConnections = await generateConnections(records, 'jockey', contestData.track, contestData.date);
        const trainerConnections = await generateConnections(records, 'trainer', contestData.track, contestData.date);
        const sireConnections = await generateConnections(records, 'sire', contestData.track, contestData.date);
        
        connections = [...jockeyConnections, ...trainerConnections, ...sireConnections];
        console.log(`[${opId}] Mixed connections: ${jockeyConnections.length} jockeys, ${trainerConnections.length} trainers, ${sireConnections.length} sires`);
      } else if (matchupType === 'cross_track') {
        // For cross-track, combine all three types of connections (like mixed)
        // But validation will ensure they're from different tracks
        const jockeyConnections = await generateConnections(records, 'jockey', contestData.track, contestData.date);
        const trainerConnections = await generateConnections(records, 'trainer', contestData.track, contestData.date);
        const sireConnections = await generateConnections(records, 'sire', contestData.track, contestData.date);
        
        connections = [...jockeyConnections, ...trainerConnections, ...sireConnections];
        console.log(`[${opId}] Cross-track connections: ${jockeyConnections.length} jockeys, ${trainerConnections.length} trainers, ${sireConnections.length} sires`);
      } else {
        // For single type (jockey_vs_jockey, trainer_vs_trainer, sire_vs_sire)
        const role = matchupType.split('_vs_')[0] as 'jockey' | 'trainer' | 'sire';
        connections = await generateConnections(records, role, contestData.track, contestData.date);
      }
      
      // Get settings to determine min_appearances
      const typeSettings = settings && typeof settings === 'object' && !Array.isArray(settings)
        ? (settings as Record<string, any>)[matchupType] || settings
        : settings;
      const defaultUnified = DEFAULT_UNIFIED_SETTINGS[matchupType] || DEFAULT_UNIFIED_SETTINGS.jockey_vs_jockey;
      const minSalarySetting =
        (typeSettings as any)?.minSalary ??
        (typeSettings as any)?.min_salary ??
        defaultUnified.min_salary ?? 1000;
      const applyMinAppearances =
        (typeSettings as any)?.minAppearancesEnabled ??
        (typeSettings as any)?.min_appearances_enabled ??
        defaultUnified.apply_min_appearances ?? false;
      const minAppearancesSetting =
        (typeSettings as any)?.minAppearances ??
        (typeSettings as any)?.min_appearances ??
        defaultUnified.min_appearances;
      
      // Get unique connections (by id) - important for theoretical calculations
      const uniqueConnections = new Set(connections.map(c => c.id));
      const uniqueCount = uniqueConnections.size;
      const salaryThresholdCandidates = [
        minSalarySetting,
        Math.floor(minSalarySetting * 0.75),
        Math.floor(minSalarySetting * 0.5),
        Math.floor(minSalarySetting * 0.25),
        0,
      ].filter((value, index, self) => value >= 0 && self.indexOf(value) === index);

      let effectiveMinSalary = minSalarySetting;
      let salaryEligibleConnections: Connection[] = [];

      for (const threshold of salaryThresholdCandidates) {
        const candidates = connections.filter(c => (c.salarySum || 0) >= threshold);
        if (candidates.length >= 2) {
          effectiveMinSalary = threshold;
          salaryEligibleConnections = candidates;
          if (threshold < minSalarySetting) {
            console.warn(
              `[${opId}] ⚠️ Reduced min salary threshold for ${matchupType} from ${minSalarySetting} to ${effectiveMinSalary} to ensure sufficient connections (${candidates.length})`
            );
          }
          break;
        }
      }

      if (salaryEligibleConnections.length === 0) {
        salaryEligibleConnections = connections;
      }

      const eligibleCount = applyMinAppearances
        ? salaryEligibleConnections.filter(c => c.apps >= minAppearancesSetting).length
        : salaryEligibleConnections.length;
      const totalApps = connections.reduce((sum, c) => sum + c.apps, 0);
      const totalSalary = connections.reduce((sum, c) => sum + c.salarySum, 0);
      const totalPoints = connections.reduce((sum, c) => sum + c.pointsSum, 0);
      
      console.log(`[${opId}] Generated ${connections.length} ${matchupType} connections`);
      console.log(`[${opId}]   Unique connections: ${uniqueCount}`);
      console.log(`[${opId}]   Connections meeting min salary ${effectiveMinSalary}: ${salaryEligibleConnections.length}`);
      if (applyMinAppearances) {
        console.log(`[${opId}]   Connections with >= ${minAppearancesSetting} apps: ${eligibleCount}`);
      }
      console.log(`[${opId}]   Total apps (from entries): ${totalApps}`);
      console.log(`[${opId}]   Total salary (from entries): ${totalSalary}`);
      console.log(`[${opId}]   Total points (from results): ${totalPoints}`);

      if (connections.length < 2 || uniqueCount < 2) {
        console.warn(`[${opId}] ⚠️ Not enough unique connections for ${matchupType} (need at least 2, got ${uniqueCount})`);
        continue;
      }
      
      if (salaryEligibleConnections.length < 2) {
        console.warn(`[${opId}] ⚠️ Not enough connections meeting min salary ${effectiveMinSalary} for ${matchupType} (got ${salaryEligibleConnections.length})`);
        console.warn(`[${opId}]   Total connections: ${connections.length}, Unique: ${uniqueCount}, Min salary eligible: ${salaryEligibleConnections.length}`);
        continue;
      }
      
      if (applyMinAppearances && eligibleCount < 2) {
        console.warn(`[${opId}] ⚠️ Not enough connections with >= ${minAppearancesSetting} appearances for ${matchupType} (got ${eligibleCount})`);
        console.warn(`[${opId}]   Total connections: ${connections.length}, Unique: ${uniqueCount}, Min salary eligible: ${salaryEligibleConnections.length}, With min apps: ${eligibleCount}`);
        continue;
      }
      
      // Admin sets "count" as what they want to SHOW
      // Backend generates 3x that amount for the pool (for pre-generation strategy)
      const requestedCount = (typeSettings as any)?.count || defaultUnified.num_matchups;
      const poolSize = requestedCount * 3; // Generate 3x for pool
      
      const unifiedSettings: UnifiedMatchupSettings = {
        num_matchups: poolSize, // Generate more for the pool
        salary_tolerance: (typeSettings as any)?.tolerance || defaultUnified.salary_tolerance,
        appearance_tolerance: (typeSettings as any)?.appearance_tolerance !== undefined 
          ? (typeSettings as any).appearance_tolerance 
          : defaultUnified.appearance_tolerance,
        patterns: (typeSettings as any)?.patterns || defaultUnified.patterns,
        min_appearances: minAppearancesSetting,
        min_salary: effectiveMinSalary,
        apply_min_appearances: applyMinAppearances,
      };
      
      console.log(`[${opId}] Using unified settings:`, unifiedSettings);
      
      // Build horse map for overlap checking
      const horseMap = buildConnectionHorseMap(connections);
      
      const startTime = Date.now();
      const isMixed = matchupType === 'mixed';
      const isCrossTrack = matchupType === 'cross_track';
      
      // PER-TYPE EXCLUSION: Get connections excluded within this matchup type only
      // Connections used in OTHER matchup types are NOT excluded (can appear in multiple types)
      const excludedForThisType = usedConnectionsPerType.get(matchupType) || new Set<string>();
      
      const matchups = generateUnifiedMatchups(
        connections, 
        unifiedSettings, 
        horseMap, 
        isMixed, 
        isCrossTrack,
        excludedForThisType // Pass per-type exclusion set (only excludes within same type)
      );
      const calcTime = Date.now() - startTime;
      console.log(`[${opId}] ⏱️  Calculation took ${calcTime}ms`);
      
      // PER-TYPE EXCLUSION: Mark all connections used in this matchup type as excluded
      // This prevents the same connection from appearing in multiple matchups of the SAME type
      // But allows it to appear in DIFFERENT matchup types (e.g., jockey_vs_jockey AND mixed)
      const usedInThisType = usedConnectionsPerType.get(matchupType) || new Set<string>();
      
      for (const matchup of matchups) {
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
      usedConnectionsPerType.set(matchupType, usedInThisType);
      
      if (matchups.length > 0) {
        const connectionsUsed = usedInThisType.size;
        console.log(`[${opId}] 🔒 Per-Type Exclusion (${matchupType}): ${connectionsUsed} connections excluded within this type (can still appear in other types)`);
      }

      console.log(`[${opId}] Generated ${matchups.length} ${matchupType} matchups (requested: ${poolSize} for pool, will show: ${requestedCount})`);
      
      const poolCount = matchups.length;
      const displayCount = poolCount === 0 ? 0 : Math.min(requestedCount, poolCount);
      
      if (poolCount === 0) {
        console.warn(`[${opId}] ⚠️ No matchups generated for ${matchupType} despite having ${eligibleCount} eligible connections`);
        console.warn(`[${opId}]   This could be due to:`);
        console.warn(`[${opId}]   - Salary tolerance too strict (${unifiedSettings.salary_tolerance})`);
        console.warn(`[${opId}]   - No valid pairs within tolerance`);
        console.warn(`[${opId}]   - Horse overlap preventing valid matchups`);
      }

      // Calculate theoretical maximums and create stats
      const stats = formatMatchupStats({
        type: matchupType,
        uniqueConnections: uniqueCount,
        eligibleConnections: eligibleCount,
        generated: poolCount,
        requested: requestedCount,
        displayCount,
        poolCount,
        minAppearances: minAppearancesSetting,
        minSalary: effectiveMinSalary,
        applyMinAppearances,
        patterns: unifiedSettings.patterns,
      });
      matchupStats.push(stats);
      
      console.log(`[${opId}] 📊 Stats for ${matchupType}:`);
      console.log(`[${opId}]   Unique connections: ${uniqueCount}`);
      if (applyMinAppearances) {
        console.log(`[${opId}]   Eligible connections (>= ${minAppearancesSetting} apps): ${eligibleCount}`);
      }
      console.log(`[${opId}]   Generated pool: ${poolCount}`);
      console.log(`[${opId}]   Display count: ${displayCount} (requested: ${requestedCount})`);
      console.log(`[${opId}]   Theoretical maximums:`, stats.theoreticalMax);

      const matchupPayload = {
        matchups,
        pool_count: poolCount,
        display_count: displayCount,
        requested_count: requestedCount,
        min_appearances: minAppearancesSetting,
        min_salary: effectiveMinSalary,
        apply_min_appearances: applyMinAppearances,
        settings: typeSettings || null,
        stats,
      };

      if (poolCount > 0) {
        // Store in Supabase
        const { error: insertError } = await supabase
          .from('matchups')
          // @ts-ignore - Supabase type inference issue
          .insert({
            contest_id: contestId,
            matchup_type: matchupType,
            matchup_data: matchupPayload,
          });

        if (insertError) {
          console.error(`[${opId}] Error storing ${matchupType} matchups:`, insertError);
          throw insertError;
        }

        totalMatchups += poolCount;
        console.log(`[${opId}] ✅ Stored ${poolCount} ${matchupType} matchups (displaying ${displayCount})`);
        
        // Update progress after storing
        const storedProgress = Math.round((processedTypes / totalTypes) * 90); // 90% after storing
        await updateProgress(storedProgress);
      } else {
        console.warn(`[${opId}] ⚠️ Skipping storage for ${matchupType} (no matchups generated)`);
        console.warn(`[${opId}]   Eligible connections: ${eligibleCount}`);
        console.warn(`[${opId}]   - Salary tolerance too strict (${unifiedSettings.salary_tolerance})`);
        console.warn(`[${opId}]   - No valid pairs within tolerance`);
        console.warn(`[${opId}]   - Horse overlap preventing valid matchups`);
      }
    }

    // Only mark as 'ready' if we have matchups, otherwise reset to 'draft'
    if (totalMatchups === 0) {
      console.warn(`[${opId}] ⚠️ No matchups generated for any type. Resetting contest to draft.`);
      
      const { error: resetError } = await supabase
        .from('contests')
        // @ts-ignore - Supabase type inference issue
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contestId);
      
      if (resetError) {
        console.error(`[${opId}] Error resetting contest status:`, resetError);
      }
      
      return {
        success: false,
        matchupsCount: 0,
        error: 'No matchups could be generated. Check that connections have sufficient data (min 3 appearances, points > 0).',
      };
    }

    // Update contest status to 'ready'
    const { error: updateError } = await supabase
      .from('contests')
      // @ts-ignore - Supabase type inference issue
      .update({
        status: 'ready',
        matchups_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contestId);

    if (updateError) {
      console.error(`[${opId}] Error updating contest status:`, updateError);
      throw updateError;
    }

    console.log(`[${opId}] ✅ Contest ${contestId} marked as ready`);
    console.log(`[${opId}] ✅ Total matchups calculated: ${totalMatchups}`);

    return {
      success: true,
      matchupsCount: totalMatchups,
      stats: matchupStats,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${opId}] ❌ Error calculating matchups:`, errorMessage);

    // Reset contest status to 'draft' on failure so admin can retry
    const { error: updateError } = await supabase
      .from('contests')
      // @ts-ignore - Supabase type inference issue
      .update({
        status: 'draft', // Reset to draft so admin can retry
        updated_at: new Date().toISOString(),
      })
      .eq('id', contestId);
    
    if (updateError) {
      console.error(`[${opId}] Error resetting contest status on failure:`, updateError);
    } else {
      console.log(`[${opId}] ✅ Contest ${contestId} reset to draft status (can be retried)`);
    }

    return {
      success: false,
      matchupsCount: 0,
      error: errorMessage,
    };
  }
}

