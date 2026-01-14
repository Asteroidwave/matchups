/**
 * Matchup Engine
 * Generates balanced matchups of various types:
 * - 1v1, 2v1, 1v2 (2-way matchups)
 * - 1v1v1, 2v1v1, 1v2v1, 1v1v2 (3-way matchups)
 * Uses MU (expected points) and Sigma (volatility) for balance
 */

import { Connection, Matchup, SetSide } from '@/types';

// Standard normal distribution CDF approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate probability that Set A beats Set B in a head-to-head matchup
 * Using the difference of normal distributions
 */
export function calculateHeadToHeadProbability(
  muA: number,
  sigmaA: number,
  muB: number,
  sigmaB: number
): number {
  // The difference X = A - B follows N(muA - muB, sqrt(sigmaA^2 + sigmaB^2))
  const muDiff = muA - muB;
  const sigmaDiff = Math.sqrt(sigmaA * sigmaA + sigmaB * sigmaB);

  if (sigmaDiff === 0) {
    return muDiff > 0 ? 1 : muDiff < 0 ? 0 : 0.5;
  }

  // P(A > B) = P(X > 0) = 1 - CDF(0)
  const z = -muDiff / sigmaDiff;
  return 1 - normalCDF(z);
}

/**
 * Calculate probabilities for a 1v1v1 matchup
 * Uses a simplified analytical approximation instead of expensive Monte Carlo
 */
export function calculate1v1v1Probabilities(
  muA: number, sigmaA: number,
  muB: number, sigmaB: number,
  muC: number, sigmaC: number
): { pA: number; pB: number; pC: number } {
  // Use pairwise probabilities as an approximation (much faster than Monte Carlo)
  // This is an approximation but good enough for our purposes
  const pAvsB = calculateHeadToHeadProbability(muA, sigmaA, muB, sigmaB);
  const pAvsC = calculateHeadToHeadProbability(muA, sigmaA, muC, sigmaC);
  const pBvsC = calculateHeadToHeadProbability(muB, sigmaB, muC, sigmaC);
  
  // Approximate 3-way probabilities using pairwise results
  // P(A wins) ≈ P(A>B) * P(A>C) adjusted for overlap
  const rawA = pAvsB * pAvsC;
  const rawB = (1 - pAvsB) * pBvsC;
  const rawC = (1 - pAvsC) * (1 - pBvsC);
  
  // Normalize to sum to 1
  const total = rawA + rawB + rawC;
  
  return {
    pA: rawA / total,
    pB: rawB / total,
    pC: rawC / total,
  };
}

// Box-Muller transform for generating normal random numbers
let spare: number | null = null;
function boxMullerRandom(): number {
  if (spare !== null) {
    const temp = spare;
    spare = null;
    return temp;
  }

  let u, v, s;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);

  const mul = Math.sqrt(-2.0 * Math.log(s) / s);
  spare = v * mul;
  return u * mul;
}

/**
 * Calculate combined MU and Sigma for a set of connections
 */
export function calculateSetMuSigma(connections: Connection[]): { mu: number; sigma: number } {
  if (connections.length === 0) {
    return { mu: 0, sigma: 0 };
  }

  // Sum the MU values
  let totalMu = 0;
  let totalVariance = 0;

  for (const conn of connections) {
    // Use connection's mu/sigma if available, otherwise estimate from salary/odds
    if (conn.mu !== undefined && conn.sigma !== undefined) {
      totalMu += conn.mu;
      totalVariance += conn.sigma * conn.sigma;
    } else {
      // Fallback: estimate from AVPA and apps
      const estimatedMu = (conn.avpa30d || conn.avpaRace || 8) * (conn.apps || 1);
      const estimatedSigma = estimatedMu * 0.5; // 50% volatility
      
      totalMu += estimatedMu;
      totalVariance += estimatedSigma * estimatedSigma;
    }
  }

  return {
    mu: totalMu,
    sigma: Math.sqrt(totalVariance),
  };
}

/**
 * Get connection MU for sorting
 */
function getConnectionMu(conn: Connection): number {
  if (conn.mu !== undefined) return conn.mu;
  return (conn.avpa30d || conn.avpaRace || 8) * (conn.apps || 1);
}

