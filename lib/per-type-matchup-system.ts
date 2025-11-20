/**
 * PER-TYPE MATCHUP EXCLUSION SYSTEM
 * Implements the user's sophisticated 4-type system:
 * - Jockey vs Jockey (high apps requirement)
 * - Trainer vs Trainer (medium tolerance)  
 * - Sire vs Sire (low apps requirement)
 * - Mixed (cross-role matchups)
 * 
 * Key feature: Per-type exclusion (not global) - much better utilization!
 */

import { Connection, Matchup } from "@/types";

export interface PerTypeMatchupSettings {
  jockeyVsJockey: {
    count: number;
    minApps: number;        // Jockeys need higher apps (2+)
    salaryTolerance: number; // Standard tolerance
    preferredSizes: number[]; // [1, 2] for 1v1, 2v1, 1v2
  };
  trainerVsTrainer: {
    count: number;
    minApps: number;        // Trainers medium apps (2+)
    salaryTolerance: number; // Maybe higher tolerance
    preferredSizes: number[];
  };
  sireVsSire: {
    count: number;
    minApps: number;        // Sires lower apps requirement (1+)
    salaryTolerance: number; // Higher tolerance (smaller salaries)
    preferredSizes: number[];
  };
  mixed: {
    count: number;
    minApps: number;        // Flexible for mixed
    salaryTolerance: number; // Higher tolerance for flexibility
    preferredSizes: number[];
    allowSameTrackDifferentRole: boolean; // Allow jockey vs trainer from same track
  };
}

export const DEFAULT_PER_TYPE_SETTINGS: PerTypeMatchupSettings = {
  jockeyVsJockey: {
    count: 10,
    minApps: 2,             // Jockeys must have 2+ races
    salaryTolerance: 1000,  // $1000 as requested
    preferredSizes: [1, 2], // 1v1, 2v1, 1v2
  },
  trainerVsTrainer: {
    count: 10,
    minApps: 2,             // Trainers need 2+ horses
    salaryTolerance: 800,   // Slightly lower (trainers more consistent)
    preferredSizes: [1, 2],
  },
  sireVsSire: {
    count: 10,
    minApps: 1,             // Sires often only on 1 horse
    salaryTolerance: 1200,  // Higher tolerance (smaller salary range)
    preferredSizes: [1, 2],
  },
  mixed: {
    count: 10,
    minApps: 1,             // Very flexible for variety
    salaryTolerance: 1500,  // Highest tolerance for cross-role balance
    preferredSizes: [1, 2],
    allowSameTrackDifferentRole: true,
  }
};

interface MatchupTypeResult {
  type: string;
  matchups: Matchup[];
  connectionsUsed: Set<string>;
  eligible: number;
  attempts: number;
  avgSalaryDiff: number;
}

/**
 * Generate connections by role with role-specific filtering
 */
function generateConnectionsByRole(
  allConnections: Connection[],
  role: 'jockey' | 'trainer' | 'sire',
  minApps: number
): Connection[] {
  return allConnections
    .filter(c => c.role === role)
    .filter(c => c.apps >= minApps && c.pointsSum >= 0) // Allow 0 points but must have some data
    .sort((a, b) => b.salarySum - a.salarySum); // High salary priority
}

/**
 * Check if two connection sets have different roles (for mixed matchups)
 */
function hasDifferentRoles(setA: Connection[], setB: Connection[]): boolean {
  const rolesA = new Set(setA.map(c => c.role));
  const rolesB = new Set(setB.map(c => c.role));
  
  // No overlap in roles = different roles
  for (const role of rolesA) {
    if (rolesB.has(role)) return false;
  }
  return true;
}

/**
 * Check horse overlap (existing function)
 */
function checkHorseOverlap(setA: Connection[], setB: Connection[]): boolean {
  const horsesA = new Set<string>();
  const horsesB = new Set<string>();
  
  for (const conn of setA) {
    for (const starter of conn.starters) {
      horsesA.add(starter.horseName);
    }
  }
  
  for (const conn of setB) {
    for (const starter of conn.starters) {
      horsesB.add(starter.horseName);
    }
  }
  
  for (const horse of horsesA) {
    if (horsesB.has(horse)) return true;
  }
  return false;
}

/**
 * Generate matchups for a single type with per-type exclusion
 */
