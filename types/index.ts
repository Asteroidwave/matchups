export type ConnectionRole = "jockey" | "trainer" | "sire";

export interface Starter {
  track: string;
  race: number;
  horseName: string;
  jockey?: string;
  trainer?: string;
  sire1?: string;
  sire2?: string;
  mlOddsFrac?: string;
  mlOdds?: number;
  decimalOdds?: number;
  salary?: number;
  points?: number;
  pos?: number;
  scratched?: boolean;
  // Race context fields
  fieldSize?: number;
  distance?: number;
  surface?: string;
  // Final odds and payoff fields
  finalOdds?: number;
  winPayoff?: number;
  placePayoff?: number;
  showPayoff?: number;
  moneyWon?: number;
  newMlOddsDecimal?: number;
}

export interface PastPerformanceEntry {
  date: string;
  track: string;
  race: number;
  horse: string;
  finish: number;
  totalPoints: number;
  finalOdds: number;
  salary?: number;
  avpa?: number;
  postPosition?: number;
}

export interface Connection {
  id: string;
  name: string;
  role: ConnectionRole;
  trackSet: string[];
  apps: number;
  avgOdds: number;
  avgSalary?: number;
  salarySum: number;
  pointsSum: number;
  avpa30d: number;
  avpaRace: number;
  starters: Starter[];
  // New fields for MU/Sigma analysis
  mu?: number;           // Expected points
  sigma?: number;        // Volatility
  winRate?: number;      // Win percentage
  itmRate?: number;      // In the money percentage
  avgFinish?: number;    // Average finish position
  pastPerformance?: PastPerformanceEntry[];
}

export interface SetSide {
  connections: Connection[];
  salaryTotal: number;
  totalSalary?: number;
  totalAvpaRace?: number;
  // New fields for MU/Sigma
  mu?: number;
  sigma?: number;
  winProbability?: number;
}

export interface Matchup {
  id: string;
  setA: SetSide;
  setB: SetSide;
  setC?: SetSide;  // For 3-way matchups
  matchupType?: string;
  type?: '1v1' | '1v1v1' | '2v1' | '1v2' | '2v1v1' | '1v2v1' | '1v1v2';
  balance?: number;  // How balanced the matchup is (0-100)
}

export interface RoundPick {
  matchupId: string;
  chosen: "A" | "B" | "C";
}

export interface Round {
  id: string;
  createdAt: string;
  matchups: Matchup[];
  picks: RoundPick[];
  entryAmount?: number;
  winnings?: number;
  multiplier?: number;
}

export interface TrackData {
  track: string;
  records: Array<{
    track: string;
    race: number;
    horse: string;
    jockey?: string;
    trainer?: string;
    sire1?: string;
    sire2?: string;
    ml_odds_frac?: string;
    ml_odds_decimal?: number;
    is_also_eligible?: boolean;
    scratched?: boolean;
    salary?: number;
    points?: number;
    place?: number;
  }>;
  jockeys?: Array<{ name: string; avpa_30_days?: number }>;
  trainers?: Array<{ name: string; avpa_30_days?: number }>;
  sires?: Array<{ name: string; avpa_30_days?: number }>;
}
