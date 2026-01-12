"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { Round, Matchup, Connection } from "@/types";
import { matchupWinner } from "@/lib/scoring";
import { MatchupModal } from "@/components/modals/MatchupModal";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { RaceDetailModal } from "@/components/modals/RaceDetailModal";
import { CompareModal } from "@/components/modals/CompareModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronDown } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const { rounds, bankroll, connections, regenerateMatchups, tolerance } = useApp();
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [selectedPick, setSelectedPick] = useState<{
    matchup: Matchup;
    chosen: "A" | "B";
  } | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [selectedRace, setSelectedRace] = useState<{
    track: string;
    race: number;
    starters: any[];
  } | null>(null);
  const [compareConnections, setCompareConnections] = useState<{
    conn1: Connection | null;
    conn2: Connection | null;
  }>({ conn1: null, conn2: null });
  
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
  
  const handleConnectionClick = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      setSelectedConnection(connection);
      setIsConnectionModalOpen(true);
    }
  };
  
  const handleRaceClick = (track: string, race: number) => {
    // Get all starters for this race
    const raceStarters: any[] = [];
    for (const conn of connections) {
      for (const starter of conn.starters) {
        if (starter.track === track && starter.race === race) {
                                  if (!raceStarters.some(s => s.horseName === starter.horseName)) {
            raceStarters.push(starter);
          }
        }
      }
    }
    
    setSelectedRace({
      track,
      race,
      starters: raceStarters,
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
    
    const individualResults = round.picks.map((pick) => {
      const matchup = round.matchups.find(m => m.id === pick.matchupId);
      if (!matchup) return { won: false, chosenPoints: 0, opponentPoints: 0 };
      return matchupWinner(matchup, pick.chosen);
    });
    
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
  
  // Get all connections from a round for compare feature
  const getRoundConnections = (round: Round): Connection[] => {
    const conns: Connection[] = [];
    const connIds = new Set<string>();
    
    for (const pick of round.picks) {
      const matchup = round.matchups.find(m => m.id === pick.matchupId);
      if (matchup) {
        const chosenSet = pick.chosen === "A" ? matchup.setA : matchup.setB;
        for (const conn of chosenSet.connections) {
          if (!connIds.has(conn.id)) {
            connIds.add(conn.id);
            conns.push(conn);
          }
        }
      }
    }
    
    return conns;
  };

  return (
    <div className="min-h-screen bg-[var(--surface-1)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Results</h1>
            <div className="text-sm text-[var(--text-secondary)]">View your round history</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-[var(--text-tertiary)]">Bankroll</div>
              <div className="text-xl font-bold text-[var(--text-primary)]">${bankroll.toFixed(2)}</div>
            </div>
          <Button
            onClick={() => {
              sessionStorage.setItem('fromResults', 'true');
              regenerateMatchups({ tolerance });
              router.push("/matchups");
            }}
            className="bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white"
          >
            New Round
          </Button>
        </div>
        </div>

        {rounds.length === 0 ? (
            <Card className="p-12 text-center bg-[var(--surface-1)] border border-[var(--content-15)]">
              <div className="text-[var(--text-secondary)] mb-4">No rounds submitted yet</div>
              <Button
                onClick={() => router.push("/matchups")}
              className="bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white"
              >
                Create Your First Round
              </Button>
            </Card>
          ) : (
          <div className="space-y-2">
            {rounds.map((round) => {
              const results = getRoundResults(round);
              const netColor = results.netResult >= 0 ? "text-[var(--success)]" : "text-[var(--error)]";
              const isExpanded = expandedRounds.has(round.id);
              
              return (
                <Card key={round.id} className="bg-[var(--surface-1)] border border-[var(--content-15)]">
                  {/* Round Summary Header - Always Visible */}
                  <div
                    className="p-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    onClick={() => toggleRound(round.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Pick Count and Amount - Stacked */}
                        <div className="flex-shrink-0">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {results.picksCount} Pick{results.picksCount !== 1 ? "s" : ""}
                          </div>
                          <div className="font-semibold text-[var(--text-primary)]">
                            ${results.entryAmount.toFixed(2)}
                          </div>
                        </div>
                        {/* Connection Names - Limited to 3 */}
                        <div className="text-sm text-[var(--text-secondary)] min-w-0 flex-shrink">
                          {results.connectionNames.slice(0, 3).join(", ")}
                          {results.connectionNames.length > 3 && (
                            <span className="text-[var(--text-tertiary)]"> +{results.connectionNames.length - 3}</span>
                          )}
                        </div>
                      </div>
                      {/* Fixed Right Section */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Individual Result Indicators - Fixed Position */}
                        <div className="flex items-center gap-1">
                          {results.individualResults.map((result, idx) => (
                            <div
                              key={`result-${idx}`}
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                result.won
                                  ? "bg-[var(--success)] text-white"
                                  : "bg-[var(--error)] text-white"
                              }`}
                            >
                              {result.won ? "✓" : "✗"}
                            </div>
                          ))}
                        </div>
                        <div className={`font-bold text-lg ${netColor}`}>
                          {results.netResult >= 0 ? "Won" : "Lost"} ${Math.abs(results.netResult).toFixed(2)}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Individual Pick Cards */}
                  {isExpanded && (
                    <div className="border-t border-[var(--content-15)] p-4 space-y-3">
                      {round.picks.map((pick, idx) => {
                        const result = results.individualResults[idx];
                        const matchup = round.matchups.find(m => m.id === pick.matchupId);
                        
                        if (!matchup) return null;
                        
                        const chosenSet = pick.chosen === "A" ? matchup.setA : matchup.setB;
                        const setPoints = chosenSet.connections.reduce((sum, c) => sum + c.pointsSum, 0);
                        const primaryName = chosenSet.connections[0]?.name || "Unknown";
                        
                        return (
                          <div
                            key={pick.matchupId}
                            className="bg-[var(--surface-2)] rounded-lg border border-[var(--content-15)] p-4 hover:shadow-sm transition-shadow flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  result.won
                                    ? "bg-[var(--success)] text-white"
                                    : "bg-[var(--error)] text-white"
                                }`}
                              >
                                {result.won ? "✓" : "✗"}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-[var(--text-primary)] mb-1">
                                  Pick {idx + 1}: {primaryName}
                                </div>
                                <div className="text-sm text-[var(--text-secondary)]">
                                  Set {pick.chosen} • {setPoints.toFixed(1)} pts
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPick({ matchup, chosen: pick.chosen });
                              }}
                              className="text-[var(--btn-link)]"
                            >
                              View Details
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPick && (
        <MatchupModal
          matchup={selectedPick.matchup}
          selectedSet={selectedPick.chosen}
          isOpen={!!selectedPick}
          onClose={() => setSelectedPick(null)}
        />
      )}
      
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
      
      {selectedRace && (
        <RaceDetailModal
          race={selectedRace}
          isOpen={!!selectedRace}
          onClose={() => setSelectedRace(null)}
        />
      )}
      
      {compareConnections.conn1 && compareConnections.conn2 && (
        <CompareModal
          connection1={compareConnections.conn1}
          connection2={compareConnections.conn2}
          isOpen={!!(compareConnections.conn1 && compareConnections.conn2)}
          onClose={() => setCompareConnections({ conn1: null, conn2: null })}
        />
      )}
    </div>
  );
}