function generateSingleTypeMatchups(
  eligibleConnections: Connection[],
  settings: {
    count: number;
    salaryTolerance: number;
    preferredSizes: number[];
  },
  usedInThisType: Set<string>,
  isMixed: boolean = false,
  maxAttempts: number = 1000
): { matchups: Matchup[]; attempts: number; avgSalaryDiff: number } {
  const matchups: Matchup[] = [];
  let totalAttempts = 0;
  const salaryDiffs: number[] = [];
  
  for (let i = 0; i < settings.count; i++) {
    let matchup: Matchup | null = null;
    let attempts = 0;
    
    while (!matchup && attempts < maxAttempts) {
      attempts++;
      totalAttempts++;
      
      // Determine sizes (prefer 1v1, allow 2v1/1v2)
      const prefer1v1 = Math.random() < 0.8; // 80% 1v1 preference
      let sizeA: number, sizeB: number;
      
      if (prefer1v1 && settings.preferredSizes.includes(1)) {
        sizeA = 1;
        sizeB = 1;
      } else {
        sizeA = settings.preferredSizes[Math.floor(Math.random() * settings.preferredSizes.length)];
        sizeB = settings.preferredSizes[Math.floor(Math.random() * settings.preferredSizes.length)];
        // No 2v2
        if (sizeA === 2 && sizeB === 2) {
          if (Math.random() < 0.5) sizeA = 1;
          else sizeB = 1;
        }
      }
      
      // Get available connections (not used in THIS type)
      const available = eligibleConnections.filter(c => !usedInThisType.has(c.id));
      
      if (available.length < sizeA + sizeB) break;
      
      // Build Set A
      const setA: Connection[] = [];
      const candidates = [...available];
      
      for (let j = 0; j < sizeA && j < candidates.length; j++) {
        setA.push(candidates[j]);
      }
      
      if (setA.length !== sizeA) continue;
      
      const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
      
      // Build Set B
      const remaining = available.filter(c => !setA.some(a => a.id === c.id));
      
      if (sizeB === 1) {
        // Single connection - find best salary match
        const matches = remaining
          .map(c => ({ conn: c, diff: Math.abs(salaryA - c.salarySum) }))
          .filter(m => m.diff <= settings.salaryTolerance)
          .sort((a, b) => a.diff - b.diff);
        
        for (const match of matches) {
          const setB = [match.conn];
          
          // Validate matchup
          if (checkHorseOverlap(setA, setB)) continue;
          
          if (isMixed && !hasDifferentRoles(setA, setB)) continue;
          
          // Valid matchup found!
          matchup = {
            id: `${isMixed ? 'mixed' : 'single'}-${Date.now()}-${i}`,
            setA: { connections: setA, salaryTotal: salaryA },
            setB: { connections: setB, salaryTotal: match.conn.salarySum },
            matchupType: isMixed ? 'mixed' : setA[0].role + '_vs_' + setB[0].role
          };
          
          // Mark as used in THIS type only
          setA.forEach(c => usedInThisType.add(c.id));
          setB.forEach(c => usedInThisType.add(c.id));
          
          salaryDiffs.push(match.diff);
          break;
        }
      } else {
        // Multi-connection Set B (simplified for now)
        const setB: Connection[] = [];
        let currentSalary = 0;
        
        // Try greedy approach for multi-connection
        for (const conn of remaining.slice(0, sizeB)) {
          setB.push(conn);
          currentSalary += conn.salarySum;
        }
        
        if (setB.length === sizeB && Math.abs(salaryA - currentSalary) <= settings.salaryTolerance) {
          if (!checkHorseOverlap(setA, setB) && (!isMixed || hasDifferentRoles(setA, setB))) {
            matchup = {
              id: `${isMixed ? 'mixed' : 'multi'}-${Date.now()}-${i}`,
              setA: { connections: setA, salaryTotal: salaryA },
              setB: { connections: setB, salaryTotal: currentSalary },
              matchupType: isMixed ? 'mixed' : setA[0].role + '_vs_' + setB[0].role
            };
            
            setA.forEach(c => usedInThisType.add(c.id));
            setB.forEach(c => usedInThisType.add(c.id));
            
            salaryDiffs.push(Math.abs(salaryA - currentSalary));
          }
        }
      }
    }
    
    if (matchup) {
      matchups.push(matchup);
    }
  }
  
  const avgSalaryDiff = salaryDiffs.length > 0 
    ? salaryDiffs.reduce((a, b) => a + b, 0) / salaryDiffs.length 
    : 0;
  
  return { matchups, attempts: totalAttempts, avgSalaryDiff };
}

/**
 * Generate mixed matchups (cross-role)
 */
function generateMixedMatchups(
  allConnections: Connection[],
  settings: PerTypeMatchupSettings['mixed'],
  usedInMixed: Set<string>,
  maxAttempts: number = 1000
): { matchups: Matchup[]; attempts: number; avgSalaryDiff: number } {
  // Get all eligible connections from all roles
  const eligible = allConnections
    .filter(c => c.apps >= settings.minApps && c.pointsSum >= 0)
    .sort((a, b) => b.salarySum - a.salarySum);
  
  console.log(`[Mixed] Eligible connections: ${eligible.length} (jockeys: ${eligible.filter(c => c.role === 'jockey').length}, trainers: ${eligible.filter(c => c.role === 'trainer').length}, sires: ${eligible.filter(c => c.role === 'sire').length})`);
  
  return generateSingleTypeMatchups(
    eligible,
    {
      count: settings.count,
      salaryTolerance: settings.salaryTolerance,
      preferredSizes: settings.preferredSizes
    },
    usedInMixed,
    true, // isMixed = true
    maxAttempts
  );
}