/**
 * Calculate a combined score for matchup quality
 * Considers both probability balance AND salary balance
 */
function calculateMatchQuality(
  probDiff: number,      // Distance from 0.5 (for 2-way) or 0.333 (for 3-way)
  salaryDiff: number,    // Absolute salary difference
  maxSalary: number      // For normalization
): number {
  // Normalize salary difference to 0-1 range
  const normalizedSalaryDiff = salaryDiff / Math.max(maxSalary, 1);
  
  // Weight: 60% probability balance, 40% salary balance
  // Lower score = better match
  return probDiff * 0.6 + normalizedSalaryDiff * 0.4;
}

/**
 * Generate balanced 1v1 matchups (targeting 50/50 with similar salaries)
 */
export function generate1v1Matchups(
  connections: Connection[],
  tolerance: number = 0.15,  // Allow 35-65 range for probability
  maxMatchups: number = 50,
  maxSalaryDiff: number = 2000  // Max salary difference allowed
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  // Sort connections by salary for better pairing (similar salaries grouped together)
  const sortedConnections = [...connections].sort((a, b) => {
    return (b.salarySum || 0) - (a.salarySum || 0);
  });

  const maxSalary = Math.max(...sortedConnections.map(c => c.salarySum || 0));
  const searchLimit = Math.min(sortedConnections.length, 100);

  for (let i = 0; i < searchLimit && matchups.length < maxMatchups; i++) {
    if (usedConnections.has(sortedConnections[i].id)) continue;

    const connA = sortedConnections[i];
    const statsA = calculateSetMuSigma([connA]);
    const salaryA = connA.salarySum || 0;

    let bestMatch: Connection | null = null;
    let bestQuality = Infinity;
    
    const searchEnd = Math.min(searchLimit, i + 40);

    for (let j = i + 1; j < searchEnd; j++) {
      if (usedConnections.has(sortedConnections[j].id)) continue;

      const connB = sortedConnections[j];
      const salaryB = connB.salarySum || 0;
      const salaryDiff = Math.abs(salaryA - salaryB);
      
      // Skip if salary difference is too large
      if (salaryDiff > maxSalaryDiff) continue;

      const statsB = calculateSetMuSigma([connB]);
      const probA = calculateHeadToHeadProbability(
        statsA.mu, statsA.sigma,
        statsB.mu, statsB.sigma
      );

      const probDiff = Math.abs(probA - 0.5);
      if (probDiff > tolerance) continue;

      const quality = calculateMatchQuality(probDiff, salaryDiff, maxSalary);
      
      if (quality < bestQuality) {
        bestQuality = quality;
        bestMatch = connB;
        // Early exit if we found an excellent match
        if (probDiff < 0.05 && salaryDiff < 500) break;
      }
    }

    if (bestMatch) {
      usedConnections.add(connA.id);
      usedConnections.add(bestMatch.id);

      const statsB = calculateSetMuSigma([bestMatch]);
      const probA = calculateHeadToHeadProbability(
        statsA.mu, statsA.sigma,
        statsB.mu, statsB.sigma
      );

      const matchup: Matchup = {
        id: `1v1-${matchups.length + 1}`,
        type: '1v1',
        setA: {
          connections: [connA],
          salaryTotal: connA.salarySum || 0,
          totalSalary: connA.salarySum || 0,
          totalAvpaRace: connA.avpaRace || 0,
          mu: statsA.mu,
          sigma: statsA.sigma,
          winProbability: probA,
        },
        setB: {
          connections: [bestMatch],
          salaryTotal: bestMatch.salarySum || 0,
          totalSalary: bestMatch.salarySum || 0,
          totalAvpaRace: bestMatch.avpaRace || 0,
          mu: statsB.mu,
          sigma: statsB.sigma,
          winProbability: 1 - probA,
        },
        balance: Math.round((1 - Math.abs(probA - 0.5) * 2) * 100),
      };

      matchups.push(matchup);
    }
  }

  return matchups;
}

/**
 * Generate balanced 2v1 matchups (2 connections vs 1 connection, targeting 50/50)
 * Optimized with limited search range
 */
