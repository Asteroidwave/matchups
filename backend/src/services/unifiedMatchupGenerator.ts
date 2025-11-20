/**
 * Unified Matchup Generator (TypeScript)
 * Based on unified_matchup_generator.py
 * 
 * Implements the same hybrid approach:
 * - Exhaustive search for 1v1 matchups (checks all pairs)
 * - Optimized random sampling for complex patterns (2v1, 1v2, etc.)
 * - Horse overlap checking
 * - Minimum appearances threshold
 */

import { Connection, Matchup, SetSide } from '../types/backend';

export interface UnifiedMatchupSettings {
  num_matchups: number;
  salary_tolerance: number;
  appearance_tolerance: number | null; // null = no limit
  patterns: Array<[number, number]>; // Array of [Set A count, Set B count] tuples
  min_appearances: number;
  min_salary: number;
  apply_min_appearances: boolean;
  // Quality thresholds (configurable)
  quality_threshold_1v1?: number; // Default: 50
  quality_threshold_2v1?: number; // Default: 45
  quality_threshold_1v2?: number; // Default: 45
  quality_threshold_cross_track?: number; // Default: 60
  quality_threshold_elite_tier?: number; // Default: 70
}

export interface ConnectionHorseMap {
  [connectionId: string]: Set<string>; // connection ID -> set of horse names
}

/**
 * Default settings matching unified_matchup_generator.py
 */
export const DEFAULT_UNIFIED_SETTINGS: Record<string, UnifiedMatchupSettings> = {
  jockey_vs_jockey: {
    num_matchups: 30, // Increased from 5 for pre-generation strategy
    salary_tolerance: 1000,
    appearance_tolerance: null,
    patterns: [[1, 1], [2, 1], [1, 2]], // Focus on 1v1, 1v2, 2v1 (jockeys ride multiple horses)
    min_appearances: 2, // Relaxed from 3 to 2 for better matchup availability
    min_salary: 1000,
    apply_min_appearances: true,
    // Quality thresholds (configurable - can be fine-tuned based on real data)
    quality_threshold_1v1: 50,
    quality_threshold_2v1: 45,
    quality_threshold_1v2: 45,
    quality_threshold_cross_track: 60,
    quality_threshold_elite_tier: 70,
  },
  trainer_vs_trainer: {
    num_matchups: 30, // Increased from 8 for pre-generation strategy
    salary_tolerance: 1000,
    appearance_tolerance: null,
    patterns: [[1, 1], [2, 1], [1, 2]], // Similar to jockeys but lower average appearances
    min_appearances: 2, // Keep at 2 for balanced matchups
    min_salary: 1000,
    apply_min_appearances: true,
    quality_threshold_1v1: 50,
    quality_threshold_2v1: 45,
    quality_threshold_1v2: 45,
    quality_threshold_cross_track: 60,
    quality_threshold_elite_tier: 70,
  },
  sire_vs_sire: {
    num_matchups: 30, // Increased from 10 for pre-generation strategy
    salary_tolerance: 1000,
    appearance_tolerance: null,
    patterns: [[1, 2], [1, 1]], // Only 1v1 and 1v2 - no 2v2 allowed per user requirement
    min_appearances: 1, // Most sires have just 1 appearance
    min_salary: 1000,
    apply_min_appearances: true,
    quality_threshold_1v1: 50,
    quality_threshold_2v1: 45, // Not used but kept for consistency
    quality_threshold_1v2: 45,
    quality_threshold_cross_track: 60,
    quality_threshold_elite_tier: 70,
  },
  mixed: {
    num_matchups: 50, // Increased from 60 to 50 (still plenty, but more focused)
    salary_tolerance: 1000,
    appearance_tolerance: null,
    patterns: [[1, 1], [2, 1], [1, 2]],
    min_appearances: 1,
    min_salary: 1000,
    apply_min_appearances: true,
    quality_threshold_1v1: 50,
    quality_threshold_2v1: 45,
    quality_threshold_1v2: 45,
    quality_threshold_cross_track: 60,
    quality_threshold_elite_tier: 70,
  },
  // NEW: Cross-track matchups (different tracks, any role)
  cross_track: {
    num_matchups: 40,
    salary_tolerance: 1000,
    appearance_tolerance: null,
    patterns: [[1, 1], [2, 1], [1, 2]],
    min_appearances: 2, // Need decent sample size for cross-track comparison
    min_salary: 1000,
    apply_min_appearances: true,
    quality_threshold_1v1: 60, // Higher for cross-track
    quality_threshold_2v1: 55, // Higher for cross-track
    quality_threshold_1v2: 55, // Higher for cross-track
    quality_threshold_cross_track: 60,
    quality_threshold_elite_tier: 70,
  },
};

/**
 * Build horse map for connections (for overlap checking)
 */
export function buildConnectionHorseMap(connections: Connection[]): ConnectionHorseMap {
  const horseMap: ConnectionHorseMap = {};
  
  for (const conn of connections) {
    const horseSet = new Set<string>();
    for (const starter of conn.starters) {
      horseSet.add(starter.horseName);
    }
    horseMap[conn.id] = horseSet;
  }
  
  return horseMap;
}

/**
 * Check if two connection sets share any horses
 */
