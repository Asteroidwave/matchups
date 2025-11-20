"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { useUserData } from "@/hooks/useUserData";
import { useRelationalApp } from "@/contexts/RelationalAppContext";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { ComparisonModal } from "@/components/modals/ComparisonModal";
import { StartersWindow } from "@/components/windows/StartersWindow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RoundPick, Connection, Matchup, Starter } from "@/types";
import { X, Info, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, CheckCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MATCHUP_TYPE_KEYS = [
  "jockey_vs_jockey",
  "trainer_vs_trainer",
  "sire_vs_sire",
  "mixed",
  "cross_track",
  "all",
  "unknown",
];

const MATCHUP_TYPE_SET = new Set(MATCHUP_TYPE_KEYS);
const CROSS_TRACK_FILTER_KEY = 'cross_tracks';
const normalizeMatchupTypeForUI = (type: string): string => {
  if (!type) return 'all';
  return type === 'cross_track' ? 'mixed' : type;
};
const formatTrackLabel = (track?: string | null): string => {
  if (!track) return '';
  if (track === CROSS_TRACK_FILTER_KEY) return 'Cross Tracks';
  if (track === 'all') return 'All';
  return track;
};

// Legacy-style track colors (small badges)
const TRACK_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; hoverBg: string }> = {
  AQU: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500", hoverBg: "hover:bg-blue-500" },
  BAQ: { bg: "bg-cyan-500", text: "text-cyan-500", border: "border-cyan-500", hoverBg: "hover:bg-cyan-500" },
  BEL: { bg: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-500", hoverBg: "hover:bg-indigo-500" },
  CD: { bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-500", hoverBg: "hover:bg-amber-500" },
  GP: { bg: "bg-green-500", text: "text-green-500", border: "border-green-500", hoverBg: "hover:bg-green-500" },
  KEE: { bg: "bg-purple-500", text: "text-purple-500", border: "border-purple-500", hoverBg: "hover:bg-purple-500" },
  LRL: { bg: "bg-pink-500", text: "text-pink-500", border: "border-pink-500", hoverBg: "hover:bg-pink-500" },
  SA: { bg: "bg-red-500", text: "text-red-500", border: "border-red-500", hoverBg: "hover:bg-red-500" },
};

const getTrackChipClasses = (track: string, selected: boolean): string => {
  const colors = TRACK_COLOR_CLASSES[track];
  if (!colors) {
    return selected
      ? "bg-[var(--btn-default)] text-white"
      : "bg-white text-[var(--brand)] border border-[var(--chip-outline)] hover:bg-[var(--blue-50)]";
  }
  // Legacy style: small, colored badges
  return selected 
    ? `${colors.bg} text-white`
    : `bg-white ${colors.text} border border-current hover:${colors.bg} hover:text-white`;
};

const buildSelectionKey = (track: string | undefined, matchupType: string, matchupId: string) => {
  const safeTrack = track && track.trim().length > 0 ? track : "Unknown";
  return `${safeTrack}-${matchupType}-${matchupId}`;
};

const parseSelectionKey = (key: string): { track?: string; matchupType?: string; matchupId: string } => {
  const parts = key.split("-");

  if (parts.length >= 3) {
    const [maybeTrack, maybeType, ...rest] = parts;
    if (MATCHUP_TYPE_SET.has(maybeType)) {
      return {
        track: maybeTrack,
        matchupType: maybeType,
        matchupId: rest.join("-") || "",
      };
    }
  }

  if (parts.length >= 2) {
    const [maybeType, ...rest] = parts;
    if (MATCHUP_TYPE_SET.has(maybeType)) {
      return {
        matchupType: maybeType,
        matchupId: rest.join("-") || "",
      };
    }
  }

  return { matchupId: key };
};

const getPrimaryTrackFromMatchup = (matchup: Matchup, fallback?: string): string => {
  const findTrack = (connections: Connection[]) => {
    for (const conn of connections) {
      if (!conn) continue;
      if (Array.isArray(conn.trackSet)) {
        const track = conn.trackSet.find(Boolean);
        if (track) return track;
      }
      if (Array.isArray(conn.starters)) {
        const starterTrack = conn.starters.find((starter) => starter?.track)?.track;
        if (starterTrack) return starterTrack;
      }
    }
    return undefined;
  };

  return (
    findTrack(matchup.setA.connections) ||
    findTrack(matchup.setB.connections) ||
    fallback ||
    "Unknown"
  );
};

export default function MatchupsPage() {
  const router = useRouter();
  const {
    connections,
    matchups,
    tolerance,
    regenerateMatchups,
    regenerateMatchupType,
    submitRound,
    isLoading,
    error,
    bankroll,
    availableMatchupTypes: availableMatchupTypesFromContext,
    contests,
    contestsLoading,
    contestsError,
    loadContests,
    totalMatchupCount,
  } = useApp();
  
  // NEW: Enhanced pick tracking with track and type information
  interface PickData {
    matchupId: string;
    track: string;
    matchupType: string;
    chosen: "A" | "B";
    names: string[];
  }
  
  const [selections, setSelections] = useState<Record<string, "A" | "B">>({});
  const [pickMetadata, setPickMetadata] = useState<Record<string, PickData>>({});
  
  // Restore picks from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSelections = sessionStorage.getItem('matchup_selections');
        const savedMetadata = sessionStorage.getItem('matchup_pick_metadata');
        
        if (savedSelections) {
          const parsed = JSON.parse(savedSelections);
          if (parsed && typeof parsed === 'object') {
            setSelections(parsed);
            console.log('[Picks] Restored selections from cache:', Object.keys(parsed).length);
          }
        }
        
        if (savedMetadata) {
          const parsed = JSON.parse(savedMetadata);
          if (parsed && typeof parsed === 'object') {
            setPickMetadata(parsed);
          }
        }
      } catch (err) {
        console.warn('[Picks] Failed to restore from cache:', err);
      }
    }
  }, []);
  
  // Save picks to sessionStorage whenever they change (debounced for performance)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce saves to avoid excessive writes
      saveTimeoutRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem('matchup_selections', JSON.stringify(selections));
          sessionStorage.setItem('matchup_pick_metadata', JSON.stringify(pickMetadata));
        } catch (err) {
          console.warn('[Picks] Failed to save to cache:', err);
        }
      }, 300); // 300ms debounce
      
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }
  }, [selections, pickMetadata]);
  const [selectedConnectionForModal, setSelectedConnectionForModal] = useState<Connection | null>(null);
  const [filteredConnections, setFilteredConnections] = useState<Set<string>>(new Set());
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [clickedConnectionFromStarters, setClickedConnectionFromStarters] = useState<{id: string; name: string; role: string} | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [selectedMatchupForComparison, setSelectedMatchupForComparison] = useState<Matchup | null>(null);
  const [entryAmount, setEntryAmount] = useState<string>("");
  const [isFlex, setIsFlex] = useState<boolean>(false);
  // Track selection state - initialize to 'all', then sync from sessionStorage in useEffect (prevents hydration error)
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  // Track transitioning state to prevent flashing
  const [isTrackTransitioning, setIsTrackTransitioning] = useState<boolean>(false);
  const previousTrackRef = useRef<string>('all');
  const transitioningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // View mode for starters panel
  const [viewMode, setViewMode] = useState<"horses" | "connected">("horses");
  const isConnectedHorsesView = viewMode === "connected";
  // Track filter for "Your Picks" panel - NOTE: This is separate from selectedTrack
  // selectedTrack filters the matchups shown, picksTrackFilter filters the picks shown
  const [picksTrackFilter, setPicksTrackFilter] = useState<string>('all');
  
  // Sync selectedTrack from sessionStorage after mount (client-only, prevents hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('selectedTrack');
      if (stored && stored !== 'null' && stored !== 'undefined') {
        const normalized = stored === 'mixed' ? CROSS_TRACK_FILTER_KEY : stored;
        if (normalized !== selectedTrack) {
          setSelectedTrack(normalized);
        }
      } else {
        // Default to 'all' on first load
        setSelectedTrack('all');
        sessionStorage.setItem('selectedTrack', 'all');
      }
    }
  }, []); // Only run once on mount
  const connectionScrollPositionsRef = useRef<Record<string, number>>({});
  const visibleMatchupsRef = useRef<Array<{ matchup: Matchup; uniqueKey: string }>>([]);
  const pendingPickScrollRef = useRef<{
    matchupId: string;
    chosen: "A" | "B";
    targetType: string;
    targetTrack?: string;
  } | null>(null);
  
  const availableTracks = React.useMemo(() => {
    const tracks = new Set<string>();
    contests.forEach(contest => {
      if (contest.track && contest.hasData) {
        tracks.add(contest.track);
      }
    });
    return Array.from(tracks).sort();
  }, [contests]);
  
  // Handle track selection with smooth transition
  const handleTrackSelect = useCallback((track: string) => {
    // Don't transition if clicking the same track
    if (track === selectedTrack) return;
    
    // Clear any pending transition timeout
    if (transitioningTimeoutRef.current) {
      clearTimeout(transitioningTimeoutRef.current);
      transitioningTimeoutRef.current = null;
    }
    
    // Store previous track for transition
    previousTrackRef.current = selectedTrack;
    
    // Start transition
    setIsTrackTransitioning(true);
    
    // Update track immediately for instant UI feedback
    setSelectedTrack(track);
    
    if (typeof window !== 'undefined') {
      if (track === 'all' || track === CROSS_TRACK_FILTER_KEY) {
        sessionStorage.removeItem('selectedTrack');
      } else {
        sessionStorage.setItem('selectedTrack', track);
        const contest = contests.find(c => c.track === track && c.hasData);
        if (contest) {
          sessionStorage.setItem('selectedContestId', contest.id);
          sessionStorage.setItem('selectedDate', contest.date);
          window.dispatchEvent(new CustomEvent('trackDataChanged'));
        }
      }
    }
    
    // End transition after a short delay (allows React to update DOM)
    // Use requestAnimationFrame to ensure DOM has updated before ending transition
    requestAnimationFrame(() => {
      transitioningTimeoutRef.current = setTimeout(() => {
        setIsTrackTransitioning(false);
        previousTrackRef.current = track;
      }, 200); // Match CSS transition duration (200ms)
    });
  }, [contests, selectedTrack]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitioningTimeoutRef.current) {
        clearTimeout(transitioningTimeoutRef.current);
      }
    };
  }, []);
  
  // Get available matchup types - use state to prevent hydration error
  const [availableMatchupTypesFromSession, setAvailableMatchupTypesFromSession] = useState<string[]>([]);
  
  // Sync availableMatchupTypes from sessionStorage after mount (client-only, prevents hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('availableMatchupTypes');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setAvailableMatchupTypesFromSession(parsed);
          }
        }
      } catch (err) {
        console.warn('[MatchupsPage] Failed to parse availableMatchupTypes from sessionStorage:', err);
      }
    }
  }, []);
  
  const availableMatchupTypes = availableMatchupTypesFromContext.length > 0
    ? availableMatchupTypesFromContext
    : availableMatchupTypesFromSession;
  
  const allConnectionsMap = React.useMemo(() => {
    const mergeStarters = (existing: Starter[] = [], incoming: Starter[] = []) => {
      const combined = new Map<string, Starter>();
      for (const starter of existing) {
        if (!starter) continue;
        const key = `${starter.track || ""}-${starter.race ?? ""}-${starter.horseName || ""}`;
        combined.set(key, starter);
      }
      for (const starter of incoming) {
        if (!starter) continue;
        const key = `${starter.track || ""}-${starter.race ?? ""}-${starter.horseName || ""}`;
        if (!combined.has(key)) {
          combined.set(key, starter);
        }
      }
      return Array.from(combined.values());
    };

    const map = new Map<string, Connection>();

    const addConnection = (conn?: Connection | null) => {
      if (!conn || !conn.id) return;

      const sanitizedStarters = Array.isArray(conn.starters) ? conn.starters : [];
      const sanitizedTrackSet = Array.isArray(conn.trackSet) ? conn.trackSet : [];

      const existing = map.get(conn.id);
      if (!existing) {
        const derivedTracks = new Set<string>(sanitizedTrackSet.filter(Boolean));
        for (const starter of sanitizedStarters) {
          if (starter?.track) {
            derivedTracks.add(starter.track);
          }
        }
        map.set(conn.id, {
          ...conn,
          starters: [...sanitizedStarters],
          trackSet: Array.from(derivedTracks),
        });
        return;
      }

      const mergedStarters = mergeStarters(existing.starters || [], sanitizedStarters);
      const mergedTracks = new Set<string>([
        ...(existing.trackSet || []),
        ...sanitizedTrackSet.filter(Boolean),
      ]);
      for (const starter of sanitizedStarters) {
        if (starter?.track) {
          mergedTracks.add(starter.track);
        }
      }

      map.set(conn.id, {
        ...existing,
        ...conn,
        starters: mergedStarters,
        trackSet: Array.from(mergedTracks),
      });
    };

    for (const conn of connections) {
      addConnection(conn);
    }
    for (const matchup of matchups) {
      for (const conn of matchup.setA.connections) {
        addConnection(conn);
      }
      for (const conn of matchup.setB.connections) {
        addConnection(conn);
      }
    }

    return map;
  }, [connections, matchups]);

  const allConnections = React.useMemo(
    () => Array.from(allConnectionsMap.values()),
    [allConnectionsMap]
  );

  const updateFilteredConnections = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setFilteredConnections((prev) => updater(prev));
  }, []);

  const toggleConnectionFilter = useCallback((connectionId: string) => {
    let nextHighlighted: string | null = null;
    updateFilteredConnections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
        delete connectionScrollPositionsRef.current[connectionId];
      } else {
        newSet.add(connectionId);
        connectionScrollPositionsRef.current[connectionId] = -1;
      }

      if (newSet.size === 0) {
        nextHighlighted = null;
      } else if (newSet.has(connectionId)) {
        nextHighlighted = connectionId;
      } else {
        const iterator = newSet.values().next();
        nextHighlighted = iterator.done ? null : iterator.value;
      }

      return newSet;
    });
    setHighlightedConnectionId(nextHighlighted);
  }, [updateFilteredConnections]);

  const setSingleConnectionFilter = useCallback((connectionId: string) => {
    updateFilteredConnections(() => {
      const newSet = new Set<string>();
      newSet.add(connectionId);
      return newSet;
    });
    connectionScrollPositionsRef.current = { [connectionId]: -1 };
    setHighlightedConnectionId(connectionId);
  }, [updateFilteredConnections]);

  const clearConnectionFilters = useCallback(
    (options?: { keepConnectedView?: boolean }) => {
      console.log('[MatchupsPage] clearConnectionFilters called with options:', options);
      updateFilteredConnections(() => new Set());
      connectionScrollPositionsRef.current = {};
      setHighlightedConnectionId(null);
      if (!options?.keepConnectedView) {
        console.log('[MatchupsPage] clearConnectionFilters setting viewMode to horses');
        setViewMode("horses");
      } else {
        console.log('[MatchupsPage] clearConnectionFilters keeping connected view');
      }
    },
    [updateFilteredConnections]
  );

  const removeConnectionFilter = useCallback((connectionId: string) => {
    let nextHighlighted: string | null = null;
    updateFilteredConnections((prev) => {
      const newSet = new Set(prev);
      newSet.delete(connectionId);
      const iterator = newSet.values().next();
      nextHighlighted = iterator.done ? null : iterator.value;
      return newSet;
    });
    delete connectionScrollPositionsRef.current[connectionId];
    setHighlightedConnectionId((prev) =>
      nextHighlighted ? nextHighlighted : prev === connectionId ? null : prev
    );
    if (!nextHighlighted && viewMode !== "connected") {
      setViewMode("horses");
    }
  }, [updateFilteredConnections, viewMode]);
  
  const primaryFilteredConnection = React.useMemo(() => {
    const iterator = filteredConnections.values().next();
    if (iterator.done) return null;
    const firstId = iterator.value;
    return allConnectionsMap.get(firstId) || null;
  }, [filteredConnections, allConnectionsMap]);

  // Color palette for multi-select connections (different colors for each selected connection)
  const connectionColors = [
    { bg: "bg-blue-500", bgLight: "bg-blue-100", border: "border-blue-500", text: "text-blue-900", textLight: "text-blue-700" },
    { bg: "bg-emerald-500", bgLight: "bg-emerald-100", border: "border-emerald-500", text: "text-emerald-900", textLight: "text-emerald-700" },
    { bg: "bg-purple-500", bgLight: "bg-purple-100", border: "border-purple-500", text: "text-purple-900", textLight: "text-purple-700" },
    { bg: "bg-orange-500", bgLight: "bg-orange-100", border: "border-orange-500", text: "text-orange-900", textLight: "text-orange-700" },
    { bg: "bg-pink-500", bgLight: "bg-pink-100", border: "border-pink-500", text: "text-pink-900", textLight: "text-pink-700" },
    { bg: "bg-cyan-500", bgLight: "bg-cyan-100", border: "border-cyan-500", text: "text-cyan-900", textLight: "text-cyan-700" },
    { bg: "bg-amber-500", bgLight: "bg-amber-100", border: "border-amber-500", text: "text-amber-900", textLight: "text-amber-700" },
    { bg: "bg-indigo-500", bgLight: "bg-indigo-100", border: "border-indigo-500", text: "text-indigo-900", textLight: "text-indigo-700" },
  ];

  // Map each selected connection ID to a color (ensure stable, unique colors)
  const connectionColorMap = React.useMemo(() => {
    const map = new Map<string, typeof connectionColors[0]>();
    // Sort connection IDs to ensure stable color assignment
    const connectionIds = Array.from(filteredConnections).sort();
    connectionIds.forEach((connId, index) => {
      map.set(connId, connectionColors[index % connectionColors.length]);
    });
    console.log('[MatchupsPage] Connection color map:', Array.from(map.entries()).map(([id, color]) => ({ id, color: color.bg })));
    return map;
  }, [filteredConnections]);

  const getConnectionById = useCallback(
    (connectionId: string) => allConnectionsMap.get(connectionId) || null,
    [allConnectionsMap]
  );

  // Default to "all" if more than 1 type available, otherwise use the single type
  const defaultMatchupType = availableMatchupTypes.length > 1
    ? "all"
    : normalizeMatchupTypeForUI(availableMatchupTypes[0] || "all");
  const [selectedMatchupType, setSelectedMatchupType] = useState<string>(defaultMatchupType);

  useEffect(() => {
    if (filteredConnections.size === 0) {
      if (highlightedConnectionId !== null) {
        setHighlightedConnectionId(null);
      }
      return;
    }

    if (highlightedConnectionId && filteredConnections.has(highlightedConnectionId)) {
      return;
    }

    const iterator = filteredConnections.values().next();
    if (!iterator.done) {
      setHighlightedConnectionId(iterator.value);
    }
  }, [filteredConnections, highlightedConnectionId]);
  
  // Sort state: 'none' | 'salary-asc' | 'salary-desc' | 'apps-asc' | 'apps-desc'
  const [sortBy, setSortBy] = useState<'none' | 'salary-asc' | 'salary-desc' | 'apps-asc' | 'apps-desc'>('none');
  
  // NEW: Handle reload button - reload only current tab or all
  const handleReload = useCallback(async () => {
    console.log(`[Reload] Button clicked in ${selectedMatchupType} tab`);
    
    if (selectedMatchupType === 'all') {
      // Reload ALL matchups
      console.log('[Reload] Reloading all matchups, clearing all picks');
      regenerateMatchups({ tolerance });
      setSelections({}); // Clear ALL picks
      setPickMetadata({});
    } else {
      // Reload ONLY current type
      console.log(`[Reload] Reloading ${selectedMatchupType} only, keeping other picks`);
      await regenerateMatchupType(selectedMatchupType);
      
      // Clear picks ONLY for current type
      setSelections(prev => {
        const newSelections = { ...prev };
        let clearedCount = 0;
        const removedKeys: string[] = [];
        
        Object.keys(newSelections).forEach(key => {
          const { matchupType } = parseSelectionKey(key);
          if (matchupType === selectedMatchupType) {
            delete newSelections[key];
            clearedCount++;
            removedKeys.push(key);
          }
        });
        
        console.log(`[Reload] Cleared ${clearedCount} picks from ${selectedMatchupType}, kept ${Object.keys(newSelections).length} picks from other tabs`);
        
        if (removedKeys.length > 0) {
          setPickMetadata(prevMeta => {
            const next = { ...prevMeta };
            removedKeys.forEach(key => delete next[key]);
            return next;
          });
        }
        
        return newSelections;
      });
    }
  }, [selectedMatchupType, regenerateMatchups, regenerateMatchupType, tolerance, setPickMetadata]);
  
  const supportsMixedTab = React.useMemo(() => {
    return availableMatchupTypes.includes('mixed') || availableMatchupTypes.includes('cross_track');
  }, [availableMatchupTypes]);

  // Normalize cross-track matchup type to mixed for UI purposes
  useEffect(() => {
    if (selectedMatchupType === 'cross_track') {
      setSelectedMatchupType(supportsMixedTab ? 'mixed' : 'all');
    }
  }, [selectedMatchupType, supportsMixedTab]);

  // Update default when availableMatchupTypes changes
  useEffect(() => {
    if (availableMatchupTypes.length > 1) {
      setSelectedMatchupType("all");
    } else if (availableMatchupTypes.length === 1) {
      setSelectedMatchupType(normalizeMatchupTypeForUI(availableMatchupTypes[0]));
    }
  }, [availableMatchupTypes.length]);
  
  // Helper: Check if matchup spans multiple tracks (memoized)
  const isMultiTrackMatchup = React.useCallback((m: Matchup): boolean => {
    const allTracks = new Set<string>();
    
    // Collect tracks from all connections
    for (const conn of [...m.setA.connections, ...m.setB.connections]) {
      if (Array.isArray(conn.trackSet)) {
        conn.trackSet.forEach(track => allTracks.add(track));
      }
      if (Array.isArray(conn.starters)) {
        conn.starters.forEach(s => { if (s?.track) allTracks.add(s.track); });
      }
    }
    
    return allTracks.size > 1; // Multiple tracks = multi-track matchup
  }, []);

  // Create a unique signature for a matchup based on its connection IDs (not type)
  const getMatchupSignature = React.useCallback((m: Matchup): string => {
    // Sort connection IDs from Set A and Set B to create a consistent signature
    const setAIds = m.setA.connections.map(c => c.id).sort().join(',');
    const setBIds = m.setB.connections.map(c => c.id).sort().join(',');
    // Combine in a consistent order (lexicographically smaller first)
    return setAIds < setBIds ? `${setAIds}|${setBIds}` : `${setBIds}|${setAIds}`;
  }, []);
  
  // Memoize filtered and sorted matchups to avoid recomputation on every render
  const filteredMatchups = React.useMemo(() => {
    let result: Matchup[];
    
    // Filter by selected type first
    if (selectedMatchupType === 'all') {
      result = matchups;
    } else if (selectedMatchupType === 'mixed') {
      result = matchups.filter(m => {
        const type = m.matchupType || (m as any).matchup_type || '';
        const isMultiTrack = isMultiTrackMatchup(m);
        return isMultiTrack || type === 'mixed';
      });
    } else if (selectedMatchupType === 'cross_track') {
      result = matchups.filter(m => {
        const type = m.matchupType || (m as any).matchup_type || '';
        const isMultiTrack = isMultiTrackMatchup(m);
        return type === 'cross_track' || isMultiTrack;
      });
    } else {
      result = matchups.filter(m => {
        const type = m.matchupType || (m as any).matchup_type || '';
        return type === selectedMatchupType;
      });
    }
    
    // Then filter by selected track
    if (selectedTrack !== 'all') {
      if (selectedTrack === CROSS_TRACK_FILTER_KEY) {
        result = result.filter(m => isMultiTrackMatchup(m));
      } else {
        result = result.filter(m => {
          const allConnections = [...m.setA.connections, ...m.setB.connections];
          return allConnections.every(c => 
            (c.trackSet && c.trackSet.includes(selectedTrack)) ||
            (c.starters && c.starters.some(s => s.track === selectedTrack))
          );
        });
      }
    }
    
    // Deduplicate matchups: Remove duplicates based on connection content (not type)
    // This prevents the same matchup from appearing multiple times when it exists in multiple types
    // (e.g., a sire vs sire cross-track matchup appearing in both 'sire_vs_sire' and 'mixed' types)
    const seenSignatures = new Set<string>();
    const seenConnections = new Map<string, string>(); // connectionId -> matchup signature (for per-type exclusion)
    const matchupType = selectedMatchupType === 'all' ? null : selectedMatchupType;
    
    result = result.filter(m => {
      // Check for exact duplicate matchups (same connections in same sets)
      const signature = getMatchupSignature(m);
      if (seenSignatures.has(signature)) {
        return false; // Duplicate - already seen
      }
      
      // PER-TYPE EXCLUSION: Within a matchup type, a connection can only appear in ONE matchup
      // This applies specifically to 'mixed' type and other types where connections might be reused
      if (matchupType && (matchupType === 'mixed' || matchupType === 'cross_track')) {
        const allConnIds = [
          ...m.setA.connections.map(c => c.id),
          ...m.setB.connections.map(c => c.id)
        ];
        
        // Check if any connection in this matchup has already been used in another matchup
        for (const connId of allConnIds) {
          if (seenConnections.has(connId)) {
            const existingSignature = seenConnections.get(connId)!;
            // If this matchup is different from the one we saw this connection in, it's a violation
            if (existingSignature !== signature) {
              console.warn(`[MatchupsPage] Per-type exclusion: Connection ${connId} already used in another ${matchupType} matchup, filtering out duplicate`);
              return false; // Connection already used in another matchup of this type
            }
          }
        }
        
        // Mark all connections in this matchup as used
        for (const connId of allConnIds) {
          seenConnections.set(connId, signature);
        }
      }
      
      seenSignatures.add(signature);
      return true; // First occurrence - keep it
    });
    
    // Apply sorting
    if (sortBy !== 'none') {
      result = [...result].sort((a, b) => {
      if (sortBy.startsWith('salary')) {
        const salaryA = a.setA.salaryTotal + a.setB.salaryTotal;
        const salaryB = b.setA.salaryTotal + b.setB.salaryTotal;
        return sortBy === 'salary-asc' ? salaryA - salaryB : salaryB - salaryA;
      } else if (sortBy.startsWith('apps')) {
        const appsA = a.setA.connections.reduce((sum, c) => sum + (c.apps || 0), 0) + 
                     a.setB.connections.reduce((sum, c) => sum + (c.apps || 0), 0);
        const appsB = b.setA.connections.reduce((sum, c) => sum + (c.apps || 0), 0) + 
                     b.setB.connections.reduce((sum, c) => sum + (c.apps || 0), 0);
        return sortBy === 'apps-asc' ? appsA - appsB : appsB - appsA;
      }
        return 0;
      });
    }
    
    return result;
  }, [matchups, selectedMatchupType, selectedTrack, sortBy, isMultiTrackMatchup, getMatchupSignature]);

  const matchupItems = React.useMemo(
    () => {
      // Use a Set to track used keys and ensure uniqueness
      const usedKeys = new Set<string>();
      return filteredMatchups.map((matchup, index) => {
        // Generate truly unique key using index to prevent duplicates
        let uniqueKey = matchup.id 
          ? `${matchup.id}-${index}-${matchup.matchupType || 'unknown'}` 
          : `matchup-${matchup.matchupType || 'unknown'}-${index}`;
        
        // Ensure uniqueness by appending counter if key already exists
        let counter = 0;
        const baseKey = uniqueKey;
        while (usedKeys.has(uniqueKey)) {
          uniqueKey = `${baseKey}-${counter}`;
          counter++;
        }
        usedKeys.add(uniqueKey);
        
        return {
          matchup,
          uniqueKey,
        };
      });
    },
    [filteredMatchups]
  );
  visibleMatchupsRef.current = matchupItems;

  const matchupKeyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const { matchup, uniqueKey } of matchupItems) {
      if (matchup.id && !map.has(matchup.id)) {
        map.set(matchup.id, uniqueKey);
      }
    }
    return map;
  }, [matchupItems]);

  useEffect(() => {
    connectionScrollPositionsRef.current = {};
  }, [selectedMatchupType, sortBy, matchupItems.length]);
  
  // Auto-reload matchups when navigating from results page
  useEffect(() => {
    // Check if we're coming from results page (via sessionStorage or router state)
    const fromResults = sessionStorage.getItem('fromResults');
    if (fromResults === 'true') {
      regenerateMatchups({ tolerance });
      sessionStorage.removeItem('fromResults');
    }
  }, [regenerateMatchups, tolerance]);
  
  // DISABLED: Auto-clean stale picks when matchups change
  // This was causing picks to disappear when switching tracks because the matchups array changes
  // Now picks persist across track switches - they're only cleared on submission or manual removal
  // useEffect(() => {
  //   if (matchups.length === 0) return;
  //   
  //   // Get current matchup IDs
  //   const currentMatchupIds = new Set(
  //     matchups
  //       .map(m => m.id)
  //       .filter((id): id is string => typeof id === 'string' && id.length > 0)
  //   );
  //   
  //   const pruneKeys = (keys: string[]) => {
  //     if (keys.length === 0) return;
  //     setPickMetadata(prev => {
  //       const next = { ...prev };
  //       keys.forEach(key => delete next[key]);
  //       return next;
  //     });
  //   };
  //   
  //   setSelections(prev => {
  //     const validSelections: Record<string, "A" | "B"> = {};
  //     const removedKeys: string[] = [];
  //     
  //     Object.entries(prev).forEach(([key, choice]) => {
  //       const { matchupId } = parseSelectionKey(key);
  //       if (matchupId && currentMatchupIds.has(matchupId)) {
  //         validSelections[key] = choice;
  //       } else {
  //         removedKeys.push(key);
  //       }
  //     });
  //     
  //     if (removedKeys.length > 0) {
  //       console.log(`[Stale Picks] Auto-removed ${removedKeys.length} stale picks after matchup change`);
  //       pruneKeys(removedKeys);
  //     }
  //     
  //     return validSelections;
  //   });
  // }, [matchups]); // Run when matchups change

  // Auto-select contest if none is selected (since we removed lobby)
  useEffect(() => {
    const selectedContestId = sessionStorage.getItem('selectedContestId');
    const storedTrack = sessionStorage.getItem('selectedTrack');
    
    // Sync selectedTrack state with sessionStorage
    if (storedTrack && storedTrack !== selectedTrack) {
      setSelectedTrack(storedTrack);
    }
    
    // If no contest is selected, try to auto-select one
    if (!selectedContestId && contests.length > 0) {
      // Prefer AQU if available, otherwise use first contest
      const aquContest = contests.find(c => c.track === 'AQU');
      const contestToSelect = aquContest || contests[0];
      
      if (contestToSelect) {
        console.log(`[MatchupsPage] Auto-selecting contest: ${contestToSelect.track} (${contestToSelect.id})`);
        sessionStorage.setItem('selectedContestId', contestToSelect.id);
        sessionStorage.setItem('selectedTrack', contestToSelect.track);
        sessionStorage.setItem('selectedDate', contestToSelect.date);
        setSelectedTrack(contestToSelect.track);
        
        // Trigger data load by dispatching custom event
        window.dispatchEvent(new CustomEvent('trackDataChanged'));
      }
    } else if (!selectedContestId && contests.length === 0) {
      // Load contests if not already loaded
      console.log('[MatchupsPage] No contests loaded, fetching...');
      loadContests();
    }
  }, [contests, loadContests, selectedTrack]);
  
  // Ensure data is loaded when entering matchups page
  useEffect(() => {
    const selectedContestId = sessionStorage.getItem('selectedContestId');
    const selectedTrack = sessionStorage.getItem('selectedTrack');
    
    // If we have a contest/track selected but no data, and not loading, trigger load
    // This handles the case where user navigates directly to /matchups
    if ((selectedContestId || selectedTrack) && connections.length === 0 && matchups.length === 0 && !isLoading) {
      console.log('[MatchupsPage] Contest/track selected but no data loaded, triggering load...');
      // Dispatch event to trigger AppContext to load data
      window.dispatchEvent(new CustomEvent('trackDataChanged'));
    }
  }, [connections.length, matchups.length, isLoading]);
  
  // NOTE: Removed auto-adjust track filter logic since we now always show all picks
  // regardless of track filter. Picks persist across track switches.
  
  const handleSelect = (matchupId: string, side: "A" | "B") => {
    // Find the matchup from the visible matchups (matchupItems) using uniqueKey
    // This ensures we get the correct matchup even if IDs don't match exactly
    const matchupItem = matchupItems.find(item => item.uniqueKey === matchupId);
    const matchup = matchupItem?.matchup || matchups.find(m => m.id === matchupId || m.id?.startsWith(matchupId));
    
    if (!matchup) {
      console.warn('[Select] Matchup not found:', matchupId);
      return;
    }
    
    // Determine the matchup type for scoping
    let matchupType: string;
    if (selectedMatchupType === 'all') {
      // In "all" tab, use the matchup's actual type
      matchupType = matchup?.matchupType || (matchup as any)?.matchup_type || 'all';
    } else {
      // In specific tabs, use the selected tab type (already in correct format: jockey_vs_jockey, etc.)
      matchupType = selectedMatchupType;
    }
    
    // Get track from matchup connections
    const fallbackTrack = selectedTrack !== 'all' ? selectedTrack : undefined;
    const matchupTrack = getPrimaryTrackFromMatchup(matchup, fallbackTrack);
    
    // Use the actual matchup ID from the matchup object (database ID)
    // The matchupId parameter is just a temporary display key
    const persistedMatchupId = matchup.id || matchupId;
    
    console.log('[Select] Matchup object:', { 
      hasId: !!matchup.id, 
      matchupId: matchup.id, 
      temporaryId: matchupId,
      usingId: persistedMatchupId 
    });
    
    // Create global key: track-type-matchupId
    const globalKey = buildSelectionKey(matchupTrack, matchupType, persistedMatchupId);
    
    console.log('[Select] Handling selection:', { matchupId: persistedMatchupId, side, track: matchupTrack, type: matchupType, key: globalKey });
    
    const chosenSet = side === "A" ? matchup.setA : matchup.setB;
    const connectionNames = chosenSet.connections.map(conn => conn?.name || conn?.id || "Unknown");
    
    setSelections((prev) => {
      const current = prev[globalKey];
      
      if (current === side) {
        // Deselect - remove this pick
        const newSelections = { ...prev };
        delete newSelections[globalKey];
        console.log('[Select] Deselected:', globalKey);
        return newSelections;
      }
      
      // Select - add or update this pick
      console.log('[Select] Selected:', globalKey, side);
      return { ...prev, [globalKey]: side };
    });
    
    // Track metadata for this pick
    setPickMetadata(prev => {
      const newMetadata = { ...prev };
      
      if (prev[globalKey]?.chosen === side) {
        // Deselecting - remove metadata
        delete newMetadata[globalKey];
      } else {
        // Selecting - add metadata
        newMetadata[globalKey] = {
          matchupId: persistedMatchupId,
          track: matchupTrack,
          matchupType,
          chosen: side,
          names: connectionNames,
        };
      }
      
      return newMetadata;
    });
    
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };
  
  const handleConnectionClick = (connection: Connection | null) => {
    if (!connection) {
      clearConnectionFilters();
      return;
    }

    setSingleConnectionFilter(connection.id);
    setHighlightedConnectionId(connection.id);
  };
  
  const handleConnectionBoxClick = (connection: Connection | string) => {
    const connectionId = typeof connection === "string" ? connection : connection.id;
    const conn = connectionId ? getConnectionById(connectionId) : (typeof connection === "object" ? connection : null);
    if (conn) {
      setSelectedConnectionForModal(conn);
      setIsConnectionModalOpen(true);
    }
  };

  // Click picked set in Your Picks to highlight and scroll to matchup
  const attemptScrollToMatchup = useCallback(
    (matchupId: string, chosenSide: "A" | "B") => {
      // Use map to find the DOM key
      const matchupKey = matchupKeyMap.get(matchupId) || matchupId;
      const matchupItem = matchupItems.find(
        (item) => item.uniqueKey === matchupKey || item.matchup.id === matchupId
      );
    const matchup = matchupItem?.matchup || matchups.find((m) => m.id === matchupId || m.id?.startsWith(matchupId));
    if (!matchup) {
        return false;
    }

      const domKey = matchupItem?.uniqueKey || matchupKey;
      const matchupElement = domKey
        ? document.querySelector(`[data-matchup-id="${domKey}"]`)
        : null;
      if (!(matchupElement instanceof HTMLElement)) {
        return false;
      }

      matchupElement.scrollIntoView({ behavior: "smooth", block: "center" });
      matchupElement.classList.add("flash-outline");
        setTimeout(() => {
        matchupElement.classList.remove("flash-outline");
        }, 600);

      const setElement = matchupElement.querySelector(`[data-set-side="set${chosenSide}"]`);
        if (setElement instanceof HTMLElement) {
        setElement.classList.add("flash-highlight");
          setTimeout(() => {
          setElement.classList.remove("flash-highlight");
          }, 600);
        }

      return true;
    },
    [matchupItems, matchupKeyMap, matchups]
  );

  const handlePickClick = useCallback(
    (pick: { matchupId: string; matchupType?: string; chosen: "A" | "B"; scopedKey?: string; track?: string }) => {
      const matchupId = pick.matchupId;
      const chosenSide = pick.chosen;
      const targetTrack = pick.track === 'mixed' ? CROSS_TRACK_FILTER_KEY : pick.track;

      // Determine target type from pick metadata
      const targetType = normalizeMatchupTypeForUI(pick.matchupType || "mixed");

      pendingPickScrollRef.current = {
        matchupId,
        chosen: chosenSide,
        targetType,
        targetTrack,
      };

      // Switch track if needed
      if (
        targetTrack &&
        targetTrack !== "all" &&
        targetTrack !== selectedTrack
      ) {
        handleTrackSelect(targetTrack);
      }

      // Switch tab if needed
      if (selectedMatchupType === "all" && targetType !== "all") {
        setSelectedMatchupType(targetType);
      } else if (selectedMatchupType !== "all" && selectedMatchupType !== targetType) {
        setSelectedMatchupType(targetType);
      }

      // Try immediate scroll (if matchup already visible)
      const scrolled = attemptScrollToMatchup(matchupId, chosenSide);
      if (scrolled) {
        pendingPickScrollRef.current = null;
    } else {
        // Fallback: retry shortly to allow UI to update
        setTimeout(() => {
          if (pendingPickScrollRef.current?.matchupId === matchupId) {
            const success = attemptScrollToMatchup(matchupId, chosenSide);
            if (success) {
              pendingPickScrollRef.current = null;
            }
          }
        }, 250);
      }
    },
    [
      attemptScrollToMatchup,
      handleTrackSelect,
      selectedMatchupType,
      selectedTrack,
      setSelectedMatchupType,
    ]
  );

  useEffect(() => {
    if (!pendingPickScrollRef.current) return;
    const { matchupId, chosen } = pendingPickScrollRef.current;
    const success = attemptScrollToMatchup(matchupId, chosen);
    if (success) {
      pendingPickScrollRef.current = null;
    }
  }, [attemptScrollToMatchup, matchupItems, selectedMatchupType, selectedTrack]);
  
  const handleConnectionNameClick = (connectionId: string) => {
    // If this connection is already filtered, toggle it off
    if (filteredConnections.has(connectionId)) {
      removeConnectionFilter(connectionId);
    } else {
      // Filter this connection
      scrollToMatchupForConnection(connectionId, isConnectedHorsesView);
    }
  };

  const handleViewModeChange = useCallback(
    (mode: "horses" | "connected") => {
      console.log('[MatchupsPage] handleViewModeChange called:', { mode, currentViewMode: viewMode });
      
      // Clear any clicked connection highlights when switching views
      setClickedConnectionFromStarters(null);
      const allCards = document.querySelectorAll('[data-connection-card]');
      allCards.forEach(card => {
        card.classList.remove('!bg-blue-50', '!border-blue-500');
      });
      const allStarters = document.querySelectorAll('[data-connection-clickable]');
      allStarters.forEach(el => {
        if (el instanceof HTMLElement) {
          el.classList.remove('!bg-blue-200', '!border-blue-600', 'shadow-md');
        }
      });
      
      if (mode === "connected") {
        console.log('[MatchupsPage] Setting view mode to connected');
        setViewMode("connected");
        // Clear filters when entering Connected Horses view
        clearConnectionFilters({ keepConnectedView: true });
      } else {
        console.log('[MatchupsPage] Setting view mode to horses');
        setViewMode("horses");
        // Clear filters when switching to Horses view
        clearConnectionFilters({ keepConnectedView: false });
      }
    },
    [clearConnectionFilters, viewMode]
  );
  
  // Debug: log viewMode changes
  useEffect(() => {
    console.log('[MatchupsPage] viewMode changed to:', viewMode);
  }, [viewMode]);
  
  // Scroll to matchup containing a connection
  // If fromConnectedHorsesView is true, ONLY scroll/highlight in players panel, DO NOT filter starters
  // If fromPlayersPanel is true, filter starters panel
  const scrollToMatchupForConnection = (connectionId: string, fromConnectedHorsesView: boolean = false) => {
    const conn = getConnectionById(connectionId);
    if (!conn) {
      console.log('[scrollToMatchup] Connection not found:', connectionId);
      return;
    }
    
    console.log('[scrollToMatchup] Called:', { connectionId, fromConnectedHorsesView, isConnectedHorsesView, connName: conn.name });
    
    if (fromConnectedHorsesView) {
      // When clicking from Connected Horses view in starters panel:
      // ONLY scroll/highlight in players panel, DO NOT filter starters
      setHighlightedConnectionId(connectionId);
      setClickedConnectionFromStarters({ id: connectionId, name: conn.name, role: conn.role });
      // Don't filter - just scroll to the matchup
    } else if (isConnectedHorsesView) {
      // When clicking connection name in players panel while Connected Horses is active:
      // Filter starters but keep Connected Horses button active
      setSingleConnectionFilter(connectionId);
      setHighlightedConnectionId(connectionId);
      setViewMode("connected"); // Ensure view mode remains connected
    } else {
      // Normal flow: filter and switch to Horses view
      toggleConnectionFilter(connectionId);
      setHighlightedConnectionId(connectionId);
      setViewMode("horses");
    }
    
    // Find all matchups containing this connection across ALL matchup types
    const allMatchupItems = matchupItems; // Current filtered view
    const allMatchupsUnfiltered = matchups; // All matchups regardless of current tab
    
    // Search in ALL matchups to find the connection
    const allMatchesAcrossTypes = allMatchupsUnfiltered
      .map((matchup, idx) => ({ matchup, idx }))
      .filter(({ matchup }) => {
        const hasInSetA = matchup.setA.connections.some((c) => 
          c.id === connectionId || 
          (c.name === conn.name && c.role === conn.role)
        );
        const hasInSetB = matchup.setB.connections.some((c) => 
          c.id === connectionId || 
          (c.name === conn.name && c.role === conn.role)
        );
        return hasInSetA || hasInSetB;
      });
    
    console.log('[scrollToMatchup] Found', allMatchesAcrossTypes.length, 'total matchups across all types');
    
    if (allMatchesAcrossTypes.length === 0) {
      console.log('[scrollToMatchup] No matchups found with this connection');
      return;
    }
    
    // Find the first matchup and determine its type
    const firstMatchup = allMatchesAcrossTypes[0].matchup;
    const rawTargetType = firstMatchup.matchupType || (firstMatchup as any).matchup_type || 'mixed';
    const targetType = normalizeMatchupTypeForUI(rawTargetType);
    
    console.log('[scrollToMatchup] Target matchup type:', targetType, 'Current type:', selectedMatchupType);
    
    // Function to perform the scroll
    const performScroll = () => {
      setTimeout(() => {
        const items = visibleMatchupsRef.current;
        console.log('[scrollToMatchup] Visible matchups after tab switch:', items.length);
        
        if (!items.length) {
          return;
        }

        const matches = items
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => {
            const hasInSetA = item.matchup.setA.connections.some((c) => 
              c.id === connectionId || 
              (c.name === conn.name && c.role === conn.role)
            );
            const hasInSetB = item.matchup.setB.connections.some((c) => 
              c.id === connectionId || 
              (c.name === conn.name && c.role === conn.role)
            );
            return hasInSetA || hasInSetB;
          });

        console.log('[scrollToMatchup] Found', matches.length, 'matchups in current view');

        if (!matches.length) {
          return;
        }

        const previousIndex = connectionScrollPositionsRef.current[connectionId] ?? -1;
        const nextMatch =
          matches.find(({ idx }) => idx > previousIndex) ?? matches[0];
        connectionScrollPositionsRef.current[connectionId] = nextMatch.idx;

        console.log('[scrollToMatchup] Scrolling to matchup:', nextMatch.item.uniqueKey);

        const matchupElement = document.querySelector(
          `[data-matchup-id="${nextMatch.item.uniqueKey}"]`
        );
        if (matchupElement instanceof HTMLElement) {
          matchupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Find the specific connection card within the matchup using data attributes
          const connectionCards = matchupElement.querySelectorAll('[data-connection-card]');
          let targetCard: HTMLElement | null = null;
          
          for (const card of Array.from(connectionCards)) {
            const cardName = card.getAttribute('data-connection-name');
            const cardRole = card.getAttribute('data-connection-role');
            // Check if this card matches the connection
            if (cardName === conn.name && cardRole === conn.role) {
              targetCard = card as HTMLElement;
              break;
            }
          }
          
          if (targetCard) {
            // Highlight the specific connection card with blue background (persistent until cleared)
            // Remove highlight from all cards first
            const allCards = document.querySelectorAll('[data-connection-card]');
            allCards.forEach(card => {
              card.classList.remove('!bg-blue-50', '!border-blue-500');
            });
            
            // Highlight the clicked connection's card (using !important classes to override)
            targetCard.classList.add('!bg-blue-50', '!border-blue-500');
            console.log('[scrollToMatchup] Highlighted connection card for:', conn.name);
          } else {
            console.log('[scrollToMatchup] Connection card not found for:', conn.name, conn.role);
          }
          
          console.log('[scrollToMatchup] Scroll complete');
        } else {
          console.log('[scrollToMatchup] Element not found in DOM');
        }
      }, 100);
    };
    
    // Switch to the correct tab if needed
    // IMPORTANT: When in 'all' or 'mixed' view, NEVER switch matchup types automatically
    // Only switch if we're in a specific type view (like 'jockey_vs_jockey') and need to find the connection
    const isGenericView = selectedMatchupType === 'all' || selectedMatchupType === 'mixed';
    
    if (isGenericView) {
      // In Mixed or All view - stay in current view, don't switch types
      console.log('[scrollToMatchup] Staying in', selectedMatchupType, 'view (generic view - never auto-switch)');
      performScroll();
    } else {
      // In a specific type view (jockey_vs_jockey, trainer_vs_trainer, sire_vs_sire)
      // Check if connection appears in matchups of current type
      const hasConnectionInCurrentType = allMatchupItems.some((item) => {
        const hasInSetA = item.matchup.setA.connections.some((c) => 
          c.id === connectionId || 
          (c.name === conn.name && c.role === conn.role)
        );
        const hasInSetB = item.matchup.setB.connections.some((c) => 
          c.id === connectionId || 
          (c.name === conn.name && c.role === conn.role)
        );
        return hasInSetA || hasInSetB;
      });
      
      if (hasConnectionInCurrentType) {
        // Connection found in current type - stay in current type
        console.log('[scrollToMatchup] Connection found in current type', selectedMatchupType, '- staying in current view');
        performScroll();
      } else if (selectedMatchupType !== targetType) {
        // Connection not in current type - switch to where it is found
        console.log('[scrollToMatchup] Connection not in current type', selectedMatchupType, ', switching to', targetType);
      setSelectedMatchupType(targetType);
      // Wait for tab switch before scrolling
      setTimeout(performScroll, 150);
    } else {
        // Already in correct type
        console.log('[scrollToMatchup] Already in correct type', selectedMatchupType);
      performScroll();
      }
    }
  };
  
  const removePick = (keyOrMatchupId: string) => {
    // Store the track of the pick being removed to check if filter needs to change
    let removedPickTrack: string | undefined;
    
    setPickMetadata((prev) => {
      // Find the track of the pick being removed
      if (prev[keyOrMatchupId]) {
        removedPickTrack = prev[keyOrMatchupId].track;
      } else {
        // Try to find by matching matchupId
        Object.keys(prev).forEach((key) => {
          const { matchupId } = parseSelectionKey(key);
          if (matchupId === keyOrMatchupId && !removedPickTrack) {
            removedPickTrack = prev[key].track;
          }
        });
      }
      
      const newMetadata = { ...prev };
      const keysToDelete = new Set<string>();
      
      if (newMetadata[keyOrMatchupId]) {
        keysToDelete.add(keyOrMatchupId);
      }
      
      Object.keys(newMetadata).forEach((key) => {
        const { matchupId } = parseSelectionKey(key);
        if (matchupId === keyOrMatchupId) {
          keysToDelete.add(key);
        }
      });
      
      keysToDelete.forEach((key) => {
        delete newMetadata[key];
      });
      
      return newMetadata;
    });
    
    setSelections((prev) => {
      const newSelections = { ...prev };
      const keysToDelete = new Set<string>();
      
      if (newSelections[keyOrMatchupId]) {
        keysToDelete.add(keyOrMatchupId);
      }
      
      Object.keys(newSelections).forEach((key) => {
        const { matchupId } = parseSelectionKey(key);
        if (matchupId === keyOrMatchupId) {
          keysToDelete.add(key);
        }
      });
      
      keysToDelete.forEach((key) => {
          delete newSelections[key];
      });
      
      return newSelections;
    });
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  
  const handleSubmit = async () => {
    const picks: RoundPick[] = Object.entries(selections).map(([key, chosen]) => {
      // Get matchupId from pickMetadata (which has the correct UUID)
      const metadata = pickMetadata[key];
      const matchupId = metadata?.matchupId || key;
      
      console.log('[Submit] Pick:', { key, matchupId, chosen });
      
      return {
        matchupId,
        chosen,
      };
    });
    
    const selectionCount = picks.length;
    if (selectionCount < 2 || selectionCount > 10) {
      alert(`Please select between 2 and 10 matchups (currently ${selectionCount} selected)`);
      return;
    }
    
    const amount = Number.parseFloat(entryAmount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid entry amount");
      return;
    }
    
    if (amount > bankroll) {
      alert(`Insufficient bankroll. You have $${bankroll.toFixed(2)}`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Use new relational system if user authenticated, otherwise fall back to old system
      if (userData.profile?.id && relationalApp.currentContest) {
        // NEW: Submit to relational database with user association
        const success = await userData.submitRound(
          relationalApp.currentContest.id,
          picks,
          amount
        );
        
        if (!success) {
          throw new Error(userData.error || 'Failed to submit round');
        }
        
        console.log('✅ Round submitted to relational database');
      } else {
        // FALLBACK: Use old localStorage system  
        await oldSubmitRound(picks, amount, isFlex, selectedCount, multiplierSchedule);
        console.log('⚠️ Used fallback localStorage system - consider authentication');
      }
      
      setSelections({});
      setPickMetadata({});
      setEntryAmount("");
      // Show success banner instead of redirecting
      setShowSuccessBanner(true);
      // Hide banner after 5 seconds
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 5000);
    } catch (error) {
      console.error('Error submitting entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Industry-standard multiplier schedule (aligned with DraftKings, RTSports, etc.)
  // Multiplier is based on CORRECT picks, not just number of picks selected
  // Standard: All picks must win to get max multiplier
  // Flex: Allows one miss - uses lower multiplier if you miss one, max multiplier if all win
  // Maximum multiplier capped at 100x (industry standard)
  const multiplierSchedule: Record<number, { 
    standard: number; // Max multiplier if all picks correct (standard mode)
    flexAllWin: number; // Max multiplier if all picks correct (flex mode)
    flexOneMiss: number; // Multiplier if you miss one pick (flex mode only)
  }> = {
    2: { standard: 3, flexAllWin: 2.5, flexOneMiss: 1.5 },
    3: { standard: 5, flexAllWin: 4, flexOneMiss: 2 },
    4: { standard: 8, flexAllWin: 6, flexOneMiss: 3 },
    5: { standard: 12, flexAllWin: 9, flexOneMiss: 5 },
    6: { standard: 18, flexAllWin: 14, flexOneMiss: 7 },
    7: { standard: 25, flexAllWin: 20, flexOneMiss: 10 },
    8: { standard: 35, flexAllWin: 28, flexOneMiss: 15 },
    9: { standard: 50, flexAllWin: 40, flexOneMiss: 22 },
    10: { standard: 70, flexAllWin: 55, flexOneMiss: 30 },
  };
  const selectedCount = Object.keys(selections).length || 0;
  const scheduled = multiplierSchedule[selectedCount as keyof typeof multiplierSchedule];
  // Show max possible multiplier for display (will be calculated based on actual correct picks at settlement)
  const maxMultiplier = scheduled 
    ? (isFlex ? scheduled.flexAllWin : scheduled.standard)
    : 0;
  const multiplierDisplay = maxMultiplier ? `up to ${maxMultiplier.toFixed(2)}x` : "—";
  const potentialWin = entryAmount && Number.parseFloat(entryAmount) > 0 && maxMultiplier > 0
    ? (Number.parseFloat(entryAmount) * maxMultiplier).toFixed(2)
    : "0.00";
  
  const selectedPicks = React.useMemo(() => {
    return Object.entries(pickMetadata).map(([key, data]) => {
      // Use data stored in pickMetadata - don't try to look up matchup
      // This ensures picks persist even when matchups array changes (e.g., track switch)
      const normalizedTrack = data.track === 'mixed' ? CROSS_TRACK_FILTER_KEY : data.track;
    
      return {
        ...data,
        names: data.names || [],
        track: normalizedTrack,
        scopedKey: key,
      };
    });
  }, [pickMetadata]);
  
  const isPlayButtonEnabled = 
    Object.keys(selections).length >= 2 && 
    Object.keys(selections).length <= 10 &&
    entryAmount &&
    Number.parseFloat(entryAmount) > 0 &&
    Number.parseFloat(entryAmount) <= bankroll;

  // Clear cached data when no contests exist or when contests change
  useEffect(() => {
    if (contests.length === 0 && !contestsLoading) {
      // Clear all cached data when no contests
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('cached_matchups');
          sessionStorage.removeItem('cached_connections');
          sessionStorage.removeItem('cached_matchup_pools');
          sessionStorage.removeItem('cached_display_counts');
          sessionStorage.removeItem('cached_pool_cursor');
          sessionStorage.removeItem('cached_available_matchup_types');
          sessionStorage.removeItem('cached_contest_id');
          sessionStorage.removeItem('cached_track');
          sessionStorage.removeItem('cached_date');
          sessionStorage.removeItem('matchup_selections');
          sessionStorage.removeItem('matchup_pick_metadata');
          sessionStorage.removeItem('selectedContestId');
          sessionStorage.removeItem('selectedTrack');
          sessionStorage.removeItem('selectedDate');
          console.log('[MatchupsPage] Cleared all cached data - no contests available');
        } catch (e) {
          console.warn('[MatchupsPage] Failed to clear cache:', e);
        }
      }
    }
  }, [contests.length, contestsLoading]);

  // Show unified "no matchups" page when no contests exist
  if (contests.length === 0 && !contestsLoading && !contestsError) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <Card className="p-12 max-w-md text-center bg-white border border-[var(--content-15)] shadow-lg">
          <div className="space-y-4">
            <div className="text-6xl mb-4">🏇</div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">No Matchups Available</h1>
            <p className="text-[var(--text-secondary)]">
              There are no active contests at the moment. Check back later or create a contest in the Admin panel.
            </p>
            <Button 
              onClick={() => router.push('/admin')}
              className="mt-6"
            >
              Go to Admin
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Only show loading if we have no data at all (not even cached)
  if ((isLoading && connections.length === 0 && matchups.length === 0) || contestsLoading) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <div className="text-xl text-[var(--text-secondary)]">Loading race data...</div>
      </div>
    );
  }
  
  if (error || contestsError) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error || contestsError}</div>
          <Button onClick={() => globalThis.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-[var(--surface-1)] overflow-hidden flex flex-col relative" style={{ overscrollBehavior: 'contain' }}>
      {/* Success Banner - Top Right */}
      {showSuccessBanner && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm">Round submitted successfully!</span>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="ml-2 hover:bg-green-600 rounded p-0.5 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex gap-3 md:gap-4 px-2 sm:px-3 md:px-4 py-3 md:py-4 min-h-0" style={{ overscrollBehavior: 'contain' }}>
        {/* Left Panel - Starters Window (responsive width) */}
        <div className="w-[300px] sm:w-[400px] md:w-[496px] flex-shrink-0 h-full min-h-0 flex flex-col">
          <div 
            className={`transition-opacity duration-200 flex-1 min-h-0 flex flex-col ${
              isTrackTransitioning ? 'opacity-50' : 'opacity-100'
            }`}
          >
          <StartersWindow
            connections={allConnections}
            selectedConnection={primaryFilteredConnection}
            selectedConnectionIds={filteredConnections}
            connectionColorMap={connectionColorMap}
            onConnectionClick={(conn) => {
              handleConnectionClick(conn);
              if (!conn) {
                setHighlightedConnectionId(null);
              }
            }}
            onConnectionBoxClick={handleConnectionBoxClick}
            matchups={matchups}
            onConnectionClickToMatchup={scrollToMatchupForConnection}
            activeMatchupType={selectedMatchupType}
            onRemoveConnectionFilter={removeConnectionFilter}
            onClearAllFilters={clearConnectionFilters}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            selectedTrack={selectedTrack === 'all' ? 'ALL' : selectedTrack === CROSS_TRACK_FILTER_KEY ? 'ALL' : selectedTrack}
          />
          </div>
        </div>
        
        {/* Middle Panel - Matchups/Players */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <Card 
            className={`bg-[var(--surface-1)] rounded-lg shadow-lg border border-[var(--content-15)] flex-1 flex flex-col overflow-hidden overscroll-contain transition-opacity duration-200 ${
              isTrackTransitioning ? 'opacity-50' : 'opacity-100'
            }`}
          >
            {/* Header - Same line as other panels */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--content-15)]">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Players</h1>
                <div className="flex items-center gap-3">
                  {/* Track Selector - Next to Reload button */}
                  {availableTracks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-secondary)]">Tracks:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTrackSelect('all')}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                            selectedTrack === 'all'
                              ? "bg-[var(--btn-default)] text-white"
                              : "bg-white text-[var(--brand)] border border-[var(--chip-outline)] hover:bg-[var(--blue-50)]"
                          }`}
                        >
                          All
                        </button>
                        {availableTracks
                          .filter(track => track.toUpperCase() !== 'ALL') // Filter out "ALL" to avoid duplicate with "All" button
                          .map((track) => {
                            const colors = TRACK_COLOR_CLASSES[track];
                            const isSelected = selectedTrack === track;
                            return (
                              <button
                                key={track}
                                onClick={() => handleTrackSelect(track)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all whitespace-nowrap ${
                                  isSelected
                                    ? `${colors?.bg || 'bg-[var(--btn-default)]'} text-white`
                                    : `bg-white ${colors?.text || 'text-[var(--brand)]'} border ${colors?.border || 'border-[var(--chip-outline)]'} ${colors?.hoverBg || 'hover:bg-[var(--blue-50)]'} hover:!text-white`
                                }`}
                              >
                                {track}
                              </button>
                            );
                          })}
                        {availableTracks.length > 1 && (
                          <button
                            onClick={() => handleTrackSelect(CROSS_TRACK_FILTER_KEY)}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                              selectedTrack === CROSS_TRACK_FILTER_KEY
                                ? "bg-[var(--btn-default)] text-white"
                                : "bg-white text-[var(--brand)] border border-[var(--chip-outline)] hover:bg-[var(--blue-50)]"
                            }`}
                          >
                            Cross Tracks
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => regenerateMatchups({ tolerance })}
                    variant="outline"
                    size="default"
                    className="px-6 py-3 text-base font-semibold hover:bg-[var(--btn-default)] hover:text-white"
                  >
                    Reload
                  </Button>
                </div>
              </div>
          </div>

            {/* Matchup Type Tabs - Themed band with generous spacing */}
            {availableMatchupTypes.length > 0 && (
              <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-[var(--content-16)]">
                <div className="flex items-center gap-4 flex-nowrap">
                  <Tabs value={selectedMatchupType} onValueChange={setSelectedMatchupType}>
                    <TabsList className="bg-transparent h-auto p-0 gap-2">
                      <TabsTrigger 
                        value="all" 
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap h-auto ${
                          selectedMatchupType === 'all'
                            ? "bg-[var(--btn-default)] text-white shadow-sm border border-transparent"
                            : "bg-[var(--surface-1)] text-[var(--brand)] border border-[var(--chip-outline)] hover:bg-[var(--blue-50)]"
                        }`}
                      >
                        All
                      </TabsTrigger>
                      {/* Order: Jockeys, Trainers, Sires, Mixed */}
                      {['jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed']
                        .filter(type => type === 'mixed' ? supportsMixedTab : availableMatchupTypes.includes(type))
                        .map((type: string) => {
                          const labels: Record<string, string> = {
                            'jockey_vs_jockey': 'Jockeys',
                            'trainer_vs_trainer': 'Trainers',
                            'sire_vs_sire': 'Sires',
                            'mixed': 'Mixed',
                          };
                          return (
                            <TabsTrigger
                              key={type}
                              value={type}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap h-auto ${
                                selectedMatchupType === type
                                  ? "bg-[var(--btn-default)] text-white shadow-sm border border-transparent"
                                  : "bg-[var(--surface-1)] text-[var(--brand)] border border-[var(--chip-outline)] hover:bg-[var(--blue-50)]"
                              }`}
                            >
                              {labels[type] || type}
                            </TabsTrigger>
                          );
                        })}
                    </TabsList>
                  </Tabs>
                  
                  <div className="flex-1" />
                  
                  {/* NEW: Reload Button - Icon Only */}
                  <Button
                    onClick={handleReload}
                    disabled={isLoading}
                    size="sm"
                    variant="ghost"
                    className="h-auto p-2 hover:bg-[var(--blue-50)]"
                    aria-label={selectedMatchupType === 'all' ? 'Reload All' : 'Reload Tab'}
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  
                  <div className="h-5 w-px bg-[var(--content-16)]" />
                  
                  {/* Sort Dropdown */}
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="h-auto px-2 py-1 text-[13px] font-medium bg-transparent border-none shadow-none hover:bg-[var(--blue-50)] data-[state=open]:bg-[var(--blue-50)] w-auto min-w-[120px]">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <SelectValue placeholder="Sort" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="salary-asc">
                        <div className="flex items-center gap-1.5">
                          <ArrowUp className="w-3 h-3" />
                          Salary (Low to High)
                        </div>
                      </SelectItem>
                      <SelectItem value="salary-desc">
                        <div className="flex items-center gap-1.5">
                          <ArrowDown className="w-3 h-3" />
                          Salary (High to Low)
                        </div>
                      </SelectItem>
                      <SelectItem value="apps-asc">
                        <div className="flex items-center gap-1.5">
                          <ArrowUp className="w-3 h-3" />
                          Apps (Low to High)
                        </div>
                      </SelectItem>
                      <SelectItem value="apps-desc">
                        <div className="flex items-center gap-1.5">
                          <ArrowDown className="w-3 h-3" />
                          Apps (High to Low)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Matchups count - aligned with race info in Starters panel */}
                  <div className="text-[12px] leading-[18px] font-medium text-[var(--text-primary)] ml-auto">
                    Matchups {totalMatchupCount !== undefined ? totalMatchupCount : filteredMatchups.length}
                  </div>
                </div>
              </div>
            )}
          
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" style={{ overscrollBehavior: 'contain', scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
              <div className="w-full px-4 py-4 space-y-0">
            {(() => {
              // Show "no contests" message if no active contests exist
              if (contests.length === 0 && !contestsLoading && !contestsError) {
                return (
                  <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
                    <div className="text-gray-500 space-y-2">
                      <p className="text-lg font-semibold">No contests available</p>
                      <p className="text-sm">
                        There are no active contests at the moment. Check back later or create a contest in the Admin panel.
                      </p>
                    </div>
                  </Card>
                );
              }
              
              // Show error message if contests failed to load
              if (contestsError) {
                return (
                  <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
                    <div className="text-red-500 space-y-2">
                      <p className="text-lg font-semibold">Error loading contests</p>
                      <p className="text-sm">{contestsError}</p>
                    </div>
                  </Card>
                );
              }
              
              // Show loading state
              if (contestsLoading && contests.length === 0) {
                return (
                  <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
                    <div className="text-gray-500">
                      Loading contests...
                    </div>
                  </Card>
                );
              }
              
              // Show "no matchups" message if no matchups found
              if (matchupItems.length === 0) {
                return (
                  <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
                    <div className="text-gray-500">
                      {matchups.length === 0 
                        ? "No matchups available. Try adjusting tolerance."
                        : `No ${selectedMatchupType === 'all' ? '' : selectedMatchupType.replace(/_/g, ' ')} matchups available.`}
                    </div>
                  </Card>
                );
              }
              
              // Render matchups
              return matchupItems.map(({ matchup, uniqueKey }, index) => {
                // Check selection using the correct type for scoping
                let matchupType: string;
                if (selectedMatchupType === 'all') {
                  // In "all" tab, use the matchup's actual type
                  matchupType = matchup.matchupType || (matchup as any).matchup_type || 'all';
                } else {
                  // In specific tabs, use the selected tab type (already in correct format)
                  matchupType = selectedMatchupType;
                }
                
                const fallbackTrack = selectedTrack !== 'all' ? selectedTrack : undefined;
                const matchupTrack = getPrimaryTrackFromMatchup(matchup, fallbackTrack);
                const persistedMatchupId = matchup.id || uniqueKey;
                const globalKey = buildSelectionKey(matchupTrack, matchupType, persistedMatchupId);
                const selected =
                  selections[globalKey] ||
                  selections[`${matchupType}-${persistedMatchupId}`] ||
                  selections[persistedMatchupId];
                
                return (
                  <div key={uniqueKey} data-matchup-id={uniqueKey} className="w-full mb-0 last:mb-0">
                    <MatchupCard
                      matchup={matchup}
                      selected={selected}
                      onSelect={(side) => handleSelect(uniqueKey, side)}
                      onConnectionClick={(connId) => handleConnectionBoxClick(connId)}
                      onConnectionNameClick={handleConnectionNameClick}
                      highlightedConnectionId={highlightedConnectionId || primaryFilteredConnection?.id}
                      highlightedConnectionIds={filteredConnections}
                      showPoints={false}
                      showAvpaRace={false}
                      matchupNumber={index + 1}
                      onCompareClick={() => {
                        setSelectedMatchupForComparison(matchup);
                        setIsComparisonModalOpen(true);
                      }}
                    />
                  </div>
                );
              })
            })()}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Lineup/Selections (responsive width) */}
        <div className="w-[280px] sm:w-[320px] md:w-80 flex-shrink-0 flex flex-col h-full min-h-0">
          <Card className="bg-[var(--surface-1)] rounded-lg shadow-lg border border-[var(--content-15)] h-full flex flex-col overflow-hidden">
          {/* Header - Same line as other panels */}
          <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--content-15)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Your picks <span className="bg-[var(--blue-50)] text-[var(--brand)] rounded-full px-2 py-0.5 text-sm">{selectedPicks.length}</span>
              </h2>
            </div>
            
            {/* Track Filter Buttons */}
            {selectedPicks.length > 0 && (() => {
              const picksPerTrack = selectedPicks.reduce((acc, pick) => {
                const track = pick!.track || 'Unknown';
                acc[track] = (acc[track] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              
              const tracks = Object.keys(picksPerTrack);
              
              if (tracks.length > 1) {
                return (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setPicksTrackFilter('all')}
                    >
                      All ({selectedPicks.length})
                    </Button>
                    {tracks.map(track => (
                      <Button
                        key={track}
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => setPicksTrackFilter(track)}
                      >
                        {formatTrackLabel(track)} ({picksPerTrack[track]})
                      </Button>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
          </div>
          
          {/* Scrollable Your Picks Section */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3 md:p-4" style={{ overscrollBehavior: 'contain', scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
            
            <div className="space-y-1.5">
                {selectedPicks.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8">
                    Select matchups to see your picks
                  </div>
                ) : (
                  selectedPicks
                    // Always show all picks regardless of track filter - picks persist across track switches
                    .map((pick) => (
                    <div
                      key={pick!.matchupId}
                      onClick={() => handlePickClick(pick!)}
                      className="bg-[var(--surface-1)] rounded-lg p-2 border border-[var(--chip-outline)] relative hover:shadow-sm transition-shadow cursor-pointer hover:border-[var(--brand)]"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove using the scoped key if available, otherwise use matchupId
                          removePick(pick!.scopedKey || pick!.matchupId);
                        }}
                        className="absolute top-1 right-1 p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="Remove pick"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="text-xs text-gray-500">Set {pick!.chosen}</div>
                        {pick!.track && (
                          <div className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-semibold rounded">
                            {formatTrackLabel(pick!.track)}
                          </div>
                        )}
                      </div>
                      <div className="font-semibold text-xs text-gray-900 pr-10">
                        {pick!.names.join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          
          {/* Entry & Play Section - Clean Compact Design */}
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-[var(--content-15)] space-y-2">
            {/* Entry Amount */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Entry</label>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <Input
                      type="number"
                  placeholder="0"
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                  className={`pl-6 pr-2 h-8 text-sm ${
                        entryAmount && 
                        Number.parseFloat(entryAmount) > bankroll 
                          ? "border-red-500 border-2 focus:border-red-500" 
                          : ""
                      }`}
                      min="1"
                      max={bankroll}
                    />
                  </div>
            </div>
                    {entryAmount && Number.parseFloat(entryAmount) > bankroll && (
              <div className="text-[10px] text-red-600 font-medium ml-10">Amount exceeds bankroll</div>
                    )}
                
            {/* Multiplier Options - Prominent Multipliers */}
                {selectedCount >= 2 && (
              <div className="flex gap-1.5">
                {/* Standard - Multiplier Prominent */}
                      <button
                        type="button"
                        onClick={() => setIsFlex(false)}
                  className={`flex-1 px-2 py-2 rounded border text-center transition-all ${
                          !isFlex
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                  <div className="text-base font-bold text-green-600 mb-0.5">{scheduled?.standard.toFixed(1)}x</div>
                  <div className="text-[9px] text-gray-500">{selectedCount} correct</div>
                  <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${
                    !isFlex ? "bg-[var(--brand)]" : "bg-gray-300"
                  }`} />
                      </button>
                      
                {/* Flex - Multipliers Prominent */}
                      <button
                        type="button"
                        onClick={() => setIsFlex(true)}
                  className={`flex-1 px-2 py-2 rounded border text-center transition-all relative ${
                          isFlex
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                  <div className="flex items-baseline justify-center gap-1 mb-0.5">
                    <div className="text-base font-bold text-green-600">{scheduled?.flexAllWin.toFixed(1)}x</div>
                    <div className="text-xs text-green-600">/{scheduled?.flexOneMiss.toFixed(1)}x</div>
                  </div>
                  <div className="text-[9px] text-gray-500">{selectedCount}/{selectedCount - 1} correct</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isFlex ? "bg-[var(--brand)]" : "bg-gray-300"
                    }`} />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                          <Info className="w-2.5 h-2.5 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-sm">
                                    Flex play allows you to miss one pick and still win, but with reduced payout.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                      </button>
                  </div>
                )}
                
            {/* Potential Win - Only show if amount entered */}
            {entryAmount && Number.parseFloat(entryAmount) > 0 && (
              <div className="px-2 py-1.5 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-[9px] text-gray-600">Potential Win</div>
                    <div className="text-base font-bold text-blue-600">${potentialWin}</div>
                    </div>
                  <div className="text-[10px] text-gray-500">{multiplierDisplay}</div>
                </div>
          </div>
            )}
          
            {/* Play Button - Own Row, Compact */}
            <Button
              onClick={handleSubmit}
              disabled={!isPlayButtonEnabled || isSubmitting}
              className={`w-full py-2 h-auto font-semibold text-sm ${
                isPlayButtonEnabled && !isSubmitting
                  ? "bg-[var(--btn-default)] hover:opacity-90 text-white"
                  : "bg-[var(--content-16)] text-gray-500 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Play'
              )}
            </Button>
          </div>
          </Card>
        </div>
      </div>

      {/* Connection Modal */}
      {selectedConnectionForModal && (
      <ConnectionModal
        connection={selectedConnectionForModal}
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setSelectedConnectionForModal(null);
          }}
        />
      )}
      
      {/* Comparison Modal */}
      <ComparisonModal
        matchup={selectedMatchupForComparison}
        isOpen={isComparisonModalOpen}
        onClose={() => {
          setIsComparisonModalOpen(false);
          setSelectedMatchupForComparison(null);
        }}
      />
    </div>
  );
}
