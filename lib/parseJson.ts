/**
 * Optimized data loader using pre-converted JSON files
 * Much faster than parsing Excel in the browser
 */

import { Connection, Starter, PastPerformanceEntry } from '@/types';

// Available tracks
export const AVAILABLE_TRACKS = [
  { code: 'AQU', name: 'Aqueduct' },
  { code: 'SA', name: 'Santa Anita' },
  { code: 'GP', name: 'Gulfstream Park' },
  { code: 'DMR', name: 'Del Mar' },
  { code: 'PRX', name: 'Parx Racing' },
  { code: 'PEN', name: 'Penn National' },
  { code: 'LRL', name: 'Laurel Park' },
  { code: 'MVR', name: 'Mountaineer' },
];

export interface HorseEntry {
  date: string;
  race: number;
  horse: string;
  pp: number;
  jockey: string;
  trainer: string;
  sire1: string;
  sire2?: string;
  mlOdds: string;
  mlOddsDecimal: number;
  salary: number;
  finish: number;
  totalPoints: number;
  avpa: number;
  raceAvpa?: number;
  trackAvpa?: number;
  finalOdds?: number;
  isScratched: boolean;
}

export interface RaceInfo {
  date: string;
  raceNumber: number;
  entries: HorseEntry[];
}

export interface OddsBucketStats {
  mean: number;
  std: number;
  count: number;
}

interface TrackJsonData {
  trackCode: string;
  horses: HorseEntry[];
  dates: string[];
  connections: {
    jockeys: { name: string; apps: number; avgOdds: number; avpa: number; salary: number; points: number }[];
    trainers: { name: string; apps: number; avgOdds: number; avpa: number; salary: number; points: number }[];
    sires: { name: string; apps: number; avgOdds: number; avpa: number; salary: number; points: number }[];
  };
}

// Cache for loaded track data
const trackCache = new Map<string, TrackJsonData>();

// Cache for track metadata
let trackMetadataCache: { code: string; name: string; dates: string[] }[] | null = null;

// Odds bucket definitions
const ODDS_BUCKETS = [
  { min: 0, max: 1, label: '0-1' },
  { min: 1, max: 2, label: '1-2' },
  { min: 2, max: 3, label: '2-3' },
  { min: 3, max: 5, label: '3-5' },
  { min: 5, max: 8, label: '5-8' },
  { min: 8, max: 12, label: '8-12' },
  { min: 12, max: 20, label: '12-20' },
  { min: 20, max: 50, label: '20-50' },
  { min: 50, max: 100, label: '50-100' },
  { min: 100, max: Infinity, label: '100+' },
];

function getOddsBucket(odds: number): string {
  for (const bucket of ODDS_BUCKETS) {
    if (odds >= bucket.min && odds < bucket.max) {
      return bucket.label;
    }
  }
  return '100+';
}

// Default odds bucket stats (fallback)
const DEFAULT_ODDS_STATS: Record<string, OddsBucketStats> = {
  '0-1': { mean: 22, std: 12, count: 100 },
  '1-2': { mean: 18, std: 13, count: 200 },
  '2-3': { mean: 14, std: 14, count: 300 },
  '3-5': { mean: 11, std: 14, count: 400 },
  '5-8': { mean: 8, std: 13, count: 500 },
  '8-12': { mean: 6, std: 12, count: 400 },
  '12-20': { mean: 4, std: 10, count: 300 },
  '20-50': { mean: 3, std: 8, count: 200 },
  '50-100': { mean: 2, std: 6, count: 50 },
  '100+': { mean: 1, std: 5, count: 20 },
};

