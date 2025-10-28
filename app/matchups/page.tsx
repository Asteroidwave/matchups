"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { MatchupCard } from "@/components/MatchupCard";
import { ConnectionModal } from "@/components/ConnectionModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { RoundPick, Connection } from "@/types";
import { X, Settings, Info } from "lucide-react";
import { matchupWinner } from "@/lib/scoring";

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
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [entryAmount, setEntryAmount] = useState<string>("");
  
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
  
  const handleConnectionClick = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      setSelectedConnection(connection);
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
    
    submitRound(picks, amount);
    setSelections({});
    setEntryAmount("");
    router.push("/results");
  };
  
  // Calculate multiplier with house take (20% house edge)
  const calculateMultiplier = () => {
    const selectedCount = Object.keys(selections).length;
    if (selectedCount < 2) return 0;
    
    // Base multiplier - simple calculation
    // Each matchup is assumed to have ~1.8x multiplier, then apply house take
    const baseMultiplier = Math.pow(1.8, selectedCount);
    const houseTake = 0.2; // 20% house edge
    const finalMultiplier = baseMultiplier * (1 - houseTake);
    
    return finalMultiplier;
  };
  
  const multiplier = calculateMultiplier();
  const potentialWin = multiplier > 0 && entryAmount 
    ? (Number.parseFloat(entryAmount) * multiplier).toFixed(2)
    : "0.00";
  
  // Get selected picks for sidebar
  const selectedPicks = Object.entries(selections).map(([matchupId, chosen]) => {
    const matchup = matchups.find(m => m.id === matchupId);
    if (!matchup) return null;
    
    const chosenSet = chosen === "A" ? matchup.setA : matchup.setB;
    const connectionNames = chosenSet.connections.map(c => c.name);
    const result = matchupWinner(matchup, chosen);
    
    return {
      matchupId,
      chosen,
      names: connectionNames,
      won: result.won,
      points: result.chosenPoints,
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-6">
          {/* Main Content - 3 columns */}
          <div className="col-span-3">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Popular Players
              </h1>
              <p className="text-gray-600">
                Select matchups and build your round (2-10 required)
              </p>
            </div>
            
            {/* Tolerance Control */}
            <Card className="p-4 mb-6 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Salary Tolerance: ${tolerance}
                  </label>
                  <Slider
                    value={[tolerance]}
                    onValueChange={([val]) => setTolerance(val)}
                    min={100}
                    max={1000}
                    step={50}
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={() => regenerateMatchups({ tolerance })}
                  variant="outline"
                  className="ml-4"
                >
                  Reload Matchups
                </Button>
              </div>
            </Card>
            
            {/* Matchups */}
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
                      onConnectionClick={handleConnectionClick}
                      showPoints={false}
                      showAvpaRace={false}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Sidebar - 1 column */}
          <div className="col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Your Picks */}
              <Card className="bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Your picks {selectedPicks.length}
                  </h2>
                  <Settings className="w-4 h-4 text-gray-400 cursor-pointer" />
                </div>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedPicks.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-8">
                      Select matchups to see your picks
                    </div>
                  ) : (
                    selectedPicks.map((pick) => (
                      <div
                        key={pick!.matchupId}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative"
                      >
                        <button
                          onClick={() => removePick(pick!.matchupId)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="text-xs text-gray-500 mb-1">Set {pick!.chosen}</div>
                        <div className="font-semibold text-sm text-gray-900 mb-1">
                          {pick!.names.join(", ")}
                        </div>
                        <div className="text-xs text-gray-600">
                          {pick!.points.toFixed(1)} pts
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
                      className="pl-7 pr-16"
                      min="1"
                      max={bankroll}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                      Max: ${bankroll.toFixed(0)}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 mb-3">
                  <button className="flex-1 py-2 px-3 bg-gray-900 text-white rounded-md text-sm font-semibold">
                    Standard {multiplier > 0 && `${multiplier.toFixed(2)}x`}
                  </button>
                  <button className="flex-1 py-2 px-3 bg-gray-200 text-gray-700 rounded-md text-sm font-semibold">
                    Flex
                  </button>
                </div>
                
                {entryAmount && Number.parseFloat(entryAmount) > 0 && multiplier > 0 && (
                  <div className="mb-3 p-2 bg-blue-50 rounded-md">
                    <div className="text-xs text-gray-600">Potential Win</div>
                    <div className="text-lg font-bold text-blue-600">${potentialWin}</div>
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
              
              {/* Bankroll */}
              <Card className="bg-white p-4">
                <div className="text-sm text-gray-600 mb-1">Bankroll</div>
                <div className="text-2xl font-bold text-gray-900">${bankroll.toFixed(2)}</div>
              </Card>
            </div>
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
