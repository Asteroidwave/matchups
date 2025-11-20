"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSimulation } from '@/hooks/useSimulation';
import { RoundProgressCard } from '@/components/live/RoundProgressCard';
import { LiveDashboardStats } from '@/components/live/LiveDashboardStats';
import { RoundFilters } from '@/components/live/RoundFilters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, RotateCcw, ArrowLeft, Radio, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';

interface PendingEntry {
  id: string;
  contest_id: string;
  user_id: string;
  picks: Array<{ matchupId: string; side: 'A' | 'B' }>;
  entry_amount: number;
  multiplier: number;
  is_flex?: boolean;
  isFlex?: boolean;
  pick_count?: number;
  pickCount?: number;
  multiplier_schedule?: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }> | null;
  multiplierSchedule?: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }> | null;
  status: string;
  created_at: string;
  contests?: {
    id: string;
    track: string;
    date: string;
  };
}

interface PendingEntriesGroup {
  contestId: string;
  contest: any;
  entries: PendingEntry[];
  count: number;
  totalEntryAmount: number;
  tracks: string[];
}

export default function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { contests, matchups: contextMatchups } = useApp();
  const [contestId, setContestId] = useState<string | null>(null);
  const simIdFromUrl = searchParams?.get('sim');
  const [localSimId, setLocalSimId] = useState<string | null>(simIdFromUrl);
  const [pendingEntries, setPendingEntries] = useState<PendingEntriesGroup[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedContestForSim, setSelectedContestForSim] = useState<string | null>(null);
  const [pendingRounds, setPendingRounds] = useState<any[]>([]);
  const [speedMultiplier, setSpeedMultiplier] = useState(10);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  // Track collapsed picks per round: Map<roundId, Set<pickIndex>>
  const [collapsedPicks, setCollapsedPicks] = useState<Map<string, Set<number>>>(new Map());
  
  // Filters and sorting
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost' | 'live' | 'pending'>('live'); // Default to Live
  const [sortBy, setSortBy] = useState<'status' | 'amount' | 'time' | 'potential'>('time'); // Default to time
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  // Cache for post times: Map<track-race, postTime>
  const [postTimeCache, setPostTimeCache] = useState<Map<string, string>>(new Map());
  // Force re-render when cache updates
  const [cacheVersion, setCacheVersion] = useState(0);
  
  const {
    simulation,
    isConnected,
    isLoading,
    error,
    createSimulation,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    setSpeed,
    resetSimulation,
  } = useSimulation(localSimId || undefined);
  
  // Auto-pause on disconnection
  useEffect(() => {
    if (simulation && simulation.status === 'running' && !isConnected) {
      console.log('[LivePage] Connection lost, auto-pausing simulation');
      pauseSimulation();
    }
  }, [isConnected, simulation?.status, pauseSimulation]);

  // Refresh pending rounds when simulation finishes
  useEffect(() => {
    if (simulation?.status === 'finished') {
      console.log('[LivePage] Simulation finished, refreshing pending rounds...');
      // Re-fetch pending rounds to remove completed ones
      if (user?.id) {
        const fetchUpdatedRounds = async () => {
          try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${BACKEND_URL}/api/entries/pending?userId=${user.id}&_t=${Date.now()}`, {
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (response.ok) {
              const data = await response.json();
              const entries = Array.isArray(data) ? data : (data.entries || []);
              console.log('[LivePage] Refreshed rounds after simulation:', entries.length);
              // Process the updated entries...
              setMyRounds(entries.map((entry: any) => ({
                roundId: entry.id,
                entryAmount: entry.entry_amount || 0,
                multiplier: entry.multiplier || 1,
                isFlex: entry.is_flex || false,
                picks: entry.picks || [],
                matchups: entry.matchups || [],
                status: entry.status || 'pending',
                wonMatchups: 0,
                lostMatchups: 0,
                totalPoints: 0,
                potentialWinnings: 0,
              })));
            }
          } catch (error) {
            console.error('[LivePage] Error refreshing rounds:', error);
          }
        };
        
        // Delay to ensure database updates have propagated
        setTimeout(fetchUpdatedRounds, 1000);
      }
    }
  }, [simulation?.status, user?.id]);
  
  // Persist simulation ID across navigation
  useEffect(() => {
    if (simulation?.id && typeof window !== 'undefined') {
      sessionStorage.setItem('currentSimulationId', simulation.id);
    }
  }, [simulation?.id]);
  
  // Restore simulation ID on mount - but validate it has entries first
  useEffect(() => {
    if (!localSimId && typeof window !== 'undefined') {
      const savedSimId = sessionStorage.getItem('currentSimulationId');
      if (savedSimId) {
        // Validate that this simulation has entries before restoring
        const validateSimulation = async () => {
          try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${BACKEND_URL}/api/simulation/${savedSimId}`);
            if (response.ok) {
              const data = await response.json();
              const sim = data.simulation;
              // Only restore if simulation has rounds
              if (sim && sim.rounds && sim.rounds.length > 0) {
                setLocalSimId(savedSimId);
              } else {
                // Clear stale simulation ID
                console.log('[LivePage] Clearing stale simulation ID (0 rounds)');
                sessionStorage.removeItem('currentSimulationId');
              }
            } else {
              // Simulation doesn't exist, clear it
              console.log('[LivePage] Simulation not found, clearing stored ID');
              sessionStorage.removeItem('currentSimulationId');
            }
          } catch (error) {
            console.error('[LivePage] Error validating simulation:', error);
            sessionStorage.removeItem('currentSimulationId');
          }
        };
        validateSimulation();
      }
    }
  }, [localSimId]);
  
  // Get contestId from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedContestId = sessionStorage.getItem('selectedContestId');
      if (storedContestId) {
        setContestId(storedContestId);
        setSelectedContestForSim(storedContestId);
      }
    }
  }, []);

  // Fetch pending entries
  useEffect(() => {
    const fetchPendingEntries = async () => {
      if (!user?.isAdmin) return; // Only admins can see pending entries
      
      setLoadingPending(true);
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${BACKEND_URL}/api/entries/pending`);
        if (!response.ok) throw new Error('Failed to fetch pending entries');
        const data = await response.json();
        setPendingEntries(data.entriesByContest || []);
      } catch (error) {
        console.error('Error fetching pending entries:', error);
      } finally {
        setLoadingPending(false);
      }
    };

    // Fetch on mount and periodically if admin
    fetchPendingEntries();
    const interval = setInterval(fetchPendingEntries, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user?.isAdmin]);
  
  // Update URL when simulation is created
  useEffect(() => {
    if (simulation && !simIdFromUrl) {
      router.push(`/live?sim=${simulation.id}`);
      setLocalSimId(simulation.id);
    }
  }, [simulation?.id]);
  
  // Load pending rounds from backend API (account-based, not machine-based)
  // Fetch when no simulation is active OR when simulation is running (to show new pending rounds)
  useEffect(() => {
    if (user?.id) {
      const fetchPendingRounds = async () => {
        try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
          console.log('[LivePage] Fetching pending rounds for user:', user.id);
          // Fetch ONLY pending entries for current user from backend (with userId filter)
          const response = await fetch(`${BACKEND_URL}/api/entries/pending?userId=${user.id}&status=pending`, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[LivePage] Received pending entries data:', data);
            // Backend now returns grouped entries by contest when no userId filter, or direct entries when userId is provided
            // For userId filter, backend returns { entries: [...], count: N } format
            // For admin (no userId), backend returns { entriesByContest: [...] } format
            let entries: any[] = [];
            if (data.entriesByContest) {
              // Admin view - flatten grouped entries
              entries = data.entriesByContest.flatMap((group: any) => group.entries || []);
            } else if (Array.isArray(data)) {
              entries = data;
            } else if (data.entries) {
              entries = data.entries;
            }
            console.log('[LivePage] Processed entries:', entries.length, entries);
            
            // Convert entries to rounds format WITH matchups from backend
            const rounds = entries
              .filter((entry: any) => entry.status === 'pending' || !entry.status)
              .map((entry: any) => {
                // Get picks and matchups from entry (backend now populates matchups)
                const picks = entry.picks || [];
                const matchups = entry.matchups || [];
                
                console.log(`[LivePage] Round ${entry.id}: ${picks.length} picks, ${matchups.length} matchups from backend`, {
                  picks: picks.map((p: any) => ({ id: p.matchupId || p.matchup_id, side: p.side || p.chosen })),
                  matchups: matchups.map((m: any) => ({
                    id: m?.id,
                    track: m?.setA?.connections?.[0]?.starters?.[0]?.track || m?.setA?.connections?.[0]?.track,
                    type: m?.matchupType
                  }))
                });
                
                return {
                  id: entry.id,
                  createdAt: entry.created_at || entry.createdAt,
                  picks: picks.map((p: any) => ({
                    matchupId: p.matchupId || p.matchup_id,
                    chosen: (p.chosen || p.side || 'A').toUpperCase() === 'A' ? 'A' : 'B', // Normalize to A or B
                  })),
                  entryAmount: parseFloat(entry.entry_amount || entry.entryAmount || 0),
                  multiplier: entry.multiplier || 1,
                  isFlex: entry.is_flex || entry.isFlex || false,
                  pickCount: entry.pick_count || entry.pickCount || picks.length,
                  multiplierSchedule: entry.multiplier_schedule || entry.multiplierSchedule || null,
                  matchups: matchups, // Use matchups from backend
                  contestId: entry.contest_id || entry.contestId,
                };
              });
            
            console.log('[LivePage] Processed rounds:', rounds.length, rounds);
            
            // Fetch post times BEFORE setting rounds so they're available instantly
            const fetchPostTimes = async (): Promise<Map<string, string>> => {
              try {
                // Collect all unique tracks and dates from rounds
                // Extract tracks from matchups (not from contest.track which might be 'ALL')
                const trackDateMap = new Map<string, string>();
                rounds.forEach((round: any) => {
                  if (round.contestId) {
                    const contest = contests.find((c: any) => c.id === round.contestId);
                    const contestDate = contest?.date;
                    
                    if (contestDate) {
                      // Extract unique tracks from matchups - check all connections thoroughly
                      const tracksInRound = new Set<string>();
                      round.matchups?.forEach((matchup: any) => {
                        [matchup.setA, matchup.setB].forEach((set: any) => {
                          if (set?.connections) {
                            set.connections.forEach((conn: any) => {
                              // Check starters in connection
                              if (conn.starters && Array.isArray(conn.starters)) {
                                conn.starters.forEach((starter: any) => {
                                  const track = starter.track || starter.trackCode;
                                  if (track) {
                                    tracksInRound.add(track);
                                  }
                                });
                              }
                              // Also check if connection itself has track
                              if (conn.track) {
                                tracksInRound.add(conn.track);
                              }
                            });
                          }
                        });
                      });
                      
                      // Add each track with the contest date
                      tracksInRound.forEach(track => {
                        if (!trackDateMap.has(track)) {
                          trackDateMap.set(track, contestDate);
                        }
                      });
                    }
                  }
                });
                
                if (trackDateMap.size === 0) {
                  console.log('[LivePage] No tracks found for post time fetching');
                  return new Map<string, string>();
                }
                
                console.log(`[LivePage] Fetching post times for ${trackDateMap.size} tracks:`, Array.from(trackDateMap.entries()));
                
                // Fetch post times for each track-date combination
                const newPostTimeCache = new Map<string, string>();
                const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                
                // Fetch all tracks in parallel for faster loading
                const fetchPromises = Array.from(trackDateMap.entries()).map(async ([track, date]) => {
                  try {
                    console.log(`[LivePage] Fetching post times for ${track} on ${date}`);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                    
                    const response = await fetch(`${BACKEND_URL}/api/tracks/${track}/entries?date=${date}`, {
                      signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                      const trackData = await response.json();
                      if (trackData.records && Array.isArray(trackData.records)) {
                        trackData.records.forEach((record: any) => {
                          if (record.track && record.race && record.post_time) {
                            // Ensure race is a string for consistent key format
                            const key = `${record.track}-${String(record.race)}`;
                            newPostTimeCache.set(key, record.post_time);
                          }
                        });
                        console.log(`[LivePage] Found ${trackData.records.filter((r: any) => r.post_time).length} post times for ${track}`);
                      }
                    } else {
                      console.error(`[LivePage] Failed to fetch post times for ${track}:`, response.status, response.statusText);
                    }
                  } catch (err: any) {
                    if (err.name === 'AbortError') {
                      console.warn(`[LivePage] Timeout fetching post times for ${track}`);
                    } else {
                      console.error(`[LivePage] Error fetching post times for ${track}:`, err);
                    }
                  }
                });
                
                // Wait for all fetches to complete
                await Promise.allSettled(fetchPromises);
                
                if (newPostTimeCache.size > 0) {
                  console.log(`[LivePage] Cached ${newPostTimeCache.size} post times`);
                } else {
                  console.warn('[LivePage] No post times were cached');
                }
                
                return newPostTimeCache;
              } catch (err) {
                console.error('[LivePage] Error fetching post times:', err);
                return new Map<string, string>();
              }
            };
            
            // Fetch post times FIRST, then set rounds with cache already populated
            fetchPostTimes().then((newPostTimeCache) => {
              if (newPostTimeCache.size > 0) {
                setPostTimeCache(prev => {
                  const merged = new Map(prev);
                  newPostTimeCache.forEach((value, key) => merged.set(key, value));
                  return merged;
                });
                // Trigger re-render by updating cache version
                setCacheVersion(prev => prev + 1);
              }
              
              // Set rounds AFTER post times are cached
                    if (simulation && simulation.rounds) {
                      const simulationRoundIds = new Set(simulation.rounds.map((r: any) => r.roundId));
                      const newPendingRounds = rounds.filter((r: any) => !simulationRoundIds.has(r.id));
                      console.log('[LivePage] Filtered pending rounds (excluding active simulation):', newPendingRounds.length, 'new pending');
                      setPendingRounds(newPendingRounds);
                    } else {
                      setPendingRounds(rounds);
                    }
            }).catch((err) => {
              console.error('[LivePage] Error in post time fetch, setting rounds anyway:', err);
              // Set rounds even if post time fetch fails
              if (simulation && simulation.rounds) {
                const simulationRoundIds = new Set(simulation.rounds.map((r: any) => r.roundId));
                const newPendingRounds = rounds.filter((r: any) => !simulationRoundIds.has(r.id));
                setPendingRounds(newPendingRounds);
              } else {
                setPendingRounds(rounds);
              }
            });
                  } else {
                    const errorText = await response.text();
                    console.error('Failed to fetch pending rounds:', response.status, response.statusText, errorText);
                    setPendingRounds([]);
                  }
                } catch (error) {
                  console.error('Error fetching pending rounds:', error);
                  setPendingRounds([]);
                }
      };
      
      fetchPendingRounds();
      
      // Refresh every 10 seconds to keep data in sync across tabs
      const interval = setInterval(fetchPendingRounds, 10000);
      return () => clearInterval(interval);
    }
    // Note: Pending rounds shown before simulation starts, and new rounds shown during simulation
    // Using contextMatchups in closure, not in deps to avoid array size changes
  }, [simulation, user?.id, contextMatchups]);
  
  // Create simulation from pending rounds (available to all authenticated users)
  const handleCreateSimulation = async (targetContestId?: string) => {
    // Validate user is authenticated
    if (!user?.id) {
      alert('Please sign in to create a simulation.');
      router.push('/login');
      return;
    }
    
    // Use contest ID from pending rounds if available, otherwise use provided targetContestId
    const idToUse = targetContestId || (pendingRounds.length > 0 ? pendingRounds[0].contestId : null) || contestId;
    
    if (!idToUse) {
      alert('No contest found. Please submit rounds in the matchups page first.');
      return;
    }
    
    // Get contest date from contests list or from pending rounds
    const selectedContest = contests.find(c => c.id === idToUse);
    const contestDate = selectedContest?.date || 
                       (pendingRounds.length > 0 && pendingRounds[0].createdAt ? new Date(pendingRounds[0].createdAt).toISOString().split('T')[0] : null) ||
                       sessionStorage.getItem('selectedDate') || '';
    
    if (!contestDate) {
      alert('Contest date not found. Please submit rounds in the matchups page first.');
      return;
    }
    
    // Validate that we have pending rounds
    if (pendingRounds.length === 0) {
      alert('⚠️ No pending rounds to simulate.\n\nPlease submit rounds in the matchups page first.');
      return;
    }
    
    // Check if simulation is already running
    if (simulation && simulation.status === 'running') {
      const confirmRerun = confirm('A simulation is already running. Do you want to reset and create a new one?');
      if (!confirmRerun) return;
      
      try {
        await resetSimulation();
      } catch (error) {
        console.error('[LivePage] Error resetting existing simulation:', error);
        alert('Failed to reset existing simulation. Please try again.');
        return;
      }
    }
    
    console.log('[LivePage] Creating simulation with:', {
      contestId: idToUse,
      date: contestDate,
      speedMultiplier,
      pendingRoundsCount: pendingRounds.length,
      userId: user.id
    });
    
    try {
      setIsLoading(true);
      // Create simulation - it will load all pending entries for this contest
      await createSimulation(idToUse, speedMultiplier, contestDate);
      setSelectedContestForSim(null);
      console.log('[LivePage] Simulation created successfully');
    } catch (error) {
      console.error('[LivePage] Error creating simulation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        alert('Contest or track data not found. Please ensure the contest has been set up correctly.');
      } else if (errorMessage.includes('No entries') || errorMessage.includes('0 entries')) {
        alert('No pending entries found for this contest. Please submit rounds in the matchups page first.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        alert('Network error. Please check your connection and try again.');
      } else {
        alert(`Failed to create simulation: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleRoundExpansion = (roundId: string) => {
    console.log('[LivePage] Toggling round expansion:', roundId);
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
        console.log('[LivePage] Round collapsed:', roundId);
      } else {
        next.add(roundId);
        console.log('[LivePage] Round expanded:', roundId);
      }
      return next;
    });
  };

  const togglePickCollapse = (roundId: string, pickIndex: number) => {
    setCollapsedPicks(prev => {
      const newMap = new Map(prev);
      const roundCollapsed = newMap.get(roundId) || new Set<number>();
      const newRoundCollapsed = new Set(roundCollapsed);
      
      if (newRoundCollapsed.has(pickIndex)) {
        newRoundCollapsed.delete(pickIndex);
      } else {
        newRoundCollapsed.add(pickIndex);
      }
      
      newMap.set(roundId, newRoundCollapsed);
      return newMap;
    });
  };

  // Filter rounds for current user (admin sees all, regular users see only their own)
  // This must be declared before useMemo hooks that depend on it
  // Get rounds from simulation - only show if they exist in the database
  // If simulation exists but has no rounds, show empty state
  // NOTE: All authenticated users can now see simulations, but only their own rounds
  const myRounds = (simulation?.rounds || []).filter(r => 
    user?.isAdmin || r.userId === user?.id
  );

  // Get available tracks from rounds
  const availableTracks = useMemo(() => {
    const tracks = new Set<string>();
    myRounds.forEach(round => {
      round.matchups?.forEach(m => {
        [...m.setA.connections, ...m.setB.connections].forEach(conn => {
          if (conn.trackSet) {
            conn.trackSet.forEach((t: string) => tracks.add(t));
          }
          if (conn.starters) {
            conn.starters.forEach((s: any) => {
              if (s.track) tracks.add(s.track);
            });
          }
        });
      });
    });
    return Array.from(tracks).sort();
  }, [myRounds]);

  // Get rounds count per track
  const roundsByTrack = useMemo(() => {
    const counts: Record<string, number> = {};
    myRounds.forEach(round => {
      const roundTracks = new Set<string>();
      round.matchups?.forEach(m => {
        [...m.setA.connections, ...m.setB.connections].forEach(conn => {
          if (conn.trackSet) {
            conn.trackSet.forEach((t: string) => roundTracks.add(t));
          }
          if (conn.starters) {
            conn.starters.forEach((s: any) => {
              if (s.track) roundTracks.add(s.track);
            });
          }
        });
      });
      roundTracks.forEach(track => {
        counts[track] = (counts[track] || 0) + 1;
      });
    });
    return counts;
  }, [myRounds]);

  // Filter rounds by selected track (but allow all rounds regardless of track for multi-track/cross-track support)
  const filteredRoundsByTrack = useMemo(() => {
    // Always return all rounds - don't filter by track to support multi-track and cross-track rounds
    return myRounds;
    // Note: Track filter is now just for display purposes, not for filtering rounds
  }, [myRounds]);
  
  // Get current race info
  const currentRace = simulation?.races[simulation.currentRaceIndex];
  const totalRaces = simulation?.races.length || 0;
  const finishedRaces = simulation?.races.filter(r => r.status === 'finished').length || 0;
  const runningRaces = simulation?.races.filter(r => r.status === 'running').length || 0;
  const pendingRaces = simulation?.races.filter(r => r.status === 'pending').length || 0;
  
  // Calculate stats
  const stats = useMemo(() => {
    const won = myRounds.filter(r => r.status === 'won');
    const lost = myRounds.filter(r => r.status === 'lost');
    const live = myRounds.filter(r => r.status === 'in_progress');
    
    return {
      wonRounds: won.length,
      lostRounds: lost.length,
      liveRounds: live.length,
      totalWinnings: won.reduce((sum, r) => sum + r.potentialWinnings, 0),
      totalLosses: lost.reduce((sum, r) => sum + r.entryAmount, 0),
      livePotential: live.reduce((sum, r) => sum + (r.entryAmount * r.multiplier), 0),
    };
  }, [myRounds]);
  
  // Auto-switch to "All Rounds" when no more live races
  useEffect(() => {
    if (statusFilter === 'live' && stats.liveRounds === 0 && myRounds.length > 0) {
      console.log('[LivePage] No live rounds remaining, switching to All Rounds');
      setStatusFilter('all');
    }
  }, [stats.liveRounds, statusFilter, myRounds.length]);
  
  // Filter and sort rounds
  const filteredRounds = useMemo(() => {
    let filtered = [...filteredRoundsByTrack];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => {
        if (statusFilter === 'live') return r.status === 'in_progress';
        if (statusFilter === 'pending') return r.status === 'pending';
        return r.status === statusFilter;
      });
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        // Search in matchup connection names
        return r.matchups.some(m => {
          const allNames = [
            ...m.setA.connections.map((c: any) => c.name),
            ...m.setB.connections.map((c: any) => c.name),
          ].join(' ').toLowerCase();
          return allNames.includes(query);
        });
      });
    }
    
    // Default sorting: Time (newest first) - already in order from API
    // No need to sort if sortBy === 'time'
    
    return filtered;
  }, [filteredRoundsByTrack, statusFilter, searchQuery, sortBy]);
  
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
          <p className="text-[var(--text-tertiary)] mb-6">
            You need to be signed in to view live races.
          </p>
          <Button onClick={() => router.push('/login')}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--surface-1)] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Radio className="w-8 h-8" />
                Live Races
              </h1>
              <p className="text-[var(--text-secondary)] mt-1">
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
            </div>
            <Button
              onClick={() => router.push('/matchups')}
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Matchups
            </Button>
          </div>
          
          {/* Pending Entries Section (Admin Only) */}
          {user?.isAdmin && pendingEntries.length > 0 && !simulation && (
            <Card className="p-6 mb-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                Pending Entries Waiting for Simulation
              </h2>
              <div className="space-y-4">
                {pendingEntries.map((group) => (
                  <div
                    key={group.contestId}
                    className="border border-[var(--content-15)] rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {group.contest?.track || 'Unknown Track'} - {new Date(group.contest?.date).toLocaleDateString()}
                        </h3>
                        <Badge variant="outline">{group.count} entries</Badge>
                        <Badge variant="outline">${group.totalEntryAmount.toFixed(2)} total</Badge>
                        {group.tracks && group.tracks.length > 0 && (
                          <Badge variant="outline">
                            {group.tracks.length} {group.tracks.length === 1 ? 'track' : 'tracks'}: {group.tracks.join(', ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Contest ID: {group.contestId.slice(0, 16)}...
                        {group.count === 0 && (
                          <span className="ml-2 text-red-600 font-medium">⚠️ No entries - simulation will have no rounds</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Button
                        onClick={() => handleCreateSimulation(group.contestId)}
                        disabled={isLoading || group.count === 0}
                        size="lg"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Simulation
                      </Button>
                      {group.count === 0 && (
                        <span className="text-xs text-red-600">Cannot start: No entries</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          
          {/* Simulation Setup - Available to all authenticated users */}
          {!simulation && pendingRounds.length > 0 && user?.id && (
            <Card className="p-8 text-center max-w-2xl mx-auto mb-6">
              <div className="mb-6">
                <Radio className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Start Live Simulation</h2>
                <p className="text-[var(--text-secondary)]">
                  Simulate all {pendingRounds.length} pending {pendingRounds.length === 1 ? 'round' : 'rounds'} below
                </p>
              </div>
              <div className="flex flex-col gap-3 items-center">
                {/* Speed Settings */}
                <div className="w-full max-w-md flex items-center gap-3">
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-[var(--text-secondary)]">Simulation Speed:</span>
                  <Select
                    value={speedMultiplier.toString()}
                    onValueChange={(value) => setSpeedMultiplier(Number.parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1x (1 min)</SelectItem>
                      <SelectItem value="2">2x (30s)</SelectItem>
                      <SelectItem value="5">5x (12s)</SelectItem>
                      <SelectItem value="10">10x (6s)</SelectItem>
                      <SelectItem value="20">20x (3s)</SelectItem>
                      <SelectItem value="60">60x (1s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Get contest ID from first pending round */}
                {pendingRounds.length > 0 && pendingRounds[0].contestId && (
                  <Button
                    onClick={() => handleCreateSimulation(pendingRounds[0].contestId)}
                    disabled={isLoading}
                    size="lg"
                    className="w-full max-w-md"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isLoading ? 'Creating Simulation...' : `Start Simulation (${pendingRounds.length} ${pendingRounds.length === 1 ? 'round' : 'rounds'})`}
                  </Button>
                )}
              </div>
            </Card>
          )}
          
          {/* Empty State - No rounds (available to all users) */}
          {!simulation && pendingRounds.length === 0 && user?.id && (
            <Card className="p-8 text-center max-w-2xl mx-auto">
              <Radio className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Live Simulation</h2>
              <p className="text-[var(--text-secondary)] mb-4">
                You don't have any pending rounds to simulate.
              </p>
              <Button
                onClick={() => router.push('/matchups')}
                size="lg"
              >
                Go to Matchups
              </Button>
            </Card>
          )}
          
          {/* Pending Rounds Preview - Show when no simulation, or new rounds during simulation */}
          {pendingRounds.length > 0 && (
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                {simulation ? 'New Pending Rounds (Next Batch)' : 'Pending Rounds (Preview)'}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                {simulation 
                  ? 'These rounds were added after the simulation started. They will be included in the next simulation batch. Click to expand and see matchup details.'
                  : 'These rounds will be included in the simulation when you start it. Click to expand and see matchup details.'
                }
              </p>
              <div className="space-y-3">
                {pendingRounds.map((round) => {
                  const isExpanded = expandedRounds.has(round.id);
                  
                  // Extract first names from picks for display
                  // Match picks to matchups by ID (not by index) to ensure all picks are shown
                  const firstNames = round.picks
                    ?.map((pick: any) => {
                      // Find the matchup that matches this pick
                      const matchup = round.matchups?.find((m: any) => {
                        const pickMatchupId = pick.matchupId || pick.matchup_id;
                        return (
                          m.id === pickMatchupId ||
                          (m.id && pickMatchupId && m.id.includes(pickMatchupId)) ||
                          (pickMatchupId && m.id && pickMatchupId.includes(m.id))
                        );
                      });
                      
                      if (!pick || !matchup) return null;
                      const chosenSet = pick.chosen === 'A' ? matchup.setA : matchup.setB;
                      const firstConnection = chosenSet?.connections?.[0];
                      return firstConnection?.name?.split(' ')[0] || null;
                    })
                    .filter(Boolean)
                    .join(', ') || 'No picks';
                  
                  // Calculate theoretical winnings based on max multiplier
                  const pickCount = round.pickCount || round.picks?.length || 0;
                  const multiplierSchedule = round.multiplierSchedule || {};
                  const schedule = multiplierSchedule[pickCount];
                  const maxMultiplier = schedule
                    ? (round.isFlex ? schedule.flexAllWin : schedule.standard)
                    : round.multiplier || 1;
                  const theoreticalWin = round.entryAmount * maxMultiplier;
                  
                  return (
                    <div
                      key={round.id}
                      className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleRoundExpansion(round.id);
                        }}
                        className="w-full px-6 py-4 text-left hover:bg-gray-100 transition-colors"
                      >
                        {/* Row 1: Amount bet, picks count, names (left) and entry amount (right) */}
                        <div className="flex items-start justify-between mb-3">
                          {/* Left: Amount bet (black bold), picks count, and names */}
                          <div>
                            <div className="text-lg font-bold text-black mb-1">
                              {pickCount} Picks
                            </div>
                            <div className="text-sm text-gray-600">
                              {firstNames}
                            </div>
                          </div>
                          
                          {/* Right: Entry amount (money spent) and dropdown arrow */}
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-black">
                              ${round.entryAmount?.toFixed(2) || '0.00'} Stake
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                        
                        {/* Divider */}
                        <div className="h-px bg-gray-300 mb-3" />
                        
                        {/* Row 2: Pick circles (left) and theoretical win (right) */}
                        <div className="flex items-center justify-between">
                          {/* Left: Pick circles with dynamic states */}
                          <div className="flex gap-1.5">
                            {round.picks && round.picks.length > 0 ? (
                              round.picks.map((pick: any, idx: number) => {
                                // Find the matchup for this pick
                                const matchup = round.matchups?.[idx];
                                const chosenSide = pick?.chosen || 'A';
                                
                                // Determine pick status
                                let pickStatus: 'pending' | 'in_progress' | 'won' | 'lost' = 'pending';
                                let circleColor = 'border-gray-400 bg-white';
                                let pulseClass = '';
                                let title = 'Pending - Not yet started';
                                
                                if (matchup) {
                                  const matchupStatus = matchup.status;
                                  const isWon = (chosenSide === 'A' && matchupStatus === 'setA_won') || 
                                               (chosenSide === 'B' && matchupStatus === 'setB_won');
                                  const isLost = (chosenSide === 'A' && matchupStatus === 'setB_won') || 
                                                (chosenSide === 'B' && matchupStatus === 'setA_won');
                                  const isInProgress = matchupStatus === 'in_progress';
                                  
                                  if (isWon) {
                                    pickStatus = 'won';
                                    circleColor = 'border-green-600 bg-green-500';
                                    title = 'Won';
                                  } else if (isLost) {
                                    pickStatus = 'lost';
                                    circleColor = 'border-red-600 bg-red-500';
                                    title = 'Lost';
                                  } else if (isInProgress) {
                                    pickStatus = 'in_progress';
                                    circleColor = 'border-yellow-500 bg-yellow-500';
                                    pulseClass = 'animate-pulse';
                                    title = 'In Progress';
                                  }
                                }
                                
                                return (
                                <div
                                  key={`pick-indicator-${round.id}-${idx}`}
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${circleColor} ${pulseClass}`}
                                    title={title}
                                  >
                                    {pickStatus === 'won' && (
                                      <span className="text-white text-sm font-bold">✓</span>
                                    )}
                                    {pickStatus === 'lost' && (
                                      <span className="text-white text-sm font-bold">✗</span>
                                    )}
                                    {pickStatus === 'pending' && (
                                  <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                    )}
                                </div>
                                );
                              })
                            ) : (
                              <div className="w-7 h-7 rounded-full border-2 border-gray-400 bg-white"></div>
                            )}
                          </div>
                          
                          {/* Right: Theoretical win (grey) */}
                          <div>
                            <div className="text-base font-semibold text-gray-600 mr-8">
                              ${theoreticalWin.toFixed(2)}
                            </div>
                            {round.isFlex && (
                              <div className="text-xs text-blue-600 font-medium mt-0.5 text-right">
                                Flex
                            </div>
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-6 pb-6 space-y-4 border-t border-gray-200 bg-white">
                            {round.matchups && round.matchups.length > 0 ? (
                            round.matchups.map((matchup: any, index: number) => {
                                // Find the pick that matches this matchup
                                const pick = round.picks?.find((p: any) => {
                                  const pickMatchupId = p.matchupId || p.matchup_id;
                                  return (
                                    matchup.id === pickMatchupId ||
                                    (matchup.id && pickMatchupId && matchup.id.includes(pickMatchupId)) ||
                                    (pickMatchupId && matchup.id && pickMatchupId.includes(matchup.id))
                                  );
                              }) || round.picks?.[index]; // Fallback to index-based matching
                              
                              const chosenSide = pick?.chosen || 'A';
                              const chosenSet = chosenSide === 'A' ? matchup.setA : matchup.setB;
                              const opponentSet = chosenSide === 'A' ? matchup.setB : matchup.setA;
                              
                              const isPickCollapsed = collapsedPicks.get(round.id)?.has(index) || false;
                              const chosenName = chosenSet?.connections?.[0]?.name || 'Unknown';
                              
                              // Helper to get badge color
                              const getBadgeColor = (role: string) => {
                                if (role === 'jockey') return 'bg-blue-100 text-blue-800 border-blue-300';
                                if (role === 'trainer') return 'bg-purple-100 text-purple-800 border-purple-300';
                                if (role === 'sire') return 'bg-green-100 text-green-800 border-green-300';
                                return 'bg-gray-100 text-gray-800 border-gray-300';
                              };
                              
                              // Helper to get role label
                              const getRoleLabel = (role: string) => {
                                if (role === 'jockey') return 'Jockey';
                                if (role === 'trainer') return 'Trainer';
                                if (role === 'sire') return 'Sire';
                                return 'Unknown';
                              };

                              // Helper function to get all starters from both sets for time range calculation
                              const getAllStartersFromMatchup = () => {
                                const setAStarters = matchup.setA?.connections?.flatMap((conn: any, connIdx: number) =>
                                  (conn.starters || []).map((starter: any, sIdx: number) => ({
                                    starter,
                                    connIdx,
                                    sIdx,
                                    side: 'A' as const,
                                    key: `setA-${connIdx}-${sIdx}-${starter.race}`
                                  }))
                                ) || [];
                                
                                const setBStarters = matchup.setB?.connections?.flatMap((conn: any, connIdx: number) =>
                                  (conn.starters || []).map((starter: any, sIdx: number) => ({
                                    starter,
                                    connIdx,
                                    sIdx,
                                    side: 'B' as const,
                                    key: `setB-${connIdx}-${sIdx}-${starter.race}`
                                  }))
                                ) || [];
                                
                                return [...setAStarters, ...setBStarters];
                              };

                              // Get all starters from both sets for track timeline calculation
                              const allMatchupStarters = getAllStartersFromMatchup();

                              // Helper function to get race status (3 states: before, during, after)
                              const getRaceStatus = (starter: any): {
                                status: 'before_race' | 'five_min_warning' | 'during_race' | 'after_race';
                                nodeColor: string;
                                pulseClass: string;
                              } => {
                                // State 3: After race - finished (has position/points)
                                if (starter.finished || starter.position !== undefined) {
                                  return {
                                    status: 'after_race',
                                    nodeColor: 'border-black bg-black',
                                    pulseClass: ''
                                  };
                                }
                                
                                // Need postTime to determine other states
                                if (!starter.postTime) {
                                  // State 1: Before race - no post time available yet (pending round, no simulation)
                                  return {
                                    status: 'before_race',
                                    nodeColor: 'border-gray-300 bg-white',
                                    pulseClass: ''
                                  };
                                }
                                
                                const now = new Date();
                                const postTime = new Date(starter.postTime);
                                const timeUntilPost = postTime.getTime() - now.getTime();
                                const fiveMinutesInMs = 5 * 60 * 1000;
                                
                                // State 2: Before race - within 5 minutes of post time (warning)
                                if (timeUntilPost > 0 && timeUntilPost <= fiveMinutesInMs) {
                                  return {
                                    status: 'five_min_warning',
                                    nodeColor: 'border-yellow-500 bg-yellow-500',
                                    pulseClass: 'animate-pulse'
                                  };
                                }
                                
                                // State 2: During race - post time has passed but not finished (racing)
                                if (timeUntilPost <= 0) {
                                  return {
                                    status: 'during_race',
                                    nodeColor: 'border-gray-400 bg-gray-400',
                                    pulseClass: 'animate-ping'
                                  };
                                }
                                
                                // State 1: Before race - post time in future (pending)
                                return {
                                  status: 'before_race',
                                  nodeColor: 'border-gray-300 bg-white',
                                  pulseClass: ''
                                };
                              };

                              // Helper function to format post time in CT
                              const formatPostTimeCT = (postTime: string | null | undefined): string => {
                                if (!postTime) return '';
                                try {
                                  const date = new Date(postTime);
                                  // Convert to CT (Central Time)
                                  return date.toLocaleTimeString('en-US', { 
                                    timeZone: 'America/Chicago',
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  }) + ' CT';
                                } catch {
                                  return postTime;
                                }
                              };


                              // Helper function to render a set card
                              const renderSetCard = (set: any, isChosen: boolean, side: 'A' | 'B') => {
                                const setNames = set?.connections?.map((c: any) => c.name).join(', ') || 'N/A';
                                const setRole = set?.connections?.[0]?.role || 'unknown';
                                const setTrack = set?.connections?.[0]?.starters?.[0]?.track || set?.connections?.[0]?.track || '';
                                const setApps = set?.connections?.reduce((sum: number, c: any) => sum + (c.starters?.length || 0), 0) || 0;
                                const setAvgOdds = set?.connections?.[0]?.avgOdds?.toFixed(1) || 'N/A';
                                const setSalary = set?.connections?.reduce((sum: number, c: any) => sum + (c.salarySum || 0), 0) || 0;
                                
                                const allStarters = set?.connections?.flatMap((conn: any, connIdx: number) =>
                                  (conn.starters || []).map((starter: any, sIdx: number) => ({
                                    starter,
                                    connIdx,
                                    sIdx,
                                    key: `set${side}-${connIdx}-${sIdx}-${starter.race || starter.raceNumber}`
                                  }))
                                ) || [];
                                
                                // Calculate total races for the track
                                // Get all unique race numbers from all starters for this track
                                const raceNumbers = new Set<number>();
                                allStarters.forEach(({ starter }: any) => {
                                  const raceNum = starter.race || starter.raceNumber;
                                  if (raceNum && typeof raceNum === 'number') {
                                    raceNumbers.add(raceNum);
                                  }
                                });
                                
                                // Also check all starters from the matchup to get the full track race count
                                allMatchupStarters.forEach(({ starter }: any) => {
                                  if (starter.track === setTrack) {
                                    const raceNum = starter.race || starter.raceNumber;
                                    if (raceNum && typeof raceNum === 'number') {
                                      raceNumbers.add(raceNum);
                                    }
                                  }
                                });
                                
                                const totalRaces = raceNumbers.size > 0 ? Math.max(...Array.from(raceNumbers)) : allStarters.length;
                                
                                // Create a map of race number to starter data for quick lookup
                                const raceToStarterMap = new Map<number, any>();
                                allStarters.forEach(({ starter, key }: any) => {
                                  const raceNum = starter.race || starter.raceNumber;
                                  if (raceNum && typeof raceNum === 'number') {
                                    // If multiple starters for same race, keep the first one (or you could merge them)
                                    if (!raceToStarterMap.has(raceNum)) {
                                      raceToStarterMap.set(raceNum, { starter, key });
                                    }
                                  }
                                });
                                
                                // Render each connection with its own progress bar
                                // All connections in a set should be in one border card
                                return (
                                  <div className={`border-2 rounded-lg overflow-hidden ${
                                    isChosen ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                                  }`}>
                                    {set?.connections?.map((conn: any, connIdx: number) => {
                                      const connStarters = conn.starters || [];
                                      
                                      // Group starters by track for this connection
                                      const startersByTrack = new Map<string, any[]>();
                                      connStarters.forEach((starter: any) => {
                                        const track = starter.track;
                                        if (!startersByTrack.has(track)) {
                                          startersByTrack.set(track, []);
                                        }
                                        startersByTrack.get(track)!.push(starter);
                                      });
                                      
                                      // Render a progress bar for each track this connection appears in
                                      return (
                                        <div key={`conn-${connIdx}`} className={`${
                                          connIdx > 0 ? 'border-t-2 border-gray-300' : ''
                                        }`}>
                                          {Array.from(startersByTrack.entries()).map(([track, starters], trackIdx) => (
                                            <div key={`track-${trackIdx}`} className={`flex items-center gap-4 p-4 ${
                                              trackIdx > 0 ? 'border-t border-gray-200' : ''
                                  }`}>
                                              {/* Connection info card - show full card for each track (matching simulation view) */}
                                    <div className="flex-shrink-0 w-64 p-3 bg-gray-50 rounded-lg border border-gray-300">
                                      {/* Row 1: Name and Salary */}
                                      <div className="flex items-center justify-between mb-2">
                                                  <div className="font-bold text-base">{conn.name}</div>
                                                  <div className="text-base font-bold text-[var(--text-primary)]">
                                                    ${(conn.salarySum || 0).toLocaleString()}
                                      </div>
                                          </div>
                                      {/* Row 2: Role and Track badges */}
                                                <div className="flex items-center gap-2 mb-2">
                                                  <Badge className={`text-xs ${getBadgeColor(conn.role || setRole)}`}>
                                                    {getRoleLabel(conn.role || setRole)}
                                        </Badge>
                                                  <Badge variant="outline" className="text-xs font-bold">
                                                    {track}
                                          </Badge>
                                        </div>
                                                {/* Stats */}
                                                <div className="grid grid-cols-2 gap-2">
                                          <div>
                                          <div className="text-xs text-gray-500 mb-1">Apps</div>
                                                    <div className="text-sm font-semibold text-gray-900">{starters.length}</div>
                                            </div>
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Avg. Odds</div>
                                                    <div className="text-sm font-semibold text-gray-900">{(conn.avgOdds?.toFixed(1) || 'N/A')}</div>
                                            </div>
                                          </div>
                                    </div>
                                    
                                              {/* Progress bar for this track - shows full race schedule with nodes only where connection participates */}
                                    <div className="flex-1 px-4">
                                        <div className="relative flex items-center px-2" style={{ minHeight: '80px' }}>
                                                  {/* Background line - represents full race schedule */}
                                          <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-1 bg-gray-300 rounded-full" style={{ zIndex: 0 }}></div>
                                          
                                                  {/* Race nodes - positioned by actual race number on the track */}
                                          <div className="relative w-full" style={{ zIndex: 2 }}>
                                                    {(() => {
                                                      // Group starters by race number to handle multiple horses in same race
                                                      const startersByRace = new Map<number, any[]>();
                                                      starters.forEach((starter: any) => {
                                                        const raceNum = starter.race || starter.raceNumber;
                                                        if (raceNum) {
                                                          if (!startersByRace.has(raceNum)) {
                                                            startersByRace.set(raceNum, []);
                                                          }
                                                          startersByRace.get(raceNum)!.push(starter);
                                                        }
                                                      });
                                                      
                                                      // Get all race numbers for this connection to determine the range
                                                      const allRaceNums = Array.from(startersByRace.keys());
                                                      const maxRaceOnTrack = allRaceNums.length > 0 ? Math.max(...allRaceNums) : 10;
                                                      const totalRacesOnTrack = Math.max(10, maxRaceOnTrack);
                                                      
                                                      // Render one node per unique race
                                                      return Array.from(startersByRace.entries()).map(([raceNum, raceStarters], raceIdx) => {
                                                        // Use first starter for post time and other data
                                                        const starter = raceStarters[0];
                                                        const horseCount = raceStarters.length;
                                                        
                                                        // Position: Race 1 = 0%, Race 2 = 11%, Race 5 = 44%, Race 10 = 100%
                                                        const positionPercent = totalRacesOnTrack > 1 
                                                          ? ((raceNum - 1) / (totalRacesOnTrack - 1)) * 100
                                                          : 50;
                                                        
                                                        // Format post time in CT - check multiple property names
                                                        // First check the starter object itself
                                                        let postTimeStr = starter.postTime || 
                                                                         starter.post_time || 
                                                                         starter.post || 
                                                                         starter.mtp ||
                                                                         starter.scheduledStart ||
                                                                         starter.postTimeCT;
                                                        
                                                        // If not found in starter, check allMatchupStarters
                                                        if (!postTimeStr && allMatchupStarters && allMatchupStarters.length > 0) {
                                                          const raceStarter = allMatchupStarters.find((s: any) => {
                                                            const sStarter = s.starter || s;
                                                            return sStarter.track === starter.track && 
                                                                   sStarter.race === (starter.race || starter.raceNumber);
                                                          });
                                                          if (raceStarter) {
                                                            const sStarter = raceStarter.starter || raceStarter;
                                                            postTimeStr = sStarter.postTime || 
                                                                         sStarter.post_time || 
                                                                         sStarter.post || 
                                                                         sStarter.mtp ||
                                                                         sStarter.scheduledStart;
                                                          }
                                                        }
                                                        
                                                        // If still not found, check the connection's starters array
                                                        if (!postTimeStr && conn.starters) {
                                                          const connStarter = conn.starters.find((s: any) => 
                                                            s.track === starter.track && 
                                                            s.race === (starter.race || starter.raceNumber)
                                                          );
                                                          if (connStarter) {
                                                            postTimeStr = connStarter.postTime || 
                                                                         connStarter.post_time || 
                                                                         connStarter.post || 
                                                                         connStarter.mtp ||
                                                                         connStarter.scheduledStart;
                                                          }
                                                        }
                                                        
                                                        // If still not found, check the post time cache
                                                        if (!postTimeStr) {
                                                          const raceNumForCache = starter.race || starter.raceNumber;
                                                          // Ensure race is a string to match cache key format
                                                          const cacheKey = `${starter.track}-${String(raceNumForCache)}`;
                                                          postTimeStr = postTimeCache.get(cacheKey) || '';
                                                        }
                                                        
                                                        const postTimeCT = postTimeStr ? formatPostTimeCT(postTimeStr) : '';
                                              
                                              return (
                                                <div
                                                            key={`race-${raceNum}`}
                                                            className="absolute flex flex-col items-center"
                                                  style={{
                                                    left: `${positionPercent}%`,
                                                    top: '50%',
                                                              transform: 'translate(-50%, -50%)'
                                                            }}
                                                          >
                                                            {/* Race number above */}
                                                            <div className="absolute -top-7 text-[10px] font-bold text-gray-700 whitespace-nowrap">
                                                              R{raceNum}
                                                    </div>
                                                            
                                                            {/* Circle node with count badge if multiple horses */}
                                                            <div className="relative">
                                                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white"></div>
                                                              {/* Count badge - show when more than 1 horse in this race */}
                                                              {horseCount > 1 && (
                                                                <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white">
                                                                  {horseCount}
                                            </div>
                                                    )}
                                            </div>
                                                  
                                                            {/* Post time below in CT */}
                                                            <div className="absolute -bottom-7 text-[9px] font-medium text-gray-600 whitespace-nowrap">
                                                              {postTimeCT || '—'}
                                                  </div>
                                                </div>
                                              );
                                                      });
                                                    })()}
                                          </div>
                                        </div>
                                    </div>
                                      </div>
                                          ))}
                                        </div>
                                      );
                                    })}
                                    </div>
                                );
                              };
                              
                              return (
                                <div key={matchup.id || index} className="pt-3 first:pt-3">
                                  {/* Matchup container */}
                                  <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                                    {/* Matchup number header - clickable to collapse */}
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        togglePickCollapse(round.id, index);
                                      }}
                                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors bg-gray-50"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-sm font-semibold">
                                          Pick #{index + 1}
                                        </Badge>
                                        {isPickCollapsed && (
                                          <span className="text-sm font-medium text-gray-700">{chosenName}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {isPickCollapsed && (
                                          <div className="px-3 py-1 rounded font-bold text-sm bg-gray-100 text-gray-700">
                                            0 pts
                                          </div>
                                        )}
                                        {isPickCollapsed ? (
                                          <ChevronRight className="w-4 h-4 text-gray-400" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-gray-400" />
                                        )}
                                      </div>
                                    </button>
                                    
                                    {/* Pick details - collapsible */}
                                    {!isPickCollapsed && (
                                      <div className="p-4 bg-gray-50">
                                        <div className="flex flex-col gap-3">
                                          {/* Set A - shows chosen or opponent based on pick */}
                                          {renderSetCard(matchup.setA, chosenSide === 'A', 'A')}
                                          
                                          {/* Set B - shows chosen or opponent based on pick */}
                                          {renderSetCard(matchup.setB, chosenSide === 'B', 'B')}
                                        </div>
                                      </div>
                                    )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                <p>No matchup details available</p>
                                <p className="text-sm mt-1">Matchups will be loaded when simulation starts</p>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          
          {simulation && (
            <>
              {/* Track Selector */}
              {availableTracks.length > 0 && (
                <Card className="p-4 mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Filter by Track:</span>
                    <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tracks</SelectItem>
                        {availableTracks.map((track) => (
                          <SelectItem key={track} value={track}>
                            {track} ({roundsByTrack[track] || 0} rounds)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 ml-auto">
                      {availableTracks.map((track) => (
                        <Badge
                          key={track}
                          variant={selectedTrack === track ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedTrack(track)}
                        >
                          {track} ({roundsByTrack[track] || 0})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Control Panel */}
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Play/Pause */}
                    {simulation.status === 'running' ? (
                      <Button onClick={pauseSimulation} variant="outline">
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    ) : (
                      <Button 
                        onClick={simulation.status === 'ready' ? startSimulation : resumeSimulation}
                        disabled={simulation.status === 'finished'}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {simulation.status === 'ready' ? 'Start' : 'Resume'}
                      </Button>
                    )}
                    
                    {/* Reset */}
                    <Button onClick={resetSimulation} variant="outline">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                    
                    {/* View Results and Rerun - Show when finished (available to all users) */}
                    {simulation.status === 'finished' && (
                      <>
                        <Button onClick={() => router.push('/results')} variant="outline">
                          View Results
                        </Button>
                        <Button 
                          onClick={async () => {
                            try {
                              await resetSimulation();
                              // After reset, create a new simulation with the same contest
                              if (simulation?.contestId && pendingRounds.length > 0) {
                                const contest = contests.find(c => c.id === simulation.contestId);
                                if (contest?.date) {
                                  await createSimulation(simulation.contestId, speedMultiplier, contest.date);
                                }
                              }
                            } catch (error) {
                              console.error('[LivePage] Error rerunning simulation:', error);
                              alert(`Failed to rerun simulation: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                          }} 
                          variant="outline"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Rerun
                        </Button>
                      </>
                    )}
                    
                    {/* Speed Control */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-secondary)]">Speed:</span>
                      <Select
                        value={simulation.speedMultiplier.toString()}
                        onValueChange={(value) => setSpeed(parseInt(value))}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1x (1 min)</SelectItem>
                          <SelectItem value="2">2x (30s)</SelectItem>
                          <SelectItem value="5">5x (12s)</SelectItem>
                          <SelectItem value="10">10x (6s)</SelectItem>
                          <SelectItem value="20">20x (3s)</SelectItem>
                          <SelectItem value="60">60x (1s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Progress Info */}
                  <div className="text-right">
                    <div className="text-3xl font-bold text-[var(--text-primary)]">
                      {finishedRaces} / {totalRaces}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      Races Finished
                    </div>
                    {simulation?.status === 'running' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {runningRaces > 0 && `${runningRaces} running`}
                        {runningRaces > 0 && pendingRaces > 0 && ' • '}
                        {pendingRaces > 0 && `${pendingRaces} pending`}
                  </div>
                    )}
                </div>
                    </div>
              </Card>
              
              {/* User Rounds Progress */}
              {myRounds.length > 0 ? (
                <div className="space-y-6">
                  {/* Tier 1: Dashboard Stats */}
                  <LiveDashboardStats
                    {...stats}
                    onFilterClick={(filter) => setStatusFilter(filter)}
                  />
                  
                  {/* Tier 2: Filters and Search */}
                  <RoundFilters
                    statusFilter={statusFilter}
                    sortBy={sortBy}
                    searchQuery={searchQuery}
                    onStatusFilterChange={setStatusFilter}
                    onSortChange={setSortBy}
                    onSearchChange={setSearchQuery}
                    totalCount={myRounds.length}
                    filteredCount={filteredRounds.length}
                  />
                  
                  {/* Tier 3: Round List */}
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                      {statusFilter === 'all' ? 'All Rounds' :
                       statusFilter === 'live' ? 'Live Rounds' :
                       statusFilter === 'won' ? 'Won Rounds' :
                       statusFilter === 'lost' ? 'Lost Rounds' :
                       'Pending Rounds'}
                    </h2>
                    {filteredRounds.length > 0 ? (
                      <div className="space-y-4">
                        {filteredRounds.map((round) => (
                          <RoundProgressCard
                            key={round.roundId}
                            {...round}
                            races={simulation?.races || []}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card className="p-8 text-center">
                        <div className="text-gray-500 mb-4">
                          {searchQuery ? `No rounds match "${searchQuery}"` : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}rounds available`}
                        </div>
                        {!searchQuery && myRounds.length === 0 && (
                          <div className="text-sm text-gray-400 mt-2">
                            Rounds will appear here once you submit entries and start a simulation.
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <div className="text-gray-500">
                    {simulation && simulation.rounds && simulation.rounds.length === 0 ? (
                      <>
                        <div className="text-gray-500 mb-2">
                          No rounds found in this simulation.
                        </div>
                        <div className="text-sm text-gray-400">
                          This simulation was created with 0 entries. Submit rounds in the matchups page, then create a new simulation to see live progress.
                        </div>
                      </>
                    ) : (
                      <>
                        No rounds found. Submit a round in the matchups page to see live progress here.
                      </>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
          
          {/* Error Display */}
          {error && (
            <Card className="p-6 bg-red-50 border-red-500 mt-6">
              <div className="text-red-700 font-medium">{error}</div>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}


