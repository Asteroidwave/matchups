import { Connection, Matchup, SetSide } from "@/types";

export interface MatchupGenerationOptions {
  count?: number;
  tolerance?: number;
  sizes?: number[];
  isMixed?: boolean;
}

/**
 * Check if connections are from different tracks
 */
function areFromDifferentTracks(connsA: Connection[], connsB: Connection[]): boolean {
  const tracksA = new Set<string>();
  const tracksB = new Set<string>();
  
  for (const conn of connsA) {
    conn.trackSet.forEach(track => tracksA.add(track));
  }
  
  for (const conn of connsB) {
    conn.trackSet.forEach(track => tracksB.add(track));
  }
  
  // Check if there's any overlap in tracks
  for (const track of tracksA) {
    if (tracksB.has(track)) {
      return false; // Same track found
    }
  }
  
  return tracksA.size > 0 && tracksB.size > 0; // Different tracks
}

/**
 * Check if sets have different roles (for same-track mixed matchups)
 */
function haveDifferentRoles(connsA: Connection[], connsB: Connection[]): boolean {
  const rolesA = new Set<string>();
  const rolesB = new Set<string>();
  
  for (const conn of connsA) {
    rolesA.add(conn.role);
  }
  
  for (const conn of connsB) {
    rolesB.add(conn.role);
  }
  
  // Check if there's any overlap in roles
  for (const role of rolesA) {
    if (rolesB.has(role)) {
      return false; // Same role found
    }
  }
  
  return true; // All different roles
}

/**
 * Check if two connection sets share any horses
 */
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
  
  // Check for intersection
  for (const horse of horsesA) {
    if (horsesB.has(horse)) {
      return true; // Overlap found
    }
  }
  
  return false; // No overlap
}

/**
 * Validate mixed matchup rules:
 * - If from different tracks: roles can be the same
 * - If from same track: must have different roles
 */
function isValidMixedMatchup(connsA: Connection[], connsB: Connection[]): boolean {
  // First check horse overlap (always required)
  if (checkHorseOverlap(connsA, connsB)) {
    return false;
  }
  
  const fromDifferentTracks = areFromDifferentTracks(connsA, connsB);
  
  if (fromDifferentTracks) {
    // Different tracks: roles can be the same, already valid
    return true;
  } else {
    // Same track: must have different roles
    return haveDifferentRoles(connsA, connsB);
  }
}

