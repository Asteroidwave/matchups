/**
 * IMPROVED MATCHUP CALCULATION SYSTEM
 * Based on industry best practices from DraftKings, FanDuel, SuperDraft
 */

import { Connection, Matchup, SetSide } from "@/types";

interface AdvancedMatchupOptions {
  count?: number;
  salaryTolerance?: number;
  performanceTolerance?: number; // NEW: Performance balance tolerance
  contextualFactors?: {
    trackCondition?: 'fast' | 'muddy' | 'sloppy';
    weather?: 'clear' | 'rain' | 'wind';
    surfaceType?: 'dirt' | 'turf';
  };
  balancingWeights?: {
    salary: number;        // Weight for salary balance (0-1)
    performance: number;   // Weight for performance balance (0-1)  
    variance: number;      // Weight for outcome variance (0-1)
    recency: number;       // Weight for recent form (0-1)
  };
}

interface PerformanceMetrics {
  adjustedAVPA: number;      // Context-adjusted AVPA
  consistencyScore: number;   // Performance variance metric
  recentForm: number;        // Last 30-day performance trend
  venueAdjustment: number;   // Track/surface adjustment
  expectedPoints: number;    // Projected points based on conditions
}

/**
 * Calculate advanced performance metrics for a connection
 * This replaces simple pointsSum with sophisticated analytics
 */
