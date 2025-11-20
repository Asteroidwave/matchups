import { Router, Request, Response } from 'express';
import { getEquibaseEntries, getEquibaseResults } from '../utils/mongodb';
import { fractionalToDecimal, isAlsoEligible } from '../utils/calculations';
import { calculateSalaryBasedOnOdds } from '../utils/calculations';
import { getCache, setCache } from '../utils/redis';
import { extractPostTime } from '../utils/trackDataTransform';

export const tracksRouter = Router();

/**
 * GET /api/tracks/:track/entries?date=YYYY-MM-DD
 * 
 * Fetch entries for a specific track and date from MongoDB
 * Returns data in the same format as the static JSON files
 */
tracksRouter.get('/:track/entries', async (req: Request, res: Response) => {
  try {
    const { track } = req.params;
    const date = req.query.date as string;

    if (!date) {
      return res.status(400).json({
        error: 'Date parameter is required (format: YYYY-MM-DD)',
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Check cache first (24 hour TTL for past data, 1 hour for future)
    const cacheKey = `entries:${track.toUpperCase()}:${date}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const entriesCollection = await getEquibaseEntries();

    // Query MongoDB using raceNameForDB field (matching Python script logic)
    // Python uses: {'raceNameForDB': {'$regex': f'^{TRACK}-{DATE}-'}}
    const trackUpper = track.toUpperCase();
    const query = {
      raceNameForDB: {
        $regex: `^${trackUpper}-${date}-`,
      },
    };

    // Get all race documents for this track/date
    const raceDocs = await entriesCollection.find(query).toArray();

    if (raceDocs.length === 0) {
      const response = {
        track: trackUpper,
        records: [],
        message: 'No entries found for this track and date',
      };
      // Cache for 24 hours (past data) or 1 hour (future data)
      const isPastDate = new Date(date) < new Date();
      const ttl = isPastDate ? 24 * 60 * 60 : 60 * 60; // 24 hours for past, 1 hour for future
      await setCache(cacheKey, response, ttl);
      return res.json(response);
    }

    // Extract race number from raceNameForDB and sort by race number
    // raceNameForDB format: "GP-2025-11-02-1" where last number is race number
    const sortedRaces = raceDocs.sort((a: any, b: any) => {
      const raceNumA = parseInt(a.raceNameForDB?.split('-').pop() || '0');
      const raceNumB = parseInt(b.raceNameForDB?.split('-').pop() || '0');
      return raceNumA - raceNumB;
    });

    // Transform MongoDB documents to match our TrackData format
    // Each raceDoc has a 'starters' array that we need to flatten
    const records: any[] = [];
    
    for (const raceDoc of sortedRaces) {
      if (!raceDoc.starters || !Array.isArray(raceDoc.starters)) {
        continue;
      }

      // Extract race number from raceNameForDB (e.g., "GP-2025-11-02-1" -> 1)
      const raceNum = parseInt(raceDoc.raceNameForDB?.split('-').pop() || '0');

      // Extract post time for this race (same for all starters in this race)
      const racePostTime = extractPostTime(raceDoc);

      for (const starter of raceDoc.starters) {
        // Handle nested structure: starter.starter or just starter
        const st = starter.starter || starter;
        const horse = st.horse || {};
        const jockey = st.jockey || {};
        const trainer = st.trainer || {};
        const sire = st.sire || {};
        const damSire = st.damSire || {};
        
        // Get horse name
        const horseName = (horse.name || '').trim();
        if (!horseName) continue; // Skip if no horse name
        
        // Combine jockey name (firstName, middleName, lastName)
        const jockeyName = [
          jockey.firstName || '',
          jockey.middleName || '',
          jockey.lastName || '',
        ]
          .filter(Boolean)
          .join(' ')
          .trim() || null;
        
        // Combine trainer name
        const trainerName = [
          trainer.firstName || '',
          trainer.middleName || '',
          trainer.lastName || '',
        ]
          .filter(Boolean)
          .join(' ')
          .trim() || null;
        
        // Get sire names
        const sire1Name = (sire.name || '').trim() || null;
        const sire2Name = (damSire.name || '').trim() || null;
        
        // Get morning line odds
        const mlOddsFrac = (st.morningLineOdds || '').trim() || null;
        const decimalOdds = mlOddsFrac ? fractionalToDecimal(mlOddsFrac) : null;

        // Check if also eligible
        const alsoEligible = isAlsoEligible(st);

        // Calculate salary
        const salary = calculateSalaryBasedOnOdds(decimalOdds, alsoEligible);

        // Check if scratched
        const scratched = st.scratched === true || st.scratchIndicator === 'S';

        // Get program number (the saddlecloth number that doesn't change)
        // Python uses: starter.get('postPosition') or starter.get('programNumber')
        // We use ONLY programNumber - it doesn't change when horses scratch
        // Parse program number - handle string, number, or null/undefined
        let programNumber: number | null = null;
        const rawProgramNumber = st.programNumber || st.program_number;
        if (rawProgramNumber !== null && rawProgramNumber !== undefined) {
          const parsed = parseInt(String(rawProgramNumber), 10);
          programNumber = !isNaN(parsed) && parsed > 0 ? parsed : null;
        }

        records.push({
          track: trackUpper,
          race: raceNum,
          horse: horseName,
          jockey: jockeyName,
          trainer: trainerName,
          sire1: sire1Name,
          sire2: sire2Name,
          ml_odds_frac: mlOddsFrac,
          ml_odds_decimal: decimalOdds,
          is_also_eligible: alsoEligible,
          scratched: scratched,
          salary: salary,
          points: 0, // Will be populated from results if available
          place: null, // Will be populated from results if available
          program_number: programNumber, // The saddlecloth number (doesn't change) - ONLY THIS, NO POST POSITION
          post_time: racePostTime, // Post time for this race (from raceDoc)
        });
      }
    }

    // Sort by race, then by horse name
    records.sort((a, b) => {
      if (a.race !== b.race) return a.race - b.race;
      return a.horse.localeCompare(b.horse);
    });

    const response = {
      track: trackUpper,
      records,
    };

    // Cache the response (24 hours for past data, 1 hour for future)
    const isPastDate = new Date(date) < new Date();
    const ttl = isPastDate ? 24 * 60 * 60 : 60 * 60; // 24 hours for past, 1 hour for future
    await setCache(cacheKey, response, ttl);

    res.json(response);
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({
      error: 'Failed to fetch entries',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tracks/:track/results?date=YYYY-MM-DD
 * 
 * Fetch race results for a specific track and date
 */
tracksRouter.get('/:track/results', async (req: Request, res: Response) => {
  try {
    const { track } = req.params;
    const date = req.query.date as string;

    if (!date) {
      return res.status(400).json({
        error: 'Date parameter is required (format: YYYY-MM-DD)',
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Check cache first (24 hour TTL for past data, 1 hour for future)
    const cacheKey = `results:${track.toUpperCase()}:${date}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const resultsCollection = await getEquibaseResults();

    // Query MongoDB using raceNameForDB field (matching Python script logic)
    // Python uses: {'raceNameForDB': {'$regex': f'^{TRACK}-{DATE}-'}}
    const trackUpper = track.toUpperCase();
    const query = {
      raceNameForDB: {
        $regex: `^${trackUpper}-${date}-`,
      },
    };

    const resultsDocs = await resultsCollection.find(query).toArray();

    // Extract race number from raceNameForDB and sort by race number
    const sortedResults = resultsDocs.sort((a: any, b: any) => {
      const raceNumA = parseInt(a.raceNameForDB?.split('-').pop() || '0');
      const raceNumB = parseInt(b.raceNameForDB?.split('-').pop() || '0');
      return raceNumA - raceNumB;
    });

    // Transform results to include race number and starters
    const results = sortedResults.map((doc: any) => {
      const raceNum = parseInt(doc.raceNameForDB?.split('-').pop() || '0');
      return {
        raceNameForDB: doc.raceNameForDB,
        race: raceNum,
        starters: doc.starters || [],
        ...doc, // Include all other fields
      };
    });

    const response = {
      track: trackUpper,
      date: date,
      results: results,
    };

    // Cache the response (24 hours for past data, 1 hour for future)
    const isPastDate = new Date(date) < new Date();
    const ttl = isPastDate ? 24 * 60 * 60 : 60 * 60; // 24 hours for past, 1 hour for future
    await setCache(cacheKey, response, ttl);

    res.json(response);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      error: 'Failed to fetch results',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

