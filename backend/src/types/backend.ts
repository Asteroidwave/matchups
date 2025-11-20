/**
 * Backend types for matchup calculation
 * Simplified versions of frontend types
 */

export interface Connection {
  id: string;
  name: string;
  role: 'jockey' | 'trainer' | 'sire';
  trackSet: string[];
  apps: number;
  avgOdds: number;
  salarySum: number;
  pointsSum: number;
  avpa30d: number; // AVPA 30 days
  avpa90d: number; // AVPA 90 days
  pastRaces: Array<{ // Last 5 past races
    track: string;
    date: string;
    race: number;
    horseName: string;
    place: number | null;
    points: number;
    salary: number;
  }>;
  starters: Starter[];
}

export interface Starter {
  track: string;
  race: number;
  horseName: string;
  salary: number;
  points: number;
  pos: number;
  program_number?: number | null;
  mlOddsFrac?: string | null;
  decimalOdds?: number | null;
  jockey?: string | null;
  trainer?: string | null;
  sire1?: string | null;
  sire2?: string | null;
  scratched?: boolean;
  isAlsoEligible?: boolean;
  date?: string;
}

export interface Matchup {
  id: string;
  setA: SetSide;
  setB: SetSide;
}

export interface SetSide {
  connections: Connection[];
  totalSalary: number;
  totalPoints: number;
}

