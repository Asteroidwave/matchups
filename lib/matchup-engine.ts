/**
 * Matchup Engine
 * Generates balanced 1v1 and 1v1v1 matchups using MU and Sigma
 */

import { Connection, Matchup, SetSide } from '@/types';
import { getMuSigmaForOdds } from './data-loader';

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
 * Returns probability of each option winning (A, B, C)
 */
export function calculate1v1v1Probabilities(
  muA: number, sigmaA: number,
  muB: number, sigmaB: number,
  muC: number, sigmaC: number
): { pA: number; pB: number; pC: number } {
  // Monte Carlo simulation for 3-way comparison
  const simulations = 10000;
  let winsA = 0, winsB = 0, winsC = 0;

  for (let i = 0; i < simulations; i++) {
    // Generate random samples from each distribution
    const sampleA = muA + sigmaA * boxMullerRandom();
    const sampleB = muB + sigmaB * boxMullerRandom();
    const sampleC = muC + sigmaC * boxMullerRandom();

    if (sampleA > sampleB && sampleA > sampleC) {
      winsA++;
    } else if (sampleB > sampleA && sampleB > sampleC) {
      winsB++;
    } else {
      winsC++;
    }
  }

  return {
    pA: winsA / simulations,
    pB: winsB / simulations,
    pC: winsC / simulations,
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
    // Use connection's salary to estimate odds, or use a default
    const estimatedOdds = conn.avgSalary ? salaryToOdds(conn.avgSalary) : 10;
    const { mu, sigma } = getMuSigmaForOdds(estimatedOdds);
    
    totalMu += mu;
    // Variances add for independent random variables
    totalVariance += sigma * sigma;
  }

  return {
    mu: totalMu,
    sigma: Math.sqrt(totalVariance),
  };
}

/**
 * Estimate odds from salary (rough approximation)
 */
function salaryToOdds(salary: number): number {
  // Higher salary = lower odds (favorites)
  // This is a rough approximation based on typical DFS salary structures
  if (salary >= 10000) return 1.5;
  if (salary >= 9000) return 3;
  if (salary >= 8000) return 5;
  if (salary >= 7000) return 8;
  if (salary >= 6000) return 12;
  if (salary >= 5000) return 20;
  return 30;
}

/**
 * Generate balanced 1v1 matchups (targeting 50/50)
 */
export function generate1v1Matchups(
  connections: Connection[],
  tolerance: number = 0.1,  // Allow 40-60 range
  maxMatchups: number = 50
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  // Sort connections by their estimated MU for better pairing
  const sortedConnections = [...connections].sort((a, b) => {
    const muA = getMuSigmaForOdds(salaryToOdds(a.avgSalary || 7000)).mu;
    const muB = getMuSigmaForOdds(salaryToOdds(b.avgSalary || 7000)).mu;
    return muB - muA;
  });

  for (let i = 0; i < sortedConnections.length && matchups.length < maxMatchups; i++) {
    if (usedConnections.has(sortedConnections[i].id)) continue;

    const connA = sortedConnections[i];
    const statsA = calculateSetMuSigma([connA]);

    // Find best matching opponent
    let bestMatch: Connection | null = null;
    let bestProbDiff = Infinity;

    for (let j = i + 1; j < sortedConnections.length; j++) {
      if (usedConnections.has(sortedConnections[j].id)) continue;

      const connB = sortedConnections[j];
      const statsB = calculateSetMuSigma([connB]);

      const probA = calculateHeadToHeadProbability(
        statsA.mu, statsA.sigma,
        statsB.mu, statsB.sigma
      );

      const diff = Math.abs(probA - 0.5);
      if (diff < bestProbDiff && diff <= tolerance) {
        bestProbDiff = diff;
        bestMatch = connB;
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
          totalSalary: connA.avgSalary || 0,
          totalAvpaRace: connA.avpaRace || 0,
          mu: statsA.mu,
          sigma: statsA.sigma,
          winProbability: probA,
        },
        setB: {
          connections: [bestMatch],
          totalSalary: bestMatch.avgSalary || 0,
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
 * Generate balanced 1v1v1 matchups (targeting 33/33/33)
 */
export function generate1v1v1Matchups(
  connections: Connection[],
  tolerance: number = 0.1,  // Allow deviation from 33%
  maxMatchups: number = 20
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();

  // Sort by MU
  const sortedConnections = [...connections].sort((a, b) => {
    const muA = getMuSigmaForOdds(salaryToOdds(a.avgSalary || 7000)).mu;
    const muB = getMuSigmaForOdds(salaryToOdds(b.avgSalary || 7000)).mu;
    return muB - muA;
  });

  for (let i = 0; i < sortedConnections.length - 2 && matchups.length < maxMatchups; i++) {
    if (usedConnections.has(sortedConnections[i].id)) continue;

    const connA = sortedConnections[i];
    const statsA = calculateSetMuSigma([connA]);

    // Find best two matching opponents
    let bestMatchB: Connection | null = null;
    let bestMatchC: Connection | null = null;
    let bestMaxDiff = Infinity;

    for (let j = i + 1; j < sortedConnections.length - 1; j++) {
      if (usedConnections.has(sortedConnections[j].id)) continue;
      const connB = sortedConnections[j];
      const statsB = calculateSetMuSigma([connB]);

      for (let k = j + 1; k < sortedConnections.length; k++) {
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
        }
      }
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
          totalSalary: connA.avgSalary || 0,
          totalAvpaRace: connA.avpaRace || 0,
          mu: statsA.mu,
          sigma: statsA.sigma,
          winProbability: pA,
        },
        setB: {
          connections: [bestMatchB],
          totalSalary: bestMatchB.avgSalary || 0,
          totalAvpaRace: bestMatchB.avpaRace || 0,
          mu: statsB.mu,
          sigma: statsB.sigma,
          winProbability: pB,
        },
        setC: {
          connections: [bestMatchC],
          totalSalary: bestMatchC.avgSalary || 0,
          totalAvpaRace: bestMatchC.avpaRace || 0,
          mu: statsC.mu,
          sigma: statsC.sigma,
          winProbability: pC,
        },
        balance: Math.round((1 - bestMaxDiff * 3) * 100),
      };

      matchups.push(matchup);
    }
  }

  return matchups;
}

/**
 * Generate all matchups with a mix of 1v1 and 1v1v1
 */
export function generateAllMatchups(
  connections: Connection[],
  options: {
    max1v1?: number;
    max1v1v1?: number;
    tolerance?: number;
  } = {}
): { matchups1v1: Matchup[]; matchups1v1v1: Matchup[] } {
  const { max1v1 = 40, max1v1v1 = 15, tolerance = 0.15 } = options;

  // Split connections for different matchup types
  const shuffled = [...connections].sort(() => Math.random() - 0.5);
  const for1v1 = shuffled.slice(0, Math.floor(shuffled.length * 0.7));
  const for1v1v1 = shuffled.slice(Math.floor(shuffled.length * 0.3));

  const matchups1v1 = generate1v1Matchups(for1v1, tolerance, max1v1);
  const matchups1v1v1 = generate1v1v1Matchups(for1v1v1, tolerance, max1v1v1);

  return { matchups1v1, matchups1v1v1 };
}