export function generate2v1Matchups(
  connections: Connection[],
  tolerance: number = 0.15,
  maxMatchups: number = 10
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  const sortedConnections = [...connections].sort((a, b) => {
    return getConnectionMu(b) - getConnectionMu(a);
  });

  // Limit search for performance
  const searchLimit = Math.min(sortedConnections.length, 40);

  // Pick the strongest connection for set A (single)
  for (let i = 0; i < searchLimit && matchups.length < maxMatchups; i++) {
    if (usedConnections.has(sortedConnections[i].id)) continue;

    const connA = sortedConnections[i];
    const statsA = calculateSetMuSigma([connA]);

    // Find best pair for set B - limited search range
    let bestPair: [Connection, Connection] | null = null;
    let bestProbDiff = Infinity;
    
    const jEnd = Math.min(searchLimit - 1, i + 15);

    for (let j = i + 1; j < jEnd; j++) {
      if (usedConnections.has(sortedConnections[j].id)) continue;
      
      const kEnd = Math.min(searchLimit, j + 10);
      
      for (let k = j + 1; k < kEnd; k++) {
        if (usedConnections.has(sortedConnections[k].id)) continue;

        const connB1 = sortedConnections[j];
        const connB2 = sortedConnections[k];
        const statsB = calculateSetMuSigma([connB1, connB2]);

        const probA = calculateHeadToHeadProbability(
          statsA.mu, statsA.sigma,
          statsB.mu, statsB.sigma
        );

        const diff = Math.abs(probA - 0.5);
        if (diff < bestProbDiff && diff <= tolerance) {
          bestProbDiff = diff;
          bestPair = [connB1, connB2];
          // Early exit if good enough
          if (diff < 0.05) break;
        }
      }
      if (bestProbDiff < 0.05) break;
    }

    if (bestPair) {
      usedConnections.add(connA.id);
      usedConnections.add(bestPair[0].id);
      usedConnections.add(bestPair[1].id);

      const statsB = calculateSetMuSigma(bestPair);
      const probA = calculateHeadToHeadProbability(
        statsA.mu, statsA.sigma,
        statsB.mu, statsB.sigma
      );

      const matchup: Matchup = {
        id: `1v2-${matchups.length + 1}`,
        type: '1v2',
        setA: {
          connections: [connA],
          salaryTotal: connA.salarySum || 0,
          totalSalary: connA.salarySum || 0,
          totalAvpaRace: connA.avpaRace || 0,
          mu: statsA.mu,
          sigma: statsA.sigma,
          winProbability: probA,
        },
        setB: {
          connections: bestPair,
          salaryTotal: bestPair.reduce((sum, c) => sum + (c.salarySum || 0), 0),
          totalSalary: bestPair.reduce((sum, c) => sum + (c.salarySum || 0), 0),
          totalAvpaRace: bestPair.reduce((sum, c) => sum + (c.avpaRace || 0), 0),
          mu: statsB.mu,
          sigma: statsB.sigma,
          winProbability: 1 - probA,
        },
        balance: Math.round((1 - Math.abs(probA - 0.5) * 2) * 100),
      };

      matchups.push(matchup);
    }
  }

  return matchups;
}

/**
 * Generate balanced 1v1v1 matchups (targeting 33/33/33 with similar salaries)
 * Optimized to limit search space for performance
 */
