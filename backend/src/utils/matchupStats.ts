/**
 * Calculate theoretical maximum matchups possible
 * Based on combinatorics for unique connections
 */

/**
 * Calculate number of ways to choose k items from n items
 * C(n, k) = n! / (k! * (n-k)!)
 */
function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k; // Use symmetry
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.floor(result);
}

/**
 * Calculate theoretical maximum matchups for a given pattern
 * Pattern [a, b] means: a connections on Set A, b connections on Set B
 */
export function calculateTheoreticalMax(
  uniqueConnections: number,
  pattern: [number, number]
): number {
  const [a, b] = pattern;
  
  if (a + b > uniqueConnections) return 0;
  
  // For pattern [a, b]:
  // - Choose a connections for Set A: C(n, a)
  // - Choose b connections for Set B from remaining: C(n-a, b)
  // - Total: C(n, a) * C(n-a, b)
  
  const chooseA = combinations(uniqueConnections, a);
  const chooseB = combinations(uniqueConnections - a, b);
  
  return chooseA * chooseB;
}

/**
 * Calculate theoretical maximums for all patterns
 */
export function calculateAllTheoreticalMaxs(
  uniqueConnections: number,
  patterns: Array<[number, number]>
): Record<string, number> {
  const maxs: Record<string, number> = {};
  
  for (const pattern of patterns) {
    const [a, b] = pattern;
    const key = `${a}v${b}`;
    maxs[key] = calculateTheoreticalMax(uniqueConnections, pattern);
  }
  
  // Total theoretical maximum (sum of all patterns)
  maxs.total = Object.values(maxs).reduce((sum, val) => sum + val, 0);
  
  return maxs;
}

/**
 * Get matchup type label
 */
export function getMatchupTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'jockey_vs_jockey': 'Jockey vs Jockey (JvJ)',
    'trainer_vs_trainer': 'Trainer vs Trainer (TvT)',
    'sire_vs_sire': 'Sire vs Sire (SvS)',
    'mixed': 'Mixed Matchups',
  };
  return labels[type] || type;
}

/**
 * Format matchup stats for display
 */
export interface MatchupStats {
  type: string;
  typeLabel: string;
  uniqueConnections: number;
  eligibleConnections: number;
  generated: number;
  requested: number;
  displayCount: number;
  poolCount: number;
  minAppearances: number;
  minSalary: number;
  applyMinAppearances: boolean;
  theoreticalMax: Record<string, number>;
  patterns: Array<[number, number]>;
}

interface FormatMatchupStatsParams {
  type: string;
  uniqueConnections: number;
  eligibleConnections: number;
  generated: number;
  requested: number;
  displayCount: number;
  poolCount: number;
  minAppearances: number;
  minSalary: number;
  applyMinAppearances: boolean;
  patterns: Array<[number, number]>;
}

export function formatMatchupStats({
  type,
  uniqueConnections,
  eligibleConnections,
  generated,
  requested,
  displayCount,
  poolCount,
  minAppearances,
  minSalary,
  applyMinAppearances,
  patterns,
}: FormatMatchupStatsParams): MatchupStats {
  const theoreticalSource = eligibleConnections > 0 ? eligibleConnections : uniqueConnections;

  return {
    type,
    typeLabel: getMatchupTypeLabel(type),
    uniqueConnections,
    eligibleConnections,
    generated,
    requested,
    displayCount,
    poolCount,
    minAppearances,
    minSalary,
    applyMinAppearances,
    theoreticalMax: calculateAllTheoreticalMaxs(theoreticalSource, patterns),
    patterns,
  };
}

