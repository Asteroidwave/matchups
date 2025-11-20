/**
 * Diagnostic script to analyze why fewer matchups are generated than requested
 * 
 * This script will:
 * 1. Fetch track data from Supabase for AQU or DMR
 * 2. Generate connections
 * 3. Run matchup generation with detailed logging
 * 4. Show statistics about constraints limiting matchup generation
 */

import { supabase } from '../src/utils/supabase';
import { generateUnifiedMatchups, buildConnectionHorseMap, DEFAULT_UNIFIED_SETTINGS, UnifiedMatchupSettings } from '../src/services/unifiedMatchupGenerator';
import { Connection } from '../src/types/backend';
import { loadJockeyPerformanceData, loadTrainerPerformanceData, loadSirePerformanceData } from '../src/utils/performanceData';

// Copy of generateConnections from matchupCalculation.ts (not exported)
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

  // Track keys for matching with performance data
  const jockeyKeys = new Map<string, string>();
  const trainerKeys = new Map<string, string>();
  const sireKeys = new Map<string, string>();

  // First pass: collect all data
  for (const record of records) {
    const isScratched = record.scratched === true;
    const isAlsoEligible = record.is_also_eligible === true || record.isAlsoEligible === true;
    const countForApps = !isScratched;
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

    const starter = {
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

    if (countForApps) {
      conn.apps++;
      conn.salarySum += record.salary || 0;
      const odds = record.ml_odds_decimal || 0;
      if (odds > 0) {
        const currentTotal = conn.avgOdds * (conn.apps - 1);
        conn.avgOdds = (currentTotal + odds) / conn.apps;
      }
    }
    
    if (actuallyRaced) {
      conn.pointsSum += record.points || 0;
    }
  }

  // Second pass: Load AVPA
  for (const [name, conn] of connectionMap.entries()) {
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
    
    conn.pastRaces = [];
  }

  return Array.from(connectionMap.values());
}