export function generate1v1v1Matchups(
  connections: Connection[],
  tolerance: number = 0.2,  // Allow deviation from 33%
  maxMatchups: number = 20,
  maxSalaryDiff: number = 2500  // Max salary spread across all 3 sets
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  // Sort by salary for better grouping
  const sortedConnections = [...connections].sort((a, b) => {
    return (b.salarySum || 0) - (a.salarySum || 0);
  });

  const maxSalary = Math.max(...sortedConnections.map(c => c.salarySum || 0));
  const searchLimit = Math.min(sortedConnections.length, 60);

  for (let i = 0; i < searchLimit - 2 && matchups.length < maxMatchups; i++) {
    if (usedConnections.has(sortedConnections[i].id)) continue;

    const connA = sortedConnections[i];
    const statsA = calculateSetMuSigma([connA]);
    const salaryA = connA.salarySum || 0;

    let bestMatchB: Connection | null = null;
    let bestMatchC: Connection | null = null;
    let bestQuality = Infinity;
    
    const jEnd = Math.min(searchLimit - 1, i + 25);

    for (let j = i + 1; j < jEnd; j++) {
      if (usedConnections.has(sortedConnections[j].id)) continue;
      const connB = sortedConnections[j];
      const salaryB = connB.salarySum || 0;
      
      // Quick check: if A and B already too far apart, skip
      if (Math.abs(salaryA - salaryB) > maxSalaryDiff) continue;
      
      const statsB = calculateSetMuSigma([connB]);
      const kEnd = Math.min(searchLimit, j + 20);

      for (let k = j + 1; k < kEnd; k++) {
        if (usedConnections.has(sortedConnections[k].id)) continue;
        const connC = sortedConnections[k];
        const salaryC = connC.salarySum || 0;
        
        // Check salary spread across all 3
        const salarySpread = Math.max(salaryA, salaryB, salaryC) - Math.min(salaryA, salaryB, salaryC);
        if (salarySpread > maxSalaryDiff) continue;
        
        const statsC = calculateSetMuSigma([connC]);

        const { pA, pB, pC } = calculate1v1v1Probabilities(
          statsA.mu, statsA.sigma,
          statsB.mu, statsB.sigma,
          statsC.mu, statsC.sigma
        );

        const maxDiff = Math.max(
          Math.abs(pA - 0.333),
          Math.abs(pB - 0.333),
          Math.abs(pC - 0.333)
        );

        if (maxDiff > tolerance) continue;

        // Calculate quality score (lower is better)
        const quality = maxDiff * 0.6 + (salarySpread / maxSalary) * 0.4;

        if (quality < bestQuality) {
          bestQuality = quality;
          bestMatchB = connB;
          bestMatchC = connC;
          // Early exit if excellent match
          if (maxDiff < 0.08 && salarySpread < 1000) break;
        }
      }
      if (bestQuality < 0.15) break;
    }

    if (bestMatchB && bestMatchC) {
      usedConnections.add(connA.id);
      usedConnections.add(bestMatchB.id);
      usedConnections.add(bestMatchC.id);

      const statsB = calculateSetMuSigma([bestMatchB]);
      const statsC = calculateSetMuSigma([bestMatchC]);
      const { pA, pB, pC } = calculate1v1v1Probabilities(
        statsA.mu, statsA.sigma,
        statsB.mu, statsB.sigma,
        statsC.mu, statsC.sigma
      );

      const matchup: Matchup = {
        id: `1v1v1-${matchups.length + 1}`,
        type: '1v1v1',
        setA: {
          connections: [connA],
          salaryTotal: connA.salarySum || 0,
          totalSalary: connA.salarySum || 0,
          totalAvpaRace: connA.avpaRace || 0,
          mu: statsA.mu,
          sigma: statsA.sigma,
          winProbability: pA,
        },
        setB: {
          connections: [bestMatchB],
          salaryTotal: bestMatchB.salarySum || 0,
          totalSalary: bestMatchB.salarySum || 0,
          totalAvpaRace: bestMatchB.avpaRace || 0,
          mu: statsB.mu,
          sigma: statsB.sigma,
          winProbability: pB,
        },
        setC: {
          connections: [bestMatchC],
          salaryTotal: bestMatchC.salarySum || 0,
          totalSalary: bestMatchC.salarySum || 0,
          totalAvpaRace: bestMatchC.avpaRace || 0,
          mu: statsC.mu,
          sigma: statsC.sigma,
          winProbability: pC,
        },
        balance: Math.round((1 - Math.max(Math.abs(pA - 0.333), Math.abs(pB - 0.333), Math.abs(pC - 0.333)) * 3) * 100),
      };

      matchups.push(matchup);
    }
  }

  return matchups;
}

/**
 * Generate 2v1v1 matchups (2 connections vs 1 vs 1, targeting 33/33/33)
 * Heavily optimized - only generate a few due to O(n^4) complexity
 */
