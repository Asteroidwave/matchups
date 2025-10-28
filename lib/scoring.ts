import { SetSide, Matchup, Connection } from "@/types";

export function setPoints(setSide: SetSide): number {
  return setSide.connections.reduce((sum, conn) => sum + conn.pointsSum, 0);
}

export function setAvpaRace(setSide: SetSide): number {
  const totalPoints = setPoints(setSide);
  const totalSalary = setSide.salaryTotal;
  
  if (totalSalary === 0) return 0;
  
  return (1000 * totalPoints) / totalSalary;
}

export function matchupWinner(matchup: Matchup, chosen: "A" | "B"): {
  won: boolean;
  chosenPoints: number;
  opponentPoints: number;
} {
  const setAPoints = setPoints(matchup.setA);
  const setBPoints = setPoints(matchup.setB);
  
  const chosenPoints = chosen === "A" ? setAPoints : setBPoints;
  const opponentPoints = chosen === "A" ? setBPoints : setAPoints;
  
  const won = chosenPoints > opponentPoints;
  
  return { won, chosenPoints, opponentPoints };
}

export function roundOutcome(round: {
  matchups: Matchup[];
  picks: Array<{ matchupId: string; chosen: "A" | "B" }>;
}): boolean {
  // A round wins only if ALL chosen sets win
  for (const pick of round.picks) {
    const matchup = round.matchups.find(m => m.id === pick.matchupId);
    if (!matchup) continue;
    
    const result = matchupWinner(matchup, pick.chosen);
    if (!result.won) {
      return false;
    }
  }
  
  return true;
}

export function connectionPoints(connection: Connection): number {
  return connection.pointsSum;
}

export function connectionAvpaRace(connection: Connection): number {
  return connection.avpaRace;
}

