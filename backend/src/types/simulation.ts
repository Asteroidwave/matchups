/**
 * Simulation System Type Definitions
 * For testing live features with past race data
 */

export interface SimulationConfig {
  contestId: string;
  tracks: string[]; // e.g., ['LRL', 'GP', 'DMR', 'CD', 'AQU']
  date: string; // e.g., '2025-11-09'
  speedMultiplier: number; // 1x = 1 min per race, 2x = 30s, 10x = 6s
  autoStart: boolean;
}

export interface RaceResult {
  track: string;
  race: number;
  horseName: string;
  position: number;
  points: number;
  win?: number; // Win payout
  place?: number; // Place payout
  show?: number; // Show payout
  jockey?: string;
  trainer?: string;
  sire1?: string;
  sire2?: string;
}

export interface SimulatedRace {
  track: string;
  raceNumber: number;
  scheduledStart: Date; // Simulated time (relative to simulation start)
  actualStart: Date | null; // When simulation actually started this race
  scheduledEnd: Date; // Simulated time (scheduledStart + race duration)
  actualEnd: Date | null; // When simulation actually finished this race
  status: 'pending' | 'running' | 'finished';
  horses: any[]; // Starters in this race
  results: RaceResult[]; // Results (revealed when race finishes)
  postTime: string; // Original post time from data
}

export interface MatchupProgress {
  matchupId: string;
  setA: {
    connections: any[];
    currentPoints: number;
    totalRaces: number;
    finishedRaces: number;
  };
  setB: {
    connections: any[];
    currentPoints: number;
    totalRaces: number;
    finishedRaces: number;
  };
  status: 'pending' | 'in_progress' | 'setA_won' | 'setB_won' | 'tied';
  winner: 'A' | 'B' | null;
}

export interface RoundProgress {
  roundId: string;
  userId: string;
  entryAmount: number;
  multiplier: number; // Max possible multiplier initially, actual calculated at settlement
  isFlex: boolean;
  pickCount?: number; // Number of picks selected
  multiplierSchedule?: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }> | null; // Schedule for calculating actual multiplier
  picks: Array<{ matchupId: string; chosen: 'A' | 'B' }>;
  matchups: MatchupProgress[];
  precalculatedOutcome?: any | null; // Pre-calculated outcome from entry submission
  status: 'pending' | 'in_progress' | 'won' | 'lost';
  wonMatchups: number;
  lostMatchups: number;
  totalPoints: number;
  potentialWinnings: number;
}

export interface SimulationState {
  id: string;
  contestId: string;
  status: 'ready' | 'running' | 'paused' | 'finished';
  speedMultiplier: number;
  currentRaceIndex: number;
  races: SimulatedRace[];
  rounds: RoundProgress[]; // All active rounds being simulated
  startedAt: Date | null;
  pausedAt: Date | null;
  pausedDuration: number; // Total time spent paused (ms)
  finishedAt: Date | null;
  createdAt: Date;
}

export interface SimulationEvent {
  type: 'simulation_started' | 'simulation_paused' | 'simulation_resumed' | 
        'race_started' | 'race_progress' | 'race_finished' | 
        'matchup_updated' | 'round_updated' | 'simulation_finished';
  simulationId: string;
  timestamp: Date;
  data: any;
}

