/**
 * Shared utility for transforming MongoDB track data
 * Used by both public tracks API and admin track data API
 */

import { fractionalToDecimal, isAlsoEligible } from './calculations';
import { calculateSalaryBasedOnOdds } from './calculations';

export interface TransformedRecord {
  track: string;
  race: number;
  horse: string;
  jockey: string | null;
  trainer: string | null;
  sire1: string | null;
  sire2: string | null;
  ml_odds_frac: string | null;
  ml_odds_decimal: number | null;
  is_also_eligible: boolean;
  scratched: boolean;
  salary: number;
  points: number;
  place: number | null;
  program_number: number | null;
  post_time?: string | null;
}

function normalizeToIso(dateValue: any): string | null {
  if (!dateValue) {
    return null;
  }

  const attempt = (value: any): string | null => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === 'number') {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber.toISOString();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      // If the string already looks like an ISO date, try parsing directly
      const direct = new Date(trimmed);
      if (!Number.isNaN(direct.getTime())) {
        return direct.toISOString();
      }
    }

    return null;
  };

  return attempt(dateValue);
}

function combineDateAndTime(datePart: string | undefined, timePart: string): string | null {
  if (!datePart) return null;
  const trimmedDate = datePart.trim();
  if (!trimmedDate) return null;

  const cleanTime = timePart.trim();
  if (!cleanTime) return null;

  // Ensure time has seconds
  const finalTime = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
  const isoCandidate = `${trimmedDate}T${finalTime}`;
  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function extractPostTime(raceDoc: any): string | null {
  if (!raceDoc || typeof raceDoc !== 'object') {
    return null;
  }

  const dateCandidates: Array<string | undefined> = [
    raceDoc.raceDate,
    raceDoc.race_date,
    raceDoc.raceDateForDB,
    raceDoc.race_date_for_db,
    raceDoc.raceDateIso,
    raceDoc.race_date_iso,
    raceDoc.date,
  ];

  const timeCandidates = [
    raceDoc.postTimeUtc,
    raceDoc.postTimeUTC,
    raceDoc.postTime,
    raceDoc.post_time,
    raceDoc.scheduledPostTime,
    raceDoc.scheduled_post_time,
    raceDoc.startTime,
    raceDoc.start_time,
    raceDoc.raceDateTime,
    raceDoc.race_date_time,
    raceDoc.raceDateUtc,
    raceDoc.race_date_utc,
  ];

  for (const candidate of timeCandidates) {
    const iso = normalizeToIso(candidate);
    if (iso) return iso;

    if (typeof candidate === 'string') {
      const timeString = candidate.trim();
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
        for (const datePart of dateCandidates) {
          const combined = combineDateAndTime(datePart, timeString);
          if (combined) {
            return combined;
          }
        }
      }
    }
  }

  // As a fallback, if raceDoc has a numeric timestamp field
  if (typeof raceDoc.timestamp === 'number') {
    const fromTimestamp = new Date(raceDoc.timestamp);
    if (!Number.isNaN(fromTimestamp.getTime())) {
      return fromTimestamp.toISOString();
    }
  }

  return null;
}

/**
 * Transform MongoDB race documents to TrackData format
 */
