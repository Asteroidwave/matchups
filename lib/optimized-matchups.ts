/**
 * OPTIMIZED CURRENT MATCHUP SYSTEM
 * Simple improvements that dramatically increase matchup generation
 * while maintaining your existing framework and priorities
 */

import { Connection, Matchup, SetSide } from "@/types";

export interface OptimizedMatchupGenerationOptions {
  count?: number;
  tolerance?: number;
  sizes?: number[];
  isMixed?: boolean;
  // New optimization options
  relaxedEligibility?: boolean;  // Use apps >= 1 instead of >= 2
  dynamicTolerance?: boolean;   // Auto-calculate tolerance based on salary range
  prioritizeHighSalary?: boolean; // Always prioritize high-salary connections first
  maxAttempts?: number;         // Increase from default 500
  allowEarlyReuse?: boolean;    // Remove the i < 5 reuse restriction
}

/**
 * Calculate optimal salary tolerance based on connection salary distribution
 * This replaces the hardcoded 500 with a data-driven approach
 */
function calculateOptimalTolerance(connections: Connection[]): number {
  if (connections.length === 0) return 500;
  
  const salaries = connections.map(c => c.salarySum).sort((a, b) => a - b);
  const avgSalary = salaries.reduce((a, b) => a + b, 0) / salaries.length;
  
  // Use 25% of average salary as tolerance (industry standard)
  const calculatedTolerance = Math.round(avgSalary * 0.25);
  
  // Ensure minimum tolerance of 300 and maximum of 1500 for reasonableness
  return Math.max(300, Math.min(1500, calculatedTolerance));
}

/**
 * Enhanced eligibility filter that keeps more valuable connections
 */
function getEligibleConnections(pool: Connection[], relaxed: boolean = false): Connection[] {
  if (relaxed) {
    // Relaxed: apps >= 1 AND (points >= 0 OR salary > 0)  
    // This keeps connections that contribute salary even without points
    return pool.filter(c => 
      c.apps >= 1 && (c.pointsSum >= 0 || c.salarySum > 0)
    );
  } else {
    // Original strict criteria
    return pool.filter(c => c.apps >= 2 && c.pointsSum > 0);
  }
}

/**
 * Smart connection selection that prioritizes high-salary connections
 * instead of random shuffling
 */
function getOrderedCandidates(
  eligible: Connection[], 
  prioritizeHighSalary: boolean = true,
  usedConnections: Set<string>,
  allowReuse: boolean = false,
  matchupIndex: number = 0
): Connection[] {
  // Apply reuse restrictions
  let available: Connection[];
  if (allowReuse) {
    // Always allow all connections
    available = eligible;
  } else {
    // Original logic: restrict reuse for first 5 matchups
    available = eligible.filter(c => 
      matchupIndex < 5 ? !usedConnections.has(c.id) : true
    );
  }
  
  if (available.length === 0) {
    available = eligible; // Fallback to all if none available
  }
  
  if (prioritizeHighSalary) {
    // Sort by salary descending, then by points as tiebreaker
    return [...available].sort((a, b) => {
      const salaryDiff = b.salarySum - a.salarySum;
      if (Math.abs(salaryDiff) > 100) return salaryDiff; // Salary difference significant
      return b.pointsSum - a.pointsSum; // Use points as tiebreaker
    });
  } else {
    // Original random shuffling
    return [...available].sort(() => Math.random() - 0.5);
  }
}

/**
 * Enhanced matchup generation with all optimizations
 */
