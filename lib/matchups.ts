import { Connection, Matchup, SetSide } from "@/types";

export interface MatchupGenerationOptions {
  count?: number;
  tolerance?: number;
  sizes?: number[];
}

export function generateMatchups(
  pool: Connection[],
  options: MatchupGenerationOptions = {}
): Matchup[] {
  const {
    count = 10,
    tolerance = 500,
    sizes = [1, 2, 3],
  } = options;
  
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();
  const maxAttempts = 500;
  
  // Filter pool to only eligible connections (min apps threshold)
  const eligible = pool.filter(c => c.apps >= 2);
  
  if (eligible.length < Math.max(...sizes) * 2) {
    console.warn("Not enough eligible connections for matchup generation");
    return matchups;
  }
  
  // Shuffle pool for randomness
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < count; i++) {
    let matchup: Matchup | null = null;
    let attempts = 0;
    
    while (!matchup && attempts < maxAttempts) {
      attempts++;
      
      const sizeA = sizes[Math.floor(Math.random() * sizes.length)];
      const sizeB = sizes[Math.floor(Math.random() * sizes.length)];
      
      // Get available connections (prefer unused for first few matchups)
      let available = shuffled.filter(c => 
        i < 5 ? !usedConnections.has(c.id) : true
      );
      
      if (available.length < sizeA + sizeB) {
        available = shuffled; // Allow reuse if needed
      }
      
      // Shuffle again
      const candidates = [...available].sort(() => Math.random() - 0.5);
      
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

