"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { ComparisonModal } from "@/components/modals/ComparisonModal";
import { StartersWindow } from "@/components/windows/StartersWindow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RoundPick, Connection, Matchup, Starter } from "@/types";
import { X, Settings, Info, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function MatchupsPage() {
  const router = useRouter();
  const {
    connections,
    matchups,
    tolerance,
    regenerateMatchups,
    submitRound,
    isLoading,
    error,
    bankroll,
    availableMatchupTypes: availableMatchupTypesFromContext,
  } = useApp();
  
  const [selections, setSelections] = useState<Record<string, "A" | "B">>({});
  const [selectedConnectionForModal, setSelectedConnectionForModal] = useState<Connection | null>(null);
  const [filteredConnections, setFilteredConnections] = useState<Set<string>>(new Set());
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [selectedMatchupForComparison, setSelectedMatchupForComparison] = useState<Matchup | null>(null);
  const [entryAmount, setEntryAmount] = useState<string>("");
  const [isFlex, setIsFlex] = useState<boolean>(false);
  const connectionScrollPositionsRef = useRef<Record<string, number>>({});
  const visibleMatchupsRef = useRef<Array<{ matchup: Matchup; uniqueKey: string }>>([]);
  // Get available matchup types from sessionStorage
  const availableMatchupTypesFromSession = typeof window !== 'undefined' 
    ? JSON.parse(sessionStorage.getItem('availableMatchupTypes') || '[]')
    : [];
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

  const clearConnectionFilters = useCallback(() => {
    updateFilteredConnections(() => new Set());
    connectionScrollPositionsRef.current = {};
    setHighlightedConnectionId(null);
  }, [updateFilteredConnections]);

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
    setHighlightedConnectionId((prev) => {
      if (nextHighlighted) return nextHighlighted;
      return prev === connectionId ? null : prev;
    });
  }, [updateFilteredConnections]);
  
  const primaryFilteredConnection = React.useMemo(() => {
    const iterator = filteredConnections.values().next();
    if (iterator.done) return null;
    const firstId = iterator.value;
    return allConnectionsMap.get(firstId) || null;
  }, [filteredConnections, allConnectionsMap]);

  const getConnectionById = useCallback(
    (connectionId: string) => allConnectionsMap.get(connectionId) || null,
    [allConnectionsMap]
  );

  // Default to "all" if more than 1 type available, otherwise use the single type
  const defaultMatchupType = availableMatchupTypes.length > 1 ? "all" : (availableMatchupTypes[0] || "all");
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
  
  // Update default when availableMatchupTypes changes
  useEffect(() => {
    if (availableMatchupTypes.length > 1 && selectedMatchupType !== "all") {
      setSelectedMatchupType("all");
    } else if (availableMatchupTypes.length === 1 && selectedMatchupType === "all") {
      setSelectedMatchupType(availableMatchupTypes[0]);
    }
  }, [availableMatchupTypes.length]);
  
  // Filter matchups by selected type
  let filteredMatchups = selectedMatchupType === 'all'
    ? matchups
    : matchups.filter(m => m.matchupType === selectedMatchupType);
  
  // Apply sorting
  if (sortBy !== 'none') {
    filteredMatchups = [...filteredMatchups].sort((a, b) => {
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

  const matchupItems = React.useMemo(
    () =>
      filteredMatchups.map((matchup, index) => ({
        matchup,
        uniqueKey: matchup.id || `matchup-${index}-${matchup.matchupType || 'unknown'}`,
      })),
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

  // Ensure data is loaded when entering matchups page from lobby
  useEffect(() => {
    const selectedTrack = sessionStorage.getItem('selectedTrack');
    const selectedDate = sessionStorage.getItem('selectedDate');
    
    // If we have a selected track but no connections, trigger a reload
    // This handles the case where user navigates directly to /matchups
    if (selectedTrack && connections.length === 0 && !isLoading) {
      // The AppContext should handle this, but we can force a reload if needed
      console.log('Track selected but no connections loaded, waiting for AppContext...');
    }
  }, [connections.length, isLoading]);
  
  const handleSelect = (matchupId: string, side: "A" | "B") => {
    setSelections((prev) => {
      const current = prev[matchupId];
      if (current === side) {
        const newSelections = { ...prev };
        delete newSelections[matchupId];
        return newSelections;
      }
      return { ...prev, [matchupId]: side };
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
  const handlePickClick = (matchupId: string, chosenSide: "A" | "B") => {
    const matchup = matchups.find((m) => m.id === matchupId || m.id?.startsWith(matchupId));
    if (!matchup) return;

    const targetType = matchup.matchupType || "mixed";

    const scroll = () => {
      const matchupKey =
        (matchup.id && matchupKeyMap.get(matchup.id)) ||
        matchup.id ||
        matchupItems.find((item) => item.matchup === matchup)?.uniqueKey;

      const matchupElement = matchupKey
        ? document.querySelector(`[data-matchup-id="${matchupKey}"]`)
        : null;
      if (matchupElement instanceof HTMLElement) {
        matchupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        matchupElement.classList.add('flash-outline');
        setTimeout(() => {
          matchupElement.classList.remove('flash-outline');
        }, 600);

        const setElement = matchupElement.querySelector(
          `[data-set-side="set${chosenSide}"]`
        );
        if (setElement instanceof HTMLElement) {
          setElement.classList.add('flash-highlight');
          setTimeout(() => {
            setElement.classList.remove('flash-highlight');
          }, 600);
        }
      }
    };

    if (selectedMatchupType !== 'all' && selectedMatchupType !== targetType) {
      setSelectedMatchupType(targetType);
      setTimeout(scroll, 0);
    } else {
      scroll();
    }
  };
  
  const handleConnectionNameClick = (connectionId: string) => {
    // Use the existing scrollToMatchupForConnection function which handles everything
    scrollToMatchupForConnection(connectionId, false);
  };
  
  // Scroll to matchup containing a connection
  // If fromConnectedHorsesView is true, only highlight in players panel, don't filter starters
  const scrollToMatchupForConnection = (connectionId: string, fromConnectedHorsesView: boolean = false) => {
    const conn = getConnectionById(connectionId);
    if (!conn) return;
    
    if (fromConnectedHorsesView) {
      // When clicking from Connected Horses view, only highlight in players panel, don't filter starters
      setHighlightedConnectionId(connectionId);
    } else {
      toggleConnectionFilter(connectionId);
      setHighlightedConnectionId(connectionId);
    }
    
    setTimeout(() => {
      const items = visibleMatchupsRef.current;
      if (!items.length) {
        return;
      }

      const matches = items
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) =>
          item.matchup.setA.connections.some((c) => c.id === connectionId) ||
          item.matchup.setB.connections.some((c) => c.id === connectionId)
        );

      if (!matches.length) {
        return;
      }

      const previousIndex = connectionScrollPositionsRef.current[connectionId] ?? -1;
      const nextMatch =
        matches.find(({ idx }) => idx > previousIndex) ?? matches[0];
      connectionScrollPositionsRef.current[connectionId] = nextMatch.idx;

      const matchupElement = document.querySelector(
        `[data-matchup-id="${nextMatch.item.uniqueKey}"]`
      );
      if (matchupElement instanceof HTMLElement) {
        matchupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };
  
  const removePick = (matchupId: string) => {
    setSelections((prev) => {
      const newSelections = { ...prev };
      delete newSelections[matchupId];
      return newSelections;
    });
  };
  
  const handleSubmit = () => {
    const picks: RoundPick[] = Object.entries(selections).map(([matchupId, chosen]) => ({
      matchupId,
      chosen,
    }));
    
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
    
    submitRound(picks, amount, computedMultiplier);
    setSelections({});
    setEntryAmount("");
    router.push("/live");
  };

  // Industry-standard multiplier schedule (DraftKings/Underdog style)
  // Standard: All picks must win
  // Flex: Lower payout if all win, but allows one miss (with reduced payout)
  const multiplierSchedule: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }> = {
    2: { standard: 3, flexAllWin: 1.8, flexOneMiss: 1.25 },
    3: { standard: 6, flexAllWin: 2.25, flexOneMiss: 1.25 },
    4: { standard: 10, flexAllWin: 5, flexOneMiss: 2 },
    5: { standard: 20, flexAllWin: 10, flexOneMiss: 4 },
    6: { standard: 35, flexAllWin: 17.5, flexOneMiss: 8 },
    7: { standard: 70, flexAllWin: 35, flexOneMiss: 16 },
    8: { standard: 125, flexAllWin: 62.5, flexOneMiss: 32 },
    9: { standard: 250, flexAllWin: 125, flexOneMiss: 64 },
    10: { standard: 500, flexAllWin: 250, flexOneMiss: 125 },
  };
  const selectedCount = Object.keys(selections).length || 0;
  const scheduled = multiplierSchedule[selectedCount as keyof typeof multiplierSchedule];
  const computedMultiplier = scheduled 
    ? (isFlex ? scheduled.flexAllWin : scheduled.standard)
    : 0;
  const multiplierDisplay = computedMultiplier ? `${computedMultiplier.toFixed(2)}x` : "—";
  const potentialWin = entryAmount && Number.parseFloat(entryAmount) > 0
    ? (Number.parseFloat(entryAmount) * (computedMultiplier || 0)).toFixed(2)
    : "0.00";
  
  const selectedPicks = Object.entries(selections).map(([matchupId, chosen]) => {
    const matchup = matchups.find(m => m.id === matchupId);
    if (!matchup) return null;
    
    const chosenSet = chosen === "A" ? matchup.setA : matchup.setB;
    const connectionNames = chosenSet.connections.map(c => c.name);
    
    return {
      matchupId,
      chosen,
      names: connectionNames,
    };
  }).filter(Boolean);
  
  const isPlayButtonEnabled = 
    Object.keys(selections).length >= 2 && 
    Object.keys(selections).length <= 10 &&
    entryAmount &&
    Number.parseFloat(entryAmount) > 0 &&
    Number.parseFloat(entryAmount) <= bankroll;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading race data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <Button onClick={() => globalThis.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-[var(--surface-1)] overflow-hidden flex flex-col" style={{ overscrollBehavior: 'contain' }}>
      <div className="flex-1 flex gap-4 px-4 py-4 min-h-0" style={{ overscrollBehavior: 'contain' }}>
        {/* Left Panel - Starters Window (fixed to Figma width 496px) */}
        <div className="w-[496px] flex-shrink-0 h-full min-h-0">
          <StartersWindow
            connections={allConnections}
            selectedConnection={primaryFilteredConnection}
            selectedConnectionIds={filteredConnections}
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
          />
        </div>
        
        {/* Middle Panel - Matchups/Players */}
        <div className="flex-1 min-w-0 min-h-0">
          <Card className="bg-[var(--surface-1)] rounded-lg shadow-lg border border-[var(--content-15)] h-full flex flex-col overflow-hidden overscroll-contain">
            {/* Header - Same line as other panels */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--content-15)]">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Players</h1>
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

            {/* Matchup Type Tabs - In grey band, aligned with Starters panel grey band */}
            {availableMatchupTypes.length > 0 && (
              <div className="flex-shrink-0 px-4 py-2 bg-[var(--content-15)] border-b border-[var(--content-16)]">
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <Tabs value={selectedMatchupType} onValueChange={setSelectedMatchupType}>
                    <TabsList className="bg-transparent h-auto p-0">
                      <TabsTrigger 
                        value="all" 
                        className={`px-2 py-1 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap h-auto ${
                          selectedMatchupType === 'all'
                            ? "bg-[var(--btn-default)] text-white"
                            : "bg-[var(--blue-50)] text-[var(--brand)] hover:opacity-90"
                        }`}
                      >
                        All
                      </TabsTrigger>
                      {/* Order: Jockeys, Trainers, Sires, Mixed */}
                      {['jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed']
                        .filter(type => availableMatchupTypes.includes(type))
                        .map((type: string, idx: number) => {
                          const labels: Record<string, string> = {
                            'jockey_vs_jockey': 'Jockeys',
                            'trainer_vs_trainer': 'Trainers',
                            'sire_vs_sire': 'Sires',
                            'mixed': 'Mixed',
                          };
                          return (
                            <React.Fragment key={type}>
                              {/* Visual Separator */}
                              {idx > 0 && (
                                <div className="w-px h-4 bg-[var(--content-16)] mx-0.5"></div>
                              )}
                              <TabsTrigger
                                value={type}
                                className={`px-2 py-1 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap h-auto ${
                                  selectedMatchupType === type
                                    ? "bg-[var(--btn-default)] text-white"
                                    : "bg-[var(--blue-50)] text-[var(--brand)] hover:opacity-90"
                                }`}
                              >
                                {labels[type] || type}
                              </TabsTrigger>
                            </React.Fragment>
                          );
                        })}
                    </TabsList>
                  </Tabs>
                  
                  {/* Visual Separator before sort */}
                  <div className="w-px h-4 bg-[var(--content-16)] mx-0.5"></div>
                  
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
                    Matchups {filteredMatchups.length}
                  </div>
                </div>
              </div>
            )}
          
            <div className="flex-1 overflow-y-auto pb-4" style={{ overscrollBehavior: 'contain', scrollBehavior: 'auto' }}>
              <div className="w-full">
            {matchupItems.length === 0 ? (
              <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
                <div className="text-gray-500">
                  {matchups.length === 0 
                    ? "No matchups available. Try adjusting tolerance."
                    : `No ${selectedMatchupType === 'all' ? '' : selectedMatchupType.replace(/_/g, ' ')} matchups available.`}
                </div>
              </Card>
            ) : (
              matchupItems.map(({ matchup, uniqueKey }, index) => {
                return (
                  <div key={uniqueKey} data-matchup-id={uniqueKey} className="w-full">
                    <MatchupCard
                      matchup={matchup}
                      selected={selections[uniqueKey]}
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
            )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Lineup/Selections */}
        <div className="w-80 flex-shrink-0 flex flex-col h-full min-h-0">
          <Card className="bg-[var(--surface-1)] rounded-lg shadow-lg border border-[var(--content-15)] h-full flex flex-col overflow-hidden">
          {/* Header - Same line as other panels */}
          <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--content-15)]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Your picks <span className="bg-[var(--blue-50)] text-[var(--brand)] rounded-full px-2 py-0.5 text-sm">{selectedPicks.length}</span>
              </h2>
              <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
            </div>
          </div>
          
          {/* Scrollable Your Picks Section */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4" style={{ overscrollBehavior: 'contain', scrollBehavior: 'auto' }}>
            
            <div className="space-y-1.5">
                {selectedPicks.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8">
                    Select matchups to see your picks
                  </div>
                ) : (
                  selectedPicks.map((pick) => (
                    <div
                      key={pick!.matchupId}
                      onClick={() => handlePickClick(pick!.matchupId, pick!.chosen)}
                      className="bg-[var(--surface-1)] rounded-lg p-2 border border-[var(--chip-outline)] relative hover:shadow-sm transition-shadow cursor-pointer hover:border-[var(--brand)]"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePick(pick!.matchupId);
                        }}
                        className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="text-xs text-gray-500 mb-0.5">Set {pick!.chosen}</div>
                      <div className="font-semibold text-xs text-gray-900 pr-6">
                        {pick!.names.join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          
          {/* Entry Amount - Always Visible */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--content-15)]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Entry amount</h2>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="mb-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      className={`pl-7 pr-3 ${
                        entryAmount && 
                        Number.parseFloat(entryAmount) > bankroll 
                          ? "border-red-500 border-2 focus:border-red-500" 
                          : ""
                      }`}
                      min="1"
                      max={bankroll}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-gray-500">Max: ${bankroll.toFixed(0)}</span>
                    {entryAmount && Number.parseFloat(entryAmount) > bankroll && (
                      <span className="text-red-600 font-medium">Amount exceeds bankroll</span>
                    )}
                  </div>
                </div>
                
                {selectedCount >= 2 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-sm font-medium text-gray-700">Expected payout</label>
                      <Info className="w-3 h-3 text-gray-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Standard Card */}
                      <button
                        type="button"
                        onClick={() => setIsFlex(false)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          !isFlex
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-gray-700">Standard</div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            !isFlex
                              ? "border-[var(--brand)] bg-[var(--brand)]"
                              : "border-gray-300"
                          }`}>
                            {!isFlex && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">{selectedCount} Correct</div>
                        <div className="text-sm font-semibold text-green-600">{scheduled?.standard.toFixed(2)}x</div>
                      </button>
                      
                      {/* Flex Card */}
                      <button
                        type="button"
                        onClick={() => setIsFlex(true)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          isFlex
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            <div className="text-xs font-semibold text-gray-700">Flex</div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3 h-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-sm">
                                    Flex play allows you to miss one pick and still win, but with reduced payout.
                                    Perfect for when you want a safety net on your selections.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isFlex
                              ? "border-[var(--brand)] bg-[var(--brand)]"
                              : "border-gray-300"
                          }`}>
                            {isFlex && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">{selectedCount} Correct</div>
                        <div className="text-sm font-semibold text-green-600 mb-1">{scheduled?.flexAllWin.toFixed(2)}x</div>
                        <div className="text-xs text-gray-600">{selectedCount - 1} Correct</div>
                        <div className="text-xs font-semibold text-green-600">up to {scheduled?.flexOneMiss.toFixed(2)}x</div>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="mb-3 min-h-[60px]">
                  {entryAmount && Number.parseFloat(entryAmount) > 0 ? (
                    <div className="p-2 bg-blue-50 rounded-md">
                      <div className="text-xs text-gray-600">Potential Win</div>
                      <div className="text-lg font-bold text-blue-600">${potentialWin}</div>
                      <div className="text-xs text-gray-500 mt-1">at {multiplierDisplay}</div>
                    </div>
                  ) : (
                    <div className="h-[60px]" />
                  )}
                </div>
          </div>
          
          {/* Play Button - Always Visible at Bottom */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--content-15)]">
            <Button
              onClick={handleSubmit}
              disabled={!isPlayButtonEnabled}
              className={`w-full py-3 font-semibold ${
                isPlayButtonEnabled
                  ? "bg-[var(--btn-default)] hover:opacity-90 text-white"
                  : "bg-[var(--content-16)] text-gray-500 cursor-not-allowed"
              }`}
            >
              Play
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
