/**
 * Fetch AVPA (Average Value Per Appearance) and past performance data
 * from MongoDB performance collections
 */

import { getJockeyPerformances, getTrainerPerformances, getSirePerformances } from './mongodb';

interface PerformanceData {
  avpa30: number;
  avpa90: number;
}

// Cache performance data to avoid repeated MongoDB queries
let jockeyPerfCache: Map<string, PerformanceData> | null = null;
let trainerPerfCache: Map<string, PerformanceData> | null = null;
let sirePerfCache: Map<string, PerformanceData> | null = null;
let mongoPerformanceWarningLogged = false;

function canUseMongoPerformanceData(): boolean {
  if (process.env.MONGODB_URI_STAGING) return true;
  if (!mongoPerformanceWarningLogged) {
    console.warn(
      '⚠️ MongoDB performance data is not configured (MONGODB_URI_STAGING missing). ' +
        'Continuing without AVPA metrics.'
    );
    mongoPerformanceWarningLogged = true;
  }
  return false;
}

/**
 * Load jockey performance data from MongoDB
 */
export async function loadJockeyPerformanceData(): Promise<Map<string, PerformanceData>> {
  if (jockeyPerfCache) {
    return jockeyPerfCache;
  }

  const cache = new Map<string, PerformanceData>();
  try {
    if (!canUseMongoPerformanceData()) {
      jockeyPerfCache = cache;
      return cache;
    }
    const jPerfCol = await getJockeyPerformances();
    const docs = await jPerfCol.find({}).toArray();

    for (const doc of docs) {
      const key = doc.jockey_key || '';
      if (!key) continue;

      const p30 = doc.thirty_days || {};
      const p90 = doc.ninety_days || {};

      cache.set(key, {
        avpa30: parseFloat(String(p30.average_value_per_appearance || 0)) || 0,
        avpa90: parseFloat(String(p90.average_value_per_appearance || 0)) || 0,
      });
    }

    jockeyPerfCache = cache;
    console.log(`✅ Loaded ${cache.size} jockey performance records`);
  } catch (error) {
    console.error('❌ Error loading jockey performance data:', error);
  }

  return cache;
}

/**
 * Load trainer performance data from MongoDB
 */
export async function loadTrainerPerformanceData(): Promise<Map<string, PerformanceData>> {
  if (trainerPerfCache) {
    return trainerPerfCache;
  }

  const cache = new Map<string, PerformanceData>();
  try {
    if (!canUseMongoPerformanceData()) {
      trainerPerfCache = cache;
      return cache;
    }
    const tPerfCol = await getTrainerPerformances();
    const docs = await tPerfCol.find({}).toArray();

    for (const doc of docs) {
      const key = doc.trainer_key || '';
      if (!key) continue;

      const p30 = doc.thirty_days || {};
      const p90 = doc.ninety_days || {};

      cache.set(key, {
        avpa30: parseFloat(String(p30.average_value_per_appearance || 0)) || 0,
        avpa90: parseFloat(String(p90.average_value_per_appearance || 0)) || 0,
      });
    }

    trainerPerfCache = cache;
    console.log(`✅ Loaded ${trainerPerfCache.size} trainer performance records`);
  } catch (error) {
    console.error('❌ Error loading trainer performance data:', error);
  }

  return cache;
}

/**
 * Load sire performance data from MongoDB
 */
export async function loadSirePerformanceData(): Promise<Map<string, PerformanceData>> {
  if (sirePerfCache) {
    return sirePerfCache;
  }

  const cache = new Map<string, PerformanceData>();
  try {
    if (!canUseMongoPerformanceData()) {
      sirePerfCache = cache;
      return cache;
    }
    const sPerfCol = await getSirePerformances();
    const docs = await sPerfCol.find({}).toArray();

    for (const doc of docs) {
      const key = doc.key || '';
      if (!key) continue;

      const p30 = doc.thirty_days || {};
      const p90 = doc.ninety_days || {};

      cache.set(key, {
        avpa30: parseFloat(String(p30.average_value_per_appearance || 0)) || 0,
        avpa90: parseFloat(String(p90.average_value_per_appearance || 0)) || 0,
      });
    }

    sirePerfCache = cache;
    console.log(`✅ Loaded ${sirePerfCache.size} sire performance records`);
  } catch (error) {
    console.error('❌ Error loading sire performance data:', error);
  }

  return cache;
}

/**
 * Clear performance caches (useful for testing or refreshing data)
 */
export function clearPerformanceCaches(): void {
  jockeyPerfCache = null;
  trainerPerfCache = null;
  sirePerfCache = null;
}

