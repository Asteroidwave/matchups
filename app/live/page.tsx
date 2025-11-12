"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Circle,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from "lucide-react";

interface Entry {
  id: string;
  contestId: string;
  contest: {
    track: string;
    date: string;
    firstPostTime: string;
    lifecycleStatus: string;
  };
  picks: Array<{
    matchupId: string;
    side: 'A' | 'B';
  }>;
  entryAmount: number;
  multiplier: number;
  status: 'pending' | 'live' | 'won' | 'lost' | 'cancelled';
  payoutAmount: number;
  matchedResults: number;
  winningPicks: number;
}

interface MatchupProgress {
  matchupId: string;
  status: 'pending' | 'live' | 'won' | 'lost';
  setA: {
    totalPoints: number;
    completedRaces: number;
    totalRaces: number;
    connections: Array<{
      name: string;
      points: number;
      races: Array<{
        race: number;
        horse: string;
        position: number | null;
        points: number;
        status: 'pending' | 'running' | 'official';
      }>;
    }>;
  };
  setB: {
    totalPoints: number;
    completedRaces: number;
    totalRaces: number;
    connections: Array<{
      name: string;
      points: number;
      races: Array<{
        race: number;
        horse: string;
        position: number | null;
        points: number;
        status: 'pending' | 'running' | 'official';
      }>;
    }>;
  };
}

export default function LivePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [matchupProgress, setMatchupProgress] = useState<Record<string, MatchupProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load user entries
  const loadEntries = async () => {
    if (!user) return;

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${BACKEND_URL}/api/entries/user/${user.id}?status=live`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }

      const data = await response.json();
      setEntries(data.entries || []);
      
      // Auto-select first entry if none selected
      if (data.entries.length > 0 && !selectedEntry) {
        setSelectedEntry(data.entries[0]);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    loadEntries();
  }, [user]);

  // Refresh data periodically (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      loadEntries().finally(() => setIsRefreshing(false));
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Won</Badge>;
      case 'lost':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Lost</Badge>;
      case 'live':
        return <Badge variant="secondary"><Circle className="w-3 h-3 mr-1" />Live</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getMatchupStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'lost':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'live':
        return <Circle className="w-5 h-5 text-yellow-500 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
          <p className="text-[var(--text-tertiary)] mb-6">
            You need to be signed in to view live contests.
          </p>
          <Button onClick={() => router.push('/login')}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <div className="text-[var(--text-primary)]">Loading entries...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[var(--surface-1)]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-6">
              <Button
                onClick={() => router.push('/lobby')}
                variant="ghost"
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Lobby
              </Button>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">Live Dashboard</h1>
            </div>

            <Card className="p-8 text-center">
              <Trophy className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">No Live Entries</h2>
              <p className="text-[var(--text-tertiary)] mb-6">
                You don't have any live contest entries at the moment.
              </p>
              <Button onClick={() => router.push('/lobby')}>
                Go to Lobby
              </Button>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--surface-1)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <Button
              onClick={() => router.push('/lobby')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">Live Dashboard</h1>
              <Button
                onClick={() => {
                  setIsRefreshing(true);
                  loadEntries().finally(() => setIsRefreshing(false));
                }}
                variant="outline"
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Entry List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Your Entries</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-[var(--content-15)]">
                    {entries.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className={`w-full p-4 text-left hover:bg-[var(--content-15)] transition-colors ${
                          selectedEntry?.id === entry.id ? 'bg-[var(--content-15)]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[var(--text-primary)]">
                            {entry.contest.track}
                          </span>
                          {getStatusBadge(entry.status)}
                        </div>
                        <div className="text-sm text-[var(--text-tertiary)] space-y-1">
                          <div>Entry: ${entry.entryAmount}</div>
                          <div>Multiplier: {entry.multiplier}x</div>
                          <div>Progress: {entry.winningPicks}/{entry.picks.length}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Entry Details */}
            <div className="lg:col-span-2">
              {selectedEntry ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Entry Details</CardTitle>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">
                          ${selectedEntry.entryAmount} → ${(selectedEntry.entryAmount * selectedEntry.multiplier).toFixed(2)}
                        </div>
                        <div className="text-sm text-[var(--text-tertiary)]">
                          Entry → Potential Payout
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="matchups" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="matchups">Matchups</TabsTrigger>
                        <TabsTrigger value="races">Race Schedule</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="matchups" className="space-y-4">
                        <div className="text-sm text-[var(--text-tertiary)] mb-4">
                          Track: {selectedEntry.contest.track} • 
                          Date: {new Date(selectedEntry.contest.date).toLocaleDateString()}
                        </div>
                        
                        <div className="space-y-3">
                          {selectedEntry.picks.map((pick, index) => {
                            const progress = matchupProgress[pick.matchupId];
                            const status = progress?.status || 'pending';
                            
                            return (
                              <Card key={pick.matchupId} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">Matchup {index + 1}</span>
                                    {getMatchupStatusIcon(status)}
                                  </div>
                                  <Badge variant={pick.side === 'A' ? 'default' : 'secondary'}>
                                    Set {pick.side}
                                  </Badge>
                                </div>
                                
                                {progress ? (
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span>Set A: {progress.setA.totalPoints} pts</span>
                                      <span>Set B: {progress.setB.totalPoints} pts</span>
                                    </div>
                                    <div className="w-full bg-[var(--content-15)] rounded-full h-2 relative overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-300 ${
                                          progress.setA.totalPoints > progress.setB.totalPoints 
                                            ? 'bg-green-500' 
                                            : 'bg-red-500'
                                        }`}
                                        style={{ 
                                          width: `${Math.max(20, (progress.setA.completedRaces / progress.setA.totalRaces) * 100)}%` 
                                        }}
                                      />
                                    </div>
                                    <div className="text-xs text-[var(--text-tertiary)]">
                                      Races Complete: {progress.setA.completedRaces}/{progress.setA.totalRaces}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm text-[var(--text-tertiary)]">
                                    Waiting for race to start...
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="races" className="space-y-4">
                        <div className="text-sm text-[var(--text-tertiary)]">
                          Race schedule and results will appear here once available.
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-[var(--text-tertiary)]">
                    Select an entry to view details
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
