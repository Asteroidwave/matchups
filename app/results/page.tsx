"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { Round, Matchup } from "@/types";
import { matchupWinner } from "@/lib/scoring";
import { MatchupModal } from "@/components/MatchupModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, User, Settings } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const { rounds, bankroll } = useApp();
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [selectedPick, setSelectedPick] = useState<{
    matchup: Matchup;
    chosen: "A" | "B";
  } | null>(null);
  
  const toggleRound = (roundId: string) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };
  
  
  const getRoundResults = (round: Round) => {
    const allWon = round.picks.every((pick) => {
      const matchup = round.matchups.find(m => m.id === pick.matchupId);
      if (!matchup) return false;
      const result = matchupWinner(matchup, pick.chosen);
      return result.won;
    });
    
    const picksCount = round.picks.length;
    const entryAmount = round.entryAmount || 0;
    const winnings = round.winnings || 0;
    const netResult = winnings - entryAmount;
    
    // Get individual results for checkmarks
    const individualResults = round.picks.map((pick) => {
      const matchup = round.matchups.find(m => m.id === pick.matchupId);
      if (!matchup) return { won: false, chosenPoints: 0, opponentPoints: 0 };
      return matchupWinner(matchup, pick.chosen);
    });
    
    // Get connection names for display
    const connectionNames: string[] = [];
    for (const pick of round.picks) {
      const matchup = round.matchups.find(m => m.id === pick.matchupId);
      if (matchup) {
        const chosenSet = pick.chosen === "A" ? matchup.setA : matchup.setB;
        connectionNames.push(...chosenSet.connections.map(c => c.name));
      }
    }
    
    return {
      won: allWon,
      picksCount,
      entryAmount,
      winnings,
      netResult,
      individualResults,
      connectionNames,
    };
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Results</h1>
            <div className="text-sm text-gray-600">View your round history</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">Bankroll</div>
              <div className="text-xl font-bold text-gray-900">${bankroll.toFixed(2)}</div>
            </div>
            <Button
              onClick={() => router.push("/matchups")}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              New Round
            </Button>
          </div>
        </div>
        
        {rounds.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <div className="text-gray-500 mb-4">No rounds submitted yet</div>
            <Button
              onClick={() => router.push("/matchups")}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Create Your First Round
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {rounds.map((round) => {
              const results = getRoundResults(round);
              const isExpanded = expandedRounds.has(round.id);
              const netColor = results.netResult >= 0 ? "text-green-600" : "text-red-600";
              
              return (
                <Card key={round.id} className="bg-white border border-gray-200">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRound(round.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Pick Count */}
                        <div className="font-semibold text-gray-900">
                          {results.picksCount} Pick{results.picksCount !== 1 ? "s" : ""}
                          {results.entryAmount > 0 && (
                            <span className="text-gray-500 font-normal ml-1">
                              for ${results.entryAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                        
                        {/* Connection Names */}
                        <div className="flex-1 text-sm text-gray-700">
                          {results.connectionNames.slice(0, 5).join(", ")}
                          {results.connectionNames.length > 5 && ` +${results.connectionNames.length - 5} more`}
                        </div>
                        
                        {/* Individual Results */}
                        <div className="flex items-center gap-1">
                          {results.individualResults.map((result, idx) => (
                            <div
                              key={idx}
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                result.won
                                  ? "bg-green-500 text-white"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {result.won ? "✓" : "✗"}
                            </div>
                          ))}
                        </div>
                        
                        {/* Action Icons */}
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <Settings className="w-4 h-4 text-gray-400" />
                        </div>
                        
                        {/* Net Result */}
                        <div className={`font-bold ${netColor}`}>
                          {results.netResult >= 0 ? "Won" : "Lost"} ${Math.abs(results.netResult).toFixed(2)}
                        </div>
                      </div>
                      
                      {/* Expand Icon */}
                      <div className="ml-4">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="space-y-2">
                        {round.picks.map((pick, idx) => {
                          const result = results.individualResults[idx];
                          const matchup = round.matchups.find(m => m.id === pick.matchupId);
                          
                          if (!matchup) return null;
                          
                          const chosenSet = pick.chosen === "A" ? matchup.setA : matchup.setB;
                          const connectionNames = chosenSet.connections.map(c => c.name).join(", ");
                          
                          return (
                            <div
                              key={pick.matchupId}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm cursor-pointer transition-shadow"
                              onClick={() => setSelectedPick({ matchup, chosen: pick.chosen })}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                                    result.won
                                      ? "bg-green-500 text-white"
                                      : "bg-red-500 text-white"
                                  }`}
                                >
                                  {result.won ? "✓" : "✗"}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    Pick {idx + 1}: {connectionNames}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Set {pick.chosen} • {result.chosenPoints.toFixed(1)} pts
                                  </div>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="ml-2">
                                View Details
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Matchup Modal */}
      {selectedPick && (
        <MatchupModal
          matchup={selectedPick.matchup}
          selectedSet={selectedPick.chosen}
          isOpen={!!selectedPick}
          onClose={() => setSelectedPick(null)}
        />
      )}
    </div>
  );
}
