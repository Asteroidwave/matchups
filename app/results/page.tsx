"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Round, Matchup, Connection } from "@/types";
import { matchupWinner } from "@/lib/scoring";
import { MatchupModal } from "@/components/modals/MatchupModal";
import { ConnectionModal } from "@/components/modals/ConnectionModal";
import { RaceDetailModal } from "@/components/modals/RaceDetailModal";
import { CompareModal } from "@/components/modals/CompareModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronDown } from "lucide-react";
import { UserRoundsHistory } from "@/components/UserRoundsHistory";
// DEPRECATED: import { loadHistoryRounds } from "@/lib/store";

export default function ResultsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // OLD SYSTEM (keeping for compatibility)
  const { rounds: contextRounds, bankroll: oldBankroll, connections, regenerateMatchups, tolerance } = useApp();
  
  // NEW SYSTEM (relational database)
  const userData = useUserData();
  
  const [backendRounds, setBackendRounds] = useState<Round[]>([]);
  const [historyRounds, setHistoryRounds] = useState<Round[]>([]);

  // Use relational data if authenticated, fallback to old system
  const rounds = userData.profile?.id ? userData.rounds : contextRounds;
  const bankroll = userData.profile?.id ? userData.bankroll : oldBankroll;
  
  // Load rounds - use relational system if authenticated
  useEffect(() => {
    if (userData.profile?.id) {
      // NEW: Rounds automatically loaded via userData hook
      setHistoryRounds(userData.rounds);
    } else if (user?.id) {
      // FALLBACK: Load from new relational API endpoint
      const fetchRounds = async () => {
        try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
          const response = await fetch(`${BACKEND_URL}/api/users/${user.id}/rounds?limit=100`, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            const roundsData = data.rounds || [];
            
            // Convert relational rounds to frontend format
            const rounds = roundsData.map((round: any) => ({
              id: round.id,
              createdAt: round.created_at || round.createdAt,
              picks: round.user_entry?.picks || [],
              entryAmount: round.entry_amount || round.user_entry?.entry_amount || 0,
              multiplier: round.multiplier || 1,
              winnings: round.actual_payout || 0,
              matchups: [], // Will be populated if needed
            }));
            setHistoryRounds(rounds);
          } else {
            console.error('Failed to fetch rounds from backend');
          }
        } catch (error) {
          console.error('Error fetching rounds from backend:', error);
        }
      };
      
      fetchRounds();
    }
  }, [user?.id, userData.profile?.id, userData.rounds]);
  
  // Load history rounds - REPLACED with relational data above
  // This is now handled in the earlier useEffect with relational data
  
  // Combine context rounds and history rounds, removing duplicates
  const allRounds = useMemo(() => {
    const combined = [...contextRounds];
    const roundIds = new Set(combined.map(r => r.id));
    
    // Add history rounds that aren't already in current rounds
    historyRounds.forEach(round => {
      if (!roundIds.has(round.id)) {
        combined.push(round);
        roundIds.add(round.id);
      }
    });
    
    // Sort by creation date (newest first)
    return combined.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [contextRounds, historyRounds]);
  
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
    <ProtectedRoute>
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
            onClick={() => {
              sessionStorage.setItem('fromResults', 'true');
              regenerateMatchups({ tolerance });
              router.push("/matchups");
            }}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            New Round
          </Button>
        </div>
        </div>

        {allRounds.length === 0 ? (
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
            {allRounds.map((round) => {
              const results = getRoundResults(round);
              const netColor = results.netResult >= 0 ? "text-green-600" : "text-red-600";
              const isExpanded = expandedRounds.has(round.id);
              
              return (
                <Card key={round.id} className="bg-white border border-gray-200">
                  {/* Round Summary Header - Always Visible */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRound(round.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Pick Count and Amount - Stacked */}
                        <div className="flex-shrink-0">
                          <div className="font-semibold text-gray-900">
                            {results.picksCount} Pick{results.picksCount !== 1 ? "s" : ""}
                          </div>
                          <div className="font-semibold text-gray-900">
                            ${results.entryAmount.toFixed(2)}
                          </div>
                        </div>
                        {/* Connection Names - Limited to 3 */}
                        <div className="text-sm text-gray-600 min-w-0 flex-shrink">
                          {results.connectionNames.slice(0, 3).join(", ")}
                          {results.connectionNames.length > 3 && (
                            <span className="text-gray-500"> +{results.connectionNames.length - 3}</span>
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
                                  ? "bg-green-500 text-white"
                                  : "bg-red-500 text-white"
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
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Individual Pick Cards */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 space-y-3">
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
                            className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  result.won
                                    ? "bg-green-500 text-white"
                                    : "bg-red-500 text-white"
                                }`}
                              >
                                {result.won ? "✓" : "✗"}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 mb-1">
                                  Pick {idx + 1}: {primaryName}
                                </div>
                                <div className="text-sm text-gray-600">
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
    </ProtectedRoute>
  );
}