export function transformRaceDocs(raceDocs: any[], trackCode: string): TransformedRecord[] {
  // Sort by race number
  const sortedRaces = raceDocs.sort((a: any, b: any) => {
    const raceNumA = parseInt(a.raceNameForDB?.split('-').pop() || '0');
    const raceNumB = parseInt(b.raceNameForDB?.split('-').pop() || '0');
    return raceNumA - raceNumB;
  });

  const records: TransformedRecord[] = [];

  for (const raceDoc of sortedRaces) {
    if (!raceDoc.starters || !Array.isArray(raceDoc.starters)) {
      continue;
    }

    const raceNum = parseInt(raceDoc.raceNameForDB?.split('-').pop() || '0');
    const racePostTimeIso = extractPostTime(raceDoc);

    for (const starter of raceDoc.starters) {
      const st = starter.starter || starter;
      const horse = st.horse || {};
      const jockey = st.jockey || {};
      const trainer = st.trainer || {};
      const sire = st.sire || {};
      const damSire = st.damSire || {};

      const horseName = (horse.name || '').trim();
      if (!horseName) continue;

      const jockeyName = [
        jockey.firstName || '',
        jockey.middleName || '',
        jockey.lastName || '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      const trainerName = [
        trainer.firstName || '',
        trainer.middleName || '',
        trainer.lastName || '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      const sire1Name = (sire.name || '').trim() || null;
      const sire2Name = (damSire.name || '').trim() || null;

      const mlOddsFrac = (st.morningLineOdds || '').trim() || null;
      const decimalOdds = mlOddsFrac ? fractionalToDecimal(mlOddsFrac) : null;
      const alsoEligible = isAlsoEligible(st);
      const salary = calculateSalaryBasedOnOdds(decimalOdds, alsoEligible);
      const scratched =
        st.scratched === true ||
        st.scratchIndicator === true ||
        st.scratchIndicator === 'Y' ||
        st.scratchIndicator === 'y';

      let programNumber: number | null = null;
      const rawProgramNumber = st.programNumber || st.program_number;
      if (rawProgramNumber !== null && rawProgramNumber !== undefined) {
        const parsed = parseInt(String(rawProgramNumber), 10);
        programNumber = !isNaN(parsed) && parsed > 0 ? parsed : null;
      }

      // Extract keys for performance data lookup
      const jockeyKey = jockey.key || null;
      const trainerKey = trainer.key || null;
      const sire1Key = sire.referenceNumber || sire.key || null;
      const sire2Key = damSire.referenceNumber || damSire.key || null;

      records.push({
        track: trackCode,
        race: raceNum,
        horse: horseName,
        jockey: jockeyName,
        trainer: trainerName,
        sire1: sire1Name,
        sire2: sire2Name,
        jockey_key: jockeyKey, // For AVPA lookup
        trainer_key: trainerKey, // For AVPA lookup
        sire1_key: sire1Key, // For AVPA lookup
        sire2_key: sire2Key, // For AVPA lookup
        ml_odds_frac: mlOddsFrac,
        ml_odds_decimal: decimalOdds,
        is_also_eligible: alsoEligible,
        scratched: scratched,
        salary: salary,
        points: 0,
        place: null,
        program_number: programNumber,
        post_time: racePostTimeIso,
      });
    }
  }

  // Sort by race, then by horse name
  records.sort((a, b) => {
    if (a.race !== b.race) return a.race - b.race;
    return a.horse.localeCompare(b.horse);
  });

  return records;
}

/**
 * Calculate metadata from transformed records
 * 
 * Note: Jockeys, trainers, and sires are counted from ALL records (including scratched and AE)
 * because they represent the connections available for matchups, regardless of whether
 * the horse actually raced.
 */
export function calculateMetadata(records: TransformedRecord[], trackCode: string, date: string) {
  const races = new Set(records.map(r => r.race));
  const horses = records.length;
  const racePostTimes = new Map<string, string>();

  for (const record of records) {
    if (record.post_time) {
      const key = `${record.track}-${record.race}`;
      if (!racePostTimes.has(key)) {
        racePostTimes.set(key, record.post_time);
      }
    }
  }

  const postTimes = Array.from(racePostTimes.values()).sort();
  const firstPostTime = postTimes.length > 0 ? postTimes[0] : null;
  const lastPostTime = postTimes.length > 0 ? postTimes[postTimes.length - 1] : null;

  let lockTime: string | null = null;
  if (firstPostTime) {
    const firstDate = new Date(firstPostTime);
    if (!Number.isNaN(firstDate.getTime())) {
      const lockDate = new Date(firstDate.getTime() - 10 * 60 * 1000);
      lockTime = lockDate.toISOString();
    }
  }

  // Non-scratched: excludes scratched horses but includes AE (Also Eligible)
  // AE horses didn't race but are still "non-scratched" in the sense they were eligible
  const nonScratched = records.filter(r => !r.scratched);
  
  // Count unique jockeys, trainers, and sires from ALL records
  // This includes scratched and AE horses because connections are still valid for matchups
  const jockeys = new Set<string>();
  const trainers = new Set<string>();
  const sires = new Set<string>();
  
  for (const record of records) {
    // Count from all records, not just non-scratched
    if (record.jockey) jockeys.add(record.jockey);
    if (record.trainer) trainers.add(record.trainer);
    if (record.sire1) sires.add(record.sire1);
    if (record.sire2) sires.add(record.sire2);
  }

  return {
    races_count: races.size,
    horses_count: horses, // Total horses including scratched and AE
    non_scratched_count: nonScratched.length, // Excludes scratched, includes AE
    jockeys_count: jockeys.size,
    trainers_count: trainers.size,
    sires_count: sires.size,
    post_times: postTimes,
    first_post_time: firstPostTime,
    last_post_time: lastPostTime,
    lock_time: lockTime,
    track_code: trackCode,
    date,
    fetched_at: new Date().toISOString(),
  };
}