export function generate2v1v1Matchups(
  connections: Connection[],
  tolerance: number = 0.20,
  maxMatchups: number = 3
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  const sortedConnections = [...connections].sort((a, b) => {
    return getConnectionMu(b) - getConnectionMu(a);
  });

  // Very limited search for performance
  const searchLimit = Math.min(sortedConnections.length, 25);

  for (let i = 0; i < Math.min(10, searchLimit - 3) && matchups.length < maxMatchups; i++) {
    if (usedConnections.has(sortedConnections[i].id)) continue;

    // Only check nearby second member for set A
    for (let i2 = i + 1; i2 < Math.min(i + 5, searchLimit - 2); i2++) {
      if (usedConnections.has(sortedConnections[i2].id)) continue;

      const setAConns = [sortedConnections[i], sortedConnections[i2]];
      const statsA = calculateSetMuSigma(setAConns);

      let bestMatchB: Connection | null = null;
      let bestMatchC: Connection | null = null;
      let bestMaxDiff = Infinity;

      // Limited search for B and C
      for (let j = i2 + 1; j < Math.min(i2 + 8, searchLimit - 1); j++) {
        if (usedConnections.has(sortedConnections[j].id)) continue;
        const connB = sortedConnections[j];
        const statsB = calculateSetMuSigma([connB]);

        for (let k = j + 1; k < Math.min(j + 6, searchLimit); k++) {
          if (usedConnections.has(sortedConnections[k].id)) continue;
          const connC = sortedConnections[k];
          const statsC = calculateSetMuSigma([connC]);

          const { pA, pB, pC } = calculate1v1v1Probabilities(
            statsA.mu, statsA.sigma,
            statsB.mu, statsB.sigma,
            statsC.mu, statsC.sigma
          );

          const maxDiff = Math.max(
            Math.abs(pA - 0.333),
            Math.abs(pB - 0.333),
            Math.abs(pC - 0.333)
          );

          if (maxDiff < bestMaxDiff && maxDiff <= tolerance) {
            bestMaxDiff = maxDiff;
            bestMatchB = connB;
            bestMatchC = connC;
            if (maxDiff < 0.1) break;
          }
        }
        if (bestMaxDiff < 0.1) break;
      }

      if (bestMatchB && bestMatchC) {
        setAConns.forEach(c => usedConnections.add(c.id));
        usedConnections.add(bestMatchB.id);
        usedConnections.add(bestMatchC.id);

        const statsB = calculateSetMuSigma([bestMatchB]);
        const statsC = calculateSetMuSigma([bestMatchC]);
        const { pA, pB, pC } = calculate1v1v1Probabilities(
          statsA.mu, statsA.sigma,
          statsB.mu, statsB.sigma,
          statsC.mu, statsC.sigma
        );

        const matchup: Matchup = {
          id: `2v1v1-${matchups.length + 1}`,
          type: '2v1v1',
          setA: {
            connections: setAConns,
            salaryTotal: setAConns.reduce((sum, c) => sum + (c.salarySum || 0), 0),
            totalSalary: setAConns.reduce((sum, c) => sum + (c.salarySum || 0), 0),
            totalAvpaRace: setAConns.reduce((sum, c) => sum + (c.avpaRace || 0), 0),
            mu: statsA.mu,
            sigma: statsA.sigma,
            winProbability: pA,
          },
          setB: {
            connections: [bestMatchB],
            salaryTotal: bestMatchB.salarySum || 0,
            totalSalary: bestMatchB.salarySum || 0,
            totalAvpaRace: bestMatchB.avpaRace || 0,
            mu: statsB.mu,
            sigma: statsB.sigma,
            winProbability: pB,
          },
          setC: {
            connections: [bestMatchC],
            salaryTotal: bestMatchC.salarySum || 0,
            totalSalary: bestMatchC.salarySum || 0,
            totalAvpaRace: bestMatchC.avpaRace || 0,
            mu: statsC.mu,
            sigma: statsC.sigma,
            winProbability: pC,
          },
          balance: Math.round((1 - bestMaxDiff * 3) * 100),
        };

        matchups.push(matchup);
        break; // Move to next i
      }
    }
  }

  return matchups;
}

/**
 * Generate all matchups with a mix of types
 * Targets 20 matchups total with a good mix of 2-way and 3-way matchups
 * Each connection can only appear ONCE across all matchups served
 */
