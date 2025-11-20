/**
 * Outcome Calculator Service
 * Pre-calculates round outcomes using real results data
 * This allows instant results and smooth, repeatable simulations
 */

import { supabase } from '../utils/supabase';

interface ConnectionStarter {
  horseName: string;
  track: string;
  race: number;
  position?: number;
  points?: number;
  mlOddsFrac?: string;
  mlOdds?: number;
  program_number?: number;
  scratched?: boolean;
}

interface MatchupOutcome {
  matchupId: string;
  chosenSide: 'A' | 'B';
  setA: {
    totalPoints: number;
    starters: ConnectionStarter[];
  };
  setB: {
    totalPoints: number;
    starters: ConnectionStarter[];
  };
  winner: 'A' | 'B' | 'tie' | null;
  isCorrect: boolean;
}

interface RoundOutcome {
  matchups: MatchupOutcome[];
  correctPicks: number;
  totalPicks: number;
  actualMultiplier: number;
  finalWinnings: number;
  outcome: 'won' | 'lost';
  calculatedAt: string;
}

/**
 * Calculate the outcome of a round using real results data
 */
export async function calculateRoundOutcome(
  contestId: string,
  picks: Array<{ matchupId: string; chosen: 'A' | 'B' }>,
  entryAmount: number,
  isFlex: boolean,
  pickCount: number,
  multiplierSchedule: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }>
): Promise<RoundOutcome> {
  console.log('[OutcomeCalculator] Calculating outcome for', picks.length, 'picks');
  
  // Fetch contest to get track_data_id
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single();
  
  if (contestError || !contest) {
    throw new Error('Contest not found');
  }
  
  // Fetch track data (entries + results)
  const { data: trackData, error: trackError } = await supabase
    .from('track_data')
    .select('*')
    .eq('id', contest.track_data_id)
    .single();
  
  if (trackError || !trackData) {
    throw new Error('Track data not found');
  }
  
  const results = trackData.data?.results || [];
  console.log('[OutcomeCalculator] Loaded', results.length, 'result records');
  
  // Build a lookup map: track-race-horse → result
  const resultLookup = new Map<string, any>();
  for (const result of results) {
    const key = `${result.track}-${result.race}-${result.horse}`.toLowerCase();
    resultLookup.set(key, result);
  }
  
  // Fetch matchups for this contest
  const { data: matchupsData, error: matchupsError } = await supabase
    .from('matchups')
    .select('*')
    .eq('contest_id', contestId);
  
  if (matchupsError || !matchupsData) {
    throw new Error('Matchups not found');
  }
  
  // Build matchup lookup by ID
  const matchupLookup = new Map<string, any>();
  for (const row of matchupsData) {
    const matchupData = row.matchup_data;
    if (matchupData && matchupData.matchups) {
      for (const matchup of matchupData.matchups) {
        if (matchup.id) {
          matchupLookup.set(matchup.id, matchup);
        }
      }
    }
  }
  
  console.log('[OutcomeCalculator] Loaded', matchupLookup.size, 'matchups');
  
  // Calculate outcome for each matchup
  const matchupOutcomes: MatchupOutcome[] = [];
  let correctPicks = 0;
  
  for (const pick of picks) {
    const matchup = matchupLookup.get(pick.matchupId);
    
    if (!matchup) {
      console.warn('[OutcomeCalculator] Matchup not found:', pick.matchupId);
      continue;
    }
    
    // Calculate points for Set A
    const setAStarters: ConnectionStarter[] = [];
    let setAPoints = 0;
    
    for (const conn of matchup.setA.connections) {
      for (const starter of conn.starters || []) {
        const lookupKey = `${starter.track}-${starter.race}-${starter.horseName}`.toLowerCase();
        const result = resultLookup.get(lookupKey);
        
        const starterOutcome: ConnectionStarter = {
          horseName: starter.horseName,
          track: starter.track,
          race: starter.race,
          position: result?.pos || result?.position || 0,
          points: result?.points || 0,
          mlOddsFrac: starter.mlOddsFrac,
          mlOdds: starter.mlOdds,
          program_number: starter.program_number,
          scratched: starter.scratched || false,
        };
        
        setAStarters.push(starterOutcome);
        setAPoints += starterOutcome.points || 0;
      }
    }
    
    // Calculate points for Set B
    const setBStarters: ConnectionStarter[] = [];
    let setBPoints = 0;
    
    for (const conn of matchup.setB.connections) {
      for (const starter of conn.starters || []) {
        const lookupKey = `${starter.track}-${starter.race}-${starter.horseName}`.toLowerCase();
        const result = resultLookup.get(lookupKey);
        
        const starterOutcome: ConnectionStarter = {
          horseName: starter.horseName,
          track: starter.track,
          race: starter.race,
          position: result?.pos || result?.position || 0,
          points: result?.points || 0,
          mlOddsFrac: starter.mlOddsFrac,
          mlOdds: starter.mlOdds,
          program_number: starter.program_number,
          scratched: starter.scratched || false,
        };
        
        setBStarters.push(starterOutcome);
        setBPoints += starterOutcome.points || 0;
      }
    }
    
    // Determine winner
    let winner: 'A' | 'B' | 'tie' | null = null;
    if (setAPoints > setBPoints) {
      winner = 'A';
    } else if (setBPoints > setAPoints) {
      winner = 'B';
    } else if (setAPoints === setBPoints && setAPoints > 0) {
      // Tie - always give win to user's pick
      console.log('[OutcomeCalculator] Tie detected, giving win to user pick:', pick.chosen);
      winner = pick.chosen;
    }
    
    const isCorrect = winner === pick.chosen;
    if (isCorrect) {
      correctPicks++;
    }
    
    matchupOutcomes.push({
      matchupId: pick.matchupId,
      chosenSide: pick.chosen,
      setA: {
        totalPoints: setAPoints,
        starters: setAStarters,
      },
      setB: {
        totalPoints: setBPoints,
        starters: setBStarters,
      },
      winner,
      isCorrect,
    });
  }
  
  // Calculate final outcome
  const totalPicks = picks.length;
  const schedule = multiplierSchedule[pickCount];
  
  let actualMultiplier = 0;
  let outcome: 'won' | 'lost' = 'lost';
  
  if (isFlex) {
    // Flex mode: Can miss 1 pick
    if (correctPicks === totalPicks) {
      // All correct
      actualMultiplier = schedule?.flexAllWin || 1;
      outcome = 'won';
    } else if (correctPicks === totalPicks - 1) {
      // Missed 1 (flex allows this)
      actualMultiplier = schedule?.flexOneMiss || 1;
      outcome = 'won';
    } else {
      // Missed 2+ (loss)
      actualMultiplier = 0;
      outcome = 'lost';
    }
  } else {
    // Standard mode: Must get all correct
    if (correctPicks === totalPicks) {
      actualMultiplier = schedule?.standard || 1;
      outcome = 'won';
    } else {
      actualMultiplier = 0;
      outcome = 'lost';
    }
  }
  
  const finalWinnings = outcome === 'won' ? entryAmount * actualMultiplier : 0;
  
  console.log('[OutcomeCalculator] Outcome:', {
    correctPicks,
    totalPicks,
    actualMultiplier,
    finalWinnings,
    outcome
  });
  
  return {
    matchups: matchupOutcomes,
    correctPicks,
    totalPicks,
    actualMultiplier,
    finalWinnings,
    outcome,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Check if results are available for a contest
 */
export async function hasResultsData(contestId: string): Promise<boolean> {
  try {
    const { data: contest } = await supabase
      .from('contests')
      .select('track_data_id')
      .eq('id', contestId)
      .single();
    
    if (!contest?.track_data_id) return false;
    
    const { data: trackData } = await supabase
      .from('track_data')
      .select('data')
      .eq('id', contest.track_data_id)
      .single();
    
    const results = trackData?.data?.results || [];
    return results.length > 0;
  } catch {
    return false;
  }
}

