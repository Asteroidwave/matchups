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
  // Odds
  mlOdds: string;
  mlOddsDecimal: number;
  newMlOdds?: string;
  newMlOddsDecimal?: number;
  finalOdds?: number;
  oddsMovement?: number;
  oddsDrift?: number;
  favorite?: boolean;
  // Salary
  ogSalary?: number;
  salary: number;
  scratchAmount?: number;
  // Results
  finish: number;
  totalPoints: number;
  pointsWithScrAdj?: number;
  // AVPA
  avpa: number;
  raceAvpa?: number;
  dayAvpa?: number;
  trackAvpa?: number;
  // Race conditions
  fieldSize?: number;
  weather?: string;
  surface?: string;
  trackCondition?: string;
  distance?: number;
  // Timing
  finalTime?: string;
  runningStyle?: string;
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

// Connection stats structure (from Jockey/Trainer/Sire Stats sheets)
interface ConnectionStats {
  name: string;
  ogApps: number;
  starts: number;
  avgOdds: number;
  ogSalary: number;
  scrAmount: number;
  newSalary: number;
  totalPoints: number;
  avpa: number;
  avpa14d: number;
  avpa30d: number;
  avpa90d: number;
  avpa150d: number;
  avpa180d: number;
  avpa270d: number;
  avpa360d: number;
  wins: number;
  places: number;
  shows: number;
  winPct: number;
  itmPct: number;
  avgFinish: number;
  avgField: number;
  mu: number;
  variance: number;
  sigma: number;
}

// Odds bucket analysis
interface OddsBucket {
  oddsRange: string;
  oddsDec: number;
  low: number;
  high: number;
  numHorses: number;
  avgPts: number;
  muRaw: number;
  sigmaRaw: number;
  muSmooth: number;
  sigmaSmooth: number;
}

