/**
 * Fetch past race data for connections (last 5 races)
 * Queries historical results from MongoDB
 */

import { getEquibaseResults } from './mongodb';
import { calculateSalaryBasedOnOdds, fractionalToDecimal } from './calculations';

interface PastRace {
  track: string;
  date: string;
  race: number;
  horseName: string;
  place: number | null;
  points: number;
  salary: number;
}

/**
 * Get past races for a connection (jockey/trainer/sire)
 * Returns last 5 races before the given date
 */
export async function getPastRaces(
  connectionName: string,
  role: 'jockey' | 'trainer' | 'sire',
  beforeDate: string, // Format: YYYY-MM-DD
  limit: number = 5
): Promise<PastRace[]> {
  try {
    const resultsCollection = await getEquibaseResults();
    
    // Query for results before the given date
    // We'll search for races where this connection appears
    // Note: This is a simplified approach - in production, you might want to
    // query by connection key or use a more efficient index
    
    const query: any = {
      'raceDate': { $lt: beforeDate }, // Before the contest date
    };
    
    // For now, we'll fetch recent results and filter by connection name
    // In a production system, you'd want to index by jockey/trainer/sire keys
    const results = await resultsCollection
      .find(query)
      .sort({ raceDate: -1, raceNameForDB: 1 }) // Most recent first
      .limit(100) // Fetch more to filter
      .toArray();
    
    const pastRaces: PastRace[] = [];
    
    for (const resultDoc of results) {
      if (!resultDoc.starters || !Array.isArray(resultDoc.starters)) {
        continue;
      }
      
      const raceDate = resultDoc.raceDate || resultDoc.raceNameForDB?.split('-')[1] || '';
      const raceNum = parseInt(resultDoc.raceNameForDB?.split('-').pop() || '0');
      const trackCode = resultDoc.raceNameForDB?.split('-')[0] || '';
      
      for (const starter of resultDoc.starters) {
        const st = starter.starter || starter;
        const horse = st.horse || {};
        const horseName = (horse.name || '').trim();
        
        if (!horseName) continue;
        
        // Check if this connection matches
        let matches = false;
        if (role === 'jockey') {
          const jockey = st.jockey || {};
          const jockeyName = [
            jockey.firstName || '',
            jockey.middleName || '',
            jockey.lastName || '',
          ].filter(Boolean).join(' ').trim();
          matches = jockeyName.toLowerCase() === connectionName.toLowerCase();
        } else if (role === 'trainer') {
          const trainer = st.trainer || {};
          const trainerName = [
            trainer.firstName || '',
            trainer.middleName || '',
            trainer.lastName || '',
          ].filter(Boolean).join(' ').trim();
          matches = trainerName.toLowerCase() === connectionName.toLowerCase();
        } else if (role === 'sire') {
          const sire = st.sire || {};
          const sireName = (sire.name || '').trim();
          matches = sireName.toLowerCase() === connectionName.toLowerCase();
        }
        
        if (matches) {
          const pos = parseFinish(st.mutuelFinish || st.finishPosition || st.finish || st.place);
          const win = parseFloat(String(st.winPayoff || 0)) || 0;
          const place = parseFloat(String(st.placePayoff || 0)) || 0;
          const show = parseFloat(String(st.showPayoff || 0)) || 0;
          
          // Calculate points (matching Python logic)
          const bonus = pos === 1 ? 25 : pos === 2 ? 15 : pos === 3 ? 5 : 0;
          const points = (win + place + show) / 100.0 + bonus;
          
          // Calculate salary from morning line odds
          const mlOdds = (st.morningLineOdds || '').trim();
          const decimalOdds = mlOdds ? fractionalToDecimal(mlOdds) : null;
          const isAE = (st.scratchIndicator || '').toUpperCase() === 'A';
          const salary = calculateSalaryBasedOnOdds(decimalOdds, isAE);
          
          pastRaces.push({
            track: trackCode,
            date: raceDate,
            race: raceNum,
            horseName,
            place: pos > 0 ? pos : null,
            points,
            salary,
          });
          
          if (pastRaces.length >= limit) {
            break;
          }
        }
      }
      
      if (pastRaces.length >= limit) {
        break;
      }
    }
    
    // Sort by date descending (most recent first) and limit
    return pastRaces
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  } catch (error) {
    console.error(`Error fetching past races for ${role} ${connectionName}:`, error);
    return [];
  }
}

function parseFinish(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

