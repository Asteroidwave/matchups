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
import { ChevronDown, ChevronRight, GitCompare } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const { rounds, bankroll, connections } = useApp();
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
              const roundConnections = getRoundConnections(round);
              
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
                              key={`result-${idx}`}
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
                        
                        {/* Compare Button */}
                        {roundConnections.length >= 2 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareConnections({
                                conn1: roundConnections[0],
                                conn2: roundConnections[1],
                              });
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Compare connections"
                            type="button"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setCompareConnections({
                                  conn1: roundConnections[0],
                                  conn2: roundConnections[1],
                                });
                              }
                            }}
                          >
                            <GitCompare className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        
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
            <div className="space-y-3">
                        {round.picks.map((pick) => {
                          const idx = round.picks.indexOf(pick);
                          const result = results.individualResults[idx];
                          const matchup = round.matchups.find(m => m.id === pick.matchupId);
                          
                          if (!matchup) return null;
                          
                          const chosenSet = pick.chosen === "A" ? matchup.setA : matchup.setB;
                          
                          return (
                            <div
                              key={pick.matchupId}
                              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-start justify-between mb-3">
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
                                    <div className="font-medium text-gray-900 mb-2">
                                      Pick {idx + 1}: Set {pick.chosen}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPick({ matchup, chosen: pick.chosen })}
                                >
                                  View Matchup
                                </Button>
                              </div>
                              
                              {/* Connections with Points & AVPA inline */}
                              <div className="space-y-2">
                                {chosenSet.connections.map((conn) => {
                                  const connection = connections.find(c => c.id === conn.id);
                                  const topFinishes = connection
                                    ? connection.starters.filter(s => s.pos && s.pos >= 1 && s.pos <= 3)
                                    : [];
                                  
                                  return (
                                    <div
                                      key={conn.id}
                                      className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3 flex-1">
                                          <div className="font-semibold text-gray-900">
                                            {conn.name}
                                          </div>
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            (() => {
                                              if (conn.role === "jockey") return "bg-blue-100 text-blue-800";
                                              if (conn.role === "trainer") return "bg-green-100 text-green-800";
                                              return "bg-amber-100 text-amber-800";
                                            })()
                                          }`}>
                                            {conn.role}
                                          </span>
                                          <span className="text-xs text-gray-600">
                                            {conn.trackSet.join(", ")}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <div>
                                            <span className="text-gray-500">Points:</span>{" "}
                                            <span className="font-bold text-gray-900">{conn.pointsSum.toFixed(1)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">AVPA (Race):</span>{" "}
                                            <span className="font-bold text-gray-900">{conn.avpaRace.toFixed(1)}</span>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleConnectionClick(conn.id)}
                                          >
                                            View Details
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {/* Top Finishes - Clickable Races */}
                                      {topFinishes.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <div className="text-xs text-gray-500 mb-1">Top Finishes (click to view race):</div>
                                          <div className="flex flex-wrap gap-1">
                                            {topFinishes.slice(0, 5).map((starter) => (
                                              <button
                                                key={`${starter.track}-${starter.race}-${starter.horseName}`}
                                                onClick={() => handleRaceClick(starter.track, starter.race)}
                                                className="text-xs px-2 py-1 rounded bg-white border border-gray-300 hover:bg-blue-50 hover:border-blue-400 transition-colors cursor-pointer"
                                                title={`View ${starter.track} Race ${starter.race} details`}
                                              >
                                                {starter.horseName} - {starter.track} R{starter.race} ({starter.pos}st)
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Stats Row */}
                              <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <div className="text-gray-500">Apps</div>
                                  <div className="font-medium text-gray-900">
                                    {chosenSet.connections.reduce((sum, c) => sum + c.apps, 0)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Avg Odds</div>
                                  <div className="font-medium text-gray-900">
                                    {(() => {
                                      const totalOdds = chosenSet.connections.reduce((sum, c) => sum + (c.avgOdds * c.apps), 0);
                                      const totalApps = chosenSet.connections.reduce((sum, c) => sum + c.apps, 0);
                                      return totalApps > 0 ? (totalOdds / totalApps).toFixed(1) : "—";
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">AVPA (30D)</div>
                                  <div className="font-medium text-gray-900">
                                    {(() => {
                                      const totalAvpa = chosenSet.connections.reduce((sum, c) => sum + (c.avpa30d * c.apps), 0);
                                      const totalApps = chosenSet.connections.reduce((sum, c) => sum + c.apps, 0);
                                      return totalApps > 0 ? (totalAvpa / totalApps).toFixed(1) : "—";
                                    })()}
                                  </div>
                                </div>
                              </div>
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
