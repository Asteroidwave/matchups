"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Trash2, Eye, EyeOff, Calendar, Settings, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { fetchWithAuth } from "@/lib/api/authInterceptor";
import { MatchupTypesDialog } from "./MatchupTypesDialog";
import { MultiTrackDialog } from "./MultiTrackDialog";
import { MultiTrackBundleDrawer } from "./MultiTrackBundleDrawer";

export interface Contest {
  id: string;
  track: string;
  date: string;
  is_active: boolean;
  created_at: string;
  status?: string;
  matchup_types?: string[];
  matchups_calculated_at?: string;
  track_data_id?: string;
  first_post_time?: string | null;
  last_post_time?: string | null;
  lock_time?: string | null;
  lifecycle_status?: string | null;
}

export function ContestManagement() {
  const { profile, isLoading: authLoading } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [isMatchupDialogOpen, setIsMatchupDialogOpen] = useState(false);
  const [contestStatuses, setContestStatuses] = useState<Record<string, { status: string; matchups_count: number }>>({});
  const [togglingVisibility, setTogglingVisibility] = useState<string | null>(null);
  const loadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isMultiTrackDialogOpen, setIsMultiTrackDialogOpen] = useState(false);
  const [bundleSummary, setBundleSummary] = useState<Record<string, {
    bundleCount: number;
    totalMatchups: number;
    lastGenerated: string | null;
  }>>({});
  const [drawerBundle, setDrawerBundle] = useState<{
    id: string;
    trackCodes: string[];
    matchupTypes: string[];
    matchupCount: number;
    createdAt: string;
    matchups: Matchup[];
  } | null>(null);

  const loadMultiTrackBundles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('multi_track_bundles')
        .select('id, contest_ids, matchup_data, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[Bundles] Error loading multi-track bundles:', error);
        return;
      }

      const summary: Record<string, { bundleCount: number; totalMatchups: number; lastGenerated: string | null }> = {};

      data?.forEach(bundle => {
        const count = Number(bundle.matchup_data?.matchup_count) ||
          (Array.isArray(bundle.matchup_data?.matchups) ? bundle.matchup_data.matchups.length : 0);
        bundle.contest_ids?.forEach((contestId: string) => {
          if (!contestId) return;
          const existing = summary[contestId] || { bundleCount: 0, totalMatchups: 0, lastGenerated: null };
          summary[contestId] = {
            bundleCount: existing.bundleCount + 1,
            totalMatchups: existing.totalMatchups + count,
            lastGenerated: existing.lastGenerated && existing.lastGenerated > bundle.created_at
              ? existing.lastGenerated
              : bundle.created_at,
          };
        });
      });

      setBundleSummary(summary);
    } catch (err) {
      console.error('[Bundles] Exception loading multi-track bundles:', err);
    }
  }, []);

  const loadContests = useCallback(async () => {
    // Clear any pending debounced load
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const operationId = `contest-load-${Date.now()}`;
    console.log(`[${operationId}] Starting contest load...`);
    
    try {
      // Simplified query - single orderBy to avoid timeout issues
      const startTime = Date.now();
      const { data, error: fetchError } = await supabase
        .from('contests')
        .select('*')
        .order('created_at', { ascending: false });
      
      const queryTime = Date.now() - startTime;
      console.log(`[${operationId}] Query completed in ${queryTime}ms`);
      
      // If query took too long, log warning but continue
      if (queryTime > 25000) {
        console.warn(`[${operationId}] ⚠️ Query took ${queryTime}ms (slow but successful)`);
      }

      if (fetchError) {
        console.error(`[${operationId}] Supabase error:`, fetchError);
        console.error(`[${operationId}] Error details:`, {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
        });
        throw fetchError;
      }

      setContests(data || []);
      console.log(`[${operationId}] ✅ Loaded ${data?.length || 0} contests`);
      
      // Load status for each contest (with delay to ensure backend is ready)
      if (data && data.length > 0) {
        console.log(`[${operationId}] Contests:`, data.map(c => ({ id: c.id, track: c.track, date: c.date, is_active: c.is_active })));
        // Wait a moment before loading statuses to ensure backend has finished processing
        setTimeout(() => {
          loadContestStatuses(data.map(c => c.id));
        }, 500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load contests";
      console.error(`[${operationId}] ❌ Error loading contests:`, err);
      setError(errorMessage);
      
      // Always set loading to false, even on error
      setIsLoading(false);
      return;
    }
    
    setIsLoading(false);
    loadMultiTrackBundles();
  }, [loadMultiTrackBundles]);

  const loadContestStatuses = async (contestIds: string[]) => {
    try {
      // Wait for auth to be ready
      if (authLoading) {
        console.log('[Status] Auth still loading, skipping status load');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[Status] No session available for loading contest statuses');
        // Don't return - try using fetchWithAuth which handles auth automatically
      }

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      const statusPromises = contestIds.map(async (id) => {
        try {
          const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/contests/${id}/status`, {});
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[Status] Contest ${id}: status=${data.status}, matchups=${data.matchups_count}`);
            return { id, ...data };
          } else {
            const errorText = await response.text();
            console.error(`[Status] Error loading status for contest ${id}: ${response.status} ${errorText}`);
          }
        } catch (err) {
          console.error(`[Status] Error loading status for contest ${id}:`, err);
        }
        return null;
      });

      const results = await Promise.all(statusPromises);
      const statusMap: Record<string, { status: string; matchups_count: number }> = {};
      
      results.forEach(result => {
        if (result) {
          statusMap[result.id] = {
            status: result.status || 'draft',
            matchups_count: result.matchups_count || 0,
          };
        }
      });

      console.log(`[Status] Loaded statuses for ${Object.keys(statusMap).length} contests:`, statusMap);
      setContestStatuses(statusMap);
    } catch (err) {
      console.error('[Status] Error loading contest statuses:', err);
    }
  };

  useEffect(() => {
    // Wait for auth to be ready before loading contests
    if (authLoading) {
      return;
    }
    
    // Debounce initial load to prevent excessive queries
    loadTimeoutRef.current = setTimeout(() => {
      loadContests();
    }, 300); // 300ms debounce

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [authLoading, loadContests]);

  // Track polling state to prevent infinite loops
  const pollingAttemptsRef = useRef<Record<string, number>>({});
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const contestsRef = useRef<Contest[]>(contests);
  const contestStatusesRef = useRef<Record<string, { status: string; matchups_count: number }>>(contestStatuses);

  // Keep refs in sync with state
  useEffect(() => {
    contestsRef.current = contests;
  }, [contests]);

  useEffect(() => {
    contestStatusesRef.current = contestStatuses;
  }, [contestStatuses]);

  // Refresh statuses periodically for contests that are ready but showing 0 matchups
  useEffect(() => {
    // Only refresh if auth is ready
    if (authLoading) return;
    
    // Clear any existing interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Find contests that need polling (ready status but 0 matchups)
    const readyContests = contests.filter(c => {
      const status = contestStatuses[c.id];
      const needsPolling = (status?.status === 'ready' && status?.matchups_count === 0) || 
                           (!status && c.status === 'ready');
      
      // Only poll contests that haven't exceeded max attempts
      const attempts = pollingAttemptsRef.current[c.id] || 0;
      const maxAttempts = 12; // Max 12 attempts = 1 minute of polling (12 * 5s)
      
      // Reset attempts counter if contest now has matchups (it was fixed)
      if (status?.matchups_count > 0 && attempts > 0) {
        pollingAttemptsRef.current[c.id] = 0;
        return false; // Don't poll contests that have matchups
      }
      
      return needsPolling && attempts < maxAttempts;
    });

    if (readyContests.length === 0) {
      return; // Nothing to poll
    }

    // Initialize attempts counter for contests we're about to poll
    readyContests.forEach(c => {
      if (!(c.id in pollingAttemptsRef.current)) {
        pollingAttemptsRef.current[c.id] = 0;
      }
    });

    // Create interval that polls using current refs (always fresh)
    pollingIntervalRef.current = setInterval(() => {
      // Check session before refreshing
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          console.warn(`[ContestManagement] No session available, skipping status refresh`);
          return;
        }

        // Use refs to get current state (always fresh)
        const currentContests = contestsRef.current;
        const currentStatuses = contestStatusesRef.current;

        // Find contests that still need polling
        const stillNeedsPolling = currentContests
          .filter(c => {
            const status = currentStatuses[c.id];
            const attempts = pollingAttemptsRef.current[c.id] || 0;
            
            // Reset attempts if contest now has matchups
            if (status?.matchups_count > 0) {
              if (attempts > 0) {
                pollingAttemptsRef.current[c.id] = 0;
              }
              return false; // Stop polling contests with matchups
            }
            
            // Stop polling if exceeded max attempts
            if (attempts >= 12) {
              return false;
            }
            
            return (status?.status === 'ready' && status?.matchups_count === 0) || (!status && c.status === 'ready');
          })
          .map(c => c.id);

        if (stillNeedsPolling.length === 0) {
          // All done polling, clear interval
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        console.log(`[ContestManagement] Refreshing statuses for ${stillNeedsPolling.length} contests (attempts: ${stillNeedsPolling.map(id => `${id.slice(0, 8)}:${pollingAttemptsRef.current[id] || 0}`).join(', ')})...`);
        loadContestStatuses(stillNeedsPolling).then(() => {
          // Increment attempt counter after loading (only for contests that still need polling)
          stillNeedsPolling.forEach(contestId => {
            const currentStatus = contestStatusesRef.current[contestId];
            // Only increment if still has 0 matchups
            if (!currentStatus || currentStatus.matchups_count === 0) {
            pollingAttemptsRef.current[contestId] = (pollingAttemptsRef.current[contestId] || 0) + 1;
            } else {
              // Reset if matchups were found
              pollingAttemptsRef.current[contestId] = 0;
            }
          });
        });
      });
    }, 5000); // Refresh every 5 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // Include contestStatuses in dependencies so we re-evaluate when statuses update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contests, authLoading, contestStatuses]);

  const handleToggleActive = async (contest: Contest) => {
    setTogglingVisibility(contest.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in');
      }

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Use the visibility endpoint with auth interceptor
      const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/contests/${contest.id}/visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !contest.is_active,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update contest visibility');
      }

      const result = await response.json();
      
      // Clear backend cache so lobby reflects changes immediately
      await fetchWithAuth(`${BACKEND_URL}/api/admin/contests/cache/clear`, {
        method: 'POST',
      }).catch(err => console.warn('Failed to clear cache:', err));

      setSuccess(`Contest ${contest.is_active ? 'hidden from' : 'shown in'} lobby`);
      await loadContests();
      
      // Notify other components that contests changed
      window.dispatchEvent(new CustomEvent('contestChanged'));
      
      setTimeout(() => setSuccess(null), 3000);
      await loadContestStatuses([contest.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update contest");
    } finally {
      setTogglingVisibility(null);
    }
  };

  const handleSetMatchupTypes = (contest: Contest) => {
    setSelectedContest(contest);
    setIsMatchupDialogOpen(true);
  };

  const handleMatchupTypesSuccess = async () => {
    if (selectedContest) {
      // Wait a moment for backend to finish processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Single call - loadContests will handle status loading internally
      // This prevents multiple refresh cycles (was causing 5+ refreshes)
      await loadContests();
      // Dispatch event to refresh lobby
      window.dispatchEvent(new CustomEvent('contestChanged'));
    }
  };

  const handleDelete = async (contest: Contest) => {
    if (!confirm(`Are you sure you want to permanently delete contest ${contest.track} on ${contest.date}? This cannot be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('contests')
        .delete()
        .eq('id', contest.id);

      if (deleteError) throw deleteError;

      // Clear backend cache so lobby reflects changes immediately
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`${BACKEND_URL}/api/admin/contests/cache/clear`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }).catch(err => console.warn('Failed to clear cache:', err));
      }

      setSuccess('Contest deleted successfully');
      await loadContests();
      
      // Notify other components that contests changed
      window.dispatchEvent(new CustomEvent('contestChanged'));
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contest");
    }
  };

  const filteredContests = contests.filter(contest =>
    contest.track.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contest.date.includes(searchTerm)
  );

  const TRACK_NAMES: Record<string, string> = {
    'AQU': 'Aqueduct',
    'ARP': 'Arapahoe',
    'BAQ': 'Belmont Park',
    'BEL': 'Belmont At The Big A',
    'CAM': 'Camarero',
    'CEN': 'Century Downs',
    'CD': 'Churchill Downs',
    'CHS': 'Charleston',
    'CT': 'Charles Town',
    'DED': 'Delta Downs',
    'DMR': 'Del Mar',
    'EVD': 'Evangeline',
    'FP': 'Fairmount Park',
    'FL': 'Finger Lakes',
    'GP': 'Gulfstream Park',
    'HAW': 'Hawthorne',
    'IND': 'Horseshoe Indianapolis',
    'LA': 'Los Alamitos Quarter Horse',
    'LS': 'Lone Star',
    'LRL': 'Laurel Park',
    'MVR': 'Mahoning Valley Race Course',
    'MON': 'Montpelier',
    'MNR': 'Mountaineer',
    'OP': 'Oaklawn Park',
    'PEN': 'Penn National',
    'PHC': 'Pennsylvania Hunt Cup',
    'PRX': 'Parx Racing',
    'RP': 'Remington Park',
    'TUP': 'Turf Paradise',
    'WO': 'Woodbine',
    'WRD': 'Will Rogers',
    'ZIA': 'Zia Park',
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription className="text-green-600 dark:text-green-400">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search by track or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            onClick={() => setIsMultiTrackDialogOpen(true)}
            variant="default"
            size="sm"
            disabled={contests.length < 2}
          >
            Multi Tracks
          </Button>
        <Button 
          onClick={loadContests} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[var(--text-tertiary)]">Loading contests...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Track</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Matchups</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[var(--text-tertiary)]">
                    No contests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredContests.map((contest) => {
                  const status = contestStatuses[contest.id] || { status: contest.status || 'draft', matchups_count: 0 };
                  
                  // Determine display status: if ready and active, show "Active", otherwise show actual status
                  const displayStatus = (status.status === 'ready' && contest.is_active) ? 'active' : status.status;
                  
                  const statusBadge = {
                    draft: { 
                      label: 'Draft', 
                      variant: 'secondary' as const,
                      className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20'
                    },
                    processing: { 
                      label: 'Processing', 
                      variant: 'default' as const,
                      className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 animate-pulse'
                    },
                    ready: { 
                      label: 'Ready', 
                      variant: 'default' as const,
                      className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                    },
                    active: { 
                      label: 'Active', 
                      variant: 'default' as const,
                      className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
                    },
                  }[displayStatus] || { 
                    label: 'Draft', 
                    variant: 'secondary' as const,
                    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20'
                  };

                  return (
                    <TableRow key={contest.id}>
                      <TableCell className="font-medium">
                        {TRACK_NAMES[contest.track] || contest.track} ({contest.track})
                      </TableCell>
                      <TableCell>{new Date(contest.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{status.matchups_count || 0}</span>
                          {status.matchups_count === 0 && status.status === 'ready' && (() => {
                            const attempts = pollingAttemptsRef.current[contest.id] || 0;
                            if (attempts < 12) {
                              return <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">(checking...)</span>;
                            } else {
                              return <span className="text-xs text-red-600 dark:text-red-400 ml-2">(no matchups)</span>;
                            }
                          })()}
                          {contest.matchups_calculated_at && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {new Date(contest.matchups_calculated_at).toLocaleDateString()}
                            </span>
                          )}
                      {bundleSummary[contest.id] && (
                        <div className="text-xs text-[var(--text-secondary)] mt-1">
                          <button
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase
                                  .from('multi_track_bundles')
                                  .select('id, track_codes, matchup_types, matchup_data, created_at')
                                  .contains('contest_ids', [contest.id])
                                  .order('created_at', { ascending: false })
                                  .limit(1)
                                  .maybeSingle();

                                if (error || !data) {
                                  console.warn('[Bundles] No bundle found for contest', contest.id, error);
                                  return;
                                }

                                const matchupCount = Number(data.matchup_data?.matchup_count) ||
                                  (Array.isArray(data.matchup_data?.matchups) ? data.matchup_data.matchups.length : 0);

                                setDrawerBundle({
                                  id: data.id,
                                  trackCodes: data.track_codes || [],
                                  matchupTypes: data.matchup_types || [],
                                  matchupCount,
                                  createdAt: data.created_at,
                                  matchups: data.matchup_data?.matchups || [],
                                });
                              } catch (err) {
                                console.error('[Bundles] Failed to fetch bundle for drawer:', err);
                              }
                            }}
                            className="underline text-[var(--brand)]"
                          >
                            Multi-track: {bundleSummary[contest.id].bundleCount} bundle
                            {bundleSummary[contest.id].bundleCount !== 1 ? 's' : ''} · {bundleSummary[contest.id].totalMatchups} matchups
                          </button>
                          {bundleSummary[contest.id].lastGenerated && (
                            <div>
                              Last: {new Date(bundleSummary[contest.id].lastGenerated!).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetMatchupTypes(contest)}
                            title="Set matchup types"
                            disabled={status.status === 'processing'}
                          >
                            {status.status === 'processing' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Settings className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(contest)}
                            title={contest.is_active ? 'Hide from lobby' : 'Show in lobby'}
                            disabled={status.status !== 'ready' || togglingVisibility === contest.id}
                            className={
                              contest.is_active
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
                                : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20'
                            }
                          >
                            {togglingVisibility === contest.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : contest.is_active ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(contest)}
                            className="ml-4"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedContest && (
        <MatchupTypesDialog
          contestId={selectedContest.id}
          contestTrack={selectedContest.track}
          contestDate={selectedContest.date}
          currentMatchupTypes={selectedContest.matchup_types || []}
          currentStatus={contestStatuses[selectedContest.id]?.status || selectedContest.status || 'draft'}
          isOpen={isMatchupDialogOpen}
          onClose={() => {
            setIsMatchupDialogOpen(false);
            setSelectedContest(null);
          }}
          onSuccess={handleMatchupTypesSuccess}
        />
      )}

      <MultiTrackDialog
        contests={contests}
        isOpen={isMultiTrackDialogOpen}
        onClose={() => setIsMultiTrackDialogOpen(false)}
        onSuccess={() => {
          loadContests();
          loadMultiTrackBundles();
          setSuccess('Multi-track matchups generated successfully');
          setTimeout(() => setSuccess(null), 3000);
        }}
      />

      <MultiTrackBundleDrawer
        open={Boolean(drawerBundle)}
        onClose={() => setDrawerBundle(null)}
        bundle={drawerBundle}
      />
    </div>
  );
}