async function diagnoseMatchupGeneration() {
  console.log('🔍 Starting matchup generation diagnosis...\n');

  try {
    // Step 1: Find a contest for AQU or DMR
    console.log('📋 Step 1: Finding contest for AQU or DMR...');
    const { data: contests, error: contestError } = await supabase
      .from('contests')
      .select('id, track, date, track_data_id, matchup_types')
      .in('track', ['AQU', 'DMR'])
      .order('date', { ascending: false })
      .limit(1);

    if (contestError || !contests || contests.length === 0) {
      console.error('❌ No contests found for AQU or DMR');
      return;
    }

    const contest = contests[0];
    console.log(`✅ Found contest: ${contest.track} on ${contest.date} (ID: ${contest.id})\n`);

    // Step 2: Get track data
    console.log('📊 Step 2: Loading track data...');
    let trackData: any = null;

    if (contest.track_data_id) {
      const { data: td, error: tdError } = await supabase
        .from('track_data')
        .select('data, metadata')
        .eq('id', contest.track_data_id)
        .single();

      if (tdError || !td) {
        console.error('❌ Track data not found');
        return;
      }

      trackData = td.data;
      console.log('✅ Track data loaded from Supabase\n');
    } else {
      console.error('❌ No track_data_id found');
      return;
    }

    // Step 3: Extract records
    let records: any[] = [];
    if (trackData && trackData.data && trackData.data.entries) {
      records = trackData.data.entries;
    } else if (trackData && trackData.entries) {
      records = trackData.entries;
    }

    console.log(`📈 Found ${records.length} records\n`);

    // Step 4: Generate connections for each matchup type
    const matchupTypes = ['jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire'];
    
    for (const matchupType of matchupTypes) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔬 ANALYZING: ${matchupType.toUpperCase()}`);
      console.log('='.repeat(80));

      // Generate connections
      const role = matchupType.split('_vs_')[0] as 'jockey' | 'trainer' | 'sire';
      const connections = await generateConnections(records, role, contest.track, contest.date);

      console.log(`\n📊 Connection Statistics:`);
      console.log(`   Total connections: ${connections.length}`);
      
      // Analyze connection quality
      const withPoints = connections.filter(c => c.pointsSum > 0).length;
      const withSalary = connections.filter(c => c.salarySum > 0).length;
      const withMinApps = connections.filter(c => c.apps >= 2).length;
      const withMinApps3 = connections.filter(c => c.apps >= 3).length;
      
      console.log(`   Connections with points > 0: ${withPoints}`);
      console.log(`   Connections with salary > 0: ${withSalary}`);
      console.log(`   Connections with apps >= 2: ${withMinApps}`);
      console.log(`   Connections with apps >= 3: ${withMinApps3}`);

      // Salary distribution
      const salaries = connections.map(c => c.salarySum).filter(s => s > 0).sort((a, b) => b - a);
      if (salaries.length > 0) {
        console.log(`\n💰 Salary Distribution:`);
        console.log(`   Min: $${salaries[salaries.length - 1]}`);
        console.log(`   Max: $${salaries[0]}`);
        console.log(`   Median: $${salaries[Math.floor(salaries.length / 2)]}`);
        console.log(`   Mean: $${Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)}`);
      }

      // Step 5: Test matchup generation with requested count = 10
      const requestedCount = 10;
      const poolSize = requestedCount * 3; // Backend generates 3x for pool
      
      console.log(`\n🎯 Testing Matchup Generation:`);
      console.log(`   Requested count (display): ${requestedCount}`);
      console.log(`   Pool size (generated): ${poolSize}`);

      const defaultSettings = DEFAULT_UNIFIED_SETTINGS[matchupType] || DEFAULT_UNIFIED_SETTINGS.jockey_vs_jockey;
      
      const unifiedSettings: UnifiedMatchupSettings = {
        num_matchups: poolSize,
        salary_tolerance: defaultSettings.salary_tolerance,
        appearance_tolerance: defaultSettings.appearance_tolerance,
        patterns: defaultSettings.patterns,
        min_appearances: defaultSettings.min_appearances,
        min_salary: defaultSettings.min_salary,
        apply_min_appearances: defaultSettings.apply_min_appearances,
      };

      console.log(`\n⚙️  Settings:`);
      console.log(`   Salary tolerance: $${unifiedSettings.salary_tolerance}`);
      console.log(`   Min appearances: ${unifiedSettings.min_appearances}`);
      console.log(`   Apply min appearances: ${unifiedSettings.apply_min_appearances}`);
      console.log(`   Min salary: $${unifiedSettings.min_salary}`);
      console.log(`   Patterns: ${JSON.stringify(unifiedSettings.patterns)}`);

      // Filter eligible connections
      const salaryEligible = connections.filter(c => (c.salarySum || 0) >= unifiedSettings.min_salary);
      const eligible = unifiedSettings.apply_min_appearances
        ? salaryEligible.filter(c => c.apps >= unifiedSettings.min_appearances)
        : salaryEligible;

      console.log(`\n✅ Eligible Connections:`);
      console.log(`   After salary filter (>= $${unifiedSettings.min_salary}): ${salaryEligible.length}`);
      console.log(`   After apps filter (>= ${unifiedSettings.min_appearances}): ${eligible.length}`);

      if (eligible.length < 2) {
        console.log(`\n❌ NOT ENOUGH ELIGIBLE CONNECTIONS (need at least 2, got ${eligible.length})`);
        continue;
      }

      // Build horse map
      const horseMap = buildConnectionHorseMap(connections);

      // Step 6: Analyze potential 1v1 matchups
      console.log(`\n🔍 Analyzing Potential 1v1 Matchups:`);
      
      const sorted = [...eligible].sort((a, b) => b.salarySum - a.salarySum);
      const validPairs: Array<{
        connA: Connection;
        connB: Connection;
        salaryDiff: number;
        hasHorseOverlap: boolean;
      }> = [];

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const connA = sorted[i];
          const connB = sorted[j];
          const salaryDiff = Math.abs(connA.salarySum - connB.salarySum);
          
          if (salaryDiff <= unifiedSettings.salary_tolerance) {
            // Check horse overlap
            const horsesA = new Set<string>();
            const horsesB = new Set<string>();
            
            for (const starter of connA.starters) {
              horsesA.add(starter.horseName);
            }
            for (const starter of connB.starters) {
              horsesB.add(starter.horseName);
            }
            
            let hasOverlap = false;
            for (const horse of horsesA) {
              if (horsesB.has(horse)) {
                hasOverlap = true;
                break;
              }
            }
            
            validPairs.push({
              connA,
              connB,
              salaryDiff,
              hasHorseOverlap: hasOverlap,
            });
          }
        }
      }

      const pairsWithoutOverlap = validPairs.filter(p => !p.hasHorseOverlap);
      
      console.log(`   Total valid pairs (within salary tolerance): ${validPairs.length}`);
      console.log(`   Pairs without horse overlap: ${pairsWithoutOverlap.length}`);
      console.log(`   Pairs with horse overlap: ${validPairs.length - pairsWithoutOverlap.length}`);

      // Calculate theoretical maximum with per-type exclusion
      const maxWithExclusion = Math.floor(eligible.length / 2);
      console.log(`\n📐 Theoretical Maximums:`);
      console.log(`   With per-type exclusion (each connection used once): ${maxWithExclusion}`);
      console.log(`   Without exclusion (allows reuse): ${pairsWithoutOverlap.length}`);

      // Step 7: Actually generate matchups
      console.log(`\n🚀 Generating Matchups...`);
      const startTime = Date.now();
      
      const matchups = generateUnifiedMatchups(
        connections,
        unifiedSettings,
        horseMap,
        false, // not mixed
        false, // not cross-track
        new Set() // no excluded connections
      );
      
      const calcTime = Date.now() - startTime;
      
      console.log(`\n📊 Results:`);
      console.log(`   Generated: ${matchups.length} matchups`);
      console.log(`   Requested (pool): ${poolSize}`);
      console.log(`   Requested (display): ${requestedCount}`);
      console.log(`   Calculation time: ${calcTime}ms`);
      
      if (matchups.length < requestedCount) {
        console.log(`\n⚠️  PROBLEM IDENTIFIED:`);
        console.log(`   Generated ${matchups.length} matchups but requested ${requestedCount}`);
        console.log(`   Shortfall: ${requestedCount - matchups.length} matchups`);
        
        console.log(`\n🔍 Root Cause Analysis:`);
        console.log(`   1. Valid pairs without overlap: ${pairsWithoutOverlap.length}`);
        console.log(`   2. Theoretical max with exclusion: ${maxWithExclusion}`);
        console.log(`   3. Actual generated: ${matchups.length}`);
        
        if (pairsWithoutOverlap.length < requestedCount) {
          console.log(`   ⚠️  Not enough valid pairs (need ${requestedCount}, have ${pairsWithoutOverlap.length})`);
        }
        if (maxWithExclusion < requestedCount) {
          console.log(`   ⚠️  Per-type exclusion limits to ${maxWithExclusion} (need ${requestedCount})`);
        }
        if (matchups.length < pairsWithoutOverlap.length && matchups.length < maxWithExclusion) {
          console.log(`   ⚠️  Generation algorithm may be hitting other constraints`);
        }
      } else {
        console.log(`\n✅ SUCCESS: Generated ${matchups.length} matchups (>= ${requestedCount} requested)`);
      }

      // Step 8: Analyze what's limiting generation
      console.log(`\n🔬 Constraint Analysis:`);
      
      // Check salary tolerance impact
      const tolerance1000 = validPairs.filter(p => p.salaryDiff <= 1000).length;
      const tolerance2000 = validPairs.filter(p => p.salaryDiff <= 2000).length;
      const tolerance5000 = validPairs.filter(p => p.salaryDiff <= 5000).length;
      
      console.log(`   Pairs within $1000 tolerance: ${tolerance1000}`);
      console.log(`   Pairs within $2000 tolerance: ${tolerance2000}`);
      console.log(`   Pairs within $5000 tolerance: ${tolerance5000}`);
      
      if (tolerance1000 < requestedCount && tolerance2000 >= requestedCount) {
        console.log(`   💡 Suggestion: Increase salary tolerance from $1000 to $2000`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ Diagnosis Complete');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Run the diagnosis
diagnoseMatchupGeneration()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

