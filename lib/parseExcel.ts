import * as XLSX from 'xlsx';
import { Connection, Starter, PastPerformanceEntry } from '@/types';

// Available tracks with their files
export const AVAILABLE_TRACKS = [
  { code: 'AQU', name: 'Aqueduct', file: 'AQU_20250101_V11_COMPLETE.xlsx' },
  { code: 'SA', name: 'Santa Anita', file: 'SA_20250101_V11_COMPLETE.xlsx' },
  { code: 'GP', name: 'Gulfstream Park', file: 'GP_20250101_V11_COMPLETE.xlsx' },
  { code: 'DMR', name: 'Del Mar', file: 'DMR_20250101_V11_COMPLETE.xlsx' },
  { code: 'PRX', name: 'Parx Racing', file: 'PRX_20250101_V11_COMPLETE.xlsx' },
  { code: 'PEN', name: 'Penn National', file: 'PEN_20250101_V11_COMPLETE.xlsx' },
  { code: 'LRL', name: 'Laurel Park', file: 'LRL_20250101_V11_COMPLETE.xlsx' },
  { code: 'MVR', name: 'Mountaineer', file: 'MVR_20250101_V11_COMPLETE.xlsx' },
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
  raceAvpa: number;
  trackAvpa: number;
  isScratched: boolean;
  mu: number;
  sigma: number;
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

export interface TrackDataLoaded {
  trackCode: string;
  horses: HorseEntry[];
  connections: Map<string, Connection>;
  oddsBucketStats: Map<string, OddsBucketStats>;
  dates: string[];
}

// Cache for loaded track data
const trackCache = new Map<string, TrackDataLoaded>();

// Cache for track metadata (lightweight - just dates)
let trackMetadataCache: { code: string; name: string; dates: string[] }[] | null = null;

/**
 * Get track metadata (dates) from lightweight JSON - no Excel parsing needed
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
    console.warn('Failed to load track metadata, falling back to Excel parsing');
  }
  
  // Fall back to loading from Excel (slow path)
  return getAvailableTracksFromExcel();
}

/**
 * Get available tracks by loading Excel files (slow - avoid if possible)
 */
async function getAvailableTracksFromExcel(): Promise<{ code: string; name: string; dates: string[] }[]> {
  const tracks: { code: string; name: string; dates: string[] }[] = [];
  
  for (const track of AVAILABLE_TRACKS) {
    try {
      const data = await loadTrackData(track.code);
      
      // Filter dates with valid data
      const validDates = data.dates.filter(date => {
        const dayHorses = data.horses.filter(h => h.date === date);
        const validHorses = dayHorses.filter(h => !h.isScratched);
        return validHorses.length > 0;
      });
      
      if (validDates.length > 0) {
        tracks.push({
          code: track.code,
          name: track.name,
          dates: validDates,
        });
      }
    } catch (error) {
      console.error(`Failed to load track ${track.code}:`, error);
    }
  }
  
  return tracks;
}

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
  bucketData.forEach((points, bucket) => {
    if (points.length === 0) return;
    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
    stats.set(bucket, {
      mean,
      std: Math.sqrt(variance),
      count: points.length,
    });
  });
  
  return stats;
}

function getHorseMuSigma(horse: HorseEntry, oddsBucketStats: Map<string, OddsBucketStats>): { mu: number; sigma: number } {
  const bucket = getOddsBucket(horse.mlOddsDecimal || 0);
  const stats = oddsBucketStats.get(bucket);
  if (!stats) {
    return { mu: 0, sigma: 10 };
  }
  return { mu: stats.mean, sigma: stats.std };
}

/**
 * Load data for a specific track
 */