interface TrackJsonData {
  trackCode: string;
  horses: HorseEntry[];
  dates: string[];
  // Daily data (per date)
  dailyJockeys: any[];
  dailyTrainers: any[];
  dailySires: any[];
  // Overall stats
  jockeyStats: ConnectionStats[];
  trainerStats: ConnectionStats[];
  sireStats: ConnectionStats[];
  horseStats: any[];
  // Odds analysis
  oddsBucketAnalysis: OddsBucket[];
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

function buildOddsBucketStats(horses: HorseEntry[], oddsBucketAnalysis?: OddsBucket[]): Map<string, OddsBucketStats> {
  const stats = new Map<string, OddsBucketStats>();
  
  // First, try to use pre-computed odds bucket analysis if available
  if (oddsBucketAnalysis && oddsBucketAnalysis.length > 0) {
    oddsBucketAnalysis.forEach(bucket => {
      if (bucket.oddsRange) {
        stats.set(bucket.oddsRange, {
          mean: bucket.muSmooth || bucket.muRaw || bucket.avgPts,
          std: bucket.sigmaSmooth || bucket.sigmaRaw || 10,
          count: bucket.numHorses,
        });
      }
    });
  }
  
  // Fall back to calculating from horse data
  if (stats.size === 0) {
    const bucketData = new Map<string, number[]>();
    
    horses.forEach(horse => {
      if (horse.isScratched || !horse.mlOddsDecimal) return;
      const bucket = getOddsBucket(horse.mlOddsDecimal);
      if (!bucketData.has(bucket)) {
        bucketData.set(bucket, []);
      }
      bucketData.get(bucket)!.push(horse.totalPoints);
    });
    
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
  
  // Build odds bucket stats from pre-computed analysis or horse data
  const oddsBucketStats = buildOddsBucketStats(data.horses, data.oddsBucketAnalysis);

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

    // Get connection-level stats from the Jockey Stats sheet (has 30d, 90d AVPA, etc.)
    const connStats = data.jockeyStats?.find(j => j.name === jockeyName);
    
    // Use 90d AVPA as default (user requirement), fallback to 30d, then overall
    const avpa90d = connStats?.avpa90d || connStats?.avpa30d || connStats?.avpa || (totalPoints / horses.length);

    connections.push({
      id,
      name: jockeyName,
      role: 'jockey',
      trackSet: [trackCode],
      apps: horses.length,
      avgOdds: connStats?.avgOdds || horses.reduce((sum, h) => sum + (h.mlOddsDecimal || 0), 0) / horses.length,
      salarySum: totalSalary,
      pointsSum: totalPoints,
      avpa30d: avpa90d,  // NOTE: This field is named 30d but we're using 90d as default
      avpaRace: totalPoints / horses.length,
      starters,
      mu: connStats?.mu || totalMu,
      sigma: connStats?.sigma || Math.sqrt(totalVariance),
      winRate: connStats?.winPct,
      itmRate: connStats?.itmPct,
      avgFinish: connStats?.avgFinish,
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

    // Get connection-level stats from the Trainer Stats sheet
    const connStats = data.trainerStats?.find(t => t.name === trainerName);
    
    // Use 90d AVPA as default
    const avpa90d = connStats?.avpa90d || connStats?.avpa30d || connStats?.avpa || (totalPoints / horses.length);

    connections.push({
      id,
      name: trainerName,
      role: 'trainer',
      trackSet: [trackCode],
      apps: horses.length,
      avgOdds: connStats?.avgOdds || horses.reduce((sum, h) => sum + (h.mlOddsDecimal || 0), 0) / horses.length,
      salarySum: totalSalary,
      pointsSum: totalPoints,
      avpa30d: avpa90d,  // Using 90d AVPA as default
      avpaRace: totalPoints / horses.length,
      starters,
      mu: connStats?.mu || totalMu,
      sigma: connStats?.sigma || Math.sqrt(totalVariance),
      winRate: connStats?.winPct,
      itmRate: connStats?.itmPct,
      avgFinish: connStats?.avgFinish,
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

    // Get connection-level stats from the Sire Stats sheet
    const connStats = data.sireStats?.find(s => s.name === sireName);
    
    // Use 90d AVPA as default
    const avpa90d = connStats?.avpa90d || connStats?.avpa30d || connStats?.avpa || (totalPoints / horses.length);

    connections.push({
      id,
      name: sireName,
      role: 'sire',
      trackSet: [trackCode],
      apps: horses.length,
      avgOdds: connStats?.avgOdds || horses.reduce((sum, h) => sum + (h.mlOddsDecimal || 0), 0) / horses.length,
      salarySum: totalSalary,
      pointsSum: totalPoints,
      avpa30d: avpa90d,  // Using 90d AVPA as default
      avpaRace: totalPoints / horses.length,
      starters,
      mu: connStats?.mu || totalMu,
      sigma: connStats?.sigma || Math.sqrt(totalVariance),
      winRate: connStats?.winPct,
      itmRate: connStats?.itmPct,
      avgFinish: connStats?.avgFinish,
    });
  });

  return { races, connections, horses: dayHorses, oddsBucketStats };
}

/**
 * Get past performance for a connection
 * Uses dailyJockeys/dailyTrainers/dailySires for connection-level stats (AVPA, salary)
 */
export async function getConnectionHistory(
  connectionName: string,
  role: 'jockey' | 'trainer' | 'sire',
  trackCode: string = 'AQU',
  limit: number = 10
): Promise<PastPerformanceEntry[]> {
  const data = await loadTrackData(trackCode);
  
  // Build a lookup map for connection's daily stats (date -> stats)
  const dailyStatsMap = new Map<string, { avpa: number; salary: number; totalPoints: number }>();
  
  // Get the appropriate daily connection data based on role
  const dailyData = role === 'jockey' ? data.dailyJockeys :
                    role === 'trainer' ? data.dailyTrainers :
                    data.dailySires;
  
  // Build lookup map for this connection's daily stats
  if (dailyData) {
    dailyData.forEach((entry: any) => {
      if (entry.name === connectionName) {
        dailyStatsMap.set(entry.date, {
          avpa: entry.avpa || entry.dayAvpa || 0,
          salary: entry.newSalary || entry.ogSalary || 0,
          totalPoints: entry.totalPoints || 0,
        });
      }
    });
  }
  
  const history: PastPerformanceEntry[] = [];
  
  data.horses.forEach((horse) => {
    if (horse.isScratched) return;
    
    let isMatch = false;
    if (role === 'jockey' && horse.jockey === connectionName) isMatch = true;
    if (role === 'trainer' && horse.trainer === connectionName) isMatch = true;
    if (role === 'sire' && (horse.sire1 === connectionName || horse.sire2 === connectionName)) isMatch = true;
    
    if (isMatch) {
      // Get connection's daily stats for this date
      const dailyStats = dailyStatsMap.get(horse.date);
      
      history.push({
        date: horse.date,
        track: trackCode,
        race: horse.race,
        horse: horse.horse,
        finish: horse.finish,
        totalPoints: horse.totalPoints,
        finalOdds: horse.mlOddsDecimal,
        // Use horse's salary (individual entry), but AVPA from connection's daily stats
        salary: horse.salary || 0,
        // Use connection's daily AVPA if available, otherwise fall back to horse's avpa
        avpa: dailyStats?.avpa || horse.avpa || 0,
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
 * Comprehensive stats for a connection - used in Stats tab
 */
export interface ConnectionComprehensiveStats {
  // Basic info
  name: string;
  role: 'jockey' | 'trainer' | 'sire';
  
  // Tracks included in this stats calculation
  tracksIncluded: string[];
  
  // Recent performance for graph (last 10 race days) - now with AVPA
  recentPerformance: {
    date: string;
    points: number;
    salary: number;
    races: number;
    avgPoints: number;
    avpa: number;  // AVPA for this day
  }[];
  
  // Overall weighted average AVPA (for comparison line on graph)
  overallAvgAvpa: number;
  
  // Overall average points (legacy, kept for compatibility)
  overallAvgPoints: number;
  
  // Key stats by time period
  keyStats: {
    period: string;
    starts: number;
    wins: number;
    places: number;
    shows: number;
    winPct: number;
    itmPct: number;
    avgPoints: number;
    avpa: number;
  }[];
  
  // Surface breakdown
  surfaceStats: {
    surface: string;
    starts: number;
    wins: number;
    winPct: number;
    itmPct: number;
    avgPoints: number;
    avpa: number;
  }[];
  
  // Odds-based stats
  oddsStats: {
    oddsRange: string;
    label: string;
    starts: number;
    wins: number;
    winPct: number;
    avgPoints: number;
    avpa: number;
  }[];
  
  // Field size stats
  fieldSizeStats: {
    fieldSize: string;
    starts: number;
    wins: number;
    winPct: number;
    itmPct: number;
    avgPoints: number;
  }[];
  
  // Distance stats (Sprint vs Route)
  distanceStats: {
    distance: string;
    starts: number;
    wins: number;
    winPct: number;
    itmPct: number;
    avgPoints: number;
    avpa: number;
  }[];
  
  // Post position stats (inside vs middle vs outside)
  postPositionStats: {
    position: string;
    starts: number;
    wins: number;
    winPct: number;
    avgPoints: number;
    avpa: number;
  }[];
  
  // Upset frequency - how often they beat higher-priced connections
  upsetStats: {
    totalRaces: number;
    upsets: number;  // Beat at least one higher-priced connection
    upsetPct: number;
    avgPointsWhenUpset: number;
  };
  
  // Consistency score (lower = more predictable)
  consistencyScore: {
    avpaStdDev: number;
    pointsStdDev: number;
    rating: 'Very Consistent' | 'Consistent' | 'Variable' | 'Unpredictable';
  };
  
  // Current horses quality (for today's races)
  currentHorsesStats: {
    avgOdds: number;
    avgFieldSize: number;
    totalHorses: number;
    favoriteCount: number;  // Horses at < 5/1
    longshotCount: number;  // Horses at > 10/1
    horses: {
      name: string;
      odds: string;
      track: string;
      race: number;
      surface: string;
      distance: string;
    }[];
  };
  
  // Jockey/Trainer combo stats (for trainers: which jockeys work best, for jockeys: which trainers)
  comboStats: {
    type: 'jockey' | 'trainer';  // What type of partner to show
    combos: {
      name: string;
      starts: number;
      wins: number;
      winPct: number;
      avgPoints: number;
      avpa: number;
    }[];
  };
  
  // Favorite stats - performance when favorite vs when not
  favoriteStats: {
    asFavorite: {
      starts: number;
      wins: number;
      winPct: number;
      avgPoints: number;
      avpa: number;
    };
    notFavorite: {
      starts: number;
      wins: number;
      winPct: number;
      avgPoints: number;
      avpa: number;
    };
    beatFavoriteCount: number;  // Times they beat the race favorite
    beatFavoritePct: number;
  };
  
  // Final odds performance - comparing ML odds to final odds
  finalOddsStats: {
    avgMlOdds: number;
    avgFinalOdds: number;
    driftPct: number;  // Positive = odds drifted (got worse), negative = steamed (got better)
    steamCount: number;  // Times final odds < ML odds (money came in)
    driftCount: number;  // Times final odds > ML odds (money went away)
    performanceWhenSteam: {
      starts: number;
      winPct: number;
      avgPoints: number;
    };
    performanceWhenDrift: {
      starts: number;
      winPct: number;
      avgPoints: number;
    };
  };
}

/**
 * Get comprehensive stats for a connection across all available data
 */
export async function getConnectionComprehensiveStats(
  connectionName: string,
  role: 'jockey' | 'trainer' | 'sire',
  trackCodes: string[] = ['AQU']
): Promise<ConnectionComprehensiveStats> {
  // Collect all horse entries for this connection across all tracks
  const allEntries: HorseEntry[] = [];
  
  for (const trackCode of trackCodes) {
    try {
      const data = await loadTrackData(trackCode);
      
      data.horses.forEach((horse) => {
        if (horse.isScratched) return;
        
        let isMatch = false;
        if (role === 'jockey' && horse.jockey === connectionName) isMatch = true;
        if (role === 'trainer' && horse.trainer === connectionName) isMatch = true;
        if (role === 'sire' && (horse.sire1 === connectionName || horse.sire2 === connectionName)) isMatch = true;
        
        if (isMatch) {
          allEntries.push(horse);
        }
      });
    } catch (err) {
      console.warn(`Failed to load data for ${trackCode}:`, err);
    }
  }
  
  // Sort entries by date (newest first)
  allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Calculate overall totals
  const totalPoints = allEntries.reduce((sum, e) => sum + (e.totalPoints || 0), 0);
  const totalSalary = allEntries.reduce((sum, e) => sum + (e.salary || 0), 0);
  const overallAvgPoints = allEntries.length > 0 ? totalPoints / allEntries.length : 0;
  const overallAvgAvpa = totalSalary > 0 ? (totalPoints / totalSalary) * 1000 : 0;
  
  // Recent performance by date (last 10 unique dates) - now with AVPA
  const dateStatsMap = new Map<string, { points: number; salary: number; races: number }>();
  allEntries.forEach((entry) => {
    const existing = dateStatsMap.get(entry.date) || { points: 0, salary: 0, races: 0 };
    dateStatsMap.set(entry.date, {
      points: existing.points + (entry.totalPoints || 0),
      salary: existing.salary + (entry.salary || 0),
      races: existing.races + 1,
    });
  });
  
  const recentPerformance = Array.from(dateStatsMap.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 10)
    .map(([date, data]) => ({
      date,
      points: data.points,
      salary: data.salary,
      races: data.races,
      avgPoints: data.points / data.races,
      avpa: data.salary > 0 ? (data.points / data.salary) * 1000 : 0,
    }))
    .reverse(); // Oldest first for chart display
  
  // Helper function to calculate stats for a subset of entries
  const calculateStats = (entries: HorseEntry[]) => {
    const starts = entries.length;
    const wins = entries.filter(e => e.finish === 1).length;
    const places = entries.filter(e => e.finish === 2).length;
    const shows = entries.filter(e => e.finish === 3).length;
    const itm = wins + places + shows;
    const totalPts = entries.reduce((sum, e) => sum + (e.totalPoints || 0), 0);
    const totalSalary = entries.reduce((sum, e) => sum + (e.salary || 0), 0);
    
    return {
      starts,
      wins,
      places,
      shows,
      winPct: starts > 0 ? (wins / starts) * 100 : 0,
      itmPct: starts > 0 ? (itm / starts) * 100 : 0,
      avgPoints: starts > 0 ? totalPts / starts : 0,
      avpa: totalSalary > 0 ? (totalPts / totalSalary) * 1000 : 0,
    };
  };
  
  // Key stats by time period
  const now = new Date();
  const periods = [
    { label: 'Total', days: Infinity },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 },
    { label: 'Last 365 Days', days: 365 },
  ];
  
  const keyStats = periods.map(({ label, days }) => {
    const cutoff = days === Infinity ? new Date(0) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const filtered = allEntries.filter(e => new Date(e.date) >= cutoff);
    const stats = calculateStats(filtered);
    return { period: label, ...stats };
  });
  
  // Surface stats
  const surfaceMap = new Map<string, HorseEntry[]>();
  allEntries.forEach((entry) => {
    const surface = entry.surface || 'Unknown';
    if (!surfaceMap.has(surface)) surfaceMap.set(surface, []);
    surfaceMap.get(surface)!.push(entry);
  });
  
  const surfaceStats = Array.from(surfaceMap.entries()).map(([surface, entries]) => {
    const stats = calculateStats(entries);
    return { surface, ...stats };
  }).sort((a, b) => b.starts - a.starts);
  
  // Odds-based stats
  const oddsRanges = [
    { min: 0, max: 2, label: 'Favorites (0-2/1)' },
    { min: 2, max: 5, label: 'Short (2-5/1)' },
    { min: 5, max: 10, label: 'Medium (5-10/1)' },
    { min: 10, max: 20, label: 'Long (10-20/1)' },
    { min: 20, max: Infinity, label: 'Longshots (20+)' },
  ];
  
  const oddsStats = oddsRanges.map(({ min, max, label }) => {
    const filtered = allEntries.filter(e => {
      const odds = e.mlOddsDecimal || 0;
      return odds >= min && odds < max;
    });
    const stats = calculateStats(filtered);
    return { 
      oddsRange: `${min}-${max === Infinity ? '+' : max}`,
      label,
      ...stats,
    };
  });
  
  // Field size stats
  const fieldSizeRanges = [
    { min: 1, max: 6, label: 'Small (1-6)' },
    { min: 7, max: 10, label: 'Medium (7-10)' },
    { min: 11, max: Infinity, label: 'Large (11+)' },
  ];
  
  const fieldSizeStats = fieldSizeRanges.map(({ min, max, label }) => {
    const filtered = allEntries.filter(e => {
      const fieldSize = e.fieldSize || 8; // default to 8 if not available
      return fieldSize >= min && fieldSize <= (max === Infinity ? 999 : max);
    });
    const stats = calculateStats(filtered);
    return { fieldSize: label, ...stats };
  });
  
  // Distance stats (Sprint < 1 mile, Route >= 1 mile)
  // Distance is typically in furlongs (8 furlongs = 1 mile)
  const distanceRanges = [
    { min: 0, max: 7.99, label: 'Sprint (< 1 mile)' },
    { min: 8, max: Infinity, label: 'Route (1+ mile)' },
  ];
  
  const distanceStats = distanceRanges.map(({ min, max, label }) => {
    const filtered = allEntries.filter(e => {
      // Try to parse distance - assume furlongs if numeric
      const distVal = e.distance || 0;
      const furlongs = typeof distVal === 'number' ? distVal : 
        (typeof distVal === 'string' ? parseFloat(distVal) || 6 : 6);
      return furlongs >= min && furlongs < max;
    });
    const stats = calculateStats(filtered);
    return { distance: label, ...stats };
  });
  
  // Post position stats (inside 1-3, middle 4-7, outside 8+)
  const postRanges = [
    { min: 1, max: 3, label: 'Inside (1-3)' },
    { min: 4, max: 7, label: 'Middle (4-7)' },
    { min: 8, max: Infinity, label: 'Outside (8+)' },
  ];
  
  const postPositionStats = postRanges.map(({ min, max, label }) => {
    const filtered = allEntries.filter(e => {
      const post = e.postPosition || e.programNumber || 5;
      return post >= min && post <= (max === Infinity ? 99 : max);
    });
    const stats = calculateStats(filtered);
    return { position: label, ...stats };
  });
  
  // Upset stats - how often they beat higher-priced (lower odds) connections
  // An "upset" is when they finish ahead of a horse with lower odds (more favored)
  let upsetCount = 0;
  let totalRacesWithOpportunity = 0;
  let pointsWhenUpset = 0;
  
  allEntries.forEach(entry => {
    if (entry.finish && entry.finish <= 3 && entry.mlOddsDecimal) {
      // If they finished in the money at odds > 3/1, count as upset potential
      if (entry.mlOddsDecimal > 3) {
        totalRacesWithOpportunity++;
        upsetCount++;
        pointsWhenUpset += entry.totalPoints || 0;
      }
    }
  });
  
  const upsetStats = {
    totalRaces: totalRacesWithOpportunity,
    upsets: upsetCount,
    upsetPct: totalRacesWithOpportunity > 0 ? (upsetCount / allEntries.length) * 100 : 0,
    avgPointsWhenUpset: upsetCount > 0 ? pointsWhenUpset / upsetCount : 0,
  };
  
  // Consistency score - standard deviation of AVPA per race day
  const dailyAvpas = Array.from(dateStatsMap.entries()).map(([, data]) => 
    data.salary > 0 ? (data.points / data.salary) * 1000 : 0
  );
  
  const avgAvpa = dailyAvpas.length > 0 
    ? dailyAvpas.reduce((a, b) => a + b, 0) / dailyAvpas.length 
    : 0;
  
  const avpaVariance = dailyAvpas.length > 0
    ? dailyAvpas.reduce((sum, val) => sum + Math.pow(val - avgAvpa, 2), 0) / dailyAvpas.length
    : 0;
  const avpaStdDev = Math.sqrt(avpaVariance);
  
  // Points std dev
  const dailyPoints = allEntries.map(e => e.totalPoints || 0);
  const avgPts = dailyPoints.length > 0 
    ? dailyPoints.reduce((a, b) => a + b, 0) / dailyPoints.length 
    : 0;
  const ptsVariance = dailyPoints.length > 0
    ? dailyPoints.reduce((sum, val) => sum + Math.pow(val - avgPts, 2), 0) / dailyPoints.length
    : 0;
  const pointsStdDev = Math.sqrt(ptsVariance);
  
  // Rating based on AVPA std dev
  let consistencyRating: 'Very Consistent' | 'Consistent' | 'Variable' | 'Unpredictable';
  if (avpaStdDev < 2) consistencyRating = 'Very Consistent';
  else if (avpaStdDev < 4) consistencyRating = 'Consistent';
  else if (avpaStdDev < 7) consistencyRating = 'Variable';
  else consistencyRating = 'Unpredictable';
  
  const consistencyScore = {
    avpaStdDev,
    pointsStdDev,
    rating: consistencyRating,
  };
  
  // Current horses stats - from the most recent entries (today's races)
  // Get the most recent date's entries
  const mostRecentDate = allEntries.length > 0 ? allEntries[0].date : '';
  const todaysEntries = allEntries.filter(e => e.date === mostRecentDate);
  
  const currentHorsesStats = {
    avgOdds: todaysEntries.length > 0 
      ? todaysEntries.reduce((sum, e) => sum + (e.mlOddsDecimal || 5), 0) / todaysEntries.length 
      : 0,
    avgFieldSize: todaysEntries.length > 0
      ? todaysEntries.reduce((sum, e) => sum + (e.fieldSize || 8), 0) / todaysEntries.length
      : 0,
    totalHorses: todaysEntries.length,
    favoriteCount: todaysEntries.filter(e => (e.mlOddsDecimal || 10) < 5).length,
    longshotCount: todaysEntries.filter(e => (e.mlOddsDecimal || 0) > 10).length,
    horses: todaysEntries.slice(0, 10).map(e => ({
      name: e.horseName,
      odds: e.mlOddsFrac || `${(e.mlOddsDecimal || 0).toFixed(0)}/1`,
      track: e.track,
      race: e.race,
      surface: e.surface || 'Dirt',
      distance: e.distance ? `${e.distance}f` : 'Unknown',
    })),
  };
  
  // Jockey/Trainer combo stats
  // For jockeys: show which trainers they work best with
  // For trainers: show which jockeys they work best with
  const comboMap = new Map<string, HorseEntry[]>();
  allEntries.forEach(entry => {
    const partner = role === 'jockey' ? entry.trainer : 
                    role === 'trainer' ? entry.jockey : 
                    null;
    if (partner) {
      if (!comboMap.has(partner)) comboMap.set(partner, []);
      comboMap.get(partner)!.push(entry);
    }
  });
  
  const comboStats = {
    type: (role === 'jockey' ? 'trainer' : 'jockey') as 'jockey' | 'trainer',
    combos: Array.from(comboMap.entries())
      .map(([name, entries]) => {
        const stats = calculateStats(entries);
        return { name, ...stats };
      })
      .filter(c => c.starts >= 3)  // Only show combos with 3+ starts
      .sort((a, b) => b.starts - a.starts)
      .slice(0, 5),  // Top 5 combos
  };
  
  // Favorite stats - performance when favorite (< 3/1) vs not
  const asFavoriteEntries = allEntries.filter(e => (e.mlOddsDecimal || 10) < 3);
  const notFavoriteEntries = allEntries.filter(e => (e.mlOddsDecimal || 0) >= 3);
  
  const asFavoriteStats = calculateStats(asFavoriteEntries);
  const notFavoriteStats = calculateStats(notFavoriteEntries);
  
  // Count times they beat the favorite (finished ahead of a horse with lower odds)
  let beatFavoriteCount = 0;
  allEntries.forEach(entry => {
    // If they weren't the favorite but won, they beat the favorite
    if ((entry.mlOddsDecimal || 0) >= 3 && entry.finish === 1) {
      beatFavoriteCount++;
    }
  });
  
  const favoriteStats = {
    asFavorite: asFavoriteStats,
    notFavorite: notFavoriteStats,
    beatFavoriteCount,
    beatFavoritePct: notFavoriteEntries.length > 0 ? (beatFavoriteCount / notFavoriteEntries.length) * 100 : 0,
  };
  
  // Final odds performance - comparing ML odds to final odds
  const entriesWithFinalOdds = allEntries.filter(e => e.finalOddsDecimal && e.mlOddsDecimal);
  
  const totalMlOdds = entriesWithFinalOdds.reduce((sum, e) => sum + (e.mlOddsDecimal || 0), 0);
  const totalFinalOdds = entriesWithFinalOdds.reduce((sum, e) => sum + (e.finalOddsDecimal || 0), 0);
  const avgMlOdds = entriesWithFinalOdds.length > 0 ? totalMlOdds / entriesWithFinalOdds.length : 0;
  const avgFinalOdds = entriesWithFinalOdds.length > 0 ? totalFinalOdds / entriesWithFinalOdds.length : 0;
  
  // Steam = final odds < ML odds (money came in, odds shortened)
  // Drift = final odds > ML odds (money went away, odds lengthened)
  const steamEntries = entriesWithFinalOdds.filter(e => (e.finalOddsDecimal || 0) < (e.mlOddsDecimal || 0));
  const driftEntries = entriesWithFinalOdds.filter(e => (e.finalOddsDecimal || 0) > (e.mlOddsDecimal || 0));
  
  const steamStats = calculateStats(steamEntries);
  const driftStats = calculateStats(driftEntries);
  
  const finalOddsStats = {
    avgMlOdds,
    avgFinalOdds,
    driftPct: avgMlOdds > 0 ? ((avgFinalOdds - avgMlOdds) / avgMlOdds) * 100 : 0,
    steamCount: steamEntries.length,
    driftCount: driftEntries.length,
    performanceWhenSteam: {
      starts: steamStats.starts,
      winPct: steamStats.winPct,
      avgPoints: steamStats.avgPoints,
    },
    performanceWhenDrift: {
      starts: driftStats.starts,
      winPct: driftStats.winPct,
      avgPoints: driftStats.avgPoints,
    },
  };
  
  return {
    name: connectionName,
    role,
    tracksIncluded: trackCodes,
    recentPerformance,
    overallAvgAvpa,
    overallAvgPoints,
    keyStats,
    surfaceStats,
    oddsStats,
    fieldSizeStats,
    distanceStats,
    postPositionStats,
    upsetStats,
    consistencyScore,
    currentHorsesStats,
    comboStats,
    favoriteStats,
    finalOddsStats,
  };
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