function buildOddsBucketStats(horses: HorseEntry[]): Map<string, OddsBucketStats> {
  const bucketData = new Map<string, number[]>();
  
  horses.forEach(horse => {
    if (horse.isScratched || !horse.mlOddsDecimal) return;
    const bucket = getOddsBucket(horse.mlOddsDecimal);
    if (!bucketData.has(bucket)) {
      bucketData.set(bucket, []);
    }
    bucketData.get(bucket)!.push(horse.totalPoints);
  });
  
  const stats = new Map<string, OddsBucketStats>();
  
  // Use actual data if available, otherwise use defaults
  for (const bucket of Object.keys(DEFAULT_ODDS_STATS)) {
    const points = bucketData.get(bucket);
    if (points && points.length > 10) {
      const mean = points.reduce((a, b) => a + b, 0) / points.length;
      const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
      stats.set(bucket, {
        mean,
        std: Math.sqrt(variance),
        count: points.length,
      });
    } else {
      stats.set(bucket, DEFAULT_ODDS_STATS[bucket]);
    }
  }
  
  return stats;
}

/**
 * Get track metadata from lightweight JSON (very fast)
 */
export async function getTrackMetadata(): Promise<{ code: string; name: string; dates: string[] }[]> {
  if (trackMetadataCache) {
    return trackMetadataCache;
  }
  
  try {
    const response = await fetch('/track-metadata.json');
    if (response.ok) {
      const data = await response.json();
      trackMetadataCache = data.tracks;
      return data.tracks;
    }
  } catch (err) {
    console.warn('Failed to load track metadata');
  }
  
  // Fallback to static data
  return AVAILABLE_TRACKS.map(t => ({ ...t, dates: [] }));
}

/**
 * Get all available tracks with their race dates
 */
export async function getAvailableTracks(): Promise<{ code: string; name: string; dates: string[] }[]> {
  return getTrackMetadata();
}

/**
 * Load JSON data for a specific track
 */
export async function loadTrackData(trackCode: string): Promise<TrackJsonData> {
  // Check cache
  if (trackCache.has(trackCode)) {
    return trackCache.get(trackCode)!;
  }

  const response = await fetch(`/data/${trackCode}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load data for ${trackCode}`);
  }
  
  const data: TrackJsonData = await response.json();
  
  // Cache it
  trackCache.set(trackCode, data);
  
  return data;
}

/**
 * Get data for a specific date and track
 */