export async function loadTrackData(trackCode: string): Promise<TrackDataLoaded> {
  // Check cache
  if (trackCache.has(trackCode)) {
    return trackCache.get(trackCode)!;
  }

  const track = AVAILABLE_TRACKS.find(t => t.code === trackCode);
  if (!track) {
    throw new Error(`Unknown track: ${trackCode}`);
  }

  const response = await fetch(`/${track.file}`);
  if (!response.ok) {
    throw new Error(`Failed to load data for ${trackCode}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // Parse Horses sheet
  const horsesSheet = workbook.Sheets['Horses'];
  if (!horsesSheet) {
    throw new Error(`No Horses sheet found for ${trackCode}`);
  }
  
  const horsesRaw: any[] = XLSX.utils.sheet_to_json(horsesSheet);

  // First pass: create horses
  const horsesWithoutStats: HorseEntry[] = horsesRaw.map((row) => ({
    date: row.Date || '',
    race: row.Race || 0,
    horse: row.Horse || '',
    pp: row.PP || 0,
    jockey: row.Jockey || '',
    trainer: row.Trainer || '',
    sire1: row['Sire 1'] || '',
    sire2: row['Sire 2'],
    mlOdds: row['OG M/L'] || '',
    mlOddsDecimal: row['OG M/L Dec'] || 0,
    salary: row['New Sal.'] || 0,
    finish: row.Finish || 0,
    totalPoints: row['Total Points'] || 0,
    avpa: row.AVPA || 0,
    raceAvpa: row['Race AVPA'] || 0,
    trackAvpa: row['Track AVPA'] || 0,
    isScratched: row.Horse?.includes('SCR') || row.Finish === 0 || !row.Finish,
    mu: 0,
    sigma: 0,
  }));

  // Build odds bucket statistics
  const oddsBucketStats = buildOddsBucketStats(horsesWithoutStats);

  // Second pass: add μ/σ to each horse
  const horses: HorseEntry[] = horsesWithoutStats.map((horse) => {
    const { mu, sigma } = getHorseMuSigma(horse, oddsBucketStats);
    return { ...horse, mu, sigma };
  });

  // Build connections map
  const connections = new Map<string, Connection>();
  
  // Parse Jockeys sheet
  const jockeysSheet = workbook.Sheets['Jockeys'];
  if (jockeysSheet) {
    const jockeysRaw: any[] = XLSX.utils.sheet_to_json(jockeysSheet);
    jockeysRaw.forEach((row) => {
      const key = `jockey-${row.Name?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}-${row.Date}`;
      connections.set(key, {
        id: key,
        name: row.Name || '',
        role: 'jockey',
        trackSet: [trackCode],
        apps: row['New Apps'] || 0,
        avgOdds: row['New Avg. Odds'] || 0,
        salarySum: row['New Sal.'] || 0,
        pointsSum: row['Total Points'] || 0,
        avpa30d: row['Track AVPA'] || 0,
        avpaRace: row['Track AVPA'] || 0,
        starters: [],
        winRate: row['Win %'] || 0,
        itmRate: row['ITM %'] || 0,
      });
    });
  }

  // Parse Trainers sheet
  const trainersSheet = workbook.Sheets['Trainers'];
  if (trainersSheet) {
    const trainersRaw: any[] = XLSX.utils.sheet_to_json(trainersSheet);
    trainersRaw.forEach((row) => {
      const key = `trainer-${row.Name?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}-${row.Date}`;
      connections.set(key, {
        id: key,
        name: row.Name || '',
        role: 'trainer',
        trackSet: [trackCode],
        apps: row['New Apps'] || 0,
        avgOdds: row['New Avg. Odds'] || 0,
        salarySum: row['New Sal.'] || 0,
        pointsSum: row['Total Points'] || 0,
        avpa30d: row['Track AVPA'] || 0,
        avpaRace: row['Track AVPA'] || 0,
        starters: [],
        winRate: row['Win %'] || 0,
        itmRate: row['ITM %'] || 0,
      });
    });
  }

  // Parse Sires sheet
  const siresSheet = workbook.Sheets['Sires'];
  if (siresSheet) {
    const siresRaw: any[] = XLSX.utils.sheet_to_json(siresSheet);
    siresRaw.forEach((row) => {
      const key = `sire-${row.Name?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}-${row.Date}`;
      connections.set(key, {
        id: key,
        name: row.Name || '',
        role: 'sire',
        trackSet: [trackCode],
        apps: row['New Apps'] || 0,
        avgOdds: row['New Avg. Odds'] || 0,
        salarySum: row['New Sal.'] || 0,
        pointsSum: row['Total Points'] || 0,
        avpa30d: row['Track AVPA'] || 0,
        avpaRace: row['Track AVPA'] || 0,
        starters: [],
        winRate: row['Win %'] || 0,
        itmRate: row['ITM %'] || 0,
      });
    });
  }

  // Get unique dates
  const dateSet = new Set<string>();
  horses.forEach(h => {
    if (h.date) dateSet.add(h.date);
  });
  const dates = Array.from(dateSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const trackData: TrackDataLoaded = {
    trackCode,
    horses,
    connections,
    oddsBucketStats,
    dates,
  };

  // Cache the data
  trackCache.set(trackCode, trackData);

  return trackData;
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

  // Get connections for this date
  const connections: Connection[] = [];
  const seenConnections = new Set<string>();

  // Calculate connection stats from horses
  const calculateConnectionStats = (
    connectionName: string,
    role: 'jockey' | 'trainer' | 'sire'
  ) => {
    const connHorses = validDayHorses.filter((h) => {
      if (role === 'jockey') return h.jockey === connectionName;
      if (role === 'trainer') return h.trainer === connectionName;
      if (role === 'sire') return h.sire1 === connectionName || h.sire2 === connectionName;
      return false;
    });

    const mu = connHorses.reduce((sum, h) => sum + h.mu, 0);
    const variance = connHorses.reduce((sum, h) => sum + Math.pow(h.sigma, 2), 0);
    const sigma = Math.sqrt(variance);

    const starters: Starter[] = connHorses.map(h => ({
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
    }));

    return { mu, sigma, starters };
  };

  // Add connections from data
  data.connections.forEach((conn, key) => {
    if (key.endsWith(date)) {
      const connectionStats = calculateConnectionStats(conn.name, conn.role);
      if (!seenConnections.has(conn.id) && connectionStats.starters.length > 0) {
        connections.push({
          ...conn,
          mu: connectionStats.mu,
          sigma: connectionStats.sigma,
          starters: connectionStats.starters,
        });
        seenConnections.add(conn.id);
      }
    }
  });

  return { races, connections, horses: dayHorses, oddsBucketStats: data.oddsBucketStats };
}

/**
 * Get all available tracks with their race dates
 * Uses lightweight JSON metadata instead of parsing Excel files
 */
export async function getAvailableTracks(): Promise<{ code: string; name: string; dates: string[] }[]> {
  // Use the lightweight metadata (no Excel parsing)
  return getTrackMetadata();
}

/**
 * Get available dates for a specific track
 */
export async function getAvailableDates(trackCode: string = 'AQU'): Promise<{ date: string; raceCount: number; horseCount: number }[]> {
  const data = await loadTrackData(trackCode);
  
  // Group horses by date
  const dateMap = new Map<string, { total: number; scratches: number; races: Set<number> }>();
  
  data.horses.forEach((horse) => {
    if (!horse.date) return;
    const existing = dateMap.get(horse.date) || { total: 0, scratches: 0, races: new Set() };
    existing.total++;
    existing.races.add(horse.race);
    if (horse.isScratched) {
      existing.scratches++;
    }
    dateMap.set(horse.date, existing);
  });
  
  // Format dates
  const availableDates: { date: string; raceCount: number; horseCount: number }[] = [];
  
  dateMap.forEach((stats, date) => {
    const validHorses = stats.total - stats.scratches;
    if (validHorses > 0) {
      availableDates.push({
        date,
        raceCount: stats.races.size,
        horseCount: stats.total,
      });
    }
  });
  
  // Sort by date (newest first)
  return availableDates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
  const trackDates = new Map<string, Set<string>>();
  
  for (const code of trackCodes) {
    try {
      const data = await loadTrackData(code);
      trackDates.set(code, new Set(data.dates));
    } catch (error) {
      console.error(`Failed to load dates for ${code}:`, error);
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