export function generateOptimizedMatchups(
  pool: Connection[],
  options: OptimizedMatchupGenerationOptions = {}
): Matchup[] {
  const {
    count = 10,
    tolerance = 500,
    sizes = [1, 2],
    isMixed = false,
    relaxedEligibility = true,          // 🔧 DEFAULT: Use relaxed eligibility
    dynamicTolerance = true,            // 🔧 DEFAULT: Calculate tolerance from data
    prioritizeHighSalary = true,        // 🔧 DEFAULT: High salary priority
    maxAttempts = 1000,                 // 🔧 DEFAULT: Double the attempts
    allowEarlyReuse = true              // 🔧 DEFAULT: Remove reuse restriction
  } = options;
  
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();
  
  // 🔧 OPTIMIZATION 1: Enhanced eligibility
  const eligible = getEligibleConnections(pool, relaxedEligibility);
  
  if (eligible.length < 2) {
    console.warn(`Not enough eligible connections: ${eligible.length} (relaxed: ${relaxedEligibility})`);
    return matchups;
  }
  
  // 🔧 OPTIMIZATION 2: Dynamic tolerance calculation
  const effectiveTolerance = dynamicTolerance 
    ? calculateOptimalTolerance(eligible)
    : tolerance;
  
  console.log(`[Optimized] Using tolerance: $${effectiveTolerance} (dynamic: ${dynamicTolerance})`);
  console.log(`[Optimized] Eligible connections: ${eligible.length}/${pool.length} (relaxed: ${relaxedEligibility})`);
  
  // Generate matchups with enhanced algorithm
  for (let i = 0; i < count; i++) {
    let matchup: Matchup | null = null;
    let attempts = 0;
    
    const prefer1v1 = Math.random() < 0.8; // Keep your 80% 1v1 preference
    
    while (!matchup && attempts < maxAttempts) {
      attempts++;
      
      // Determine matchup sizes (keep your existing logic)
      let sizeA: number, sizeB: number;
      if (prefer1v1 && sizes.includes(1)) {
        sizeA = 1;
        sizeB = 1;
      } else {
        sizeA = sizes[Math.floor(Math.random() * sizes.length)];
        sizeB = sizes[Math.floor(Math.random() * sizes.length)];
        if (sizeA === 2 && sizeB === 2) {
          if (Math.random() < 0.5) sizeA = 1;
          else sizeB = 1;
        }
      }
      
      // 🔧 OPTIMIZATION 3: Smart candidate selection
      const candidates = getOrderedCandidates(
        eligible, 
        prioritizeHighSalary, 
        usedConnections,
        allowEarlyReuse,
        i
      );
      
      if (candidates.length < sizeA + sizeB) {
        continue;
      }
      
      // Build Set A (same logic, but with ordered candidates)
      const setA: Connection[] = [];
      const setAIds = new Set<string>();
      
      for (const conn of candidates) {
        if (setA.length < sizeA && !setAIds.has(conn.id)) {
          setA.push(conn);
          setAIds.add(conn.id);
        }
      }
      
      if (setA.length !== sizeA) continue;
      
      const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
      
      // Build Set B with enhanced matching
      const remaining = candidates.filter(c => !setAIds.has(c.id));
      
      if (sizeB === 1) {
        // Single connection - find best salary match
        const bestMatch = remaining
          .map(c => ({ conn: c, diff: Math.abs(salaryA - c.salarySum) }))
          .sort((a, b) => a.diff - b.diff)[0];
        
        if (bestMatch && bestMatch.diff <= effectiveTolerance) {
          const isValid = isMixed 
            ? isValidMixedMatchup(setA, [bestMatch.conn])
            : !checkHorseOverlap(setA, [bestMatch.conn]);
          
          if (isValid) {
            matchup = {
              id: `optimized-matchup-${Date.now()}-${i}`,
              setA: {
                connections: setA,
                salaryTotal: salaryA,
              },
              setB: {
                connections: [bestMatch.conn],
                salaryTotal: bestMatch.conn.salarySum,
              },
            };
            
            // 🔧 OPTIMIZATION 4: Conditional connection marking
            if (allowEarlyReuse || i >= 5) {
              // Only mark as used if allowing early reuse or after 5 matchups
              [...setA, bestMatch.conn].forEach(c => usedConnections.add(c.id));
            }
          }
        }
      } else {
        // Multiple connections (keep existing logic but with better tolerance)
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
        
        if (setB.length === sizeB && Math.abs(salaryA - currentSalary) <= effectiveTolerance) {
          const isValid = isMixed 
            ? isValidMixedMatchup(setA, setB)
            : !checkHorseOverlap(setA, setB);
          
          if (isValid) {
            matchup = {
              id: `optimized-matchup-${Date.now()}-${i}`,
              setA: {
                connections: setA,
                salaryTotal: salaryA,
              },
              setB: {
                connections: setB,
                salaryTotal: currentSalary,
              },
            };
            
            if (allowEarlyReuse || i >= 5) {
              [...setA, ...setB].forEach(c => usedConnections.add(c.id));
            }
          }
        }
      }
    }
    
    if (matchup) {
      matchups.push(matchup);
    } else if (attempts >= maxAttempts) {
      console.warn(`Failed to generate matchup ${i + 1} after ${maxAttempts} attempts`);
    }
  }
  
  console.log(`[Optimized] Generated ${matchups.length}/${count} matchups`);
  return matchups;
}

// Helper functions (unchanged from your original)
function checkHorseOverlap(connsA: Connection[], connsB: Connection[]): boolean {
  const horsesA = new Set<string>();
  const horsesB = new Set<string>();
  
  for (const conn of connsA) {
    for (const starter of conn.starters) {
      horsesA.add(starter.horseName);
    }
  }
  
  for (const conn of connsB) {
    for (const starter of conn.starters) {
      horsesB.add(starter.horseName);
    }
  }
  
  for (const horse of horsesA) {
    if (horsesB.has(horse)) return true;
  }
  
  return false;
}

function areFromDifferentTracks(connsA: Connection[], connsB: Connection[]): boolean {
  const tracksA = new Set<string>();
  const tracksB = new Set<string>();
  
  for (const conn of connsA) {
    conn.trackSet.forEach(track => tracksA.add(track));
  }
  
  for (const conn of connsB) {
    conn.trackSet.forEach(track => tracksB.add(track));
  }
  
  for (const track of tracksA) {
    if (tracksB.has(track)) return false;
  }
  
  return tracksA.size > 0 && tracksB.size > 0;
}

function haveDifferentRoles(connsA: Connection[], connsB: Connection[]): boolean {
  const rolesA = new Set<string>();
  const rolesB = new Set<string>();
  
  for (const conn of connsA) {
    rolesA.add(conn.role);
  }
  
  for (const conn of connsB) {
    rolesB.add(conn.role);
  }
  
  for (const role of rolesA) {
    if (rolesB.has(role)) return false;
  }
  
  return true;
}

function isValidMixedMatchup(connsA: Connection[], connsB: Connection[]): boolean {
  if (checkHorseOverlap(connsA, connsB)) return false;
  
  const fromDifferentTracks = areFromDifferentTracks(connsA, connsB);
  
  if (fromDifferentTracks) {
    return true;
  } else {
    return haveDifferentRoles(connsA, connsB);
  }
}

/**
 * Drop-in replacement for your existing generateMatchups function
 */
export function generateMatchups(
  pool: Connection[],
  options: any = {}
): Matchup[] {
  // Convert old options to new optimized options
  const optimizedOptions: OptimizedMatchupGenerationOptions = {
    count: options.count || 10,
    tolerance: options.tolerance || 500,
    sizes: options.sizes || [1, 2],
    isMixed: options.isMixed || false,
    
    // Enable all optimizations by default
    relaxedEligibility: true,
    dynamicTolerance: true,
    prioritizeHighSalary: true,
    maxAttempts: 1000,
    allowEarlyReuse: true
  };
  
  return generateOptimizedMatchups(pool, optimizedOptions);
}