export async function getDataForDate(date: string, trackCode: string = 'AQU'): Promise<{
  races: RaceInfo[];
  connections: Connection[];
  horses: HorseEntry[];
  oddsBucketStats: Map<string, OddsBucketStats>;
}> {
  const data = await loadTrackData(trackCode);
  
  // Filter horses for this date
  const dayHorses = data.horses.filter((h) => h.date === date);
  const validDayHorses = dayHorses.filter((h) => !h.isScratched);
  
  // Build odds bucket stats from all horses
  const oddsBucketStats = buildOddsBucketStats(data.horses);

  // Group by race
  const raceMap = new Map<number, HorseEntry[]>();
  dayHorses.forEach((h) => {
    if (!raceMap.has(h.race)) {
      raceMap.set(h.race, []);
    }
    raceMap.get(h.race)!.push(h);
  });

  const races: RaceInfo[] = Array.from(raceMap.entries())
    .map(([raceNumber, entries]) => ({
      date,
      raceNumber,
      entries: entries.sort((a, b) => a.pp - b.pp),
    }))
    .sort((a, b) => a.raceNumber - b.raceNumber);

  // Build connections from day's horses
  const connections: Connection[] = [];
  const seenConnections = new Set<string>();

  // Helper to get MU/Sigma for a horse based on odds
  const getHorseStats = (horse: HorseEntry) => {
    const bucket = getOddsBucket(horse.mlOddsDecimal || 0);
    const stats = oddsBucketStats.get(bucket);
    return {
      mu: stats?.mean || 8,
      sigma: stats?.std || 10,
    };
  };

  // Process jockeys
  const jockeyMap = new Map<string, HorseEntry[]>();
  validDayHorses.forEach(h => {
    if (!h.jockey) return;
    if (!jockeyMap.has(h.jockey)) jockeyMap.set(h.jockey, []);
    jockeyMap.get(h.jockey)!.push(h);
  });

  jockeyMap.forEach((horses, jockeyName) => {
    const id = `jockey-${jockeyName}-${date}`;
    if (seenConnections.has(id)) return;
    seenConnections.add(id);

    // Calculate aggregate stats
    let totalMu = 0;
    let totalVariance = 0;
    let totalSalary = 0;
    let totalPoints = 0;

    const starters: Starter[] = horses.map(h => {
      const stats = getHorseStats(h);
      totalMu += stats.mu;
      totalVariance += stats.sigma * stats.sigma;
      totalSalary += h.salary || 0;
      totalPoints += h.totalPoints || 0;

      return {
        track: trackCode,
        race: h.race,
        horseName: h.horse,
        jockey: h.jockey,
        trainer: h.trainer,
        sire1: h.sire1,
        sire2: h.sire2,
        mlOddsFrac: h.mlOdds,
        mlOdds: h.mlOddsDecimal,
        salary: h.salary,
        points: h.totalPoints,
        pos: h.finish,
        scratched: h.isScratched,
      };
    });

    // Get connection-level stats from the pre-computed data
    const connData = data.connections.jockeys.find(j => j.name === jockeyName);

    connections.push({
      id,
      name: jockeyName,
      role: 'jockey',
      trackSet: [trackCode],
      apps: horses.length,
      avgOdds: connData?.avgOdds || horses.reduce((sum, h) => sum + (h.mlOddsDecimal || 0), 0) / horses.length,
      salarySum: totalSalary,
      pointsSum: totalPoints,
      avpa30d: connData?.avpa || (totalPoints / horses.length),
      avpaRace: totalPoints / horses.length,
      starters,
      mu: totalMu,
      sigma: Math.sqrt(totalVariance),
    });
  });

  // Process trainers
  const trainerMap = new Map<string, HorseEntry[]>();
  validDayHorses.forEach(h => {
    if (!h.trainer) return;
    if (!trainerMap.has(h.trainer)) trainerMap.set(h.trainer, []);
    trainerMap.get(h.trainer)!.push(h);
  });

  trainerMap.forEach((horses, trainerName) => {
    const id = `trainer-${trainerName}-${date}`;
    if (seenConnections.has(id)) return;
    seenConnections.add(id);

    let totalMu = 0;
    let totalVariance = 0;
    let totalSalary = 0;
    let totalPoints = 0;

    const starters: Starter[] = horses.map(h => {
      const stats = getHorseStats(h);
      totalMu += stats.mu;
      totalVariance += stats.sigma * stats.sigma;
      totalSalary += h.salary || 0;
      totalPoints += h.totalPoints || 0;

      return {
        track: trackCode,
        race: h.race,
        horseName: h.horse,
        jockey: h.jockey,
        trainer: h.trainer,
        sire1: h.sire1,
        sire2: h.sire2,
        mlOddsFrac: h.mlOdds,
        mlOdds: h.mlOddsDecimal,
        salary: h.salary,
        points: h.totalPoints,
        pos: h.finish,
        scratched: h.isScratched,
      };
    });

    const connData = data.connections.trainers.find(t => t.name === trainerName);

    connections.push({
      id,
      name: trainerName,
      role: 'trainer',
      trackSet: [trackCode],
      apps: horses.length,
      avgOdds: connData?.avgOdds || horses.reduce((sum, h) => sum + (h.mlOddsDecimal || 0), 0) / horses.length,
      salarySum: totalSalary,
      pointsSum: totalPoints,
      avpa30d: connData?.avpa || (totalPoints / horses.length),
      avpaRace: totalPoints / horses.length,
      starters,
      mu: totalMu,
      sigma: Math.sqrt(totalVariance),
    });
  });

  // Process sires
  const sireMap = new Map<string, HorseEntry[]>();
  validDayHorses.forEach(h => {
    if (h.sire1) {
      if (!sireMap.has(h.sire1)) sireMap.set(h.sire1, []);
      sireMap.get(h.sire1)!.push(h);
    }
    if (h.sire2) {
      if (!sireMap.has(h.sire2)) sireMap.set(h.sire2, []);
      sireMap.get(h.sire2)!.push(h);
    }
  });

  sireMap.forEach((horses, sireName) => {
    const id = `sire-${sireName}-${date}`;
    if (seenConnections.has(id)) return;
    seenConnections.add(id);

    let totalMu = 0;
    let totalVariance = 0;
    let totalSalary = 0;
    let totalPoints = 0;

    const starters: Starter[] = horses.map(h => {
      const stats = getHorseStats(h);
      totalMu += stats.mu;
      totalVariance += stats.sigma * stats.sigma;
      totalSalary += h.salary || 0;
      totalPoints += h.totalPoints || 0;

      return {
        track: trackCode,
        race: h.race,
        horseName: h.horse,
        jockey: h.jockey,
        trainer: h.trainer,
        sire1: h.sire1,
        sire2: h.sire2,
        mlOddsFrac: h.mlOdds,
        mlOdds: h.mlOddsDecimal,
        salary: h.salary,
        points: h.totalPoints,
        pos: h.finish,
        scratched: h.isScratched,
      };
    });

    const connData = data.connections.sires.find(s => s.name === sireName);

    connections.push({
      id,
      name: sireName,
      role: 'sire',
      trackSet: [trackCode],
      apps: horses.length,
      avgOdds: connData?.avgOdds || horses.reduce((sum, h) => sum + (h.mlOddsDecimal || 0), 0) / horses.length,
      salarySum: totalSalary,
      pointsSum: totalPoints,
      avpa30d: connData?.avpa || (totalPoints / horses.length),
      avpaRace: totalPoints / horses.length,
      starters,
      mu: totalMu,
      sigma: Math.sqrt(totalVariance),
    });
  });

  return { races, connections, horses: dayHorses, oddsBucketStats };
}