/**
 * Main function: Generate all 4 matchup types with per-type exclusion
 */
export function generatePerTypeMatchups(
  allConnections: Connection[],
  settings: PerTypeMatchupSettings = DEFAULT_PER_TYPE_SETTINGS
): {
  results: MatchupTypeResult[];
  totalMatchups: number;
  summary: string;
} {
  const results: MatchupTypeResult[] = [];
  
  console.log(`[Per-Type System] Starting with ${allConnections.length} total connections`);
  
  // Track used connections PER TYPE (key insight!)
  const usedPerType = {
    jockey: new Set<string>(),
    trainer: new Set<string>(),
    sire: new Set<string>(),
    mixed: new Set<string>()
  };
  
  // 1. JOCKEY VS JOCKEY
  console.log(`\n[1/4] Generating Jockey vs Jockey matchups...`);
  const jockeyEligible = generateConnectionsByRole(allConnections, 'jockey', settings.jockeyVsJockey.minApps);
  const jockeyResult = generateSingleTypeMatchups(
    jockeyEligible,
    settings.jockeyVsJockey,
    usedPerType.jockey,
    false
  );
  
  results.push({
    type: 'jockey_vs_jockey',
    matchups: jockeyResult.matchups,
    connectionsUsed: new Set(usedPerType.jockey),
    eligible: jockeyEligible.length,
    attempts: jockeyResult.attempts,
    avgSalaryDiff: jockeyResult.avgSalaryDiff
  });
  
  // 2. TRAINER VS TRAINER
  console.log(`\n[2/4] Generating Trainer vs Trainer matchups...`);
  const trainerEligible = generateConnectionsByRole(allConnections, 'trainer', settings.trainerVsTrainer.minApps);
  const trainerResult = generateSingleTypeMatchups(
    trainerEligible,
    settings.trainerVsTrainer,
    usedPerType.trainer,
    false
  );
  
  results.push({
    type: 'trainer_vs_trainer',
    matchups: trainerResult.matchups,
    connectionsUsed: new Set(usedPerType.trainer),
    eligible: trainerEligible.length,
    attempts: trainerResult.attempts,
    avgSalaryDiff: trainerResult.avgSalaryDiff
  });
  
  // 3. SIRE VS SIRE
  console.log(`\n[3/4] Generating Sire vs Sire matchups...`);
  const sireEligible = generateConnectionsByRole(allConnections, 'sire', settings.sireVsSire.minApps);
  const sireResult = generateSingleTypeMatchups(
    sireEligible,
    settings.sireVsSire,
    usedPerType.sire,
    false
  );
  
  results.push({
    type: 'sire_vs_sire',
    matchups: sireResult.matchups,
    connectionsUsed: new Set(usedPerType.sire),
    eligible: sireEligible.length,
    attempts: sireResult.attempts,
    avgSalaryDiff: sireResult.avgSalaryDiff
  });
  
  // 4. MIXED (CROSS-ROLE)
  console.log(`\n[4/4] Generating Mixed matchups...`);
  const mixedResult = generateMixedMatchups(
    allConnections,
    settings.mixed,
    usedPerType.mixed
  );
  
  results.push({
    type: 'mixed',
    matchups: mixedResult.matchups,
    connectionsUsed: new Set(usedPerType.mixed),
    eligible: allConnections.filter(c => c.apps >= settings.mixed.minApps).length,
    attempts: mixedResult.attempts,
    avgSalaryDiff: mixedResult.avgSalaryDiff
  });
  
  const totalMatchups = results.reduce((sum, r) => sum + r.matchups.length, 0);
  
  // Generate summary
  let summary = `Per-Type Matchup Generation Summary:\n`;
  summary += `Total Connections: ${allConnections.length}\n`;
  summary += `Total Matchups Generated: ${totalMatchups}\n\n`;
  
  results.forEach(result => {
    summary += `${result.type.replace(/_/g, ' ').toUpperCase()}:\n`;
    summary += `  Eligible: ${result.eligible}\n`;
    summary += `  Generated: ${result.matchups.length}\n`;
    summary += `  Used: ${result.connectionsUsed.size}\n`;
    summary += `  Avg Salary Diff: $${Math.round(result.avgSalaryDiff)}\n\n`;
  });
  
  return { results, totalMatchups, summary };
}

// Export for easy testing
export { generateConnectionsByRole, hasDifferentRoles, checkHorseOverlap };