// Here are some changes
export function generateMatchups(
  pool: Connection[],
  options: MatchupGenerationOptions = {}
): Matchup[] {
  const {
    count = 10,
    tolerance = 500,
    sizes = [1, 2], // Only 1v1, 2v1, 1v2 (max 2 connections per side)
    isMixed = false,
  } = options;
  
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();
  const maxAttempts = 500;
  
  // Filter pool to only eligible connections (min apps threshold AND must have points)
  // This ensures every matchup has a clear winner (no 0-0 ties)
  const eligible = pool.filter(c => c.apps >= 2 && c.pointsSum > 0);
  
  if (eligible.length < 2) {
    console.warn("Not enough eligible connections for matchup generation");
    return matchups;
  }
  
  // Create a shuffled pool for more variety - mix popular and less popular connections
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  
  // Sort by popularity for reference, but we'll mix it up
  const sortedByPopularity = [...eligible].sort((a, b) => {
    const popA = (a.pointsSum / a.apps) * a.apps;
    const popB = (b.pointsSum / b.apps) * b.apps;
    if (Math.abs(popA - popB) > 0.1) return popB - popA;
    return b.apps - a.apps;
  });
  
  // For each matchup, try 1v1 first (80% chance), then 2v1 or 1v2 (20% chance)
  for (let i = 0; i < count; i++) {
    let matchup: Matchup | null = null;
    let attempts = 0;
    
    // Prefer 1v1 matchups
    const prefer1v1 = Math.random() < 0.8;
    
    while (!matchup && attempts < maxAttempts) {
      attempts++;
      
      let sizeA: number, sizeB: number;
      if (prefer1v1 && sizes.includes(1)) {
        // Prefer 1v1
        sizeA = 1;
        sizeB = 1;
      } else {
        // Allow 2v1 or 1v2, but cap at 2 connections per side
        sizeA = sizes[Math.floor(Math.random() * sizes.length)];
        sizeB = sizes[Math.floor(Math.random() * sizes.length)];
        // Ensure at least one side is 1 (no 2v2)
        if (sizeA === 2 && sizeB === 2) {
          if (Math.random() < 0.5) sizeA = 1;
          else sizeB = 1;
        }
      }
      
      // Mix up candidates: 50% chance to use shuffled (more variety), 50% popular
      const useVariety = Math.random() < 0.5;
      let available = useVariety ? shuffled.filter(c => 
        i < 5 ? !usedConnections.has(c.id) : true
      ) : sortedByPopularity.filter(c => 
        i < 5 ? !usedConnections.has(c.id) : true
      );
      
      if (available.length < sizeA + sizeB) {
        available = shuffled; // Allow reuse if needed
      }
      
      // Shuffle candidates for more variety even when using popular list
      const candidates = [...available].sort(() => Math.random() - 0.3);
      
      // Build Set A
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
      
      // Build Set B - find connections that balance salary
      const remaining = candidates.filter(c => !setAIds.has(c.id));
      
      if (sizeB === 1) {
        // Single connection - find closest match
        const bestMatch = remaining
          .map(c => ({ conn: c, diff: Math.abs(salaryA - c.salarySum) }))
          .sort((a, b) => a.diff - b.diff)[0];
        
        if (bestMatch && bestMatch.diff <= tolerance) {
          // Validate based on matchup type
          const isValid = isMixed 
            ? isValidMixedMatchup(setA, [bestMatch.conn])
            : !checkHorseOverlap(setA, [bestMatch.conn]);
          
          if (isValid) {
          const frozenSetA = setA.map(c => ({ ...c, starters: [...c.starters] }));
          const frozenSetB = [{ ...bestMatch.conn, starters: [...bestMatch.conn.starters] }];
          
          matchup = createMatchup(frozenSetA, frozenSetB, i);
          if (matchup) {
            [...setA, bestMatch.conn].forEach(c => {
              if (i < 5) usedConnections.add(c.id);
            });
            matchups.push(matchup);
            }
          }
        }
      } else {
        // Multiple connections - try greedy approach
        const setB: Connection[] = [];
        const setBIds = new Set<string>();
        let currentSalary = 0;
        
        // Try to get close to salaryA
        const sorted = remaining
          .map(c => ({ conn: c, diff: Math.abs(salaryA - c.salarySum) }))
          .sort((a, b) => a.diff - b.diff);
        
        for (const item of sorted) {
          if (setB.length < sizeB && !setBIds.has(item.conn.id)) {
            setB.push(item.conn);
            setBIds.add(item.conn.id);
            currentSalary += item.conn.salarySum;
          }
        }
        
        if (setB.length === sizeB && Math.abs(salaryA - currentSalary) <= tolerance) {
          // Validate based on matchup type
          const isValid = isMixed 
            ? isValidMixedMatchup(setA, setB)
            : !checkHorseOverlap(setA, setB);
          
          if (isValid) {
          const frozenSetA = setA.map(c => ({ ...c, starters: [...c.starters] }));
          const frozenSetB = setB.map(c => ({ ...c, starters: [...c.starters] }));
          
          matchup = createMatchup(frozenSetA, frozenSetB, i);
          if (matchup) {
            [...setA, ...setB].forEach(c => {
              if (i < 5) usedConnections.add(c.id);
            });
            matchups.push(matchup);
            }
          }
        }
      }
    }
    
    if (!matchup && attempts >= maxAttempts) {
      console.warn(`Failed to generate matchup ${i + 1} after ${maxAttempts} attempts`);
    }
  }
  
  return matchups;
}

function createMatchup(setA: Connection[], setB: Connection[], index: number): Matchup | null {
  const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
  const salaryB = setB.reduce((sum, c) => sum + c.salarySum, 0);
  
  return {
    id: `matchup-${Date.now()}-${index}`,
    setA: {
      connections: setA,
      salaryTotal: salaryA,
    },
    setB: {
      connections: setB,
      salaryTotal: salaryB,
    },
  };
}

