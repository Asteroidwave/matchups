/**
 * Data Loader for Race Excel Files
 * Loads race data from Excel files in the DATA folder and calculates MU/Sigma
 */

// MU (Expected Points) and Sigma (Volatility) by odds range
// Based on statistical analysis of historical race data
export const ODDS_BUCKETS: { min: number; max: number; mu: number; sigma: number; label: string }[] = [
  { min: 0, max: 2, mu: 19.69, sigma: 13.91, label: '0-2' },
  { min: 2, max: 4, mu: 13.89, sigma: 15.42, label: '2-4' },
  { min: 4, max: 6, mu: 11.54, sigma: 16.16, label: '4-6' },
  { min: 6, max: 10, mu: 10.01, sigma: 16.74, label: '6-10' },
  { min: 10, max: 15, mu: 7.75, sigma: 17.03, label: '10-15' },
  { min: 15, max: 20, mu: 7.74, sigma: 19.77, label: '15-20' },
  { min: 20, max: 30, mu: 5.51, sigma: 17.57, label: '20-30' },
  { min: 30, max: 50, mu: 5.01, sigma: 20.00, label: '30-50' },
  { min: 50, max: 100, mu: 2.90, sigma: 18.33, label: '50-100' },
  { min: 100, max: Infinity, mu: 5.89, sigma: 42.57, label: '100+' },
];

export interface RaceEntry {
  date: string;
  race: number;
  horse: string;
  jockey: string;
  trainer: string;
  sire1: string;
  sire2?: string;
  morningLineOdds: number;
  finalOdds: number;
  totalPoints: number;
  finish: number;
  track: string;
  salary?: number;
  fieldSize?: number;
}

export interface ConnectionPerformance {
  connectionId: string;
  connectionType: 'jockey' | 'trainer' | 'sire';
  name: string;
  track: string;
  races: RaceEntry[];
  mu: number;        // Expected points
  sigma: number;     // Volatility
  winRate: number;
  itmRate: number;   // In the money (top 3)
  avgFinish: number;
  totalStarts: number;
}

export interface TrackCalendarData {
  track: string;
  raceDates: string[];  // ISO date strings
  datesByMonth: Record<string, string[]>;  // 'YYYY-MM' -> dates
}

/**
 * Get MU and Sigma for a given odds value
 */
export function getMuSigmaForOdds(odds: number): { mu: number; sigma: number; bucket: string } {
  const bucket = ODDS_BUCKETS.find(b => odds >= b.min && odds < b.max);
  if (!bucket) {
    // Default to the last bucket for very high odds
    const lastBucket = ODDS_BUCKETS[ODDS_BUCKETS.length - 1];
    return { mu: lastBucket.mu, sigma: lastBucket.sigma, bucket: lastBucket.label };
  }
  return { mu: bucket.mu, sigma: bucket.sigma, bucket: bucket.label };
}

/**
 * Calculate connection performance stats from race entries
 */
export function calculateConnectionStats(races: RaceEntry[]): {
  mu: number;
  sigma: number;
  winRate: number;
  itmRate: number;
  avgFinish: number;
} {
  if (races.length === 0) {
    return { mu: 0, sigma: 0, winRate: 0, itmRate: 0, avgFinish: 0 };
  }

  const points = races.map(r => r.totalPoints);
  const wins = races.filter(r => r.finish === 1).length;
  const itm = races.filter(r => r.finish >= 1 && r.finish <= 3).length;
  const finishes = races.filter(r => r.finish > 0).map(r => r.finish);

  const mu = points.reduce((a, b) => a + b, 0) / points.length;
  const variance = points.reduce((sum, p) => sum + Math.pow(p - mu, 2), 0) / points.length;
  const sigma = Math.sqrt(variance);

  return {
    mu,
    sigma,
    winRate: (wins / races.length) * 100,
    itmRate: (itm / races.length) * 100,
    avgFinish: finishes.length > 0 ? finishes.reduce((a, b) => a + b, 0) / finishes.length : 0,
  };
}

/**
 * Group races by connection (jockey, trainer, or sire)
 */
export function groupRacesByConnection(
  races: RaceEntry[],
  connectionType: 'jockey' | 'trainer' | 'sire'
): Map<string, RaceEntry[]> {
  const groups = new Map<string, RaceEntry[]>();

  for (const race of races) {
    let connectionName: string;
    switch (connectionType) {
      case 'jockey':
        connectionName = race.jockey;
        break;
      case 'trainer':
        connectionName = race.trainer;
        break;
      case 'sire':
        connectionName = race.sire1;
        break;
    }

    if (!connectionName) continue;

    const key = `${connectionType}-${connectionName}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(race);
  }

  return groups;
}

/**
 * Get past performance for a connection (last N races)
 */
export function getPastPerformance(
  races: RaceEntry[],
  limit: number = 10
): RaceEntry[] {
  // Sort by date descending and take the most recent
  return [...races]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

/**
 * Extract unique race dates from race entries
 */
export function extractRaceDates(races: RaceEntry[]): string[] {
  const dates = new Set<string>();
  for (const race of races) {
    if (race.date) {
      // Normalize date to ISO format
      const dateStr = new Date(race.date).toISOString().split('T')[0];
      dates.add(dateStr);
    }
  }
  return Array.from(dates).sort();
}

/**
 * Group dates by month
 */
export function groupDatesByMonth(dates: string[]): Record<string, string[]> {
  const byMonth: Record<string, string[]> = {};
  
  for (const date of dates) {
    const monthKey = date.substring(0, 7); // 'YYYY-MM'
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = [];
    }
    byMonth[monthKey].push(date);
  }
  
  return byMonth;
}

/**
 * Find dates where multiple tracks have races
 */
export function findCommonRaceDates(
  trackCalendars: TrackCalendarData[],
  minTracks: number = 3
): string[] {
  const dateCounts = new Map<string, number>();
  
  for (const calendar of trackCalendars) {
    for (const date of calendar.raceDates) {
      dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
    }
  }
  
  return Array.from(dateCounts.entries())
    .filter(([, count]) => count >= minTracks)
    .map(([date]) => date)
    .sort();
}

/**
 * Get available tracks from DATA folder
 */
export function getAvailableTracks(): string[] {
  return ['AQU', 'DMR', 'GP', 'LRL', 'MVR', 'PEN', 'PRX', 'SA'];
}

/**
 * Track display names
 */
export const TRACK_NAMES: Record<string, string> = {
  AQU: 'Aqueduct',
  DMR: 'Del Mar',
  GP: 'Gulfstream Park',
  LRL: 'Laurel Park',
  MVR: 'Mahoning Valley',
  PEN: 'Penn National',
  PRX: 'Parx',
  SA: 'Santa Anita',
};

/**
 * Track colors for UI
 */
export const TRACK_COLORS: Record<string, { primary: string; light: string }> = {
  AQU: { primary: '#3B82F6', light: '#DBEAFE' },  // Blue
  DMR: { primary: '#06B6D4', light: '#CFFAFE' },  // Cyan
  GP: { primary: '#22C55E', light: '#DCFCE7' },   // Green
  LRL: { primary: '#EC4899', light: '#FCE7F3' },  // Pink
  MVR: { primary: '#F59E0B', light: '#FEF3C7' },  // Amber
  PEN: { primary: '#8B5CF6', light: '#EDE9FE' },  // Purple
  PRX: { primary: '#EF4444', light: '#FEE2E2' },  // Red
  SA: { primary: '#F97316', light: '#FFEDD5' },   // Orange
};
