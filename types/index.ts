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
  decimalOdds?: number;
  salary?: number;
  points?: number;
  pos?: number;
  scratched?: boolean;
}

export interface Connection {
  id: string;
  name: string;
  role: ConnectionRole;
  trackSet: string[];
  apps: number;
  avgOdds: number;
  salarySum: number;
  pointsSum: number;
  avpa30d: number;
  avpaRace: number;
  starters: Starter[];
}

export interface SetSide {
  connections: Connection[];
  salaryTotal: number;
}

export interface Matchup {
  id: string;
  setA: SetSide;
  setB: SetSide;
}

export interface RoundPick {
  matchupId: string;
  chosen: "A" | "B";
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
