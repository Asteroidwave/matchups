import { Connection, MatchupSet, Matchup } from "@/types";

export function calculateConnectionPoints(connection: Connection): number {
  let totalPoints = 0;

  connection.tracks.forEach(track => {
    track.races.forEach(race => {
      race.horses.forEach(horse => {
        if (horse.points && !horse.scratched) {
          const isConnected =
            (connection.role === "JOCKEY" && horse.jockey === connection.name) ||
            (connection.role === "TRAINER" && horse.trainer === connection.name) ||
            (connection.role === "SIRE" && (horse.sire1 === connection.name || horse.sire2 === connection.name));

          if (isConnected) {
            totalPoints += horse.points;
          }
        }
      });
    });
  });

  return totalPoints;
}

export function calculateSetPoints(set: MatchupSet): number {
  return set.members.reduce((sum, member) => sum + calculateConnectionPoints(member), 0);
}

export function calculateSetSalary(set: MatchupSet): number {
  return set.members.reduce((sum, member) => sum + member.salary, 0);
}

export function determineMatchupWinner(matchup: Matchup, selectedSet: "A" | "B"): {
  selectedSetPoints: number;
  opponentSetPoints: number;
  won: boolean;
} {
  const setAPoints = calculateSetPoints(matchup.setA);
  const setBPoints = calculateSetPoints(matchup.setB);

  const selectedSetPoints = selectedSet === "A" ? setAPoints : setBPoints;
  const opponentSetPoints = selectedSet === "A" ? setBPoints : setAPoints;

  return {
    selectedSetPoints,
    opponentSetPoints,
    won: selectedSetPoints > opponentSetPoints,
  };
}