function calculatePerformanceMetrics(
  connection: Connection, 
  contextualFactors?: AdvancedMatchupOptions['contextualFactors']
): PerformanceMetrics {
  const { starters } = connection;
  
  // Base AVPA calculation
  const baseAVPA = connection.salarySum > 0 ? (1000 * connection.pointsSum) / connection.salarySum : 0;
  
  // Recent form calculation (last 30 days weighted more heavily)
  const recentRaces = starters
    .filter(s => s.date && new Date(s.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  
  const recentForm = recentRaces.length > 0 
    ? recentRaces.reduce((sum, race, index) => {
        // Weight recent races more heavily (exponential decay)
        const weight = Math.exp(-index * 0.2);
        const raceAVPA = race.salary > 0 ? (1000 * race.points) / race.salary : 0;
        return sum + (raceAVPA * weight);
      }, 0) / recentRaces.reduce((sum, _, index) => sum + Math.exp(-index * 0.2), 0)
    : baseAVPA;

  // Consistency score (lower variance = more consistent)
  const avgPoints = connection.pointsSum / connection.apps;
  const variance = starters.reduce((sum, s) => sum + Math.pow(s.points - avgPoints, 2), 0) / connection.apps;
  const consistencyScore = 100 - Math.min(variance, 100); // 0-100 scale
  
  // Venue adjustment based on track conditions
  let venueAdjustment = 1.0;
  if (contextualFactors?.trackCondition === 'muddy') venueAdjustment *= 0.95; // Muddy tracks favor different styles
  if (contextualFactors?.weather === 'rain') venueAdjustment *= 0.92; // Rain affects performance
  if (contextualFactors?.surfaceType === 'turf') venueAdjustment *= 0.98; // Surface type matters
  
  // Context-adjusted AVPA
  const adjustedAVPA = baseAVPA * venueAdjustment * (1 + (recentForm - baseAVPA) / baseAVPA * 0.3);
  
  // Expected points projection
  const expectedPoints = (adjustedAVPA * connection.salarySum) / 1000;
  
  return {
    adjustedAVPA,
    consistencyScore,
    recentForm,
    venueAdjustment,
    expectedPoints
  };
}

/**
 * Advanced matchup balance scoring
 * Considers salary, performance, variance, and recency
 */
function calculateMatchupBalance(
  setA: Connection[], 
  setB: Connection[], 
  options: AdvancedMatchupOptions
): {
  score: number;
  salaryBalance: number;
  performanceBalance: number;
  varianceBalance: number;
  recencyBalance: number;
} {
  const weights = options.balancingWeights || {
    salary: 0.4,
    performance: 0.3,
    variance: 0.2,
    recency: 0.1
  };
  
  // Calculate metrics for both sets
  const metricsA = setA.map(c => calculatePerformanceMetrics(c, options.contextualFactors));
  const metricsB = setB.map(c => calculatePerformanceMetrics(c, options.contextualFactors));
  
  // Salary balance (traditional)
  const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
  const salaryB = setB.reduce((sum, c) => sum + c.salarySum, 0);
  const salaryDiff = Math.abs(salaryA - salaryB);
  const salaryBalance = Math.max(0, 1 - salaryDiff / Math.max(salaryA, salaryB));
  
  // Performance balance (expected points)
  const expectedPointsA = metricsA.reduce((sum, m) => sum + m.expectedPoints, 0);
  const expectedPointsB = metricsB.reduce((sum, m) => sum + m.expectedPoints, 0);
  const perfDiff = Math.abs(expectedPointsA - expectedPointsB);
  const performanceBalance = Math.max(0, 1 - perfDiff / Math.max(expectedPointsA, expectedPointsB));
  
  // Variance balance (consistency match)
  const avgConsistencyA = metricsA.reduce((sum, m) => sum + m.consistencyScore, 0) / metricsA.length;
  const avgConsistencyB = metricsB.reduce((sum, m) => sum + m.consistencyScore, 0) / metricsB.length;
  const consistencyDiff = Math.abs(avgConsistencyA - avgConsistencyB);
  const varianceBalance = Math.max(0, 1 - consistencyDiff / 100);
  
  // Recency balance (recent form match)
  const avgRecentA = metricsA.reduce((sum, m) => sum + m.recentForm, 0) / metricsA.length;
  const avgRecentB = metricsB.reduce((sum, m) => sum + m.recentForm, 0) / metricsB.length;
  const recentDiff = Math.abs(avgRecentA - avgRecentB);
  const maxRecent = Math.max(avgRecentA, avgRecentB);
  const recencyBalance = maxRecent > 0 ? Math.max(0, 1 - recentDiff / maxRecent) : 1;
  
  // Weighted composite score
  const score = 
    weights.salary * salaryBalance +
    weights.performance * performanceBalance +
    weights.variance * varianceBalance +
    weights.recency * recencyBalance;
  
  return {
    score,
    salaryBalance,
    performanceBalance,
    varianceBalance,
    recencyBalance
  };
}

/**
 * Strategic matchup generation using advanced analytics
 * Instead of random pairing, use performance-based clustering
 */
export function generateAdvancedMatchups(
  pool: Connection[],
  options: AdvancedMatchupOptions = {}
): Matchup[] {
  const {
    count = 10,
    salaryTolerance = 500,
    performanceTolerance = 0.2, // 20% performance difference tolerance
    balancingWeights = { salary: 0.4, performance: 0.3, variance: 0.2, recency: 0.1 }
  } = options;
  
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();
  
  // Filter eligible connections with enhanced criteria
  const eligible = pool.filter(c => {
    // Enhanced eligibility: minimum apps AND positive recent performance
    const metrics = calculatePerformanceMetrics(c, options.contextualFactors);
    return c.apps >= 3 && // Higher threshold
           c.pointsSum > 0 && 
           metrics.expectedPoints > 0 && // Must have positive expected value
           metrics.consistencyScore > 20; // Must have some consistency
  });
  
  if (eligible.length < 2) {
    console.warn("Not enough eligible connections for advanced matchup generation");
    return matchups;
  }
  
  // Performance clustering: group connections by similar performance levels
  const performanceTiers = clusterConnectionsByPerformance(eligible, options);
  
  // Generate matchups within and across tiers strategically
  for (let i = 0; i < count && matchups.length < count; i++) {
    const bestMatchup = findOptimalMatchup(performanceTiers, usedConnections, options);
    
    if (bestMatchup) {
      matchups.push(bestMatchup);
      // Mark connections as used
      [...bestMatchup.setA.connections, ...bestMatchup.setB.connections]
        .forEach(c => usedConnections.add(c.id));
    }
  }
  
  return matchups;
}

/**
 * Cluster connections by performance tiers for strategic matching
 */
function clusterConnectionsByPerformance(
  connections: Connection[], 
  options: AdvancedMatchupOptions
): Connection[][] {
  // Calculate performance scores and sort
  const withScores = connections.map(c => ({
    connection: c,
    metrics: calculatePerformanceMetrics(c, options.contextualFactors)
  })).sort((a, b) => b.metrics.adjustedAVPA - a.metrics.adjustedAVPA);
  
  // Create 4 performance tiers (top 25%, upper mid 25%, lower mid 25%, bottom 25%)
  const tierSize = Math.ceil(withScores.length / 4);
  const tiers: Connection[][] = [];
  
  for (let i = 0; i < 4; i++) {
    const start = i * tierSize;
    const end = Math.min(start + tierSize, withScores.length);
    tiers.push(withScores.slice(start, end).map(item => item.connection));
  }
  
  return tiers.filter(tier => tier.length > 0);
}

/**
 * Find optimal matchup using advanced balance scoring
 */
function findOptimalMatchup(
  performanceTiers: Connection[][],
  usedConnections: Set<string>,
  options: AdvancedMatchupOptions
): Matchup | null {
  let bestMatchup: Matchup | null = null;
  let bestScore = -1;
  
  const maxAttempts = 1000;
  let attempts = 0;
  
  while (attempts < maxAttempts && !bestMatchup) {
    attempts++;
    
    // Try different tier combinations for variety
    const tierStrategy = Math.random();
    let setATier: number, setBTier: number;
    
    if (tierStrategy < 0.4) {
      // Same tier matchup (40% chance) - most balanced
      const tier = Math.floor(Math.random() * performanceTiers.length);
      setATier = setBTier = tier;
    } else if (tierStrategy < 0.7) {
      // Adjacent tier matchup (30% chance) - slight edge
      const tier = Math.floor(Math.random() * (performanceTiers.length - 1));
      setATier = tier;
      setBTier = tier + 1;
    } else {
      // Cross-tier matchup (30% chance) - bigger edges but still balanced
      setATier = Math.floor(Math.random() * performanceTiers.length);
      setBTier = Math.floor(Math.random() * performanceTiers.length);
    }
    
    // Get available connections from selected tiers
    const availableA = performanceTiers[setATier]?.filter(c => !usedConnections.has(c.id)) || [];
    const availableB = performanceTiers[setBTier]?.filter(c => !usedConnections.has(c.id)) || [];
    
    if (availableA.length === 0 || availableB.length === 0) continue;
    
    // Select random connections from each tier
    const setA = [availableA[Math.floor(Math.random() * availableA.length)]];
    let setB = [availableB[Math.floor(Math.random() * availableB.length)]];
    
    // Ensure no overlap in connections
    if (setA[0].id === setB[0].id) continue;
    
    // Check for horse overlap (no shared horses)
    if (checkHorseOverlap(setA, setB)) continue;
    
    // Calculate balance score
    const balance = calculateMatchupBalance(setA, setB, options);
    
    // Accept if balance score is good enough and meets tolerances
    const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
    const salaryB = setB.reduce((sum, c) => sum + c.salarySum, 0);
    
    if (balance.score > 0.7 && // High balance score
        Math.abs(salaryA - salaryB) <= (options.salaryTolerance || 500) &&
        balance.performanceBalance > (1 - (options.performanceTolerance || 0.2))) {
      
      bestMatchup = {
        id: `advanced-matchup-${Date.now()}-${attempts}`,
        setA: {
          connections: setA,
          salaryTotal: salaryA,
        },
        setB: {
          connections: setB,
          salaryTotal: salaryB,
        },
        // Store balance metrics for debugging/analysis
        balanceMetrics: balance
      };
      bestScore = balance.score;
    }
  }
  
  return bestMatchup;
}

/**
 * Check if two connection sets share horses (existing function)
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
      return true;
    }
  }
  
  return false;
}

/**
 * ADVANCED WINNER DETERMINATION
 * Replaces simple points comparison with sophisticated analytics
 */
export function advancedMatchupWinner(
  matchup: Matchup, 
  chosen: "A" | "B",
  contextualFactors?: AdvancedMatchupOptions['contextualFactors']
): {
  won: boolean;
  chosenScore: number;
  opponentScore: number;
  confidence: number; // 0-1 confidence in the result
  breakdown: {
    rawPoints: { chosen: number; opponent: number };
    adjustedPoints: { chosen: number; opponent: number };
    consistencyFactor: number;
    contextualAdjustment: number;
  };
} {
  const setA = matchup.setA;
  const setB = matchup.setB;
  
  // Calculate advanced metrics for both sets
  const metricsA = setA.connections.map(c => calculatePerformanceMetrics(c, contextualFactors));
  const metricsB = setB.connections.map(c => calculatePerformanceMetrics(c, contextualFactors));
  
  // Raw points (traditional method)
  const rawPointsA = setA.connections.reduce((sum, c) => sum + c.pointsSum, 0);
  const rawPointsB = setB.connections.reduce((sum, c) => sum + c.pointsSum, 0);
  
  // Adjusted points (with context and consistency)
  const adjustedPointsA = metricsA.reduce((sum, m) => sum + m.expectedPoints, 0);
  const adjustedPointsB = metricsB.reduce((sum, m) => sum + m.expectedPoints, 0);
  
  // Consistency factors (more consistent performers get slight boost)
  const consistencyA = metricsA.reduce((sum, m) => sum + m.consistencyScore, 0) / metricsA.length;
  const consistencyB = metricsB.reduce((sum, m) => sum + m.consistencyScore, 0) / metricsB.length;
  const consistencyFactor = (consistencyA - consistencyB) / 100; // -1 to 1
  
  // Contextual adjustment (venue, weather, etc.)
  const contextualAdjustmentA = metricsA.reduce((sum, m) => sum + m.venueAdjustment, 0) / metricsA.length;
  const contextualAdjustmentB = metricsB.reduce((sum, m) => sum + m.venueAdjustment, 0) / metricsB.length;
  const contextualAdjustment = contextualAdjustmentA - contextualAdjustmentB;
  
  // Final scores with all adjustments
  const finalScoreA = adjustedPointsA * (1 + consistencyFactor * 0.1 + contextualAdjustment * 0.05);
  const finalScoreB = adjustedPointsB * (1 - consistencyFactor * 0.1 - contextualAdjustment * 0.05);
  
  const chosenScore = chosen === "A" ? finalScoreA : finalScoreB;
  const opponentScore = chosen === "A" ? finalScoreB : finalScoreA;
  
  const won = chosenScore > opponentScore;
  
  // Confidence calculation (higher score difference = higher confidence)
  const scoreDiff = Math.abs(chosenScore - opponentScore);
  const avgScore = (chosenScore + opponentScore) / 2;
  const confidence = Math.min(0.95, Math.max(0.55, scoreDiff / avgScore));
  
  return {
    won,
    chosenScore,
    opponentScore,
    confidence,
    breakdown: {
      rawPoints: { 
        chosen: chosen === "A" ? rawPointsA : rawPointsB,
        opponent: chosen === "A" ? rawPointsB : rawPointsA
      },
      adjustedPoints: {
        chosen: chosen === "A" ? adjustedPointsA : adjustedPointsB,
        opponent: chosen === "A" ? adjustedPointsB : adjustedPointsA
      },
      consistencyFactor,
      contextualAdjustment
    }
  };
}