function checkHorseOverlap(
  connsA: Connection[],
  connsB: Connection[],
  horseMap: ConnectionHorseMap
): boolean {
  const horsesA = new Set<string>();
  const horsesB = new Set<string>();
  
  for (const conn of connsA) {
    const horses = horseMap[conn.id] || new Set<string>();
    horses.forEach(h => horsesA.add(h));
  }
  
  for (const conn of connsB) {
    const horses = horseMap[conn.id] || new Set<string>();
    horses.forEach(h => horsesB.add(h));
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
 * Validate mixed matchup rules:
 * - If from different tracks: roles can be the same
 * - If from same track: must have different roles
 */
function isValidMixedMatchup(
  connsA: Connection[],
  connsB: Connection[],
  horseMap: ConnectionHorseMap
): boolean {
  // First check horse overlap (always required)
  if (checkHorseOverlap(connsA, connsB, horseMap)) {
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

/**
 * Validate cross-track matchup rules:
 * - MUST be from different tracks (no track overlap)
 * - Roles can be the same or different
 * - No horse overlap (always)
 */
function isValidCrossTrackMatchup(
  connsA: Connection[],
  connsB: Connection[],
  horseMap: ConnectionHorseMap
): boolean {
  // First check horse overlap (always required)
  if (checkHorseOverlap(connsA, connsB, horseMap)) {
    return false;
  }
  
  // MUST be from different tracks
  const fromDifferentTracks = areFromDifferentTracks(connsA, connsB);
  
  return fromDifferentTracks; // Only valid if from different tracks
}

/**
 * Generate matchups using unified generator logic (exhaustive for 1v1, optimized for complex)
 * 
 * @param connections - Pool of connections to generate matchups from
 * @param settings - Matchup generation settings (tolerance, patterns, etc.)
 * @param horseMap - Map of connection IDs to horse names (for overlap checking)
 * @param isMixed - Whether this is a mixed matchup type (roles can differ)
 * @param isCrossTrack - Whether this is a cross-track matchup (must be different tracks)
 * @param excludedConnectionIds - Set of connection IDs to exclude from generation (per-type exclusion, only excludes within same matchup type)
 * @returns Array of generated matchups
 */
export function generateUnifiedMatchups(
  connections: Connection[],
  settings: UnifiedMatchupSettings,
  horseMap: ConnectionHorseMap,
  isMixed: boolean = false,
  isCrossTrack: boolean = false,
  excludedConnectionIds: Set<string> = new Set()
): Matchup[] {
  const {
    num_matchups,
    salary_tolerance,
    appearance_tolerance,
    patterns,
    min_appearances,
    min_salary,
    apply_min_appearances,
  } = settings;
  
  // VALIDATE PATTERNS: Only allow [1,1], [2,1], or [1,2] - no 2v2 or larger
  const validPatterns = patterns.filter(p => {
    const [a, b] = p;
    // Allow: [1,1], [2,1], [1,2]
    // Reject: [2,2], [3,2], [2,3], or any with both > 1
    return (a === 1 && b === 1) || (a === 2 && b === 1) || (a === 1 && b === 2);
  });
  
  if (validPatterns.length === 0) {
    console.warn('[UnifiedMatchup] No valid patterns after filtering - defaulting to [1,1]');
    validPatterns.push([1, 1]);
  }
  
  if (validPatterns.length !== patterns.length) {
    const removed = patterns.length - validPatterns.length;
    console.warn(`[UnifiedMatchup] Removed ${removed} invalid pattern(s) - only [1,1], [2,1], [1,2] allowed`);
  }
  
  // First filter by minimum salary
  const salaryEligible = connections.filter(c => (c.salarySum || 0) >= (min_salary ?? 0));
  
  if (salaryEligible.length < 2) {
    console.warn('Not enough connections meeting minimum salary requirement for matchup generation');
    return [];
  }
  
  // Optionally filter by minimum appearances
  const eligibleBeforeExclusion = apply_min_appearances
    ? salaryEligible.filter(c => c.apps >= min_appearances)
    : salaryEligible;
  
  // Apply per-type exclusion: filter out connections that have already been used in this matchup type
  // Note: This only excludes within the same type; connections can still appear in different matchup types
  const eligible = eligibleBeforeExclusion.filter(c => !excludedConnectionIds.has(c.id));
  
  if (eligible.length !== eligibleBeforeExclusion.length) {
    const excludedCount = eligibleBeforeExclusion.length - eligible.length;
    console.log(`[UnifiedMatchup] Excluded ${excludedCount} connections due to per-type exclusion (${excludedConnectionIds.size} total excluded within this type)`);
  }
  
  if (eligible.length < 2) {
    console.warn('Not enough eligible connections after applying minimum appearances filter');
    return [];
  }
  
  // Sort by salary descending (like Python code)
  const sorted = [...eligible].sort((a, b) => b.salarySum - a.salarySum);
  
    // TIERED APPROACH: Divide connections into salary tiers for better distribution
    // This ensures high-salary connections appear in matchups
    // QUALITY TUNING: Uses weighted tier distribution (top 20%, next 25%, next 25%, bottom 30%)
    const tiers = createSalaryTiers(sorted, 4); // Create 4 tiers
    console.log(`[UnifiedMatchup] Created ${tiers.length} salary tiers (weighted distribution):`, 
      tiers.map((t, i) => `Tier ${i+1}: ${t.connections.length} connections, avg salary $${Math.round(t.avgSalary)}, range $${t.minSalary}-${t.maxSalary}`)
    );
    
    // QUALITY TUNING: Log tier statistics for monitoring
    const tierStats = tiers.map((t, i) => ({
      tier: i + 1,
      count: t.connections.length,
      avgSalary: Math.round(t.avgSalary),
      avgApps: Math.round(t.connections.reduce((sum, c) => sum + c.apps, 0) / t.connections.length),
      minSalary: t.minSalary,
      maxSalary: t.maxSalary
    }));
    console.log(`[UnifiedMatchup] Tier quality metrics:`, JSON.stringify(tierStats, null, 2));
  
  // Use validated patterns
  const usePatterns = validPatterns;
  
  // Check if we have 1v1 patterns
  const has1v1 = usePatterns.some(p => p[0] === 1 && p[1] === 1);
  const hasComplex = usePatterns.some(p => !(p[0] === 1 && p[1] === 1));
  
  const matchups: Matchup[] = [];
  let matchupId = 1;
  const usedConnections = new Set<string>();
  const qualityScores: number[] = []; // Track quality scores for all matchups
  
  // HYBRID MODE: Exhaustive search for 1v1 matchups
  if (has1v1) {
    const matchingSets: ScoredMatchup[] = [];
    
    // Calculate max salary for quality scoring
    const maxSalary = sorted.length > 0 ? sorted[0].salarySum : 0;
    
    // Generate matchups from each tier to ensure distribution
    for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
      const tier = tiers[tierIdx];
      const tierConns = tier.connections;
      
      // Exhaustive search within tier and adjacent tiers for better matching
      for (let i = 0; i < tierConns.length; i++) {
        for (let j = i + 1; j < tierConns.length; j++) {
          const connA = tierConns[i];
          const connB = tierConns[j];
        
        const salaryDiff = Math.abs(connA.salarySum - connB.salarySum);
        
        if (salaryDiff > salary_tolerance) {
          continue;
        }
        
        // Check appearance tolerance
        if (appearance_tolerance !== null) {
          const appDiff = Math.abs(connA.apps - connB.apps);
          if (appDiff > appearance_tolerance) {
            continue;
          }
        }
        
        // Check validation based on matchup type
        if (isCrossTrack) {
          // Use cross-track validation rules (MUST be different tracks)
          if (!isValidCrossTrackMatchup([connA], [connB], horseMap)) {
            continue;
          }
        } else if (isMixed) {
          // Use mixed matchup validation rules
          if (!isValidMixedMatchup([connA], [connB], horseMap)) {
            continue;
          }
        } else {
          // Regular horse overlap check for non-mixed
        if (checkHorseOverlap([connA], [connB], horseMap)) {
          continue;
          }
        }
        
        // Calculate quality score
        const qualityScore = calculateQualityScore(
          connA,
          connB,
          salaryDiff,
          salary_tolerance,
          tiers,
          maxSalary
        );
        
        // Check quality threshold - skip low-quality matchups
        const qualityThreshold = getQualityThreshold('1v1', isCrossTrack, tierIdx, settings);
        if (qualityScore.total < qualityThreshold) {
          continue; // Skip this matchup - not good enough quality
        }
        
        // Ensure Pick_A has higher or equal salary
        let pickA: Connection, pickB: Connection;
        if (connA.salarySum >= connB.salarySum) {
          pickA = connA;
          pickB = connB;
        } else {
          pickA = connB;
          pickB = connA;
        }
        
        // Ensure no tie (add 0.01 to break ties)
        let pointsA = pickA.pointsSum;
        let pointsB = pickB.pointsSum;
        if (Math.abs(pointsA - pointsB) < 0.1 || (pointsA === 0 && pointsB === 0)) {
          if (pickA.salarySum >= pickB.salarySum) {
            pointsA += 0.01;
          } else {
            pointsB += 0.01;
          }
        }
        
        matchingSets.push({
          setA: [pickA],
          setB: [pickB],
          salaryDiff,
          tier: tierIdx,
          qualityScore,
        });
        }
      }
    }
    
    // Sort by quality score (prioritize quality over quantity):
    // 1. Quality score (higher is better - PRIMARY)
    // 2. Tier (distribute across tiers)
    // 3. Salary difference (lower is better)
    // 4. Total salary (higher is better - more interesting)
    matchingSets.sort((a, b) => {
      // Primary: Quality score (higher is better)
      const qualityDiff = b.qualityScore.total - a.qualityScore.total;
      if (Math.abs(qualityDiff) > 1) return qualityDiff; // Significant quality difference
      
      // Secondary: Distribute across tiers (higher tiers first for visibility)
      if (a.tier !== b.tier) {
        return a.tier - b.tier; // Lower tier number = higher salary
      }
      
      // Tertiary: salary difference (lower is better)
      const salaryDiffScore = a.salaryDiff - b.salaryDiff;
      if (Math.abs(salaryDiffScore) > 100) return salaryDiffScore;
      
      // Quaternary: prefer higher total salary (more interesting matchups)
      const totalSalaryA = a.setA[0].salarySum + a.setB[0].salarySum;
      const totalSalaryB = b.setA[0].salarySum + b.setB[0].salarySum;
      return totalSalaryB - totalSalaryA;
    });
    
    // Calculate quality statistics
    const qualityStats = {
      total: matchingSets.length,
      avgQuality: matchingSets.length > 0
        ? matchingSets.reduce((sum, m) => sum + m.qualityScore.total, 0) / matchingSets.length
        : 0,
      minQuality: matchingSets.length > 0
        ? Math.min(...matchingSets.map(m => m.qualityScore.total))
        : 0,
      maxQuality: matchingSets.length > 0
        ? Math.max(...matchingSets.map(m => m.qualityScore.total))
        : 0,
    };
    
    console.log(`[UnifiedMatchup] Found ${matchingSets.length} valid 1v1 pairs within tolerance ${salary_tolerance} (quality: avg=${qualityStats.avgQuality.toFixed(1)}, min=${qualityStats.minQuality.toFixed(1)}, max=${qualityStats.maxQuality.toFixed(1)})`);
    
    // Calculate how many 1v1 matchups to include
    // CHANGED: Ensure 85-90% are 1v1 matchups for better user experience
    const num1v1Patterns = usePatterns.filter(p => p[0] === 1 && p[1] === 1).length;
    if (num1v1Patterns > 0) {
      // Target 87.5% 1v1 matchups (middle of 85-90% range)
      const num1v1Needed = Math.floor(num_matchups * 0.875);
      const selected1v1 = matchingSets.slice(0, Math.min(num1v1Needed, matchingSets.length));
      
      if (matchingSets.length < num1v1Needed) {
        console.warn(`[UnifiedMatchup] Only found ${matchingSets.length} valid 1v1 pairs, but need ${num1v1Needed}. Using all available.`);
      }
      
      // CRITICAL FIX: Filter out pairs that share connections with already-selected matchups
      // This ensures per-type exclusion - a connection can only appear in ONE matchup per type
      const filtered1v1: typeof selected1v1 = [];
      const selectedConnectionIds = new Set<string>();
      
      for (const match of selected1v1) {
        const connAId = match.setA[0].id;
        const connBId = match.setB[0].id;
        
        // Skip if either connection is already used in a previously selected matchup
        if (selectedConnectionIds.has(connAId) || selectedConnectionIds.has(connBId)) {
          continue;
        }
        
        // Add this matchup and mark connections as used
        filtered1v1.push(match);
        selectedConnectionIds.add(connAId);
        selectedConnectionIds.add(connBId);
      }
      
      // Use filtered list instead of original
      for (const match of filtered1v1) {
        // Generate a unique, permanent ID for this matchup using crypto.randomUUID()
        // This ensures IDs are globally unique and persistent
        const uniqueId = crypto.randomUUID();
        
        const matchup: Matchup = {
          id: uniqueId,
          setA: {
            connections: match.setA,
            totalSalary: match.setA.reduce((sum, c) => sum + c.salarySum, 0),
            totalPoints: match.setA.reduce((sum, c) => sum + c.pointsSum, 0),
          },
          setB: {
            connections: match.setB,
            totalSalary: match.setB.reduce((sum, c) => sum + c.salarySum, 0),
            totalPoints: match.setB.reduce((sum, c) => sum + c.pointsSum, 0),
          },
        };
        matchups.push(matchup);
        qualityScores.push(match.qualityScore.total);
        // Mark connections as used for complex pattern generation
        usedConnections.add(match.setA[0].id);
        usedConnections.add(match.setB[0].id);
      }
      
      if (filtered1v1.length < selected1v1.length) {
        const removed = selected1v1.length - filtered1v1.length;
        console.log(`[UnifiedMatchup] Filtered out ${removed} duplicate matchups to enforce per-type exclusion`);
      }
      
      if (qualityScores.length > 0) {
        const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
        const minQuality = Math.min(...qualityScores);
        const maxQuality = Math.max(...qualityScores);
        console.log(`[UnifiedMatchup] Selected ${filtered1v1.length} 1v1 matchups (quality: avg=${avgQuality.toFixed(1)}, min=${minQuality.toFixed(1)}, max=${maxQuality.toFixed(1)})`);
      }
    }
  }
  
  // Generate complex pattern matchups using optimized random sampling
  if (hasComplex) {
    let patternIdx = 0;
    const available = sorted.filter(c => !usedConnections.has(c.id));
    let attempts = 0;
    // OPTIMIZED: Reduced from 2000 to 500 per matchup for faster generation
    // Still generates high-quality matchups but completes much faster
    const maxAttempts = num_matchups * 500;
    
    const remainingNeeded = num_matchups - matchups.length;
    console.log(`[UnifiedMatchup] Generating ${remainingNeeded} complex pattern matchups from ${available.length} available connections`);
    
    // Create tiers from available connections for better distribution
    const availableTiers = createSalaryTiers(available, 4);
    
    // Store candidate matchups and score them with quality scores
    const candidateMatchups: Array<{
      matchup: Matchup;
      score: number; // Legacy score (kept for sorting)
      salaryDiff: number;
      tier: number;
      qualityScore: QualityScore; // New quality score
      matchupType: '2v1' | '1v2';
    }> = [];
    
    // OPTIMIZED: Early exit when we have enough candidates (2x needed for quality selection)
    const targetCandidates = Math.max(remainingNeeded * 2, 20);
    
    while (candidateMatchups.length < targetCandidates && attempts < maxAttempts && available.length > 0) {
      attempts++;
      
      // Progress indicator every 10k attempts
      if (attempts % 10000 === 0) {
        console.log(`[UnifiedMatchup] Progress: ${attempts}/${maxAttempts} attempts, ${candidateMatchups.length} candidates found`);
      }
      
      // Get pattern (skip 1v1 patterns)
      let pattern: [number, number];
      while (true) {
        pattern = usePatterns[patternIdx % usePatterns.length];
        patternIdx++;
        if (!(pattern[0] === 1 && pattern[1] === 1)) {
          break;
        }
      }
      
      const [sizeA, sizeB] = pattern;
      
      if (available.length < sizeA + sizeB) {
        break;
      }
      
      let foundMatch = false;
      
      // Try multiple random combinations from different tiers
      // Rotate through tiers to ensure distribution
      const currentTierIdx = attempts % availableTiers.length;
      const currentTier = availableTiers[currentTierIdx];
      
      if (!currentTier || currentTier.connections.length < sizeA + sizeB) {
        continue;
      }
      
      // OPTIMIZED: Reduced trials from 20 to 10 for faster generation
      const numTrials = Math.min(10, Math.floor(currentTier.connections.length / 3));
      
      for (let trial = 0; trial < numTrials && !foundMatch; trial++) {
        // Random seed for reproducibility
        const seed = (attempts * 100 + trial) % 1000;
        const rng = seedRandom(seed);
        
        // Select Set A from current tier
        const shuffledA = [...currentTier.connections].sort(() => rng() - 0.5);
        const setA: Connection[] = [];
        const setAIds = new Set<string>();
        
        for (const conn of shuffledA) {
          if (setA.length < sizeA && !setAIds.has(conn.id)) {
            setA.push(conn);
            setAIds.add(conn.id);
          }
        }
        
        if (setA.length !== sizeA) continue;
        
        const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
        const pointsA = setA.reduce((sum, c) => sum + c.pointsSum, 0);
        const appsA = setA.reduce((sum, c) => sum + c.apps, 0);
        
        // Select Set B from remaining in current tier
        const remaining = currentTier.connections.filter(c => !setAIds.has(c.id));
        if (remaining.length < sizeB) continue;
        
        // OPTIMIZED: Reduced from 50 to 20 trials for Set B
        const numBTrials = Math.min(20, remaining.length);
        
        for (let bTrial = 0; bTrial < numBTrials && !foundMatch; bTrial++) {
          const shuffledB = [...remaining].sort(() => rng() - 0.5);
          const setB: Connection[] = [];
          const setBIds = new Set<string>();
          
          for (const conn of shuffledB) {
            if (setB.length < sizeB && !setBIds.has(conn.id)) {
              setB.push(conn);
              setBIds.add(conn.id);
            }
          }
          
          if (setB.length !== sizeB) continue;
          
          const salaryB = setB.reduce((sum, c) => sum + c.salarySum, 0);
          const salaryDiff = Math.abs(salaryA - salaryB);
          
          if (salaryDiff > salary_tolerance) {
            continue;
          }
          
          // Check appearance tolerance
          if (appearance_tolerance !== null) {
            const appsB = setB.reduce((sum, c) => sum + c.apps, 0);
            const appDiff = Math.abs(appsA - appsB);
            if (appDiff > appearance_tolerance) {
              continue;
            }
          }
          
          // Check validation based on matchup type
          if (isCrossTrack) {
            // Use cross-track validation rules (MUST be different tracks)
            if (!isValidCrossTrackMatchup(setA, setB, horseMap)) {
              continue;
            }
          } else if (isMixed) {
            // Use mixed matchup validation rules
            if (!isValidMixedMatchup(setA, setB, horseMap)) {
              continue;
            }
          } else {
            // Regular horse overlap check for non-mixed
          if (checkHorseOverlap(setA, setB, horseMap)) {
            continue;
            }
          }
          
          const pointsB = setB.reduce((sum, c) => sum + c.pointsSum, 0);
          
          // Ensure no tie
          let finalPointsA = pointsA;
          let finalPointsB = pointsB;
          if (Math.abs(pointsA - pointsB) < 0.1 || (pointsA === 0 && pointsB === 0)) {
            if (salaryA >= salaryB) {
              finalPointsA += 0.01;
            } else {
              finalPointsB += 0.01;
            }
          }
          
          // Determine matchup type
          const matchupType: '2v1' | '1v2' = sizeA === 2 && sizeB === 1 ? '2v1' : '1v2';
          
          // Calculate quality score using new quality scoring system
          const qualityScore = calculateQualityScoreForComplex(
            setA,
            setB,
            salaryDiff,
            salary_tolerance,
            availableTiers,
            matchupType
          );
          
          // Check quality threshold - skip low-quality matchups
          const qualityThreshold = getQualityThreshold(matchupType, isCrossTrack, currentTierIdx, settings);
          if (qualityScore.total < qualityThreshold) {
            continue; // Skip this matchup - not good enough quality
          }
          
          // Legacy score calculation (kept for backward compatibility in sorting)
          const totalSalary = salaryA + salaryB;
          const totalApps = setA.reduce((sum, c) => sum + c.apps, 0) + setB.reduce((sum, c) => sum + c.apps, 0);
          const pointsDiff = Math.abs(finalPointsA - finalPointsB);
          
          // Score components (all normalized to 0-1000):
          const salaryDiffScore = 1000 - Math.min(salaryDiff, 1000);
          const totalSalaryScore = Math.min(totalSalary / 150, 1000);
          const totalAppsScore = Math.min(totalApps / 10, 1000);
          const competitivenessScore = 1000 - Math.min(pointsDiff * 10, 1000);
          
          // Legacy score (now secondary to quality score)
          const score = 
            salaryDiffScore * 0.35 +
            totalSalaryScore * 0.35 +
            totalAppsScore * 0.15 +
            competitivenessScore * 0.15;
          
          // Create matchup with unique UUID
          const uniqueId = crypto.randomUUID();
          
          const matchup: Matchup = {
            id: uniqueId,
            setA: {
              connections: setA,
              totalSalary: salaryA,
              totalPoints: finalPointsA,
            },
            setB: {
              connections: setB,
              totalSalary: salaryB,
              totalPoints: finalPointsB,
            },
          };
          
          candidateMatchups.push({ 
            matchup, 
            score, 
            salaryDiff, 
            tier: currentTierIdx,
            qualityScore,
            matchupType
          });
          
          // Track quality score
          qualityScores.push(qualityScore.total);
          setA.forEach(c => usedConnections.add(c.id));
          setB.forEach(c => usedConnections.add(c.id));
          foundMatch = true;
          break;
        }
      }
    }
    
    // Sort candidates by quality score first (prioritize quality), then tier, then legacy score
    candidateMatchups.sort((a, b) => {
      // Primary: Quality score (higher is better)
      const qualityDiff = b.qualityScore.total - a.qualityScore.total;
      if (Math.abs(qualityDiff) > 1) return qualityDiff; // Significant quality difference
      
      // Secondary: tier (ensure distribution)
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      
      // Tertiary: legacy score (higher is better)
      return b.score - a.score;
    });
    
    const remainingSlots = num_matchups - matchups.length;
    
    // CRITICAL FIX: Filter out complex matchups that share connections with already-selected matchups
    // This ensures per-type exclusion - a connection can only appear in ONE matchup per type
    const filteredComplexCandidates: typeof candidateMatchups = [];
    const selectedComplexConnectionIds = new Set<string>();
    
    // Add connections already used in 1v1 matchups
    for (const matchup of matchups) {
      for (const conn of matchup.setA.connections) {
        selectedComplexConnectionIds.add(conn.id);
      }
      for (const conn of matchup.setB.connections) {
        selectedComplexConnectionIds.add(conn.id);
      }
    }
    
    // Filter candidates to ensure no connection reuse
    for (const candidate of candidateMatchups) {
      const candidateConnIds = new Set<string>();
      candidate.matchup.setA.connections.forEach(c => candidateConnIds.add(c.id));
      candidate.matchup.setB.connections.forEach(c => candidateConnIds.add(c.id));
      
      // Check if any connection in this candidate is already used
      const hasOverlap = Array.from(candidateConnIds).some(id => selectedComplexConnectionIds.has(id));
      
      if (!hasOverlap) {
        filteredComplexCandidates.push(candidate);
        // Mark connections as used
        candidateConnIds.forEach(id => selectedComplexConnectionIds.add(id));
      }
    }
    
    // Sort filtered candidates by quality score first (prioritize quality), then tier, then legacy score
    filteredComplexCandidates.sort((a, b) => {
      // Primary: Quality score (higher is better)
      const qualityDiff = b.qualityScore.total - a.qualityScore.total;
      if (Math.abs(qualityDiff) > 1) return qualityDiff; // Significant quality difference
      
      // Secondary: tier (ensure distribution)
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      
      // Tertiary: legacy score (higher is better)
      return b.score - a.score;
    });
    
    const bestCandidates = filteredComplexCandidates.slice(0, remainingSlots);
    
    // Calculate quality statistics for complex patterns
    const complexQualityScores = bestCandidates.map(c => c.qualityScore.total);
    const complexQualityStats = complexQualityScores.length > 0 ? {
      avg: complexQualityScores.reduce((sum, q) => sum + q, 0) / complexQualityScores.length,
      min: Math.min(...complexQualityScores),
      max: Math.max(...complexQualityScores),
    } : null;
    
    const removedCount = candidateMatchups.length - filteredComplexCandidates.length;
    if (removedCount > 0) {
      console.log(`[UnifiedMatchup] Filtered out ${removedCount} complex matchups with reused connections to enforce per-type exclusion`);
    }
    
    console.log(`[UnifiedMatchup] Selected ${bestCandidates.length} best complex matchups from ${filteredComplexCandidates.length} filtered candidates (${candidateMatchups.length} total candidates)`);
    if (complexQualityStats) {
      console.log(`[UnifiedMatchup] Complex pattern quality: avg=${complexQualityStats.avg.toFixed(1)}, min=${complexQualityStats.min.toFixed(1)}, max=${complexQualityStats.max.toFixed(1)}`);
    }
    console.log(`[UnifiedMatchup] Tier distribution:`, 
      bestCandidates.reduce((acc, c) => {
        acc[c.tier] = (acc[c.tier] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    );
    
    for (const candidate of bestCandidates) {
      matchups.push(candidate.matchup);
    }
  }
  
  // FINAL SAFETY CHECK: Enforce per-type exclusion across ALL matchups (1v1 + complex)
  // This ensures no connection appears in multiple matchups within the same type
  const finalUsedConnections = new Set<string>();
  const finalFilteredMatchups: Matchup[] = [];
  
  for (const matchup of matchups) {
    // Collect all connection IDs in this matchup
    const matchupConnIds = new Set<string>();
    for (const conn of matchup.setA.connections) {
      matchupConnIds.add(conn.id);
    }
    for (const conn of matchup.setB.connections) {
      matchupConnIds.add(conn.id);
    }
    
    // Check if any connection in this matchup is already used
    const hasOverlap = Array.from(matchupConnIds).some(id => finalUsedConnections.has(id));
    
    if (!hasOverlap) {
      // No overlap - this matchup is valid
      finalFilteredMatchups.push(matchup);
      // Mark all connections as used
      matchupConnIds.forEach(id => finalUsedConnections.add(id));
    } else {
      // Overlap detected - skip this matchup
      console.warn(`[UnifiedMatchup] Final safety check: Skipping matchup with reused connections (violates per-type exclusion)`);
    }
  }
  
  if (finalFilteredMatchups.length < matchups.length) {
    const removed = matchups.length - finalFilteredMatchups.length;
    console.log(`[UnifiedMatchup] Final safety check: Removed ${removed} matchups with reused connections to enforce per-type exclusion (kept ${finalFilteredMatchups.length} unique matchups)`);
  }
  
  const finalMatchups = finalFilteredMatchups.slice(0, num_matchups);
  
  // QUALITY TUNING: Log final matchup quality metrics
  if (finalMatchups.length > 0) {
    const avgTotalSalary = finalMatchups.reduce((sum, m) => 
      sum + m.setA.totalSalary + m.setB.totalSalary, 0) / finalMatchups.length;
    const avgTotalApps = finalMatchups.reduce((sum, m) => {
      const appsA = m.setA.connections.reduce((s, c) => s + c.apps, 0);
      const appsB = m.setB.connections.reduce((s, c) => s + c.apps, 0);
      return sum + appsA + appsB;
    }, 0) / finalMatchups.length;
    const avgSalaryDiff = finalMatchups.reduce((sum, m) => 
      sum + Math.abs(m.setA.totalSalary - m.setB.totalSalary), 0) / finalMatchups.length;
    
    // Calculate theoretical maximum for context
    const theoreticalMax = Math.floor(eligible.length / 2);
    
    // Recalculate quality scores for final matchups (only for ones that made it through)
    const finalQualityScores: number[] = [];
    // Note: We can't recalculate quality scores easily here, so we'll just log what we have
    // The quality scores array tracks scores for all matchups generated, but finalFilteredMatchups
    // might have fewer entries. We'll use the ones that exist.
    const finalQualityArray = qualityScores.slice(0, finalFilteredMatchups.length);
    
    console.log(`[UnifiedMatchup] ✅ Final Quality Metrics:`);
    console.log(`[UnifiedMatchup]   Generated: ${finalMatchups.length}/${num_matchups} requested (theoretical max: ${theoreticalMax})`);
    console.log(`[UnifiedMatchup]   Avg Total Salary: $${Math.round(avgTotalSalary)}`);
    console.log(`[UnifiedMatchup]   Avg Total Apps: ${Math.round(avgTotalApps)}`);
    console.log(`[UnifiedMatchup]   Avg Salary Diff: $${Math.round(avgSalaryDiff)}`);
    
    if (finalQualityArray.length > 0) {
      const avgQuality = finalQualityArray.reduce((sum, q) => sum + q, 0) / finalQualityArray.length;
      const minQuality = Math.min(...finalQualityArray);
      const maxQuality = Math.max(...finalQualityArray);
      console.log(`[UnifiedMatchup]   Quality Score: avg=${avgQuality.toFixed(1)}, min=${minQuality.toFixed(1)}, max=${maxQuality.toFixed(1)} (target: >80)`);
    }
  }
  
  return finalMatchups;
}

/**
 * Create salary tiers for better matchup distribution
 * Ensures high-salary connections appear in matchups
 */
interface SalaryTier {
  connections: Connection[];
  minSalary: number;
  maxSalary: number;
  avgSalary: number;
}

/**
 * Quality score interface for matchup evaluation
 */
interface QualityScore {
  total: number; // 0-100 overall quality score
  competitiveness: number; // 0-100 salary closeness
  tierMatch: number; // 0-100 tier matching bonus
  appearanceBalance: number; // 0-100 appearance similarity
  penalties: number; // Negative adjustments
  bonuses: number; // Positive adjustments
}

/**
 * Matchup candidate with quality score
 */
interface ScoredMatchup {
  setA: Connection[];
  setB: Connection[];
  salaryDiff: number;
  tier: number;
  qualityScore: QualityScore;
}

/**
 * Get tier index for a connection based on salary tiers
 */
function getConnectionTier(connection: Connection, tiers: SalaryTier[]): number {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (connection.salarySum >= tier.minSalary && connection.salarySum <= tier.maxSalary) {
      return i;
    }
  }
  return tiers.length - 1; // Default to lowest tier
}

/**
 * Calculate quality score for complex pattern matchups (2v1, 1v2)
 * Works with sets of connections instead of individual connections
 */
function calculateQualityScoreForComplex(
  setA: Connection[],
  setB: Connection[],
  salaryDiff: number,
  salaryTolerance: number,
  tiers: SalaryTier[],
  matchupType: '2v1' | '1v2'
): QualityScore {
  // Calculate aggregate metrics for sets
  const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
  const salaryB = setB.reduce((sum, c) => sum + c.salarySum, 0);
  const appsA = setA.reduce((sum, c) => sum + c.apps, 0);
  const appsB = setB.reduce((sum, c) => sum + c.apps, 0);
  
  // Get average tier for each set (weighted by salary)
  const getAverageTier = (conns: Connection[]): number => {
    if (conns.length === 0) return tiers.length - 1;
    const totalSalary = conns.reduce((sum, c) => sum + c.salarySum, 0);
    if (totalSalary === 0) return tiers.length - 1;
    
    const weightedTierSum = conns.reduce((sum, c) => {
      const tier = getConnectionTier(c, tiers);
      return sum + (tier * c.salarySum);
    }, 0);
    
    return weightedTierSum / totalSalary;
  };
  
  const tierA = getAverageTier(setA);
  const tierB = getAverageTier(setB);
  const tierDiff = Math.abs(tierA - tierB);
  
  // 1. Competitiveness (40% weight) - salary closeness
  const competitiveness = Math.max(0, 100 - (salaryDiff / Math.max(salaryTolerance, 1)) * 100);
  
  // 2. Tier matching (30% weight) - same tier = better
  const tierMatch = tierDiff === 0 ? 100 : tierDiff <= 0.5 ? 85 : tierDiff <= 1 ? 70 : tierDiff <= 2 ? 40 : 10;
  
  // 3. Appearance balance (20% weight) - similar total appearances = better
  const maxApps = Math.max(appsA, appsB, 1);
  const appDiff = Math.abs(appsA - appsB);
  const appearanceBalance = Math.max(0, 100 - (appDiff / maxApps) * 100);
  
  // 4. Penalties
  let penalties = 0;
  // Cross-tier penalty (Elite vs Value)
  if (tierDiff >= 3) {
    penalties += 20;
  }
  // Large appearance difference (more lenient for complex patterns)
  if (appDiff > 10) {
    penalties += 10;
  }
  // Large salary difference relative to tolerance
  if (salaryDiff > salaryTolerance * 0.5) {
    penalties += 5;
  }
  
  // 5. Bonuses
  let bonuses = 0;
  // Within-tier match (or very close)
  if (tierDiff <= 0.5) {
    bonuses += 10;
  }
  // Very close salary (< 25% of tolerance)
  if (salaryDiff < salaryTolerance * 0.25) {
    bonuses += 5;
  }
  // Similar appearances (< 3 difference for complex patterns)
  if (appDiff < 3) {
    bonuses += 5;
  }
  
  // Calculate total score (weighted average + adjustments)
  const total = Math.max(0, Math.min(100,
    competitiveness * 0.4 +
    tierMatch * 0.3 +
    appearanceBalance * 0.2 +
    bonuses -
    penalties
  ));
  
  return {
    total: Math.round(total * 100) / 100,
    competitiveness: Math.round(competitiveness * 100) / 100,
    tierMatch: Math.round(tierMatch * 100) / 100,
    appearanceBalance: Math.round(appearanceBalance * 100) / 100,
    penalties,
    bonuses
  };
}

/**
 * Calculate quality score for a matchup
 */
function calculateQualityScore(
  connA: Connection,
  connB: Connection,
  salaryDiff: number,
  salaryTolerance: number,
  tiers: SalaryTier[],
  maxSalary: number
): QualityScore {
  // 1. Competitiveness (40% weight) - salary closeness
  const competitiveness = Math.max(0, 100 - (salaryDiff / Math.max(salaryTolerance, 1)) * 100);
  
  // 2. Tier matching (30% weight) - same tier = better
  const tierA = getConnectionTier(connA, tiers);
  const tierB = getConnectionTier(connB, tiers);
  const tierDiff = Math.abs(tierA - tierB);
  const tierMatch = tierDiff === 0 ? 100 : tierDiff === 1 ? 70 : tierDiff === 2 ? 40 : 10;
  
  // 3. Appearance balance (20% weight) - similar appearances = better
  const maxApps = Math.max(connA.apps, connB.apps, 1);
  const appDiff = Math.abs(connA.apps - connB.apps);
  const appearanceBalance = Math.max(0, 100 - (appDiff / maxApps) * 100);
  
  // 4. Penalties
  let penalties = 0;
  // Cross-tier penalty (Elite vs Value)
  if (tierDiff >= 3) {
    penalties += 20;
  }
  // Large appearance difference
  if (appDiff > 5) {
    penalties += 10;
  }
  // Large salary difference relative to tolerance
  if (salaryDiff > salaryTolerance * 0.5) {
    penalties += 5;
  }
  
  // 5. Bonuses
  let bonuses = 0;
  // Within-tier match
  if (tierDiff === 0) {
    bonuses += 10;
  }
  // Very close salary (< 25% of tolerance)
  if (salaryDiff < salaryTolerance * 0.25) {
    bonuses += 5;
  }
  // Similar appearances (< 2 difference)
  if (appDiff < 2) {
    bonuses += 5;
  }
  
  // Calculate total score (weighted average + adjustments)
  const total = Math.max(0, Math.min(100,
    competitiveness * 0.4 +
    tierMatch * 0.3 +
    appearanceBalance * 0.2 +
    bonuses -
    penalties
  ));
  
  return {
    total: Math.round(total * 100) / 100, // Round to 2 decimals
    competitiveness: Math.round(competitiveness * 100) / 100,
    tierMatch: Math.round(tierMatch * 100) / 100,
    appearanceBalance: Math.round(appearanceBalance * 100) / 100,
    penalties,
    bonuses
  };
}

/**
 * Get quality threshold based on matchup type and settings
 */
function getQualityThreshold(
  matchupType: '1v1' | '2v1' | '1v2',
  isCrossTrack: boolean,
  tier: number,
  settings: UnifiedMatchupSettings
): number {
  // Use configurable thresholds from settings, with defaults
  const defaultThresholds = {
    quality_threshold_1v1: 50,
    quality_threshold_2v1: 45,
    quality_threshold_1v2: 45,
    quality_threshold_cross_track: 60,
    quality_threshold_elite_tier: 70,
  };
  
  // Elite tier (0) needs higher quality
  if (tier === 0) {
    return settings.quality_threshold_elite_tier ?? defaultThresholds.quality_threshold_elite_tier;
  }
  
  // Cross-track needs higher quality
  if (isCrossTrack) {
    return settings.quality_threshold_cross_track ?? defaultThresholds.quality_threshold_cross_track;
  }
  
  // Complex patterns (2v1, 1v2) slightly lower
  if (matchupType === '2v1') {
    return settings.quality_threshold_2v1 ?? defaultThresholds.quality_threshold_2v1;
  }
  if (matchupType === '1v2') {
    return settings.quality_threshold_1v2 ?? defaultThresholds.quality_threshold_1v2;
  }
  
  // Standard 1v1
  return settings.quality_threshold_1v1 ?? defaultThresholds.quality_threshold_1v1;
}

/**
 * Create salary tiers with weighted distribution prioritizing high-salary connections
 * Tuned for better representation of high-salary/apps connections:
 * - Tier 1: Top 20% (highest salary)
 * - Tier 2: Next 25% 
 * - Tier 3: Next 25%
 * - Tier 4: Bottom 30%
 */
function createSalaryTiers(
  connections: Connection[],
  numTiers: number = 4
): SalaryTier[] {
  if (connections.length === 0) return [];
  
  // Sort by salary descending (then by apps for tie-breaking)
  const sorted = [...connections].sort((a, b) => {
    const salaryDiff = b.salarySum - a.salarySum;
    if (salaryDiff !== 0) return salaryDiff;
    return b.apps - a.apps; // Higher apps wins on tie
  });
  
  const maxSalary = sorted[0].salarySum;
  const minSalary = sorted[sorted.length - 1].salarySum;
  const salaryRange = maxSalary - minSalary;
  
  // If range is too small or too few connections, just use one tier
  if (salaryRange < 1000 || connections.length < numTiers) {
    return [{
      connections: sorted,
      minSalary,
      maxSalary,
      avgSalary: (minSalary + maxSalary) / 2
    }];
  }
  
  // QUALITY TUNING: Weighted tier distribution to prioritize high-salary connections
  // Top tier gets fewer connections (more exclusive), lower tiers get more
  const tierWeights = [0.20, 0.25, 0.25, 0.30]; // Sum = 1.0
  const tiers: SalaryTier[] = [];
  let start = 0;
  
  for (let i = 0; i < numTiers && start < sorted.length; i++) {
    const weight = tierWeights[i] || (1.0 / numTiers); // Fallback to equal distribution
    const tierSize = Math.max(1, Math.floor(connections.length * weight));
    const end = Math.min(start + tierSize, sorted.length);
    const tierConns = sorted.slice(start, end);
    
    if (tierConns.length === 0) continue;
    
    tiers.push({
      connections: tierConns,
      minSalary: tierConns[tierConns.length - 1].salarySum,
      maxSalary: tierConns[0].salarySum,
      avgSalary: tierConns.reduce((sum, c) => sum + c.salarySum, 0) / tierConns.length
    });
    
    start = end;
  }
  
  return tiers;
}

/**
 * Simple seeded random number generator (for reproducibility)
 */
function seedRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

