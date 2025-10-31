"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Connection, Matchup, Round, RoundPick } from "@/types";
import { loadAndMergeAllTracks } from "@/lib/ingest";
import { generateMatchups, MatchupGenerationOptions } from "@/lib/matchups";
import { saveRound, loadRounds } from "@/lib/store";
import { matchupWinner } from "@/lib/scoring";

interface AppContextType {
  connections: Connection[];
  matchups: Matchup[];
  rounds: Round[];
  tolerance: number;
  isLoading: boolean;
  error: string | null;
  bankroll: number;
  
  loadData: () => Promise<void>;
  regenerateMatchups: (options?: MatchupGenerationOptions) => void;
  setTolerance: (tolerance: number) => void;
  submitRound: (picks: RoundPick[], entryAmount: number, multiplier: number) => void;
  updateBankroll: (amount: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [tolerance, setTolerance] = useState(500);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankroll, setBankroll] = useState(1000); // Start with $1000
  
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedConnections = await loadAndMergeAllTracks();
      setConnections(loadedConnections);
      
      // Generate initial matchups
      const initialMatchups = generateMatchups(loadedConnections, {
        count: 10,
        tolerance,
      });
      setMatchups(initialMatchups);
      
      // Load rounds from localStorage
      const loadedRounds = loadRounds();
      setRounds(loadedRounds);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      console.error("Error loading data:", err);
      // Still set loading to false even on error
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, [tolerance]);
  
  useEffect(() => {
    loadData();
  }, []); // Only run once on mount
  
  const regenerateMatchups = useCallback((options?: MatchupGenerationOptions) => {
    if (connections.length === 0) return;
    
    const newMatchups = generateMatchups(connections, {
      count: 10,
      tolerance,
      ...options,
    });
    setMatchups(newMatchups);
  }, [connections, tolerance]);
  
  const handleSetTolerance = useCallback((newTolerance: number) => {
    setTolerance(newTolerance);
    // Regenerate matchups with new tolerance
    if (connections.length > 0) {
      const newMatchups = generateMatchups(connections, {
        count: 10,
        tolerance: newTolerance,
      });
      setMatchups(newMatchups);
    }
  }, [connections]);
  
  const submitRound = useCallback((picks: RoundPick[], entryAmount: number, multiplierLevel: number) => {
    if (matchups.length === 0 || entryAmount <= 0 || entryAmount > bankroll) return;
    
    // Calculate winnings based on outcomes
    const won = picks.every(pick => {
      const matchup = matchups.find(m => m.id === pick.matchupId);
      if (!matchup) return false;
      const result = matchupWinner(matchup, pick.chosen);
      return result.won;
    });
    
    // Calculate multiplier with house take (28%)
    // multiplierLevel is 0-based (0 = 2x, 1 = 4x, 2 = 8x, etc.)
    const baseMultiplier = Math.pow(2, multiplierLevel + 1);
    const houseTake = 0.28;
    const finalMultiplier = baseMultiplier * (1 - houseTake);
    
    // Regenerate matchups for next round
    if (connections.length > 0) {
      const newMatchups = generateMatchups(connections, {
        count: 10,
        tolerance,
      });
      setMatchups(newMatchups);
    }
    
    const winnings = won ? entryAmount * finalMultiplier : 0;
    const netResult = winnings - entryAmount;
    
    // Update bankroll
    const newBankroll = bankroll - entryAmount + winnings;
    setBankroll(newBankroll);
    
    const round: Round = {
      id: `round-${Date.now()}`,
      createdAt: new Date().toISOString(),
      matchups: matchups.map(m => ({
        ...m,
        setA: { ...m.setA, connections: m.setA.connections.map(c => ({ ...c })) },
        setB: { ...m.setB, connections: m.setB.connections.map(c => ({ ...c })) },
      })),
      picks,
      entryAmount,
      winnings,
      multiplier: finalMultiplier,
    };
    
    saveRound(round);
    setRounds(prev => [round, ...prev].slice(0, 50));
    
    localStorage.setItem("horse-racing-bankroll", String(newBankroll));
  }, [matchups, bankroll]);
  
  const updateBankroll = useCallback((amount: number) => {
    setBankroll(amount);
    localStorage.setItem("horse-racing-bankroll", String(amount));
  }, []);
  
  // Load bankroll from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("horse-racing-bankroll");
    if (stored) {
      setBankroll(parseFloat(stored));
    }
  }, []);
  
  return (
    <AppContext.Provider
      value={{
        connections,
        matchups,
        rounds,
        tolerance,
        isLoading,
        error,
        bankroll,
        loadData,
        regenerateMatchups,
        setTolerance: handleSetTolerance,
        submitRound,
        updateBankroll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

