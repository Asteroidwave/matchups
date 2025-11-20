"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Connection, Matchup, Round, RoundPick } from "@/types";
import { loadAndMergeAllTracks, FALLBACK_TRACKS } from "@/lib/ingest";
import { generateMatchups, MatchupGenerationOptions } from "@/lib/matchups";
import { saveRound, loadRounds } from "@/lib/store";
import { matchupWinner } from "@/lib/scoring";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";

interface Contest {
  id: string;
  track: string;
  trackName: string;
  date: string;
  hasData: boolean;
  entryCount?: number;
  firstPostTime?: string | null;
  lastPostTime?: string | null;
  lockTime?: string | null;
  lifecycleStatus?: string | null;
  status?: string | null;
}

interface AppContextType {
  connections: Connection[];
  matchups: Matchup[];
  rounds: Round[];
  contests: Contest[];
  tolerance: number;
  isLoading: boolean;
  contestsLoading: boolean;
  contestsError: string | null;
  error: string | null;
  bankroll: number;
  availableMatchupTypes: string[];
  trackLoadingStates: Record<string, { loading: boolean; hasData: boolean }>;
  totalMatchupCount?: number; // Total matchups from backend (not filtered)
  
  loadData: () => Promise<void>;
  loadContests: (force?: boolean) => Promise<void>;
  regenerateMatchups: (options?: MatchupGenerationOptions) => void;
  regenerateMatchupType: (matchupType: string) => Promise<void>; // NEW: Per-type reload
  refreshTrackData: (track: string) => Promise<void>;
  setTolerance: (tolerance: number) => void;
  submitRound: (picks: RoundPick[], entryAmount: number, multiplier: number) => Promise<void>;
  updateBankroll: (amount: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

  // Cache keys - sessionStorage for current session only (smaller, ephemeral)
  // Note: We don't cache full track data due to localStorage quota limits
  // Instead, we rely on in-memory caching + backend API caching (Redis)
const CACHE_KEYS = {
  matchups: 'cached_matchups',
  connections: 'cached_connections',
  matchupPools: 'cached_matchup_pools',
  displayCounts: 'cached_display_counts',
  poolCursor: 'cached_pool_cursor',
  availableMatchupTypes: 'cached_available_matchup_types',
  cacheContestId: 'cached_contest_id',
  cacheTrack: 'cached_track',
  cacheDate: 'cached_date',
  // Lightweight localStorage cache (only metadata, not full data)
  totalMatchupCounts: 'app_total_matchup_counts', // Total matchup counts per contest (lightweight)
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile, refreshProfile } = useAuth();

  // Try to restore from cache on mount
  const restoreFromCache = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const cachedContestId = sessionStorage.getItem(CACHE_KEYS.cacheContestId);
      const cachedTrack = sessionStorage.getItem(CACHE_KEYS.cacheTrack);
      const cachedDate = sessionStorage.getItem(CACHE_KEYS.cacheDate);
      const currentContestId = sessionStorage.getItem('selectedContestId');
      const currentTrack = sessionStorage.getItem('selectedTrack');
      const currentDate = sessionStorage.getItem('selectedDate');
      
      console.log('[Cache] Checking cache:', {
        cached: { contestId: cachedContestId, track: cachedTrack, date: cachedDate },
        current: { contestId: currentContestId, track: currentTrack, date: currentDate }
      });
      
      // Only restore if contest/track/date match (or if contest matches, track/date can be flexible)
      const contestMatches = cachedContestId && currentContestId && cachedContestId === currentContestId;
      const trackMatches = (!cachedTrack && !currentTrack) || cachedTrack === currentTrack;
      const dateMatches = (!cachedDate && !currentDate) || cachedDate === currentDate;
      
      if (contestMatches || (trackMatches && dateMatches)) {
        const cachedMatchups = sessionStorage.getItem(CACHE_KEYS.matchups);
        const cachedConnections = sessionStorage.getItem(CACHE_KEYS.connections);
        const cachedPools = sessionStorage.getItem(CACHE_KEYS.matchupPools);
        const cachedDisplayCounts = sessionStorage.getItem(CACHE_KEYS.displayCounts);
        const cachedCursor = sessionStorage.getItem(CACHE_KEYS.poolCursor);
        const cachedTypes = sessionStorage.getItem(CACHE_KEYS.availableMatchupTypes);
        
        if (cachedMatchups && cachedConnections) {
          try {
            const matchups = JSON.parse(cachedMatchups) as Matchup[];
            const connections = JSON.parse(cachedConnections) as Connection[];
            
            // Validate parsed data
            if (!Array.isArray(matchups) || !Array.isArray(connections)) {
              console.warn('[Cache] Invalid cache data format, clearing cache');
              sessionStorage.removeItem(CACHE_KEYS.matchups);
              sessionStorage.removeItem(CACHE_KEYS.connections);
              return false;
            }
            
            setMatchups(matchups);
            setConnections(connections);
            
            if (cachedPools) {
              try {
                const pools = JSON.parse(cachedPools);
                if (pools && typeof pools === 'object') {
                  setMatchupPools(pools);
                }
              } catch (e) {
                console.warn('[Cache] Failed to parse cached pools:', e);
              }
            }
            if (cachedDisplayCounts) {
              try {
                const counts = JSON.parse(cachedDisplayCounts);
                if (counts && typeof counts === 'object') {
                  setDisplayCounts(counts);
                }
              } catch (e) {
                console.warn('[Cache] Failed to parse cached display counts:', e);
              }
            }
            if (cachedCursor) {
              try {
                const cursor = JSON.parse(cachedCursor);
                if (cursor && typeof cursor === 'object') {
                  setPoolCursor(cursor);
                }
              } catch (e) {
                console.warn('[Cache] Failed to parse cached cursor:', e);
              }
            }
            if (cachedTypes) {
              try {
                const types = JSON.parse(cachedTypes) as string[];
                if (Array.isArray(types)) {
                  setAvailableMatchupTypes(types);
                }
              } catch (e) {
                console.warn('[Cache] Failed to parse cached types:', e);
              }
            }
            
            console.log(`✅ Restored from cache: ${matchups.length} matchups, ${connections.length} connections`);
            // Set loading to false immediately when cache is restored
            setIsLoading(false);
            return true;
          } catch (parseError) {
            console.error('[Cache] Failed to parse cached data:', parseError);
            // Clear corrupted cache
            sessionStorage.removeItem(CACHE_KEYS.matchups);
            sessionStorage.removeItem(CACHE_KEYS.connections);
            return false;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to restore from cache:', err);
    }
    return false;
    // Note: setState functions are stable and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to cache
  const saveToCache = useCallback((matchups: Matchup[], connections: Connection[], pools?: Record<string, Matchup[]>, displayCounts?: Record<string, number>, cursor?: Record<string, number>, types?: string[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      const contestId = sessionStorage.getItem('selectedContestId');
      const track = sessionStorage.getItem('selectedTrack');
      const date = sessionStorage.getItem('selectedDate');
      
      if (contestId || track) {
        sessionStorage.setItem(CACHE_KEYS.matchups, JSON.stringify(matchups));
        sessionStorage.setItem(CACHE_KEYS.connections, JSON.stringify(connections));
        if (pools) sessionStorage.setItem(CACHE_KEYS.matchupPools, JSON.stringify(pools));
        if (displayCounts) sessionStorage.setItem(CACHE_KEYS.displayCounts, JSON.stringify(displayCounts));
        if (cursor) sessionStorage.setItem(CACHE_KEYS.poolCursor, JSON.stringify(cursor));
        if (types) sessionStorage.setItem(CACHE_KEYS.availableMatchupTypes, JSON.stringify(types));
        
        if (contestId) sessionStorage.setItem(CACHE_KEYS.cacheContestId, contestId);
        if (track) sessionStorage.setItem(CACHE_KEYS.cacheTrack, track);
        if (date) sessionStorage.setItem(CACHE_KEYS.cacheDate, date);
        
        console.log(`💾 Cached ${matchups.length} matchups and ${connections.length} connections`);
      }
    } catch (err) {
      console.warn('Failed to save to cache:', err);
    }
  }, []);

  // Initialize state - start empty to prevent hydration errors, restore from cache in useEffect
  const [connections, setConnections] = useState<Connection[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  
  // Restore from cache after mount (client-only, prevents hydration mismatch)
  // This will be handled by the restoreFromCache useEffect below
  const [rounds, setRounds] = useState<Round[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestsLoaded, setContestsLoaded] = useState(false);
  const [contestsLoading, setContestsLoading] = useState(false);
  const [contestsError, setContestsError] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(500);
  // Start with loading=true, will be set to false if cache is restored (prevents hydration error)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bankroll now comes from Supabase profile, not localStorage
  const [bankroll, setBankroll] = useState(profile?.bankroll || 1000);
  // Initialize all cache-related state as empty to prevent hydration errors
  const [matchupPools, setMatchupPools] = useState<Record<string, Matchup[]>>({});
  const [displayCounts, setDisplayCounts] = useState<Record<string, number>>({});
  const [poolCursor, setPoolCursor] = useState<Record<string, number>>({});
  const [availableMatchupTypes, setAvailableMatchupTypes] = useState<string[]>([]);
  const [totalMatchupCount, setTotalMatchupCount] = useState<number | undefined>(undefined);
  // Cache multi-track bundles by date to avoid repeated GETs per date
  const bundlesCacheRef = useRef<Map<string, any[]>>(new Map());
  
  // NEW: Multi-track support - store matchups for all tracks (in-memory only)
  // Note: We don't cache full data in localStorage due to size limits
  // Instead, we rely on in-memory caching + backend caching for performance
  interface TrackDataCacheEntry {
    contestId: string;
    track: string;
    date: string;
    matchups: Matchup[];
    connections: Connection[];
    matchupPools: Record<string, Matchup[]>;
    displayCounts: Record<string, number>;
    poolCursor: Record<string, number>;
    availableTypes: string[];
    lastUpdated: number;
    totalMatchupCount?: number; // Total matchups from backend
  }

  const [allTracksData, setAllTracksData] = useState<Map<string, TrackDataCacheEntry>>(new Map());
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [trackLoadingStates, setTrackLoadingStates] = useState<Record<string, { loading: boolean; hasData: boolean }>>({});
  const applyTrackData = useCallback((track: string, data: TrackDataCacheEntry) => {
    if (!data) return;

    setConnections(data.connections);
    setMatchups(data.matchups);
    setMatchupPools(data.matchupPools || {});
    setDisplayCounts(data.displayCounts || {});
    setPoolCursor(data.poolCursor || {});
    setAvailableMatchupTypes(data.availableTypes || []);
    setTotalMatchupCount(data.totalMatchupCount);
    setIsLoading(false);
    setActiveTrack(track);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedTrack', track);
      sessionStorage.setItem('selectedContestId', data.contestId);
      sessionStorage.setItem('selectedDate', data.date);
      sessionStorage.setItem('availableMatchupTypes', JSON.stringify(data.availableTypes || []));
    }

    saveToCache(
      data.matchups,
      data.connections,
      data.matchupPools,
      data.displayCounts,
      data.poolCursor,
      data.availableTypes
    );
  }, [saveToCache]);

  
  
  // Restore all cache-related state after mount (client-only, prevents hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedPools = sessionStorage.getItem(CACHE_KEYS.matchupPools);
        const cachedDisplayCounts = sessionStorage.getItem(CACHE_KEYS.displayCounts);
        const cachedCursor = sessionStorage.getItem(CACHE_KEYS.poolCursor);
        const cachedTypes = sessionStorage.getItem(CACHE_KEYS.availableMatchupTypes);
        
        if (cachedPools) {
          const parsed = JSON.parse(cachedPools);
          if (parsed && typeof parsed === 'object') {
            setMatchupPools(parsed);
          }
        }
        
        if (cachedDisplayCounts) {
          const parsed = JSON.parse(cachedDisplayCounts);
          if (parsed && typeof parsed === 'object') {
            setDisplayCounts(parsed);
          }
        }
        
        if (cachedCursor) {
          const parsed = JSON.parse(cachedCursor);
          if (parsed && typeof parsed === 'object') {
            setPoolCursor(parsed);
          }
        }
        
        if (cachedTypes) {
          const parsed = JSON.parse(cachedTypes);
          if (Array.isArray(parsed)) {
            setAvailableMatchupTypes(parsed);
          }
        }
      } catch (err) {
        console.warn('[AppContext] Failed to restore cache state in useEffect:', err);
      }
    }
  }, []); // Only run once on mount
  
  // Selected track and date are stored in sessionStorage (set by lobby page)
  // We don't need to store them in state here since they're read directly from sessionStorage when needed

  const cloneStarter = useCallback((starter: any) => {
    return starter ? { ...starter } : starter;
  }, []);

  const cloneConnection = useCallback((connection: any) => {
    if (!connection) return connection;
    return {
      ...connection,
      starters: Array.isArray(connection.starters)
        ? connection.starters.map((starter: any) => cloneStarter(starter))
        : [],
    };
  }, [cloneStarter]);

  const convertSetSide = useCallback((set: any) => {
    return {
      connections: Array.isArray(set?.connections)
        ? set.connections.map((conn: any) => cloneConnection(conn))
        : [],
      salaryTotal: set?.totalSalary ?? set?.salaryTotal ?? 0,
      totalPoints: set?.totalPoints ?? set?.points ?? 0,
    };
  }, [cloneConnection]);

  const convertBackendMatchup = useCallback((raw: any, type: string, index: number): Matchup => {
    // Use the actual database ID - no fallback to temporary IDs
    // If no ID exists, log an error as this indicates a data integrity issue
    if (!raw?.id) {
      console.error('[AppContext] Matchup missing ID:', { type, index, raw });
    }
    
    return {
      id: raw?.id || `error-no-id-${type}-${index}`, // Fallback that's obviously an error
      setA: convertSetSide(raw?.setA || {}),
      setB: convertSetSide(raw?.setB || {}),
      matchupType: type,
    };
  }, [convertSetSide]);

  

  const pickMatchupsFromPools = useCallback((
    pools: Record<string, Matchup[]>,
    counts: Record<string, number>,
    cursor: Record<string, number>
  ) => {
    const nextCursor: Record<string, number> = { ...cursor };
    const displayed: Matchup[] = [];

    Object.entries(pools).forEach(([typeKey, pool]) => {
      if (!Array.isArray(pool) || pool.length === 0) {
        nextCursor[typeKey] = nextCursor[typeKey] ?? 0;
        return;
      }

      const desired = Math.max(0, Math.min(counts[typeKey] ?? pool.length, pool.length));
      const startIndex = nextCursor[typeKey] ?? 0;

      for (let i = 0; i < desired; i++) {
        const idx = (startIndex + i) % pool.length;
        displayed.push(pool[idx]);
      }

      nextCursor[typeKey] = pool.length === 0 ? 0 : (startIndex + desired) % pool.length;
    });

    return { displayed, cursor: nextCursor };
  }, []);

  const getBundlesForDate = useCallback(async (date: string): Promise<any[]> => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const cached = bundlesCacheRef.current.get(date);
    if (cached) return cached;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/multi-track-matchups?date=${date}`);
      if (!res.ok) return [];
      const data = await res.json();
      const bundles = Array.isArray(data.bundles) ? data.bundles : [];
      bundlesCacheRef.current.set(date, bundles);
      return bundles;
    } catch {
      return [];
    }
  }, []);

  const fetchContestTrackData = useCallback(async (contest: Contest): Promise<TrackDataCacheEntry> => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${BACKEND_URL}/api/matchups/${contest.id}?count=0`);
    if (!response.ok) {
      throw new Error(`Failed to load matchups for ${contest.track} (${contest.id})`);
    }

    const matchupsData = await response.json();
    const groups = Array.isArray(matchupsData.groups) ? matchupsData.groups : [];
    let totalMatchupCount = typeof matchupsData.totalAvailable === 'number' ? matchupsData.totalAvailable : 0;

    let finalMatchups: Matchup[] = [];
    let finalPools: Record<string, Matchup[]> = {};
    let finalDisplayCounts: Record<string, number> = {};
    let finalCursor: Record<string, number> = {};
    let finalTypes: string[] = [];
    
    // Helper to create a matchup signature for duplicate detection
    const createMatchupSignature = (matchup: any): string => {
      const setAIds = (matchup.setA?.connections || [])
        .map((c: any) => c.id || c.name)
        .sort()
        .join(',');
      const setBIds = (matchup.setB?.connections || [])
        .map((c: any) => c.id || c.name)
        .sort()
        .join(',');
      // Create signature - order doesn't matter (A,B = B,A)
      const ids = [setAIds, setBIds].sort().join('|');
      return `${matchup.matchupType || matchup.matchup_type || 'unknown'}-${ids}`;
    };

    if (groups.length > 0) {
      const poolMap: Record<string, Matchup[]> = {};
      const displayMap: Record<string, number> = {};
      const cursorSeed: Record<string, number> = {};
      const typeList: string[] = [];

      groups.forEach((group: any) => {
        const typeKey = group?.type || 'mixed';
        if (!typeList.includes(typeKey)) {
          typeList.push(typeKey);
        }
        const rawMatchups = Array.isArray(group?.matchups) ? group.matchups : [];
        const converted = rawMatchups.map((m: any, idx: number) => convertBackendMatchup(m, typeKey, idx));
        poolMap[typeKey] = converted;
        const displayCount = typeof group?.displayCount === 'number'
          ? Math.max(0, Math.min(group.displayCount, converted.length))
          : converted.length;
        displayMap[typeKey] = displayCount;
        cursorSeed[typeKey] = 0;
      });

      const { displayed, cursor } = pickMatchupsFromPools(poolMap, displayMap, cursorSeed);
      finalMatchups = displayed;
      finalPools = poolMap;
      finalDisplayCounts = displayMap;
      finalCursor = cursor;
      finalTypes = typeList;
    } else {
      const flattenedMatchups = Array.isArray(matchupsData.matchups) ? matchupsData.matchups : [];
      finalMatchups = flattenedMatchups.map((m: any, idx: number) => {
        const matchupType = m.matchup_type || m.matchupType || 'mixed';
        return convertBackendMatchup(m, matchupType, idx);
      });
      finalPools = {};
      finalDisplayCounts = {};
      finalCursor = {};
      const types = Array.isArray(matchupsData.types) ? matchupsData.types : [];
      finalTypes = types.length > 0 ? types : ['mixed'];
    }

    const connectionsForTrack = await loadAndMergeAllTracks(contest.date, contest.track);

    // NEW: Fetch and merge multi-track bundles for this date (cached)
    try {
      const bundles = await getBundlesForDate(contest.date);
      if (bundles.length > 0) {
          console.log(`[fetchContestTrackData] Found ${bundles.length} multi-track bundle(s) for ${contest.track} (${contest.date})`);
          
          // Track existing matchup signatures to prevent duplicates
          const existingSignatures = new Set<string>();
          
          // Add signatures from existing matchups
          finalMatchups.forEach(m => {
            const sig = createMatchupSignature(m);
            existingSignatures.add(sig);
          });
          
          // Track bundle matchup counts and duplicates
          let totalBundleMatchups = 0;
          let uniqueBundleMatchups = 0;
          let duplicateCount = 0;
          
          // Merge multi-track matchups into pools with duplicate detection
          bundles.forEach((bundle: any) => {
            const bundleMatchups = Array.isArray(bundle.matchups) ? bundle.matchups : [];
            const bundleCount = typeof bundle.matchup_count === 'number' ? bundle.matchup_count : bundleMatchups.length;
            
            // Track unique matchups added from this bundle
            let uniqueAdded = 0;
            
            bundleMatchups.forEach((m: any) => {
              const matchupType = m.matchupType || m.matchup_type || 'cross_track';
              
              // Check for duplicates before adding
              const sig = createMatchupSignature(m);
              if (existingSignatures.has(sig)) {
                duplicateCount++;
                return; // Skip duplicate
              }
              
              const converted = convertBackendMatchup(m, matchupType, finalMatchups.length);
              
              // Add to pools
              if (!finalPools[matchupType]) {
                finalPools[matchupType] = [];
                finalDisplayCounts[matchupType] = 0;
                finalCursor[matchupType] = 0;
                if (!finalTypes.includes(matchupType)) {
                  finalTypes.push(matchupType);
                }
              }
              
              finalPools[matchupType].push(converted);
              finalDisplayCounts[matchupType] = (finalDisplayCounts[matchupType] || 0) + 1;
              existingSignatures.add(sig);
              uniqueAdded++;
              uniqueBundleMatchups++;
            });
            
            // Add bundle's total count to total (from database metadata)
            // This ensures the count matches what's shown in admin (e.g., 86)
            totalBundleMatchups += bundleCount;
            
            if (uniqueAdded < bundleMatchups.length) {
              const skipped = bundleMatchups.length - uniqueAdded;
              console.log(`[fetchContestTrackData] Bundle: ${bundleCount} total, ${uniqueAdded} unique added, ${skipped} duplicates skipped`);
            }
          });
          
          // Add bundle total to matchup count (this matches admin page display)
          totalMatchupCount += totalBundleMatchups;
          
          if (duplicateCount > 0) {
            console.log(`[fetchContestTrackData] Total duplicates skipped: ${duplicateCount} when merging ${bundles.length} bundle(s)`);
          }
          
          // Re-pick matchups from updated pools
          const { displayed: updatedDisplayed, cursor: updatedCursor } = pickMatchupsFromPools(
            finalPools,
            finalDisplayCounts,
            finalCursor
          );
          
          finalMatchups = updatedDisplayed;
          finalCursor = updatedCursor;
          
          console.log(`[fetchContestTrackData] Total matchups after merge: ${totalMatchupCount} (individual: ${matchupsData.totalAvailable || 0}, cross-track bundles: ${totalBundleMatchups}, unique added: ${uniqueBundleMatchups})`);
      }
    } catch (bundleErr) {
      console.warn(`[fetchContestTrackData] Failed to fetch multi-track bundles for ${contest.track}:`, bundleErr);
      // Continue without bundles - not critical
    }

    const entry: TrackDataCacheEntry = {
      contestId: contest.id,
      track: contest.track,
      date: contest.date,
      matchups: finalMatchups,
      connections: connectionsForTrack,
      matchupPools: finalPools,
      displayCounts: finalDisplayCounts,
      poolCursor: finalCursor,
      availableTypes: finalTypes,
      lastUpdated: Date.now(),
      totalMatchupCount,
    };
    
    // Cache total matchup count in localStorage
    if (typeof window !== 'undefined' && totalMatchupCount > 0) {
      try {
        const counts = JSON.parse(localStorage.getItem(CACHE_KEYS.totalMatchupCounts) || '{}');
        counts[contest.id] = totalMatchupCount;
        localStorage.setItem(CACHE_KEYS.totalMatchupCounts, JSON.stringify(counts));
      } catch (e) {
        console.warn('[Cache] Failed to save total matchup count:', e);
      }
    }
    
    // Store in memory for fast track switching (no localStorage - too large and per-user)
    // In-memory cache is fast enough for instant switching within a session
    setAllTracksData(prev => {
      const updated = new Map(prev);
      updated.set(contest.track, entry);
      return updated;
    });
    
    return entry;
  }, [convertBackendMatchup, pickMatchupsFromPools, loadAndMergeAllTracks]);

  const loadData = useCallback(async () => {
    // Check if we already have data from cache before setting loading
    // This prevents showing loading screen when cache was just restored
    const hasCachedData = typeof window !== 'undefined' && 
      sessionStorage.getItem(CACHE_KEYS.matchups) && 
      sessionStorage.getItem(CACHE_KEYS.connections);
    
    // Only set loading if we don't have data AND don't have cache
    if (connections.length === 0 && matchups.length === 0 && !hasCachedData) {
      setIsLoading(true);
    }
    setError(null);
    
    // Use selected track/date from sessionStorage or defaults
    const track = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTrack') : null;
    const date = typeof window !== 'undefined' ? (sessionStorage.getItem('selectedDate') || '2025-11-02') : '2025-11-02';
    const contestId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedContestId') : null;

    const updateSelectedTracksSession = (value: string | null) => {
      if (typeof window === 'undefined') return;
      if (!value) {
        sessionStorage.removeItem('selectedTracks');
        return;
      }

      const trimmed = value.trim();
      if (!trimmed || trimmed.toLowerCase() === 'null') {
        sessionStorage.removeItem('selectedTracks');
        return;
      }

      const upper = trimmed.toUpperCase();
      const multiTokens = new Set(["ALL", "ALL_TRACKS", "MULTI"]);
      if (multiTokens.has(upper)) {
        sessionStorage.setItem('selectedTracks', JSON.stringify(FALLBACK_TRACKS));
        return;
      }

      const splitRegex = /[,\|\+]/;
      let parsed: string[] = [];

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const arr = JSON.parse(trimmed);
          if (Array.isArray(arr)) {
            parsed = arr
              .map((item: unknown) => (typeof item === "string" ? item.trim().toUpperCase() : String(item)))
              .filter(Boolean);
          }
        } catch {
          parsed = [];
        }
      } else if (splitRegex.test(trimmed)) {
        parsed = trimmed
          .split(splitRegex)
          .map((token) => token.trim().toUpperCase())
          .filter(Boolean);
      } else if (trimmed.includes(" ")) {
        parsed = trimmed
          .split(" ")
          .map((token) => token.trim().toUpperCase())
          .filter(Boolean);
      }

      if (parsed.length > 1) {
        sessionStorage.setItem('selectedTracks', JSON.stringify(parsed));
      } else {
        sessionStorage.removeItem('selectedTracks');
      }
    };

    updateSelectedTracksSession(track);
    
    try {
      // Don't clear data immediately - keep showing cached/current data while loading
      // Only clear if we're switching to a different contest/track
      const currentContestId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedContestId') : null;
      const cachedContestId = typeof window !== 'undefined' ? sessionStorage.getItem(CACHE_KEYS.cacheContestId) : null;
      const currentTrack = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTrack') : null;
      const cachedTrack = typeof window !== 'undefined' ? sessionStorage.getItem(CACHE_KEYS.cacheTrack) : null;
      
      // Only clear if contest or track changed
      if (currentContestId !== cachedContestId || currentTrack !== cachedTrack) {
        setConnections([]);
        setMatchups([]);
      }
      
      // If we have a contestId, fetch matchups from backend (new flow)
      if (contestId) {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        console.log(`[AppContext] Fetching matchups for contest ${contestId}...`);
        
        try {
          const matchupsResponse = await fetch(`${BACKEND_URL}/api/matchups/${contestId}?count=0`); // count=0 means get all
          if (matchupsResponse.ok) {
            const matchupsData = await matchupsResponse.json();
            console.log(`[AppContext] Loaded ${matchupsData.count} matchups from backend`);
            
            const groups = Array.isArray(matchupsData.groups) ? matchupsData.groups : [];
            
            let displayCountInitial = 0;
            let totalPoolCount = 0;
            let typeListForLog: string[] = [];
            let finalMatchups: Matchup[] = [];
            let finalPools: Record<string, Matchup[]> = {};
            let finalDisplayCounts: Record<string, number> = {};
            let finalCursor: Record<string, number> = {};
            
            if (groups.length > 0) {
              const poolMap: Record<string, Matchup[]> = {};
              const displayMap: Record<string, number> = {};
              const cursorSeed: Record<string, number> = {};
              const typeList: string[] = [];

              groups.forEach((group: any) => {
                const typeKey = group?.type || 'mixed';
                if (!typeList.includes(typeKey)) {
                  typeList.push(typeKey);
                }
                const rawMatchups = Array.isArray(group?.matchups) ? group.matchups : [];
                const converted = rawMatchups.map((m: any, idx: number) => convertBackendMatchup(m, typeKey, idx));
                
                poolMap[typeKey] = converted;
                const displayCount = typeof group?.displayCount === 'number'
                  ? group.displayCount
                  : converted.length;
                displayMap[typeKey] = Math.max(0, Math.min(displayCount, converted.length));
                cursorSeed[typeKey] = 0;
              });

              const { displayed, cursor: updatedCursor } = pickMatchupsFromPools(poolMap, displayMap, cursorSeed);
              
              setMatchupPools(poolMap);
              setDisplayCounts(displayMap);
              setPoolCursor(updatedCursor);
              setAvailableMatchupTypes(typeList);
              sessionStorage.setItem('availableMatchupTypes', JSON.stringify(typeList));
              setMatchups(displayed);
              
              // Store for caching
              finalMatchups = displayed;
              finalPools = poolMap;
              finalDisplayCounts = displayMap;
              finalCursor = updatedCursor;
              typeListForLog = typeList;
              
              console.log(`[AppContext] Loaded matchup pools for contest ${contestId}:`, typeList);
              
              displayCountInitial = displayed.length;
              totalPoolCount = Object.values(poolMap).reduce((sum, pool) => sum + pool.length, 0);
            } else {
              console.warn('[AppContext] Backend response missing matchup groups; falling back to flat matchups array.');
              const flattenedMatchups = Array.isArray(matchupsData.matchups) ? matchupsData.matchups : [];
              const transformedMatchups: Matchup[] = flattenedMatchups.map((m: any, idx: number) => {
                const matchupType = m.matchup_type || m.matchupType || 'mixed';
                return convertBackendMatchup(m, matchupType, idx);
              });
              
              const types = Array.isArray(matchupsData.types) ? matchupsData.types : [];
              if (types.length > 0) {
                sessionStorage.setItem('availableMatchupTypes', JSON.stringify(types));
              }
              setMatchupPools({});
              setDisplayCounts({});
              setPoolCursor({});
              setAvailableMatchupTypes(types);
              setMatchups(transformedMatchups);

              // Store for caching
              finalMatchups = transformedMatchups;
              typeListForLog = types;

              displayCountInitial = transformedMatchups.length;
              totalPoolCount = transformedMatchups.length;
            }
            
            // Also load connections from track data for the starters panel
            const loadedConnections = await loadAndMergeAllTracks(date, track);
            setConnections(loadedConnections);
            
            // NEW: Fetch and merge multi-track bundles (cached)
            try {
                const bundles = await getBundlesForDate(date);
                
                if (bundles.length > 0) {
                  console.log(`[AppContext] Found ${bundles.length} multi-track bundle(s) for date ${date}`);
                  
                  // Merge multi-track matchups into pools
                  bundles.forEach((bundle: any) => {
                    const bundleMatchups = Array.isArray(bundle.matchups) ? bundle.matchups : [];
                    const bundleTypes = Array.isArray(bundle.matchupTypes) ? bundle.matchupTypes : [];
                    
                    bundleMatchups.forEach((m: any) => {
                      const matchupType = m.matchupType || m.matchup_type || 'cross_track';
                      const converted = convertBackendMatchup(m, matchupType, finalMatchups.length);
                      
                      // Add to pools
                      if (!finalPools[matchupType]) {
                        finalPools[matchupType] = [];
                        finalDisplayCounts[matchupType] = 0;
                        finalCursor[matchupType] = 0;
                        if (!typeListForLog.includes(matchupType)) {
                          typeListForLog.push(matchupType);
                        }
                      }
                      
                      finalPools[matchupType].push(converted);
                      finalDisplayCounts[matchupType] = (finalDisplayCounts[matchupType] || 0) + 1;
                    });
                  });
                  
                  // Re-pick matchups from updated pools
                  const { displayed: updatedDisplayed, cursor: updatedCursor } = pickMatchupsFromPools(
                    finalPools,
                    finalDisplayCounts,
                    finalCursor
                  );
                  
                  finalMatchups = updatedDisplayed;
                  finalCursor = updatedCursor;
                  
                  setMatchupPools(finalPools);
                  setDisplayCounts(finalDisplayCounts);
                  setPoolCursor(finalCursor);
                  setAvailableMatchupTypes(typeListForLog);
                  setMatchups(finalMatchups);
                  
                  const bundlesCount = bundles.length;
                  const totalBundleMatchups = bundles.reduce((sum: number, b: any) => sum + (b.count || 0), 0);
                  console.log('[AppContext] Merged multi-track bundles:', bundlesCount, 'bundles,', totalBundleMatchups, 'matchups');
                }
            } catch (bundleErr) {
              console.warn('[AppContext] Failed to fetch multi-track bundles:', bundleErr);
              // Continue without bundles - not critical
            }
            
            // Save to cache with all data
            if (groups.length > 0 || Object.keys(finalPools).length > 0) {
              // Groups flow - use displayed matchups and pools
              saveToCache(finalMatchups, loadedConnections, finalPools, finalDisplayCounts, finalCursor, typeListForLog);
            } else {
              // Flat matchups flow
              saveToCache(finalMatchups, loadedConnections, {}, {}, {}, typeListForLog);
            }
            
            const displayedCount = finalMatchups.length;
            const poolTotal = Object.values(finalPools).reduce((sum, pool) => sum + pool.length, 0);
            const typesStr = (typeListForLog.join(', ') || 'none');
            console.log('✅ Loaded contest matchups', displayedCount, 'displayed /', poolTotal, 'in pool,', loadedConnections.length, 'connections, types:', typesStr);
          } else {
            console.warn(`[AppContext] Failed to fetch matchups, falling back to client-side generation`);
            throw new Error('Failed to fetch matchups');
          }
        } catch (matchupErr) {
          console.warn(`[AppContext] Error fetching matchups:`, matchupErr);
          // Fall back to old flow
          throw matchupErr;
        }
      } else {
        // Old flow: Load connections and generate matchups client-side
        const loadedConnections = await loadAndMergeAllTracks(date, track);
        setConnections(loadedConnections);
        
        // Generate initial matchups
        const initialMatchups = generateMatchups(loadedConnections, {
          count: 10,
          tolerance,
        });
        setMatchups(initialMatchups);
        
        // Save to cache
        saveToCache(initialMatchups, loadedConnections);
        
        console.log(`✅ Loaded data for ${track || 'all tracks'} on ${date} (${loadedConnections.length} connections)`);
      }
      
      // Load rounds from localStorage (only once, they don't change with track)
      // Only load if not already loaded to avoid unnecessary reads
      if (rounds.length === 0) {
        const loadedRounds = loadRounds();
        setRounds(loadedRounds);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      console.error("Error loading data:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
      }
      // Still set loading to false even on error
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, [tolerance, rounds.length]);
  
  // Track the last loaded track/date using refs (more efficient than state)
  const lastLoadedTrackRef = React.useRef<string | null>(null);
  const lastLoadedDateRef = React.useRef<string | null>(null);

  // Function to check and load data when track/date changes
  const checkAndLoadData = React.useCallback(() => {
    // Don't auto-load on admin page - tracks should be fetched via admin panel
    if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
      return;
    }
    
    const currentTrack = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTrack') : null;
    const currentContestId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedContestId') : null;
    const currentDate = typeof window !== 'undefined' ? (sessionStorage.getItem('selectedDate') || '2025-11-02') : '2025-11-02';
    
    // On matchups page, if we have a contestId but no track, that's okay - loadData will handle it
    // But if we have neither, don't load (let matchups page auto-select a contest first)
    if (!currentTrack && !currentContestId) {
      // On matchups page, wait for auto-selection
      if (typeof window !== 'undefined' && window.location.pathname === '/matchups') {
        return; // Let matchups page handle auto-selection
      }
      return; // Don't auto-load all tracks
    }
    
    if (currentTrack) {
      const trackData = allTracksData.get(currentTrack);
      if (trackData && activeTrack !== currentTrack) {
        applyTrackData(currentTrack, trackData);
        return;
      }
    }
    
    // Check if we have cached data for this contest/track
    const hasCachedData = typeof window !== 'undefined' && 
      sessionStorage.getItem(CACHE_KEYS.matchups) && 
      sessionStorage.getItem(CACHE_KEYS.connections);
    
    // If we have cached data and it matches, don't reload (cache restore already handled it)
    if (hasCachedData) {
      const cachedContestId = sessionStorage.getItem(CACHE_KEYS.cacheContestId);
      const cachedTrack = sessionStorage.getItem(CACHE_KEYS.cacheTrack);
      if ((cachedContestId === currentContestId) || (cachedTrack === currentTrack)) {
        // Cache matches, don't reload unless track/date changed
        if (currentTrack === lastLoadedTrackRef.current && currentDate === lastLoadedDateRef.current) {
          return; // Cache is valid and already loaded
        }
      }
    }
    
    // Don't reload if we're currently loading - prevents duplicate loads
    // BUT allow if we have no data at all (first load)
    if (isLoading && (connections.length > 0 || matchups.length > 0)) {
      return;
    }
    
    // If track/date changed, reload data
    if (currentTrack !== lastLoadedTrackRef.current || currentDate !== lastLoadedDateRef.current) {
      lastLoadedTrackRef.current = currentTrack;
      lastLoadedDateRef.current = currentDate;
      loadData();
    } else if (connections.length === 0 && matchups.length === 0 && (currentTrack || currentContestId)) {
      // Initial load if track or contest is selected AND we have no data
      console.log('[AppContext] First-time load: no data, loading...');
      loadData();
    }
    // If we already have data and track/date haven't changed, don't reload
  }, [loadData, connections.length, matchups.length, isLoading, allTracksData, applyTrackData, activeTrack]);

  // Restore from cache on mount FIRST, then load fresh data
  useEffect(() => {
    // Try to restore from cache synchronously
    const restored = restoreFromCache();
    
    if (restored) {
      // Cache restored - loading is already set to false by restoreFromCache
      console.log('[AppContext] Cache restored, skipping initial load');
      // Don't call checkAndLoadData immediately - let it run in the next effect if needed
    } else {
      // No cache found - need to load data
      console.log('[AppContext] No cache found, loading data...');
      checkAndLoadData();
    }
  }, [restoreFromCache, checkAndLoadData]);

  // Listen for custom event when sessionStorage changes (from lobby page)
  useEffect(() => {
    const handleTrackChange = () => {
      checkAndLoadData();
    };
    const handleBundlesUpdated = (e: Event) => {
      try {
        const date = (e as CustomEvent)?.detail?.date as string | undefined;
        if (date) {
          bundlesCacheRef.current.delete(date);
          console.log('[AppContext] Multi-track bundles updated; clearing cache for date:', date);
          checkAndLoadData();
        }
      } catch {
        checkAndLoadData();
      }
    };

    // Listen for custom event
    window.addEventListener('trackDataChanged', handleTrackChange);
    window.addEventListener('multiTrackBundlesUpdated', handleBundlesUpdated as EventListener);
    
    // Also check when page becomes visible (user navigates back)
    // Only reload if we don't have data - don't reload just because tab became visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only reload if we have no connections/matchups (data is missing)
        // Don't reload if data already exists - this prevents unnecessary reloads when switching tabs
        // Also check if we're not already loading to prevent duplicate loads
        if (connections.length === 0 && matchups.length === 0 && !isLoading) {
          checkAndLoadData();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('trackDataChanged', handleTrackChange);
      window.removeEventListener('multiTrackBundlesUpdated', handleBundlesUpdated as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAndLoadData, connections.length, matchups.length, isLoading]);
  
  const regenerateMatchups = useCallback((options?: MatchupGenerationOptions) => {
    if (Object.keys(matchupPools).length > 0) {
      const { displayed, cursor: updatedCursor} = pickMatchupsFromPools(matchupPools, displayCounts, poolCursor);
      setMatchups(displayed);
      setPoolCursor(updatedCursor);
      return;
    }

    if (connections.length === 0) return;
    
    const newMatchups = generateMatchups(connections, {
      count: 10,
      tolerance,
      ...options,
    });
    setMatchups(newMatchups);
  }, [matchupPools, displayCounts, poolCursor, pickMatchupsFromPools, connections, tolerance]);
  
  // NEW: Regenerate only specific matchup type
  const regenerateMatchupType = useCallback(async (matchupType: string) => {
    console.log(`[Reload] Regenerating ${matchupType} matchups only`);
    
    // Check if we have pools
    if (Object.keys(matchupPools).length === 0) {
      console.warn('[Reload] No matchup pools available, cannot reload specific type');
      return;
    }
    
    const pool = matchupPools[matchupType];
    if (!pool || pool.length === 0) {
      console.warn(`[Reload] No pool found for ${matchupType}`);
      return;
    }
    
    const displayCount = displayCounts[matchupType] || 10;
    const currentCursor = poolCursor[matchupType] || 0;
    
    // Pick next batch from pool
    const nextCursor = currentCursor + displayCount;
    const newMatchups = pool.slice(currentCursor, nextCursor);
    
    console.log(`[Reload] Picked ${newMatchups.length} new ${matchupType} matchups (cursor: ${currentCursor} → ${nextCursor})`);
    
    // Update matchups: remove old ones of this type, add new ones
    setMatchups(prev => {
      const filtered = prev.filter(m => {
        const type = m.matchupType || (m as any).matchup_type;
        return type !== matchupType;
      });
      
      return [...filtered, ...newMatchups];
    });
    
    // Update cursor
    setPoolCursor(prev => ({
      ...prev,
      [matchupType]: nextCursor >= pool.length ? 0 : nextCursor // Wrap around if at end
    }));
    
    // Update cache
    saveToCache();
  }, [matchupPools, displayCounts, poolCursor, saveToCache]);
  
  const handleSetTolerance = useCallback((newTolerance: number) => {
    setTolerance(newTolerance);
    // Regenerate matchups with new tolerance only in fallback mode
    if (Object.keys(matchupPools).length === 0 && connections.length > 0) {
      const newMatchups = generateMatchups(connections, {
        count: 10,
        tolerance: newTolerance,
      });
      setMatchups(newMatchups);
    }
  }, [connections, matchupPools]);
  
  // Update bankroll in Supabase and local state (defined before submitRound)
  const updateBankroll = useCallback(async (amount: number) => {
    setBankroll(amount);
    
    // Update in Supabase if user is logged in
    if (profile?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ bankroll: amount })
          .eq('id', profile.id);
        
        if (error) {
          console.error('Error updating bankroll in Supabase:', error);
        } else {
          console.log('✅ Bankroll updated in Supabase:', amount);
          // Refresh profile to sync
          await refreshProfile();
        }
      } catch (err) {
        console.error('Error updating bankroll:', err);
      }
    }
  }, [profile?.id, refreshProfile]);
  
  const submitRound = useCallback(async (
    picks: RoundPick[], 
    entryAmount: number, 
    isFlex: boolean,
    selectedCount: number,
    multiplierSchedule: Record<number, { standard: number; flexAllWin: number; flexOneMiss: number }>
  ) => {
    if (matchups.length === 0 || entryAmount <= 0 || entryAmount > bankroll) return;
    
    try {
      // Detect if picks are from multiple tracks
      const picksWithTracks = picks.map(pick => {
        const matchup = matchups.find(m => m.id === pick.matchupId);
        if (!matchup) return null;
        
        // Get track from matchup
        const track = matchup.setA?.connections?.[0]?.trackSet?.[0] || 
                     matchup.setA?.connections?.[0]?.starters?.[0]?.track ||
                     matchup.setA?.connections?.[0]?.track;
        return { ...pick, track };
      }).filter(Boolean);
      
      const uniqueTracks = new Set(picksWithTracks.map(p => p?.track).filter(Boolean));
      const isMultiTrack = uniqueTracks.size > 1;
      
      console.log('[AppContext] Picks analysis:', {
        totalPicks: picks.length,
        uniqueTracks: Array.from(uniqueTracks),
        isMultiTrack
      });
      
      let contestId: string | null = null;
      const date = sessionStorage.getItem('selectedDate') || contests[0]?.date;
      
      if (isMultiTrack) {
        // Multi-track picks - create or get ALL TRACKS contest
        console.log('[AppContext] Multi-track picks detected, creating ALL TRACKS contest...');
        
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        
        try {
          const allTracksResponse = await fetch(`${BACKEND_URL}/api/all-tracks-contest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date }),
          });
          
          if (!allTracksResponse.ok) {
            const errorText = await allTracksResponse.text();
            console.error('[AppContext] ALL TRACKS API error:', errorText);
            throw new Error('Failed to create ALL TRACKS contest: ' + errorText);
          }
          
          const allTracksData = await allTracksResponse.json();
          contestId = allTracksData.contest.id;
          
          console.log('[AppContext] Using ALL TRACKS contest:', contestId, allTracksData);
        } catch (error) {
          console.error('[AppContext] Error creating ALL TRACKS contest:', error);
          alert('Failed to create multi-track contest. Using fallback contest.');
          // Fallback to first contest
          contestId = sessionStorage.getItem('selectedContestId') || contests[0]?.id;
        }
      } else {
        // Single track picks - use existing logic
        contestId = sessionStorage.getItem('selectedContestId');
      
      // If no contestId, try to get from contests list based on track
      if (!contestId) {
        const selectedTrack = sessionStorage.getItem('selectedTrack');
        if (selectedTrack && selectedTrack !== 'all' && selectedTrack !== 'cross_tracks') {
          // Try to find contest for this track
          const trackContest = contests.find(c => c.track === selectedTrack.toUpperCase() && c.hasData);
          if (trackContest) {
            contestId = trackContest.id;
          }
        }
        
        // If still no contestId, use first available contest
        if (!contestId && contests.length > 0) {
          const firstContest = contests.find(c => c.hasData) || contests[0];
          contestId = firstContest.id;
          }
        }
      }
      
      if (!contestId) {
        throw new Error('No contest available. Please select a track with an active contest.');
      }

      // Store multiplier schedule data for settlement (will calculate actual multiplier based on correct picks)
      // For now, we'll store the max possible multiplier, but settlement will recalculate based on actual results
      const scheduled = multiplierSchedule[selectedCount as keyof typeof multiplierSchedule];
      const maxMultiplier = scheduled 
        ? (isFlex ? scheduled.flexAllWin : scheduled.standard)
        : 2; // Default fallback
      
      // Submit entry to backend
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Log the picks being submitted
      const picksToSubmit = picks.map(p => ({ matchupId: p.matchupId, side: p.chosen }));
      console.log('[AppContext] Submitting picks:', picksToSubmit);
      
      const response = await fetch(`${BACKEND_URL}/api/entries/${contestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile?.id,
          picks: picksToSubmit,
          entryAmount,
          isFlex: isFlex, // Pass flex option
          pickCount: selectedCount, // Number of picks selected
          multiplierSchedule: multiplierSchedule, // Full schedule for settlement calculation
          multiplier: maxMultiplier, // Max possible multiplier (for display, actual calculated at settlement)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit entry');
      }

      const { entry, newBankroll } = await response.json();
      
      // Update local bankroll to match backend
      setBankroll(newBankroll);
      
      // Store round locally for history (temporary until we fetch from backend)
      const round: Round = {
        id: entry.id || `round-${Date.now()}`,
        createdAt: new Date().toISOString(),
        matchups: matchups.map(m => ({
          ...m,
          setA: { ...m.setA, connections: m.setA.connections.map(c => ({ ...c })) },
          setB: { ...m.setB, connections: m.setB.connections.map(c => ({ ...c })) },
        })),
        picks,
        entryAmount,
        winnings: 0, // Will be updated when contest settles
        multiplier: maxMultiplier,
      };
      
      saveRound(round);
      setRounds(prev => [round, ...prev].slice(0, 50));
      
      // Regenerate matchups for next round (if still in practice mode)
      if (connections.length > 0) {
        const newMatchups = generateMatchups(connections, {
          count: 10,
          tolerance,
        });
        setMatchups(newMatchups);
      }
      
    } catch (error) {
      console.error('Error submitting entry:', error);
      throw error;
    }
  }, [matchups, bankroll, profile?.id, connections, tolerance, contests]);
  
  // Load contests from backend (load once, keep in memory)
  const loadContests = useCallback(async (force = false) => {
    // If already loaded and not forcing, don't reload
    // FIXED: Also skip if contestsLoaded is true, even if contests.length === 0 (prevents infinite loop)
    // Only reload if force=true OR contestsLoaded=false (initial load)
    if (!force && contestsLoaded) {
      console.log(`⏭️ Contests already loaded (${contests.length} contests), skipping...`);
      // Ensure loading state is false if we're skipping
      setContestsLoading(false);
      return;
    }
    
    setContestsLoading(true);
    setContestsError(null); // Clear any previous errors
    
    // Reset loaded flag when forcing reload to ensure fresh data
    if (force) {
      setContestsLoaded(false);
      // Clear all track data when force reloading to prevent stale data conflicts
      setAllTracksData(new Map());
      setConnections([]);
      setMatchups([]);
      setAvailableMatchupTypes([]);
      setTotalMatchupCount(undefined);
      setActiveTrack(null);
      console.log('[AppContext] Cleared all track data for fresh contest reload');
    }
    
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const operationId = `contest-load-${Date.now()}`;
    
    console.log(`[${operationId}] 🔍 Loading contests from backend...`);
    console.log(`[${operationId}] Current state: contestsLoading=${true}, contests.length=${contests.length}, contestsLoaded=${contestsLoaded}`);
    
    // Safety timeout: if loading takes more than 10 seconds, force stop
    const safetyTimeout = setTimeout(() => {
      console.warn(`[${operationId}] ⚠️ Contest loading timeout, forcing stop`);
      setContestsLoading(false);
    }, 10000);
    
    try {
      
      // Get active contests from backend with retry
      const { retryWithBackoff } = await import('@/lib/api/retry');
      const response = await retryWithBackoff(
        () => fetch(`${BACKEND_URL}/api/contests`),
        {
          maxAttempts: 3,
          baseDelay: 1000,
          onRetry: (attempt, error) => {
            console.warn(`[${operationId}] ⚠️ Retry attempt ${attempt}:`, error.message);
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const configuredContests = data.contests || [];
      
      console.log(`[${operationId}] 📊 Backend returned ${configuredContests.length} contests`);
      if (configuredContests.length > 0) {
        console.log(`[${operationId}] Sample contest data:`, JSON.stringify(configuredContests[0], null, 2));
      }
      
      // Transform contests directly - don't check entries (that's slow and blocks UI)
      // The backend already verified the contest exists and is active
      const availableContests: Contest[] = configuredContests.map((config: any) => {
        const horsesCount = config.horsesCount || config.horses_count || 0;
        console.log(`[${operationId}] Contest ${config.id}: horsesCount=${horsesCount}`);
        return {
          id: config.id,
          track: config.track,
          trackName: config.trackName,
          date: config.date,
          hasData: true, // Assume data exists if contest is active
          entryCount: horsesCount, // Use horse count from backend
          firstPostTime: config.firstPostTime || config.first_post_time || null,
          lastPostTime: config.lastPostTime || config.last_post_time || null,
          lockTime: config.lockTime || config.lock_time || null,
          lifecycleStatus: config.lifecycleStatus || config.lifecycle_status || null,
          status: config.status || null,
        };
      });
      
      console.log(`[${operationId}] Setting contests state: ${availableContests.length} contests`);
      clearTimeout(safetyTimeout); // Clear safety timeout
      
      // Check if contests have changed (different IDs) - if so, clear old track data
      const previousContestIds = new Set(contests.map(c => c.id));
      const newContestIds = new Set(availableContests.map(c => c.id));
      const contestsChanged = previousContestIds.size > 0 && (
        previousContestIds.size !== newContestIds.size ||
        !Array.from(previousContestIds).every(id => newContestIds.has(id))
      );
      
      if (contestsChanged && contests.length > 0) {
        console.log(`[${operationId}] Contests changed - clearing old track data to prevent conflicts`);
        setAllTracksData(new Map());
        setConnections([]);
        setMatchups([]);
        setAvailableMatchupTypes([]);
        setTotalMatchupCount(undefined);
        setActiveTrack(null);
        
        // Clear sessionStorage cache
        if (typeof window !== 'undefined') {
          try {
            Object.values(CACHE_KEYS).forEach(key => {
              sessionStorage.removeItem(key);
            });
            sessionStorage.removeItem('selectedContestId');
            sessionStorage.removeItem('selectedDate');
            console.log(`[${operationId}] Cleared cached data - contests changed`);
          } catch (e) {
            console.warn(`[${operationId}] Failed to clear cache:`, e);
          }
        }
      }
      
      setContests(availableContests);
      setContestsLoaded(true); // Mark as loaded after successful fetch (even if 0 contests)
      console.log(`[${operationId}] Setting contestsLoading to false`);
      setContestsLoading(false);
      console.log(`[${operationId}] ✅ Loaded ${availableContests.length} contests into memory (contestsLoaded=true to prevent retry loop)`);
    } catch (error) {
      clearTimeout(safetyTimeout); // Clear safety timeout on error
      const errorMessage = error instanceof Error ? error.message : 'Failed to load contests';
      console.error(`[${operationId}] ❌ Error loading contests:`, error);
      setContestsError(errorMessage);
      setContestsLoading(false);
      setContestsLoaded(false); // Allow retry on error
    }
  }, [contestsLoaded]); // Only depend on contestsLoaded - contests.length changes shouldn't recreate callback

  // Clear data when contests become empty (prevent stale data)
  useEffect(() => {
    if (contests.length === 0 && contestsLoaded) {
      console.log('[AppContext] No contests available - clearing all track data');
      setAllTracksData(new Map());
      setConnections([]);
      setMatchups([]);
      setAvailableMatchupTypes([]);
      setTotalMatchupCount(undefined);
      setActiveTrack(null);
    }
  }, [contests.length, contestsLoaded]);

  // Pre-load all active contests in parallel for instant track switching
  useEffect(() => {
    if (!contestsLoaded || contests.length === 0) return;

    const tracksToLoad = contests.filter(contest => !allTracksData.has(contest.track));
    if (tracksToLoad.length === 0) return;

    let cancelled = false;
    const shouldShowSpinner = connections.length === 0 && matchups.length === 0;
    if (shouldShowSpinner) {
      setIsLoading(true);
    }

    setTrackLoadingStates(prev => {
      const next = { ...prev };
      tracksToLoad.forEach(contest => {
        next[contest.track] = {
          loading: true,
          hasData: Boolean(prev[contest.track]?.hasData) || Boolean(allTracksData.get(contest.track)),
        };
      });
      return next;
    });

    // Pre-load all tracks in parallel for instant switching
    // This uses in-memory caching (fast) + backend API (Redis-cached)
    const preload = async () => {
      try {
        console.log(`⚡ Pre-loading ${tracksToLoad.length} tracks in parallel...`);
        const results = await Promise.allSettled(tracksToLoad.map(fetchContestTrackData));
        if (cancelled) return;

        const successfulEntries: TrackDataCacheEntry[] = [];
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successfulEntries.push(result.value);
          } else {
            console.warn('[AppContext] Failed to preload track data:', result.reason);
          }
        });

        setAllTracksData(prev => {
          const updated = new Map(prev);
          successfulEntries.forEach(entry => {
            updated.set(entry.track, entry);
          });
          // Keep in memory only - localStorage would be too large
          return updated;
        });

        setTrackLoadingStates(prev => {
          const next = { ...prev };
          tracksToLoad.forEach(contest => {
            const success = successfulEntries.some(entry => entry.track === contest.track);
            next[contest.track] = {
              loading: false,
              hasData: success || Boolean(prev[contest.track]?.hasData),
            };
          });
          return next;
        });

        if (!activeTrack) {
          const sessionTrack = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTrack') : null;
          // Default to first track if no session track or if session track is 'all'
          const preferredTrack =
            (sessionTrack && sessionTrack !== 'all' && sessionTrack !== 'null' && successfulEntries.find(entry => entry.track === sessionTrack)?.track) ||
            successfulEntries[0]?.track ||
            contests[0]?.track;

          const entry = successfulEntries.find(item => item.track === preferredTrack);
          if (entry) {
            applyTrackData(preferredTrack, entry);
          } else if (shouldShowSpinner) {
            setIsLoading(false);
          }
        } else if (shouldShowSpinner) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AppContext] Error preloading track data:', error);
        setTrackLoadingStates(prev => {
          const next = { ...prev };
          tracksToLoad.forEach(contest => {
            next[contest.track] = {
              loading: false,
              hasData: Boolean(prev[contest.track]?.hasData) || Boolean(allTracksData.get(contest.track)),
            };
          });
          return next;
        });
        if (shouldShowSpinner) {
          setIsLoading(false);
        }
      }
    };

    preload();

    return () => {
      cancelled = true;
    };
  }, [contestsLoaded, contests, allTracksData, fetchContestTrackData, connections.length, matchups.length, activeTrack, applyTrackData]);

  const refreshTrackData = useCallback(async (track: string) => {
    const contest = contests.find(c => c.track === track);
    if (!contest) {
      console.warn(`[AppContext] Cannot refresh track ${track} - contest not found`);
      return;
    }

    setTrackLoadingStates(prev => ({
      ...prev,
      [track]: {
        loading: true,
        hasData: Boolean(prev[track]?.hasData) || Boolean(allTracksData.get(track)),
      },
    }));

    try {
      const entry = await fetchContestTrackData(contest);
      setAllTracksData(prev => {
        const updated = new Map(prev);
        updated.set(track, entry);
        return updated;
      });

      if (activeTrack === track) {
        applyTrackData(track, entry);
      }

      setTrackLoadingStates(prev => ({
        ...prev,
        [track]: { loading: false, hasData: true },
      }));
    } catch (error) {
      console.error(`[AppContext] Failed to refresh track ${track}:`, error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('appToast', {
          detail: {
            type: 'error',
            message: `Unable to reload ${track} right now. Using last good data.`,
          },
        }));
      }
      setTrackLoadingStates(prev => ({
        ...prev,
        [track]: {
          loading: false,
          hasData: Boolean(prev[track]?.hasData) || Boolean(allTracksData.get(track)),
        },
      }));
    }
  }, [contests, fetchContestTrackData, allTracksData, activeTrack, applyTrackData]);
  
  // Listen for contest changes from admin panel
  // FIXED: Use ref to store latest loadContests to avoid stale closures
  const loadContestsRef = useRef(loadContests);
  useEffect(() => {
    loadContestsRef.current = loadContests;
  }, [loadContests]);
  
  useEffect(() => {
    const handleContestChange = () => {
      console.log('🔄 Contest change detected, refreshing contests...');
      // Reset flags to allow reload
      setContestsLoaded(false);
      // Clear ALL cached data to prevent stale data conflicts
      setAllTracksData(new Map());
      setConnections([]);
      setMatchups([]);
      setAvailableMatchupTypes([]);
      setTotalMatchupCount(undefined);
      setMatchupPools({});
      setDisplayCounts({});
      setPoolCursor({});
      
      // Clear sessionStorage cache to prevent stale data
      if (typeof window !== 'undefined') {
        try {
          Object.values(CACHE_KEYS).forEach(key => {
            sessionStorage.removeItem(key);
          });
          sessionStorage.removeItem('selectedContestId');
          sessionStorage.removeItem('selectedTrack');
          sessionStorage.removeItem('selectedDate');
          console.log('[AppContext] Cleared all cached data after contest change');
        } catch (e) {
          console.warn('[AppContext] Failed to clear cache:', e);
        }
      }
      
      // Force refresh contests using ref (always latest version)
      loadContestsRef.current(true);
    };

    const handleMultiTrackBundlesUpdated = () => {
      console.log('[AppContext] Multi-track bundles updated, reloading contests...');
      // Multi-track bundles affect contests, so reload
      setContestsLoaded(false);
      loadContestsRef.current(true); // Use ref to always get latest version
    };

    window.addEventListener('contestChanged', handleContestChange);
    window.addEventListener('trackChanged', handleContestChange);
    window.addEventListener('multiTrackBundlesUpdated', handleMultiTrackBundlesUpdated);

    return () => {
      window.removeEventListener('contestChanged', handleContestChange);
      window.removeEventListener('trackChanged', handleContestChange);
      window.removeEventListener('multiTrackBundlesUpdated', handleMultiTrackBundlesUpdated);
    };
    // FIXED: Remove loadContests dependency - handleContestChange uses loadContests directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only set up event listeners once on mount
  
  // Load contests immediately on app mount (background, non-blocking)
  // FIXED: Only load once on mount, not every time loadContests callback changes
  const hasLoadedContestsRef = useRef(false);
  useEffect(() => {
    // Only load contests once on initial mount (if not already loaded)
    if (!hasLoadedContestsRef.current && !contestsLoaded) {
      hasLoadedContestsRef.current = true;
    loadContests();
    }
  }, []); // Empty deps - only run once on mount
  
  // Load bankroll from Supabase profile when profile changes
  useEffect(() => {
    if (profile?.bankroll !== undefined) {
      setBankroll(profile.bankroll);
      console.log('✅ Bankroll loaded from Supabase profile:', profile.bankroll);
    } else if (!profile) {
      // If no profile, use default (for non-logged-in users)
      setBankroll(1000);
    }
  }, [profile?.bankroll, profile]);
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    connections,
    matchups,
    rounds,
    contests,
    tolerance,
    isLoading,
    contestsLoading,
    contestsError,
    error,
    bankroll,
    availableMatchupTypes,
    trackLoadingStates,
    totalMatchupCount,
    loadData,
    loadContests,
    regenerateMatchups,
    regenerateMatchupType,
    refreshTrackData,
    setTolerance: handleSetTolerance,
    submitRound,
    updateBankroll,
  }), [connections, matchups, rounds, contests, tolerance, isLoading, contestsLoading, contestsError, error, bankroll, availableMatchupTypes, trackLoadingStates, totalMatchupCount, loadData, loadContests, regenerateMatchups, regenerateMatchupType, refreshTrackData, handleSetTolerance, submitRound, updateBankroll]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

