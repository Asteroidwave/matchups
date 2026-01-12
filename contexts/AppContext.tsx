"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Connection, Matchup, Round, RoundPick } from "@/types";
import { loadAndMergeAllTracks } from "@/lib/ingest";
import { generateMatchups, MatchupGenerationOptions } from "@/lib/matchups";
import { saveRound, loadRounds } from "@/lib/store";
import { matchupWinner } from "@/lib/scoring";
import { 
  getAvailableTracks, 
  getDataForDate, 
  findMultiTrackDates,
  AVAILABLE_TRACKS 
} from "@/lib/parseExcel";

interface AppContextType {
  connections: Connection[];
  matchups: Matchup[];
  rounds: Round[];
  tolerance: number;
  isLoading: boolean;
  error: string | null;
  bankroll: number;
  
  // Track and date selection
  availableTracks: { code: string; name: string; dates: string[] }[];
  selectedTracks: string[];
  selectedDate: string;
  useExcelData: boolean;
  
  loadData: () => Promise<void>;
  regenerateMatchups: (options?: MatchupGenerationOptions) => void;
  setTolerance: (tolerance: number) => void;
  submitRound: (picks: RoundPick[], entryAmount: number, multiplier: number) => void;
  updateBankroll: (amount: number) => void;
  setSelectedTracks: (tracks: string[]) => void;
  setSelectedDate: (date: string) => void;
  setUseExcelData: (useExcel: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [tolerance, setTolerance] = useState(500);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankroll, setBankroll] = useState(217417.23); // Start with balance shown in UI
  
  // Track and date selection
  const [availableTracks, setAvailableTracks] = useState<{ code: string; name: string; dates: string[] }[]>([]);
  const [selectedTracks, setSelectedTracksState] = useState<string[]>(['AQU']);
  const [selectedDate, setSelectedDateState] = useState<string>('2025-01-01');
  const [useExcelData, setUseExcelDataState] = useState<boolean>(true);
  
  // Load available tracks on mount
  useEffect(() => {
    const loadTracks = async () => {
      try {
        const tracks = await getAvailableTracks();
        setAvailableTracks(tracks);
        
        // Set initial tracks and find a date where they all race
        if (tracks.length > 0) {
          const defaultTrack = tracks.find(t => t.code === 'AQU') || tracks[0];
          setSelectedTracksState([defaultTrack.code]);
          
          if (defaultTrack.dates.length > 0) {
            // Get most recent date
            setSelectedDateState(defaultTrack.dates[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load tracks:', err);
        // Fall back to static tracks
        setAvailableTracks(AVAILABLE_TRACKS.map(t => ({ ...t, dates: [] })));
      }
    };
    loadTracks();
  }, []);
  
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let loadedConnections: Connection[];
      
      if (useExcelData && selectedTracks.length > 0 && selectedDate) {
        // Load from Excel files
        const allConnections: Connection[] = [];
        
        for (const trackCode of selectedTracks) {
          try {
            const data = await getDataForDate(selectedDate, trackCode);
            // Add track info to connections
            const trackConnections = data.connections.map(c => ({
              ...c,
              trackSet: [trackCode],
            }));
            allConnections.push(...trackConnections);
          } catch (err) {
            console.warn(`Failed to load data for ${trackCode} on ${selectedDate}:`, err);
          }
        }
        
        loadedConnections = allConnections;
      } else {
        // Fall back to old JSON loading
        loadedConnections = await loadAndMergeAllTracks();
      }
      
      setConnections(loadedConnections);
      
      // Generate initial matchups
      if (loadedConnections.length > 0) {
        const initialMatchups = generateMatchups(loadedConnections, {
          count: 10,
          tolerance,
        });
        setMatchups(initialMatchups);
      } else {
        setMatchups([]);
      }
      
      // Load rounds from localStorage
      const loadedRounds = loadRounds();
      setRounds(loadedRounds);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tolerance, useExcelData, selectedTracks, selectedDate]);
  
  // Load data when tracks or date changes
  useEffect(() => {
    if (selectedTracks.length > 0 && selectedDate) {
      loadData();
    }
  }, [selectedTracks, selectedDate, useExcelData]);
  
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
  
  const setSelectedTracks = useCallback((tracks: string[]) => {
    setSelectedTracksState(tracks);
    
    // Find dates where all selected tracks have races
    if (tracks.length > 0) {
      const trackData = availableTracks.filter(t => tracks.includes(t.code));
      if (trackData.length > 0) {
        // Find intersection of dates
        let commonDates = new Set(trackData[0].dates);
        for (let i = 1; i < trackData.length; i++) {
          const trackDates = new Set(trackData[i].dates);
          commonDates = new Set([...commonDates].filter(d => trackDates.has(d)));
        }
        
        const sortedDates = Array.from(commonDates).sort((a, b) => 
          new Date(b).getTime() - new Date(a).getTime()
        );
        
        // If current date is not in common dates, select the first common date
        if (sortedDates.length > 0 && !commonDates.has(selectedDate)) {
          setSelectedDateState(sortedDates[0]);
        }
      }
    }
  }, [availableTracks, selectedDate]);
  
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
  }, []);
  
  const setUseExcelData = useCallback((useExcel: boolean) => {
    setUseExcelDataState(useExcel);
  }, []);
  
  const submitRound = useCallback((picks: RoundPick[], entryAmount: number, multiplierValue: number) => {
    if (matchups.length === 0 || entryAmount <= 0 || entryAmount > bankroll) return;
    
    // Calculate winnings based on outcomes
    const won = picks.every(pick => {
      const matchup = matchups.find(m => m.id === pick.matchupId);
      if (!matchup) return false;
      const result = matchupWinner(matchup, pick.chosen);
      return result.won;
    });
    
    // Use the multiplier value passed directly from the page
    // The page calculates the correct multiplier based on pick count and flex/standard
    const finalMultiplier = multiplierValue;
    
    // Regenerate matchups for next round
    if (connections.length > 0) {
      const newMatchups = generateMatchups(connections, {
        count: 10,
        tolerance,
      });
      setMatchups(newMatchups);
    }
    
    const winnings = won ? entryAmount * finalMultiplier : 0;
    
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
  }, [matchups, bankroll, connections, tolerance]);
  
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
        availableTracks,
        selectedTracks,
        selectedDate,
        useExcelData,
        loadData,
        regenerateMatchups,
        setTolerance: handleSetTolerance,
        submitRound,
        updateBankroll,
        setSelectedTracks,
        setSelectedDate,
        setUseExcelData,
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