export function generateAllMatchups(
  connections: Connection[],
  options: {
    max1v1?: number;
    max2v1?: number;
    max1v1v1?: number;
    max2v1v1?: number;
    tolerance?: number;
    totalTarget?: number;
  } = {}
): { 
  matchups1v1: Matchup[]; 
  matchups2v1: Matchup[];
  matchups1v1v1: Matchup[];
  matchups2v1v1: Matchup[];
  all: Matchup[];
} {
  const { 
    max1v1 = 12, 
    max2v1 = 4,
    max1v1v1 = 8,
    max2v1v1 = 3,
    tolerance = 0.35,  // More permissive to allow 3-way matchups
    totalTarget = 24 
  } = options;

  // Shuffle connections for variety each time
  const shuffled = [...connections].sort(() => Math.random() - 0.5);
  
  // Track ALL used connections globally to ensure each appears only ONCE
  const globalUsedConnections = new Set<string>();
  
  // Generate 3-way matchups first (they're more interesting and harder to fill)
  const remaining3Way = shuffled.filter(c => !globalUsedConnections.has(c.id));
  const matchups1v1v1 = generate1v1v1Matchups(remaining3Way, tolerance, max1v1v1);
  
  // Mark all 3-way connections as used
  matchups1v1v1.forEach(m => {
    m.setA.connections.forEach(c => globalUsedConnections.add(c.id));
    m.setB.connections.forEach(c => globalUsedConnections.add(c.id));
    m.setC?.connections.forEach(c => globalUsedConnections.add(c.id));
  });
  
  // Generate 2v1v1 matchups
  const remaining2v1v1 = shuffled.filter(c => !globalUsedConnections.has(c.id));
  const matchups2v1v1 = generate2v1v1Matchups(remaining2v1v1, tolerance, max2v1v1);
  
  // Mark used
  matchups2v1v1.forEach(m => {
    m.setA.connections.forEach(c => globalUsedConnections.add(c.id));
    m.setB.connections.forEach(c => globalUsedConnections.add(c.id));
    m.setC?.connections.forEach(c => globalUsedConnections.add(c.id));
  });
  
  // Generate 1v1 matchups with remaining connections
  const remaining1v1 = shuffled.filter(c => !globalUsedConnections.has(c.id));
  const matchups1v1 = generate1v1Matchups(remaining1v1, tolerance, max1v1);
  
  // Mark used
  matchups1v1.forEach(m => {
    m.setA.connections.forEach(c => globalUsedConnections.add(c.id));
    m.setB.connections.forEach(c => globalUsedConnections.add(c.id));
  });
  
  // Generate 2v1 matchups with remaining connections
  const remaining2v1 = shuffled.filter(c => !globalUsedConnections.has(c.id));
  const matchups2v1 = generate2v1Matchups(remaining2v1, tolerance, max2v1);

  // Combine all matchups - mix them up for variety
  const all3Way = [...matchups1v1v1, ...matchups2v1v1];
  const all2Way = [...matchups1v1, ...matchups2v1];
  
  // Interleave 3-way and 2-way matchups for better user experience
  const combined: Matchup[] = [];
  let idx2 = 0, idx3 = 0;
  
  while (combined.length < totalTarget && (idx2 < all2Way.length || idx3 < all3Way.length)) {
    // Add 3-way matchup
    if (idx3 < all3Way.length) {
      combined.push(all3Way[idx3++]);
    }
    // Add 2-way matchup
    if (idx2 < all2Way.length && combined.length < totalTarget) {
      combined.push(all2Way[idx2++]);
    }
  }
  
  // If we still need more matchups, add remaining
  while (combined.length < totalTarget && idx2 < all2Way.length) {
    combined.push(all2Way[idx2++]);
  }
  while (combined.length < totalTarget && idx3 < all3Way.length) {
    combined.push(all3Way[idx3++]);
  }

  return { matchups1v1, matchups2v1, matchups1v1v1, matchups2v1v1, all: combined };
}

/**
 * Get matchup type label
 */
export function getMatchupTypeLabel(matchup: Matchup): string {
  const aCount = matchup.setA.connections.length;
  const bCount = matchup.setB.connections.length;
  const cCount = matchup.setC?.connections.length || 0;
  
  if (cCount > 0) {
    return `${aCount}v${bCount}v${cCount}`;
  }
  return `${aCount}v${bCount}`;
}