/**
 * Get past performance for a connection
 */
export async function getConnectionHistory(
  connectionName: string,
  role: 'jockey' | 'trainer' | 'sire',
  trackCode: string = 'AQU',
  limit: number = 10
): Promise<PastPerformanceEntry[]> {
  const data = await loadTrackData(trackCode);
  
  const history: PastPerformanceEntry[] = [];
  
  data.horses.forEach((horse) => {
    if (horse.isScratched) return;
    
    let isMatch = false;
    if (role === 'jockey' && horse.jockey === connectionName) isMatch = true;
    if (role === 'trainer' && horse.trainer === connectionName) isMatch = true;
    if (role === 'sire' && (horse.sire1 === connectionName || horse.sire2 === connectionName)) isMatch = true;
    
    if (isMatch) {
      history.push({
        date: horse.date,
        track: trackCode,
        race: horse.race,
        horse: horse.horse,
        finish: horse.finish,
        totalPoints: horse.totalPoints,
        finalOdds: horse.mlOddsDecimal,
        salary: horse.salary,
        avpa: horse.avpa,
      });
    }
  });
  
  // Sort by date (newest first), then by race number
  return history
    .sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.race - b.race;
    })
    .slice(0, limit);
}

/**
 * Find dates where multiple tracks have races
 */
export async function findMultiTrackDates(trackCodes: string[]): Promise<string[]> {
  const metadata = await getTrackMetadata();
  
  const trackDates = new Map<string, Set<string>>();
  
  for (const code of trackCodes) {
    const track = metadata.find(t => t.code === code);
    if (track) {
      trackDates.set(code, new Set(track.dates));
    }
  }
  
  // Find dates where all tracks have races
  if (trackDates.size === 0) return [];
  
  const allDates = new Set<string>();
  trackDates.forEach(dates => {
    dates.forEach(d => allDates.add(d));
  });
  
  const multiTrackDates = Array.from(allDates).filter(date => {
    return trackCodes.every(code => trackDates.get(code)?.has(date));
  });
  
  return multiTrackDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
}
