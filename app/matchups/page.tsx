"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { StartersWindow } from "@/components/windows/StartersWindow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { RoundPick, Connection } from "@/types";
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
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [entryAmount, setEntryAmount] = useState<string>("");
  const [multiplier, setMultiplier] = useState<number>(1);
  
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
    
    submitRound(picks, amount, multiplier);
    setSelections({});
    setEntryAmount("");
    router.push("/results");
  };
  
  const calculateFinalMultiplier = (selectedMultiplier: number) => {
    const baseMultiplier = Math.pow(2, selectedMultiplier + 1);
    const houseTake = 0.28;
    return baseMultiplier * (1 - houseTake);
  };
  
  const finalMultiplier = calculateFinalMultiplier(multiplier);
  const multiplierDisplay = `${finalMultiplier.toFixed(2)}x`;
  const potentialWin = entryAmount && Number.parseFloat(entryAmount) > 0
    ? (Number.parseFloat(entryAmount) * finalMultiplier).toFixed(2)
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
    <div className="h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
      <div className="h-full flex gap-4 p-4">
        {/* Left Panel - Starters Window */}
        <div className="w-80 flex-shrink-0">
          <StartersWindow
            connections={connections}
            selectedConnection={filteredConnection}
            onConnectionClick={handleConnectionClick}
            onConnectionBoxClick={handleConnectionBoxClick}
          />
        </div>
        
        {/* Middle Panel - Matchups/Players */}
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Players</h1>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Tolerance:</span> ${tolerance}
                </div>
                <Button
                  onClick={() => regenerateMatchups({ tolerance })}
                  variant="outline"
                  size="sm"
                >
                  Reload
                </Button>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Select 2-10 matchups to build your round
            </div>
            <div className="mt-2">
              <Slider
                value={[tolerance]}
                onValueChange={([val]) => setTolerance(val)}
                min={100}
                max={1000}
                step={50}
                className="w-full max-w-xs"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            {matchups.length === 0 ? (
              <Card className="p-12 text-center bg-white">
                <div className="text-gray-500">No matchups available. Try adjusting tolerance.</div>
              </Card>
            ) : (
              matchups.map((matchup, index) => (
                <div key={matchup.id}>
                  <div className="mb-2 text-sm font-medium text-gray-600">
                    Matchup {index + 1}
                  </div>
                  <MatchupCard
                    matchup={matchup}
                    selected={selections[matchup.id]}
                    onSelect={(side) => handleSelect(matchup.id, side)}
                    onConnectionClick={(connId) => handleConnectionBoxClick(connId)}
                    showPoints={false}
                    showAvpaRace={false}
                  />
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Right Panel - Lineup/Selections */}
        <div className="w-80 flex-shrink-0">
          <div className="space-y-4 sticky top-4">
            {/* Your Picks */}
            <Card className="bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Your picks <span className="bg-yellow-400 text-gray-900 rounded-full px-2 py-0.5 text-sm">{selectedPicks.length}</span>
                </h2>
                <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {selectedPicks.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8">
                    Select matchups to see your picks
                  </div>
                ) : (
                  selectedPicks.map((pick) => (
                    <div
                      key={pick!.matchupId}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative hover:shadow-sm transition-shadow"
                    >
                      <button
                        onClick={() => removePick(pick!.matchupId)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="text-xs text-gray-500 mb-1">Set {pick!.chosen}</div>
                      <div className="font-semibold text-sm text-gray-900">
                        {pick!.names.join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
            
            {/* Entry Amount */}
            <Card className="bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Entry amount</h2>
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
              
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Multiplier
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[2, 3, 4, 5, 6].map((mult) => {
                    const finalMult = calculateFinalMultiplier(mult - 1);
                    return (
                      <button
                        key={mult}
                        onClick={() => setMultiplier(mult - 1)}
                        className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors ${
                          multiplier === mult - 1
                            ? "bg-gray-900 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {finalMult.toFixed(1)}x
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {entryAmount && Number.parseFloat(entryAmount) > 0 && (
                <div className="mb-3 p-2 bg-blue-50 rounded-md">
                  <div className="text-xs text-gray-600">Potential Win</div>
                  <div className="text-lg font-bold text-blue-600">${potentialWin}</div>
                  <div className="text-xs text-gray-500 mt-1">at {multiplierDisplay}</div>
                </div>
              )}
              
              <Button
                onClick={handleSubmit}
                disabled={!isPlayButtonEnabled}
                className={`w-full py-3 font-semibold ${
                  isPlayButtonEnabled
                    ? "bg-gray-900 hover:bg-gray-800 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Play
              </Button>
            </Card>
          </div>
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
    </div>
  );
}
