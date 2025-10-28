import { create } from "zustand";
import { Connection, Matchup, RoundResult, AppData, MatchupDetail } from "@/types";
import { determineMatchupWinner, calculateConnectionPoints } from "@/lib/points";

interface AppStore {
  connections: Connection[];
  matchups: Matchup[];
  results: RoundResult[];
  selections: Record<string, "A" | "B" | undefined>;

  loadData: (data: AppData) => void;
  selectSet: (matchupId: string, set: "A" | "B") => void;
  clearSelection: (matchupId: string) => void;
  submitRound: () => void;
  getSelectedMatchups: () => Matchup[];
  getTotalPicksCount: () => number;
}

export const useAppStore = create<AppStore>((set, get) => ({
  connections: [],
  matchups: [],
  results: [],
  selections: {},

  loadData: (data: AppData) => {
    set({
      connections: data.connections,
      matchups: data.matchups,
      results: data.results,
    });
  },

  selectSet: (matchupId: string, setChoice: "A" | "B") => {
    set((state) => ({
      selections: {
        ...state.selections,
        [matchupId]: state.selections[matchupId] === setChoice ? undefined : setChoice,
      },
    }));
  },

  clearSelection: (matchupId: string) => {
    set((state) => {
      const newSelections = { ...state.selections };
      delete newSelections[matchupId];
      return { selections: newSelections };
    });
  },

  getSelectedMatchups: () => {
    const { selections, matchups } = get();
    return matchups.filter((m) => selections[m.id] !== undefined);
  },

  getTotalPicksCount: () => {
    const { selections, matchups } = get();
    let count = 0;

    Object.entries(selections).forEach(([matchupId, setChoice]) => {
      if (setChoice) {
        const matchup = matchups.find((m) => m.id === matchupId);
        if (matchup) {
          const selectedSet = setChoice === "A" ? matchup.setA : matchup.setB;
          count += selectedSet.members.length;
        }
      }
    });

    return count;
  },

  submitRound: () => {
    const { selections, matchups } = get();
    const details: MatchupDetail[] = [];
    let allWon = true;
    let totalPoints = 0;
    let maxPossible = 0;

    Object.entries(selections).forEach(([matchupId, setChoice]) => {
      if (setChoice) {
        const matchup = matchups.find((m) => m.id === matchupId);
        if (matchup) {
          const result = determineMatchupWinner(matchup, setChoice);

          details.push({
            matchupId,
            selectedSet: setChoice,
            setPoints: result.selectedSetPoints,
            opponentPoints: result.opponentSetPoints,
            won: result.won,
          });

          totalPoints += result.selectedSetPoints;
          maxPossible += Math.max(result.selectedSetPoints, result.opponentSetPoints);

          if (!result.won) {
            allWon = false;
          }
        }
      }
    });

    const picksCount = get().getTotalPicksCount();

    const newResult: RoundResult = {
      id: `round-${Date.now()}`,
      createdAt: new Date().toISOString(),
      picks: picksCount,
      won: allWon,
      totalPoints,
      maxPossible,
      details,
    };

    set((state) => ({
      results: [newResult, ...state.results],
      selections: {},
    }));
  },
}));
