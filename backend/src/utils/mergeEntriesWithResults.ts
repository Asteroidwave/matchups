/**
 * Merge entries with results and calculate points
 * Matches the logic from unified_matchup_generator.py
 */

import { TransformedRecord } from './trackDataTransform';

const FINISH_BONUS: Record<number, number> = {
  1: 25,
  2: 15,
  3: 5,
};

/**
 * Parse finish position from result data
 */
function parseFinish(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Calculate points from race results (matching Python logic)
 * Python: points = (win + place + show) / 100.0 + bonus
 */
function calculatePointsFromResults(win: number, place: number, show: number, finishPos: number): number {
  const bonus = FINISH_BONUS[finishPos] || 0;
  return (win + place + show) / 100.0 + bonus;
}

/**
 * Build result lookup map from MongoDB results documents
 * Python: result_lookup[ref] = { 'pos': pos, 'win': win, 'plc': place, 'sho': show }
 */
function buildResultLookup(resultsDocs: any[]): Map<string, { pos: number; win: number; place: number; show: number }> {
  const lookup = new Map<string, { pos: number; win: number; place: number; show: number }>();
  
  for (const resultDoc of resultsDocs) {
    if (!resultDoc.starters || !Array.isArray(resultDoc.starters)) {
      continue;
    }
    
    for (const starterItem of resultDoc.starters) {
      // starterItem has: { starter: {...}, mutuelFinish, winPayoff, placePayoff, showPayoff, ... }
      // The nested 'starter' object has: horse, owner, trainer, jockey, programNumber, etc.
      const st = starterItem.starter || starterItem;
      const horse = st.horse || {};
      const horseRef = horse.referenceNumber;
      
      if (!horseRef) continue;
      
      // Extract finish position and payoffs from TOP LEVEL of starter item (not from nested starter)
      const pos = parseFinish(
        starterItem.mutuelFinish || 
        starterItem.officialFinish ||
        starterItem.finishPosition || 
        starterItem.finish || 
        starterItem.place ||
        // Fallback to nested starter
        st.mutuelFinish ||
        st.finishPosition ||
        st.finish ||
        st.place ||
        0
      );
      const win = parseFloat(String(
        starterItem.winPayoff || 
        starterItem.winPayoffAmount || 
        starterItem.win || 
        starterItem.winPayout ||
        // Fallback to nested starter
        st.winPayoff ||
        st.winPayoffAmount ||
        st.win ||
        st.winPayout ||
        0
      )) || 0;
      const place = parseFloat(String(
        starterItem.placePayoff || 
        starterItem.placePayoffAmount || 
        starterItem.place || 
        starterItem.placePayout ||
        // Fallback to nested starter
        st.placePayoff ||
        st.placePayoffAmount ||
        st.place ||
        st.placePayout ||
        0
      )) || 0;
      const show = parseFloat(String(
        starterItem.showPayoff || 
        starterItem.showPayoffAmount || 
        starterItem.show || 
        starterItem.showPayout ||
        // Fallback to nested starter
        st.showPayoff ||
        st.showPayoffAmount ||
        st.show ||
        st.showPayout ||
        0
      )) || 0;
      
      lookup.set(String(horseRef), { pos, win, place, show });
    }
  }
  
  return lookup;
}

/**
 * Build result lookup by program number (most reliable matching method)
 */
function buildResultLookupByProgramNumber(resultsDocs: any[], trackCode: string): Map<string, { pos: number; win: number; place: number; show: number }> {
  const lookup = new Map<string, { pos: number; win: number; place: number; show: number }>();
  
  for (const resultDoc of resultsDocs) {
    if (!resultDoc.starters || !Array.isArray(resultDoc.starters)) {
      continue;
    }
    
    // Try multiple ways to get race number
    let raceNum = 0;
    if (resultDoc.raceNameForDB) {
      const parts = resultDoc.raceNameForDB.split('-');
      raceNum = parseInt(parts[parts.length - 1] || '0');
    }
    if (raceNum === 0 && resultDoc.race) {
      raceNum = parseInt(String(resultDoc.race), 10) || 0;
    }
    
    for (const starterItem of resultDoc.starters) {
      // starterItem has: { starter: {...}, mutuelFinish, winPayoff, placePayoff, showPayoff, ... }
      // The nested 'starter' object has: horse, owner, trainer, jockey, programNumber, etc.
      const st = starterItem.starter || starterItem;
      
      // Extract program number from nested starter object
      const rawProgramNumber = st.programNumber || st.program_number;
      if (rawProgramNumber === null || rawProgramNumber === undefined) continue;
      
      // Handle program numbers like " 9 " or " 1A" - extract just the number part
      const programNumberStr = String(rawProgramNumber).trim();
      const programNumber = parseInt(programNumberStr, 10);
      if (isNaN(programNumber) || programNumber <= 0) continue;
      
      // Create key: track-race-programNumber
      const key = `${trackCode}-${raceNum}-${programNumber}`;
      
      // Extract finish position from TOP LEVEL of starter item (not from nested starter)
      const pos = parseFinish(
        starterItem.mutuelFinish || 
        starterItem.officialFinish ||
        starterItem.finishPosition || 
        starterItem.finish || 
        starterItem.place ||
        // Fallback to nested starter (in case structure differs)
        st.mutuelFinish ||
        st.finishPosition ||
        st.finish ||
        st.place ||
        0
      );
      
      // Extract payoffs from TOP LEVEL of starter item (not from nested starter)
      const win = parseFloat(String(
        starterItem.winPayoff || 
        starterItem.winPayoffAmount || 
        starterItem.win || 
        starterItem.winPayout ||
        // Fallback to nested starter
        st.winPayoff ||
        st.winPayoffAmount ||
        st.win ||
        st.winPayout ||
        0
      )) || 0;
      
      const place = parseFloat(String(
        starterItem.placePayoff || 
        starterItem.placePayoffAmount || 
        starterItem.place || 
        starterItem.placePayout ||
        // Fallback to nested starter
        st.placePayoff ||
        st.placePayoffAmount ||
        st.place ||
        st.placePayout ||
        0
      )) || 0;
      
      const show = parseFloat(String(
        starterItem.showPayoff || 
        starterItem.showPayoffAmount || 
        starterItem.show || 
        starterItem.showPayout ||
        // Fallback to nested starter
        st.showPayoff ||
        st.showPayoffAmount ||
        st.show ||
        st.showPayout ||
        0
      )) || 0;
      
      const resultData = { pos, win, place, show };
      lookup.set(key, resultData);
    }
  }
  
  return lookup;
}

/**
 * Build result lookup by horse name (fallback if program number not available)
 */
function buildResultLookupByName(resultsDocs: any[], trackCode: string): Map<string, { pos: number; win: number; place: number; show: number }> {
  const lookup = new Map<string, { pos: number; win: number; place: number; show: number }>();
  
  // Helper to normalize horse names for matching (remove extra spaces, handle case)
  const normalizeName = (name: string): string => {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  };
  
  for (const resultDoc of resultsDocs) {
    if (!resultDoc.starters || !Array.isArray(resultDoc.starters)) {
      continue;
    }
    
    // Try multiple ways to get race number
    let raceNum = 0;
    if (resultDoc.raceNameForDB) {
      const parts = resultDoc.raceNameForDB.split('-');
      raceNum = parseInt(parts[parts.length - 1] || '0');
    }
    if (raceNum === 0 && resultDoc.race) {
      raceNum = parseInt(String(resultDoc.race), 10) || 0;
    }
    
    // Debug: Log race number extraction
    if (resultsDocs.length > 0 && resultsDocs.indexOf(resultDoc) === 0) {
      console.log(`[buildResultLookupByName] First result doc - raceNameForDB: ${resultDoc.raceNameForDB}, extracted raceNum: ${raceNum}, doc.race: ${resultDoc.race}`);
    }
    
    for (const starterItem of resultDoc.starters) {
      // starterItem has: { starter: {...}, mutuelFinish, winPayoff, placePayoff, showPayoff, ... }
      // The nested 'starter' object has: horse, owner, trainer, jockey, programNumber, etc.
      const st = starterItem.starter || starterItem;
      const horse = st.horse || {};
      const horseName = (horse.name || '').trim();
      
      if (!horseName) continue;
      
      // Create multiple keys for matching (exact, normalized)
      const exactKey = `${trackCode}-${raceNum}-${horseName}`;
      const normalizedKey = `${trackCode}-${raceNum}-${normalizeName(horseName)}`;
      
      // Extract finish position from TOP LEVEL of starter item (not from nested starter)
      const pos = parseFinish(
        starterItem.mutuelFinish || 
        starterItem.officialFinish ||
        starterItem.finishPosition || 
        starterItem.finish || 
        starterItem.place ||
        // Fallback to nested starter
        st.mutuelFinish ||
        st.finishPosition ||
        st.finish ||
        st.place ||
        0
      );
      
      // Extract payoffs from TOP LEVEL of starter item (not from nested starter)
      const win = parseFloat(String(
        starterItem.winPayoff || 
        starterItem.winPayoffAmount || 
        starterItem.win || 
        starterItem.winPayout ||
        // Fallback to nested starter
        st.winPayoff ||
        st.winPayoffAmount ||
        st.win ||
        st.winPayout ||
        0
      )) || 0;
      
      const place = parseFloat(String(
        starterItem.placePayoff || 
        starterItem.placePayoffAmount || 
        starterItem.place || 
        starterItem.placePayout ||
        // Fallback to nested starter
        st.placePayoff ||
        st.placePayoffAmount ||
        st.place ||
        st.placePayout ||
        0
      )) || 0;
      
      const show = parseFloat(String(
        starterItem.showPayoff || 
        starterItem.showPayoffAmount || 
        starterItem.show || 
        starterItem.showPayout ||
        // Fallback to nested starter
        st.showPayoff ||
        st.showPayoffAmount ||
        st.show ||
        st.showPayout ||
        0
      )) || 0;
      
      const resultData = { pos, win, place, show };
      
      // Store with both exact and normalized keys for better matching
      lookup.set(exactKey, resultData);
      lookup.set(normalizedKey, resultData);
    }
  }
  
  return lookup;
}

/**
 * Merge entries with results and calculate points
 * Matches unified_matchup_generator.py logic
 */
export function mergeEntriesWithResults(
  entries: TransformedRecord[],
  resultsDocs: any[],
  trackCode: string
): TransformedRecord[] {
  const hasResults =
    Array.isArray(resultsDocs) &&
    resultsDocs.some((doc) => Array.isArray(doc?.starters) && doc.starters.length > 0);
  
  // Build result lookup maps in priority order:
  // 1. Program number (most reliable) - track-race-programNumber
  // 2. Reference number (if available) - referenceNumber
  // 3. Horse name (fallback) - track-race-horseName
  const resultLookupByProgramNumber = buildResultLookupByProgramNumber(resultsDocs, trackCode);
  const resultLookupByRef = buildResultLookup(resultsDocs);
  const resultLookupByName = buildResultLookupByName(resultsDocs, trackCode);
  
  // Helper to normalize horse names for matching
  const normalizeName = (name: string): string => {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  };
  
  // Merge entries with results
  // Try matching in priority order: 1) program number, 2) reference number, 3) horse name
  let matchMethodStats = { programNumber: 0, refNumber: 0, name: 0, none: 0 };
  
  const mergedRecords: TransformedRecord[] = entries.map((entry) => {
    const horseName = entry.horse;
    const raceNum = entry.race;
    const programNumber = entry.program_number;
    
    let resultData: { pos: number; win: number; place: number; show: number } | undefined;
    let matchMethod = '';
    
    // Method 1: Try program number match (most reliable)
    if (programNumber !== null && programNumber !== undefined && programNumber > 0) {
      const programKey = `${trackCode}-${raceNum}-${programNumber}`;
      resultData = resultLookupByProgramNumber.get(programKey);
      if (resultData) {
        matchMethod = 'programNumber';
        matchMethodStats.programNumber++;
      }
    }
    
    // Method 2: Try reference number match (if not found by program number)
    if (!resultData) {
      // Note: We don't have referenceNumber in entries currently, so skip this for now
      // Could be added if needed in the future
    }
    
    // Method 3: Try horse name match (fallback)
    if (!resultData) {
    const exactKey = `${trackCode}-${raceNum}-${horseName}`;
    const normalizedKey = `${trackCode}-${raceNum}-${normalizeName(horseName)}`;
    
      resultData = resultLookupByName.get(exactKey);
      if (resultData) {
        matchMethod = 'name-exact';
        matchMethodStats.name++;
      } else {
        resultData = resultLookupByName.get(normalizedKey);
        if (resultData) {
          matchMethod = 'name-normalized';
          matchMethodStats.name++;
        }
      }
    }
    
    if (!resultData) {
      matchMethodStats.none++;
    }
    
    // If we found result data, use it (even if pos === 0, which might mean scratched/DNF)
    if (resultData) {
      // Horse has result data - calculate points based on finish position
      const points = calculatePointsFromResults(
        resultData.win,
        resultData.place,
        resultData.show,
        resultData.pos
      );
      
      // Set place (even if 0 - means scratched/DNF, which is still valid data)
      // pos > 0 means finished, pos === 0 means didn't finish (scratched/DNF)
      const place = resultData.pos > 0 ? resultData.pos : null;
      
      return {
        ...entry,
        points,
        place,
        // If pos === 0, horse didn't finish (scratched/DNF), so keep original scratched status
        // If pos > 0, horse finished, so definitely not scratched
        scratched: resultData.pos === 0 ? entry.scratched : false,
      };
    }
    
    // No result data found
    // For past data, if we have results but horse not found, it's likely scratched
    // Preserve original scratched status from entries, but only infer scratches from missing
    // results when we actually received results data for this card.
    const wasScratchedInEntries = entry.scratched === true;
    const inferScratchedFromResults = hasResults && !resultData;
    const shouldMarkScratched =
      entry.is_also_eligible
        ? false
        : wasScratchedInEntries || inferScratchedFromResults;
    
    return {
      ...entry,
      points: 0,
      place: null,
      // Preserve original scratched status; only infer scratches from missing results when we have results data
      scratched: shouldMarkScratched,
    };
  });
  
  // Log matching statistics only if there are issues
  const matchedCount = mergedRecords.filter(r => r.place !== null).length;
  if (hasResults && entries.length > 0 && matchedCount === 0 && (resultLookupByProgramNumber.size > 0 || resultLookupByName.size > 0)) {
    console.warn(`[mergeEntriesWithResults] ⚠️ No matches found! Match methods: programNumber=${matchMethodStats.programNumber}, refNumber=${matchMethodStats.refNumber}, name=${matchMethodStats.name}, none=${matchMethodStats.none}`);
  }
  
  return mergedRecords;
}

