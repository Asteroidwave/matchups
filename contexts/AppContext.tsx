"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Connection, Matchup, Round, RoundPick } from "@/types";
import { loadAndMergeAllTracks } from "@/lib/ingest";
import { generateAllMatchups } from "@/lib/matchup-engine";
import { saveRound, loadRounds } from "@/lib/store";
import { matchupWinner } from "@/lib/scoring";
import { 
  getAvailableTracks, 
  getDataForDate, 
  findMultiTrackDates,
  AVAILABLE_TRACKS 
} from "@/lib/parseJson";

// Colors for multi-select player filtering
const HIGHLIGHT_COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-500' },
  { bg: 'bg-purple-500', light: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-500' },
  { bg: 'bg-pink-500', light: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-500' },
  { bg: 'bg-cyan-500', light: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-500' },
  { bg: 'bg-orange-500', light: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-500' },
];

interface FilterState {
  selectedPlayers: Connection[];
  selectedHorses: { raceNumber: number; horseName: string; horseId: string }[];
}

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
  
  // Filtering (multi-select with highlights)
  filterState: FilterState;
  togglePlayerFilter: (connection: Connection) => void;
  toggleHorseFilter: (raceNumber: number, horseName: string, horseId: string) => void;
  clearPlayerFilters: () => void;
  clearHorseFilters: () => void;
  clearAllFilters: () => void;
  getPlayerHighlightColor: (connectionId: string) => typeof HIGHLIGHT_COLORS[0] | null;
  
  loadData: () => Promise<void>;
  regenerateMatchups: (options?: { tolerance?: number; total?: number }) => void;
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
  
  // Multi-select player filtering
  const [filterState, setFilterState] = useState<FilterState>({
    selectedPlayers: [],
    selectedHorses: [],
  });
  
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
      
      // Generate initial matchups (mix of 2-way and 3-way, unique connections)
      if (loadedConnections.length > 0) {
        const { all } = generateAllMatchups(loadedConnections, {
          totalTarget: 24,
          tolerance: tolerance / 1000, // keep compatibility with existing tolerance slider (500 => 0.5)
        });
        setMatchups(all);
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
  
  // Load data when tracks or date changes - but debounce to prevent freezing
  const loadDataRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadKey = React.useRef<string>('');
  
  useEffect(() => {
    if (selectedTracks.length > 0 && selectedDate) {
      // Create a key to detect actual changes
      const loadKey = `${selectedTracks.join(',')}-${selectedDate}-${useExcelData}`;
      
      // Skip if nothing actually changed
      if (loadKey === lastLoadKey.current) {
        return;
      }
      
      // Clear any pending load
      if (loadDataRef.current) {
        clearTimeout(loadDataRef.current);
      }
      
      // Debounce the load to prevent rapid reloads
      loadDataRef.current = setTimeout(() => {
        lastLoadKey.current = loadKey;
    loadData();
      }, 300); // Increased debounce time
      
      return () => {
        if (loadDataRef.current) {
          clearTimeout(loadDataRef.current);
        }
      };
    }
  }, [selectedTracks.join(','), selectedDate, useExcelData]); // Use join to prevent array reference changes
  
  const regenerateMatchups = useCallback((options?: { tolerance?: number; total?: number }) => {
    if (connections.length === 0) return;
    
    const { all } = generateAllMatchups(connections, {
      totalTarget: options?.total ?? 24,
      tolerance: (options?.tolerance ?? tolerance) / 1000,
    });
    setMatchups(all);
  }, [connections, tolerance]);
  
  const handleSetTolerance = useCallback((newTolerance: number) => {
    setTolerance(newTolerance);
    // Regenerate matchups with new tolerance
    if (connections.length > 0) {
      const { all } = generateAllMatchups(connections, {
        totalTarget: 24,
        tolerance: newTolerance / 1000,
      });
      setMatchups(all);
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
      const { all } = generateAllMatchups(connections, {
        totalTarget: 24,
        tolerance: tolerance / 1000,
      });
      setMatchups(all);
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
  
  // Multi-select player filtering functions
  const togglePlayerFilter = useCallback((connection: Connection) => {
    setFilterState(prev => {
      const isSelected = prev.selectedPlayers.some(p => p.id === connection.id);
      if (isSelected) {
        return {
          ...prev,
          selectedPlayers: prev.selectedPlayers.filter(p => p.id !== connection.id),
        };
      } else {
        // Limit to 5 selections (number of highlight colors)
        if (prev.selectedPlayers.length >= 5) return prev;
        return {
          ...prev,
          selectedPlayers: [...prev.selectedPlayers, connection],
        };
      }
    });
  }, []);
  
  const toggleHorseFilter = useCallback((raceNumber: number, horseName: string, horseId: string) => {
    setFilterState(prev => {
      const isSelected = prev.selectedHorses.some(h => h.horseId === horseId);
      if (isSelected) {
        return {
          ...prev,
          selectedHorses: prev.selectedHorses.filter(h => h.horseId !== horseId),
        };
      } else {
        return {
          ...prev,
          selectedHorses: [...prev.selectedHorses, { raceNumber, horseName, horseId }],
        };
      }
    });
  }, []);
  
  const clearPlayerFilters = useCallback(() => {
    setFilterState(prev => ({ ...prev, selectedPlayers: [] }));
  }, []);
  
  const clearHorseFilters = useCallback(() => {
    setFilterState(prev => ({ ...prev, selectedHorses: [] }));
  }, []);
  
  const clearAllFilters = useCallback(() => {
    setFilterState({ selectedPlayers: [], selectedHorses: [] });
  }, []);
  
  const getPlayerHighlightColor = useCallback((connectionId: string) => {
    const index = filterState.selectedPlayers.findIndex(p => p.id === connectionId);
    if (index === -1) return null;
    return HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
  }, [filterState.selectedPlayers]);
  
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
        filterState,
        togglePlayerFilter,
        toggleHorseFilter,
        clearPlayerFilters,
        clearHorseFilters,
        clearAllFilters,
        getPlayerHighlightColor,
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
