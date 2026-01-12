"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { ComparisonModal } from "@/components/modals/ComparisonModal";
import { StartersWindow } from "@/components/windows/StartersWindow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RoundPick, Connection, Matchup } from "@/types";
import { X, Settings, Info } from "lucide-react";

export default function MatchupsPage() {
  const router = useRouter();
  const {
    connections,
    matchups,
    tolerance,
    setTolerance,
    regenerateMatchups,
    submitRound,
    isLoading,
    error,
    bankroll,
  } = useApp();
  
  const [selections, setSelections] = useState<Record<string, "A" | "B">>({});
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [filteredConnection, setFilteredConnection] = useState<Connection | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [selectedMatchupForComparison, setSelectedMatchupForComparison] = useState<Matchup | null>(null);
  const [entryAmount, setEntryAmount] = useState<string>("");
  const [isFlex, setIsFlex] = useState<boolean>(false);
  
  // Auto-reload matchups when navigating from results page
  useEffect(() => {
    // Check if we're coming from results page (via sessionStorage or router state)
    const fromResults = sessionStorage.getItem('fromResults');
    if (fromResults === 'true') {
      regenerateMatchups({ tolerance });
      sessionStorage.removeItem('fromResults');
    }
  }, [regenerateMatchups, tolerance]);
  
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
  };
  
  const handleConnectionClick = (connection: Connection | null) => {
    setFilteredConnection(connection);
    // Clear highlighted connection when clearing filter
    if (!connection) {
      setHighlightedConnectionId(null);
    }
  };
  
  const handleConnectionBoxClick = (connection: Connection | string) => {
    const conn = typeof connection === "string" 
      ? connections.find(c => c.id === connection)
      : connection;
    if (conn) {
      setSelectedConnection(conn);
      setIsConnectionModalOpen(true);
    }
  };
  
  const handleConnectionNameClick = (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    if (conn) {
      // If clicking the same connection that's already filtered, clear it (toggle off)
      // This will return to the previous view (either default horses or connected horses)
      // Otherwise, set it as the new filter (overrides current filter)
      // This will filter the starters panel to show only horses with this connection
      if (filteredConnection?.id === connectionId) {
        setFilteredConnection(null);
        setHighlightedConnectionId(null);
      } else {
        setFilteredConnection(conn);
        setHighlightedConnectionId(connectionId);
      }
    }
  };
  
  // Find matchup containing a specific connection
  const findMatchupForConnection = (connectionId: string) => {
    return matchups.findIndex(m => 
      m.setA.connections.some(c => c.id === connectionId) ||
      m.setB.connections.some(c => c.id === connectionId)
    );
  };
  
  // Scroll to matchup containing a connection
  // If fromConnectedHorsesView is true, only highlight in players panel, don't filter starters
  const scrollToMatchupForConnection = (connectionId: string, fromConnectedHorsesView: boolean = false) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;
    
    if (fromConnectedHorsesView) {
      // When clicking from Connected Horses view, only highlight in players panel, don't filter starters
      setHighlightedConnectionId(connectionId);
      // Clear filtered connection to ensure starters panel doesn't filter
      setFilteredConnection(null);
    } else {
      // Normal behavior: filter starters panel
      // If clicking the same connection that's already filtered, clear it (toggle off)
      if (filteredConnection?.id === connectionId) {
        setFilteredConnection(null);
        setHighlightedConnectionId(null);
        return;
      }
      
      // Otherwise, set it as filtered (to highlight it in players panel AND filter starters)
      setFilteredConnection(conn);
      setHighlightedConnectionId(connectionId);
    }
    
    // Scroll to the matchup
    const matchupIndex = findMatchupForConnection(connectionId);
    if (matchupIndex >= 0) {
      // Small delay to ensure the highlight renders first
      setTimeout(() => {
        const matchupElement = document.querySelector(`[data-matchup-id="${matchups[matchupIndex].id}"]`);
        if (matchupElement) {
          matchupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
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
    router.push("/results");
  };
  
  // Industry-standard multiplier schedule (DraftKings/Underdog style)
  // Standard: All picks must win
  // Flex: Lower payout if all win, but allows one miss (with reduced payout)
  const multiplierSchedule: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }> = {
    2: { standard: 3.5, flexAllWin: 2.1, flexOneMiss: 1.0 },
    3: { standard: 6.5, flexAllWin: 3.9, flexOneMiss: 2.0 },
    4: { standard: 13.0, flexAllWin: 7.8, flexOneMiss: 3.5 },
    5: { standard: 25.0, flexAllWin: 15.0, flexOneMiss: 6.5 },
    6: { standard: 50.0, flexAllWin: 30.0, flexOneMiss: 13.0 },
    7: { standard: 100.0, flexAllWin: 60.0, flexOneMiss: 25.0 },
    8: { standard: 200.0, flexAllWin: 120.0, flexOneMiss: 50.0 },
    9: { standard: 400.0, flexAllWin: 240.0, flexOneMiss: 100.0 },
    10: { standard: 800.0, flexAllWin: 480.0, flexOneMiss: 200.0 },
  };
  const selectedCount = Object.keys(selections).length || 0;
  const scheduled = multiplierSchedule[selectedCount as keyof typeof multiplierSchedule];
  const computedMultiplier = scheduled 
    ? (isFlex ? scheduled.flexAllWin : scheduled.standard)
    : 0;
  const flexOneMissMultiplier = scheduled?.flexOneMiss || 0;
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
            connections={connections}
            selectedConnection={filteredConnection}
            onConnectionClick={(conn) => {
              handleConnectionClick(conn);
              if (!conn) {
                setHighlightedConnectionId(null);
              }
            }}
            onConnectionBoxClick={handleConnectionBoxClick}
            matchups={matchups}
            onConnectionClickToMatchup={scrollToMatchupForConnection}
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
            
            {/* Divider - matching Starters panel */}
            <div className="border-b border-[var(--content-15)]"></div>
          
                 <div className="flex-1 overflow-y-auto pb-4" style={{ overscrollBehavior: 'contain', scrollBehavior: 'auto' }}>
              <div className="w-full">
            {matchups.length === 0 ? (
              <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
                <div className="text-gray-500">No matchups available. Try adjusting tolerance.</div>
              </Card>
            ) : (
              matchups.map((matchup, index) => (
                <div key={matchup.id} data-matchup-id={matchup.id} className="w-full">
                  <MatchupCard
                    matchup={matchup}
                    selected={selections[matchup.id]}
                    onSelect={(side) => handleSelect(matchup.id, side)}
                    onConnectionClick={(connId) => handleConnectionBoxClick(connId)}
                    onConnectionNameClick={handleConnectionNameClick}
                    highlightedConnectionId={highlightedConnectionId || filteredConnection?.id}
                    showPoints={false}
                    showAvpaRace={false}
                    matchupNumber={index + 1}
                    onCompareClick={() => {
                      setSelectedMatchupForComparison(matchup);
                      setIsComparisonModalOpen(true);
                    }}
                  />
                </div>
              ))
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
                      className="bg-[var(--surface-1)] rounded-lg p-2 border border-[var(--chip-outline)] relative hover:shadow-sm transition-shadow"
                    >
                      <button
                        onClick={() => removePick(pick!.matchupId)}
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
          
          {/* Entry Amount - Compact */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-[var(--content-15)]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Entry amount</h2>
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </div>
                
                <div className="mb-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      className={`pl-6 pr-2 py-1.5 h-9 text-sm ${
                        entryAmount && 
                        Number.parseFloat(entryAmount) > bankroll 
                          ? "border-red-500 border-2 focus:border-red-500" 
                          : ""
                      }`}
                      min="1"
                      max={bankroll}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px]">
                    <span className="text-gray-500">Max: ${bankroll.toFixed(0)}</span>
                    {entryAmount && Number.parseFloat(entryAmount) > bankroll && (
                      <span className="text-red-600 font-medium">Exceeds bankroll</span>
                    )}
                  </div>
                </div>
                
                {selectedCount >= 2 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">Expected payout</label>
                      <Info className="w-3 h-3 text-gray-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Standard Card */}
                      <button
                        type="button"
                        onClick={() => setIsFlex(false)}
                        className={`p-2 rounded-md border text-left transition-all ${
                          !isFlex
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-[var(--content-15)] bg-[var(--surface-1)] hover:border-[var(--content-9)]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[11px] font-semibold text-[var(--text-primary)]">Standard</div>
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                            !isFlex
                              ? "border-[var(--brand)] bg-[var(--brand)]"
                              : "border-gray-300"
                          }`}>
                            {!isFlex && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">{selectedCount} Correct</div>
                        <div className="text-xs font-bold text-green-600">{scheduled?.standard.toFixed(2)}x</div>
                      </button>
                      
                      {/* Flex Card */}
                      <button
                        type="button"
                        onClick={() => setIsFlex(true)}
                        className={`p-2 rounded-md border text-left transition-all ${
                          isFlex
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-[var(--content-15)] bg-[var(--surface-1)] hover:border-[var(--content-9)]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-0.5">
                            <div className="text-[11px] font-semibold text-[var(--text-primary)]">Flex</div>
                            <Info className="w-2.5 h-2.5 text-gray-400" />
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                            isFlex
                              ? "border-[var(--brand)] bg-[var(--brand)]"
                              : "border-gray-300"
                          }`}>
                            {isFlex && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">{selectedCount} → {scheduled?.flexAllWin.toFixed(2)}x</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">{selectedCount - 1} → {scheduled?.flexOneMiss.toFixed(2)}x</div>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="mb-2 min-h-[44px]">
                  {entryAmount && Number.parseFloat(entryAmount) > 0 ? (
                    <div className="p-2 bg-[var(--blue-50)] rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-[var(--text-secondary)]">Potential Win</div>
                          <div className="text-base font-bold text-[var(--brand)]">${potentialWin}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-[var(--text-secondary)]">Multiplier</div>
                          <div className="text-xs font-semibold text-green-600">{multiplierDisplay}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[44px]" />
                  )}
                </div>
          </div>
          
          {/* Play Button - Always Visible at Bottom */}
          <div className="flex-shrink-0 px-3 py-2 border-t border-[var(--content-15)]">
            <Button
              onClick={handleSubmit}
              disabled={!isPlayButtonEnabled}
              className={`w-full py-2 text-sm font-semibold ${
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
      {selectedConnection && (
        <ConnectionModal
          connection={selectedConnection}
          isOpen={isConnectionModalOpen}
          onClose={() => {
            setIsConnectionModalOpen(false);
            setSelectedConnection(null);
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
