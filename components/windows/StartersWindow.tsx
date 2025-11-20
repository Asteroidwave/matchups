"use client";

import { useEffect, useMemo, useState } from "react";
import { Connection, Starter } from "@/types";
import { Card } from "@/components/ui/card";

interface ConnectionColor {
  bg: string;
  bgLight: string;
  border: string;
  text: string;
  textLight: string;
}

interface StartersWindowProps {
  readonly connections: Connection[];
  readonly selectedConnection: Connection | null;
  readonly selectedConnectionIds?: Set<string>; // Multi-select support
  readonly connectionColorMap?: Map<string, ConnectionColor>; // Map of connection ID to color
  readonly onConnectionClick: (connection: Connection | null) => void;
  readonly onConnectionBoxClick?: (connection: Connection) => void;
  readonly matchups?: Array<{ setA: { connections: Connection[] }; setB: { connections: Connection[] } }>;
  readonly onConnectionClickToMatchup?: (connectionId: string, fromConnectedHorsesView: boolean) => void;
  readonly activeMatchupType?: string;
  readonly onRemoveConnectionFilter?: (connectionId: string) => void;
  readonly onClearAllFilters?: (options?: { keepConnectedView?: boolean }) => void;
  readonly viewMode: "horses" | "connected";
  readonly onViewModeChange?: (mode: "horses" | "connected") => void;
  readonly selectedTrack?: string; // Track selected from matchups page
}

const DEFAULT_TRACK_COLOR = { bg: "bg-slate-500/10", border: "border-slate-500", text: "text-slate-700" };

const trackColors: Record<string, { bg: string; border: string; text: string }> = {
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-700" },
  GP: { bg: "bg-green-500/10", border: "border-green-500", text: "text-green-700" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500", text: "text-purple-700" },
  SA: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-700" },
  CD: { bg: "bg-yellow-500/10", border: "border-yellow-500", text: "text-yellow-700" },
  DMR: { bg: "bg-indigo-500/10", border: "border-indigo-500", text: "text-indigo-700" },
  LRL: { bg: "bg-pink-500/10", border: "border-pink-500", text: "text-pink-700" },
  MNR: { bg: "bg-orange-500/10", border: "border-orange-500", text: "text-orange-700" },
  IND: { bg: "bg-sky-500/10", border: "border-sky-500", text: "text-sky-700" },
};

const ROLE_BADGE_STYLES: Record<"jockey" | "trainer" | "sire", { label: string; className: string }> = {
  jockey: { label: "J", className: "bg-blue-600 text-white" },
  trainer: { label: "T", className: "bg-green-600 text-white" },
  sire: { label: "S", className: "bg-amber-500 text-white" },
};

export function StartersWindow({
  connections,
  selectedConnection,
  selectedConnectionIds = new Set(),
  connectionColorMap = new Map(),
  onConnectionClick,
  onConnectionBoxClick,
  matchups = [],
  onConnectionClickToMatchup,
  activeMatchupType = "all",
  onRemoveConnectionFilter,
  onClearAllFilters,
  viewMode,
  onViewModeChange,
  selectedTrack: selectedTrackProp,
}: StartersWindowProps) {
  // Debug: log when viewMode prop changes
  useEffect(() => {
    console.log('[StartersWindow] viewMode prop changed to:', viewMode);
  }, [viewMode]);
  
  // Get selected track from sessionStorage (set in lobby)
  const selectedTrackFromLobby = typeof window !== 'undefined' ? sessionStorage.getItem('selectedTrack') : null;
  const selectedTracksStored = typeof window !== 'undefined'
    ? sessionStorage.getItem('selectedTracks') || sessionStorage.getItem('selectedTrackList')
    : null;
  const selectedDateFromLobby = typeof window !== 'undefined' ? sessionStorage.getItem('selectedDate') : null;

  const trackSplitRegex = /[,\|\+]/;
  const multiTrackTokens = new Set(["ALL", "ALL_TRACKS", "MULTI"]);

  const parseTrackSelection = (value?: string | null): string[] => {
    if (!value) return [];
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "null") return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
            .filter(Boolean);
        }
      } catch {
        // fall through to other parsing strategies
      }
    }
    if (trackSplitRegex.test(trimmed)) {
      return trimmed
        .split(trackSplitRegex)
        .map((token) => token.trim().toUpperCase())
        .filter(Boolean);
    }
    if (trimmed.includes(" ")) {
      return trimmed
        .split(" ")
        .map((token) => token.trim().toUpperCase())
        .filter(Boolean);
    }
    return [trimmed.toUpperCase()];
  };

  const parsedStoredTracks = parseTrackSelection(selectedTracksStored);
  const parsedLobbyTrack = parseTrackSelection(selectedTrackFromLobby);
  const normalizedTrackList = parsedStoredTracks.length > 0 ? parsedStoredTracks : parsedLobbyTrack;

  const isMultiTrackSelection =
    normalizedTrackList.length > 1 ||
    (selectedTrackFromLobby
      ? multiTrackTokens.has(selectedTrackFromLobby.trim().toUpperCase())
      : false);

  // Use prop if provided, otherwise fall back to sessionStorage
  const [selectedTrack, setSelectedTrack] = useState<string>(
    selectedTrackProp 
      ? (selectedTrackProp === 'all' ? 'ALL' : selectedTrackProp.toUpperCase())
      : (!isMultiTrackSelection && selectedTrackFromLobby
      ? selectedTrackFromLobby
          : "ALL")
  );
  
  // Update selectedTrack when prop changes
  useEffect(() => {
    if (selectedTrackProp) {
      const normalized = selectedTrackProp === 'all' ? 'ALL' : selectedTrackProp.toUpperCase();
      if (normalized !== selectedTrack) {
        setSelectedTrack(normalized);
      }
    }
  }, [selectedTrackProp, selectedTrack]);
  
  // For Connected Horses view, we need ALL matchups to determine which connections appear
  // For regular view, filter by activeMatchupType
  const filteredMatchups = useMemo(() => {
    if (!Array.isArray(matchups)) {
      return [];
    }
    // Always use all matchups to determine which connections are in matchups
    // This ensures Connected Horses view shows all connections that appear in any matchup
    return matchups;
  }, [matchups]);
  
  // Get all connection IDs that are in matchups (for "Connected Horses" filter)
  const matchupConnections = useMemo(() => {
    const ids = new Set<string>();
    const keys = new Set<string>();

    const trackConnection = (conn: Connection | undefined | null) => {
      if (!conn) return;
      if (conn.id) {
        ids.add(conn.id);
      }
      if (conn.name) {
        keys.add(`${conn.role}|${conn.name}`);
      }
    };

    for (const matchup of filteredMatchups) {
      for (const conn of matchup.setA.connections) {
        trackConnection(conn);
      }
      for (const conn of matchup.setB.connections) {
        trackConnection(conn);
      }
    }

    return { ids, keys };
  }, [filteredMatchups]);
  
  // Get connection ID by name and role (for highlighting in starters)
  const connectionById = useMemo(() => {
    const map = new Map<string, Connection>();
    for (const conn of connections) {
      if (conn?.id) {
        map.set(conn.id, conn);
      }
    }
    return map;
  }, [connections]);

  const selectedConnectionIdArray = useMemo(
    () => Array.from(selectedConnectionIds || new Set<string>()),
    [selectedConnectionIds]
  );

  const selectedConnectionsList = useMemo(() => {
    const list: Connection[] = [];
    for (const id of selectedConnectionIdArray) {
      const conn = connectionById.get(id);
      if (conn) {
        list.push(conn);
      }
    }
    if (selectedConnection && selectedConnection.id && !list.some((conn) => conn.id === selectedConnection.id)) {
      list.unshift(selectedConnection);
    }
    return list;
  }, [selectedConnectionIdArray, connectionById, selectedConnection]);

  const selectedConnectionKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const conn of selectedConnectionsList) {
      if (conn?.name) {
        set.add(`${conn.role}|${conn.name}`);
      }
    }
    return set;
  }, [selectedConnectionsList]);

  const hasConnectionFilters = selectedConnectionsList.length > 0;

  const isConnectionSelected = (role: "jockey" | "trainer" | "sire", name?: string | null) => {
    if (!name) return false;
    return selectedConnectionKeySet.has(`${role}|${name}`);
  };

  // Get color for a selected connection by name and role
  const getConnectionColor = (role: "jockey" | "trainer" | "sire", name?: string | null) => {
    if (!name) return null;
    // Try to find connection by name and role
    const conn = connections.find(c => c.name === name && c.role === role);
    if (conn?.id && connectionColorMap.has(conn.id)) {
      const color = connectionColorMap.get(conn.id);
      return color || null;
    }
    // Also check connectionColorMap directly in case connection lookup fails
    for (const [connId, color] of connectionColorMap.entries()) {
      const connById = connectionById.get(connId);
      if (connById?.name === name && connById?.role === role) {
        return color;
      }
    }
    return null;
  };

  const shouldHighlightConnected = (role: "jockey" | "trainer" | "sire", name?: string | null) => {
    if (viewMode !== "connected" || !name) return false;
    if (!isConnectionInMatchups(name, role)) return false;
    if (hasConnectionFilters) {
      return !isConnectionSelected(role, name);
    }
    return true;
  };

  const getConnectionIdByName = (name: string, role: "jockey" | "trainer" | "sire") => {
    return connections.find(c => c.name === name && c.role === role)?.id;
  };
  
  // Check if a connection name matches any connection in matchups
  const isConnectionInMatchups = (name: string, role: "jockey" | "trainer" | "sire") => {
    if (!name) return false;
    const connId = getConnectionIdByName(name, role);
    if (connId && matchupConnections.ids.has(connId)) {
      return true;
    }
    return matchupConnections.keys.has(`${role}|${name}`);
  };

  const connectionAppearsInMatchups = (conn?: Connection | null) => {
    if (!conn) return false;
    if (conn.id && matchupConnections.ids.has(conn.id)) return true;
    if (conn.name && matchupConnections.keys.has(`${conn.role}|${conn.name}`)) return true;
    return false;
  };
  
  // Handle view mode changes
  const handleViewModeChange = (mode: "horses" | "connected") => {
    console.log('[StartersWindow] handleViewModeChange called:', { mode, currentViewMode: viewMode });
    
    if (mode === "horses") {
      // Switching to Horses view - just notify parent
      console.log('[StartersWindow] Calling onViewModeChange with horses');
      onViewModeChange?.("horses");
      return;
    }

    // Switching to Connected Horses view
    if (viewMode === "connected") {
      // Already in Connected Horses - toggle it off
      console.log('[StartersWindow] Already in connected, toggling off');
      onViewModeChange?.("horses");
      return;
    }

    // Switch to Connected Horses view - just notify parent
    console.log('[StartersWindow] Calling onViewModeChange with connected');
    onViewModeChange?.("connected");
  };
  
  // When selectedConnection changes and we're in horses view, stay in horses view (filter mode)
  // This ensures the button shows "Horses" when filtering by a connection in default view
  
  // Handle connection name click in starters panel (when in Connected Horses view)
  const handleConnectionNameClickInStarters = (name: string, role: "jockey" | "trainer" | "sire") => {
    const connId = getConnectionIdByName(name, role);
    if (!connId || !onConnectionClickToMatchup) return;

    const fromConnected = viewMode === "connected";
    
    // Add prominent highlight to clicked connection name in starters panel
    // First, remove any existing click highlights from ALL connections
    const allClickableElements = document.querySelectorAll('[data-connection-clickable]');
    allClickableElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.classList.remove('!bg-blue-200', '!border-blue-600', 'shadow-md');
      }
    });
    
    // Then add highlight to clicked connection - find the clickable container
    const clickedElement = document.querySelector(`[data-connection-clickable="${role}"][data-connection-value="${name}"]`);
    if (clickedElement instanceof HTMLElement) {
      // Use a solid light blue background (like the working example)
      clickedElement.classList.add('!bg-blue-200', '!border-blue-600', 'shadow-md');
      console.log('[StartersWindow] Highlighted clicked connection:', name);
    }
    
    onConnectionClickToMatchup(connId, fromConnected);
  };
  
  // Build role index from connections (records)
  const horseToRoles = useMemo(() => {
    const map = new Map<string, { jockey?: string; trainer?: string; sires: string[] }>();
    for (const conn of connections) {
      for (const s of conn.starters) {
        const rec = map.get(s.horseName) || { sires: [] };
        if (conn.role === "jockey") rec.jockey = rec.jockey || s.jockey || conn.name;
        if (conn.role === "trainer") rec.trainer = rec.trainer || s.trainer || conn.name;
        if (conn.role === "sire") {
          if (!rec.sires.includes(conn.name)) rec.sires.push(conn.name);
        }
        map.set(s.horseName, rec);
      }
    }
    return map;
  }, [connections]);
  
  // Get all unique tracks from connections
  const allTracks = useMemo(() => {
    const tracks = new Set<string>();
    for (const conn of connections) {
      for (const track of conn.trackSet) {
        tracks.add(track);
      }
    }
    return Array.from(tracks).sort();
  }, [connections]);
  
  // If a single track is selected from lobby, lock track filters
  const showOnlyOneTrack = !isMultiTrackSelection && normalizedTrackList.length === 1;

  useEffect(() => {
    if (selectedTrack !== "ALL" && !allTracks.includes(selectedTrack)) {
      setSelectedTrack("ALL");
    }
  }, [selectedTrack, allTracks]);
  
  // Get all starters, filtered by selected connection if filtering
  const allStarters = useMemo(() => {
    const starters: (Starter & { connectionType: "jockey" | "trainer" | "sire"; connectionName: string })[] = [];
    
    console.log('[StartersWindow] Building allStarters with viewMode:', viewMode);
  
  for (const conn of connections) {
      // If "Connected Horses" view is active, only show connections that are in matchups
      if (viewMode === "connected") {
        const appearsInMatchups = connectionAppearsInMatchups(conn);
        console.log('[StartersWindow] Checking connection:', { 
          name: conn.name, 
          role: conn.role, 
          appearsInMatchups,
          connId: conn.id,
          hasConnId: matchupConnections.ids.has(conn.id),
          hasConnKey: matchupConnections.keys.has(`${conn.role}|${conn.name}`)
        });
        if (!appearsInMatchups) {
          continue;
        }
      }
      
    for (const starter of conn.starters) {
      if (starter.scratched) continue;
      
      // Filter by track
      if (selectedTrack !== "ALL" && starter.track !== selectedTrack) continue;
      
        // Filter by selected connection(s) if filtering (works in both horses and connected view)
        // Support both single-select (selectedConnection) and multi-select (selectedConnectionIds)
        if (selectedConnection || selectedConnectionIds.size > 0) {
          let matchesAnyConnection = false;
          
          // Check single-select first
          if (selectedConnection) {
            const matchesConnection = 
              (selectedConnection.role === "jockey" && starter.jockey === selectedConnection.name) ||
              (selectedConnection.role === "trainer" && starter.trainer === selectedConnection.name) ||
              (selectedConnection.role === "sire" && (starter.sire1 === selectedConnection.name || starter.sire2 === selectedConnection.name));
            
            if (matchesConnection) {
              matchesAnyConnection = true;
            }
          }
          
          // Check multi-select
          if (!matchesAnyConnection && selectedConnectionIds.size > 0) {
            for (const connId of selectedConnectionIds) {
              const conn = connections.find(c => c.id === connId);
              if (!conn) continue;
              
              const matchesConnection = 
                (conn.role === "jockey" && starter.jockey === conn.name) ||
                (conn.role === "trainer" && starter.trainer === conn.name) ||
                (conn.role === "sire" && (starter.sire1 === conn.name || starter.sire2 === conn.name));
              
              if (matchesConnection) {
                matchesAnyConnection = true;
                break;
              }
            }
          }
          
          if (!matchesAnyConnection) {
          continue;
        }
      }
      
        starters.push({
        ...starter,
        connectionType: conn.role,
        connectionName: conn.name,
      });
    }
  }
    
    console.log('[StartersWindow] Built allStarters:', starters.length, 'horses');
    return starters;
  }, [connections, viewMode, selectedTrack, selectedConnection, selectedConnectionIds, matchupConnections, connectionAppearsInMatchups]);
  
  // Group by race
  const racesMap = new Map<string, typeof allStarters>();
  for (const starter of allStarters) {
    const key = `${starter.track}-${starter.race}`;
    if (!racesMap.has(key)) {
      racesMap.set(key, []);
    }
    racesMap.get(key)!.push(starter);
  }
  
  const races = Array.from(racesMap.entries()).sort(([a], [b]) => {
    const [trackA, raceA] = a.split("-");
    const [trackB, raceB] = b.split("-");
    // Sort tracks alphabetically (same order as track buttons: AQU, CD, GP, LRL, etc.)
    const trackDiff = trackA.localeCompare(trackB);
    return trackDiff !== 0 ? trackDiff : Number.parseInt(raceA) - Number.parseInt(raceB);
  }).map(([key, starters]) => {
    // Remove duplicates (keep first-seen order)
    const seen = new Set<string>();
    const ordered: typeof starters = [] as any;
    for (const s of starters) {
      if (seen.has(s.horseName)) continue;
      seen.add(s.horseName);
      ordered.push(s);
    }
    
    // Sort by program_number (1, 2, 3...)
    // Horses without program_number go to the end
    ordered.sort((a, b) => {
      const aNum = a.program_number;
      const bNum = b.program_number;
      
      // If both have numbers, sort numerically
      if (aNum && bNum) {
        return aNum - bNum;
      }
      // If only one has a number, it comes first
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      // If neither has a number, maintain order
      return 0;
    });
    
    return [key, ordered] as [string, typeof starters];
  });
 
  // Import program number colors utility
  const getProgramNumberBadge = (programNumber?: number | null) => {
    if (!programNumber || programNumber < 1) {
      return { bg: "bg-gray-300", text: "text-gray-700", number: null };
    }
    
    // Standard saddlecloth colors (exact hex values from racing app)
    const colors: Record<number, { bg: string; text: string }> = {
      1: { bg: "bg-[#DC2626]", text: "text-white" },        // Red (#DC2626) - white text
      2: { bg: "bg-[#F0FFFF]", text: "text-black" },        // Light Blue (#F0FFFF) - black text
      3: { bg: "bg-[#005CE8]", text: "text-white" },       // Blue (#005CE8) - white text
      4: { bg: "bg-[#ECC94B]", text: "text-black" },     // Yellow (#ECC94B) - black text
      5: { bg: "bg-[#16A34A]", text: "text-white" },      // Green (#16A34A) - white text
      6: { bg: "bg-[#800080]", text: "text-white" },          // Purple (#800080) - white text
      7: { bg: "bg-[#F97316]", text: "text-black" },     // Orange (#F97316) - black text
      8: { bg: "bg-[#F9A8D4]", text: "text-black" },      // Pink (#F9A8D4) - black text
      9: { bg: "bg-[#99F6E4]", text: "text-black" },        // Light Teal (#99F6E4) - black text
      10: { bg: "bg-[#800080]", text: "text-white" },    // Purple (#800080) - white text
      11: { bg: "bg-[#000080]", text: "text-white" },     // Navy Blue (#000080) - white text
      12: { bg: "bg-[#36CD30]", text: "text-black" },       // Bright Green (#36CD30) - black text
      13: { bg: "bg-[#8A2CE6]", text: "text-white" },    // Violet (#8A2CE6) - white text
      14: { bg: "bg-[#817E01]", text: "text-white" },     // Dark Olive (#817E01) - white text
      15: { bg: "bg-[#ABA96F]", text: "text-black" },   // Khaki (#ABA96F) - black text
      16: { bg: "bg-[#2A557B]", text: "text-white" },   // Dark Blue (#2A557B) - white text
    };
    
    // Use standard color if available, otherwise cycle
    if (programNumber <= 15 && colors[programNumber]) {
      return { ...colors[programNumber], number: programNumber };
    }
    
    // For numbers > 15, cycle through colors
    const colorArray = Object.values(colors);
    const index = (programNumber - 1) % colorArray.length;
    return { ...colorArray[index], number: programNumber };
  };
  
  return (
    <Card className="bg-[var(--surface-1)] h-full flex flex-col rounded-lg shadow-lg border border-[var(--content-15)] overflow-hidden">
      {/* Header - Same line as other panels */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--content-15)]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Starters</h2>
        </div>
      </div>
      
      {/* Divider */}
      <div className="border-b border-[var(--content-15)]"></div>
        
      {/* All Buttons on Same Line */}
      <div className="flex-shrink-0 px-4 py-2">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {/* View Mode Buttons */}
          <button
            onClick={() => handleViewModeChange("horses")}
            className={`px-2 py-1 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
              viewMode === "horses"
                ? "bg-[var(--btn-default)] text-white"
                : "bg-[var(--blue-50)] text-[var(--brand)] hover:opacity-90"
            }`}
          >
            Horses
          </button>
          <button
            onClick={() => handleViewModeChange("connected")}
            className={`px-2 py-1 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
              viewMode === "connected"
                ? "bg-[var(--btn-default)] text-white"
                : "bg-[var(--blue-50)] text-[var(--brand)] hover:opacity-90"
            }`}
          >
            Connected Horses
          </button>
          
        </div>
        
        {hasConnectionFilters && (
          <div className="mt-3 px-3 py-2 bg-[var(--blue-50)]/40 rounded-md border border-[var(--content-15)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                Filtering by
              </span>
              <button
                onClick={() => {
                  onClearAllFilters?.({ keepConnectedView: false });
                  onConnectionClick(null);
                  onViewModeChange?.("horses");
                }}
                className="text-xs text-[var(--btn-link)] hover:opacity-80 transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {selectedConnectionsList.map((conn) => {
                const badge = ROLE_BADGE_STYLES[conn.role];
                return (
                  <span
                    key={conn.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--content-15)] bg-white/70 px-3 py-1 text-xs font-medium text-[var(--text-primary)] shadow-sm"
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="truncate max-w-[140px]">{conn.name}</span>
                    {onRemoveConnectionFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveConnectionFilter(conn.id);
                          if (selectedConnectionsList.length <= 1) {
                            onViewModeChange?.("horses");
                          }
                        }}
                        className="text-[var(--text-tertiary)] hover:text-[var(--brand)] transition-colors"
                        aria-label={`Remove ${conn.name}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </span>
                );
              })}
              </div>
          </div>
        )}
      </div>
      
      {/* Race List */}
      <div 
        className="flex-1 overflow-y-auto min-h-0" 
        style={{ 
          overscrollBehavior: 'contain', 
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="flex flex-col">
        {races.map(([key, starters]) => {
          const [track, raceNum] = key.split("-");
            const trackFull = { 
              BAQ: "Belmont", 
              GP: "Gulfstream Park", 
              KEE: "Keeneland", 
              SA: "Santa Anita",
              CD: "Churchill Downs",
              DMR: "Del Mar",
              LRL: "Laurel Park",
              MNR: "Mountaineer Park",
              IND: "Horseshoe Indianapolis"
            } as const;
            
            // Format date from sessionStorage or use default
            let dateStr = "November 2, 2025"; // Default
            if (selectedDateFromLobby) {
              try {
                const date = new Date(selectedDateFromLobby);
                if (!isNaN(date.getTime())) {
                  dateStr = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                }
              } catch (e) {
                // Keep default if parsing fails
              }
            }
            
            return (
              <div key={key} className="w-full">
                {/* Grey band header */}
                <div className="bg-[var(--content-15)] text-[var(--text-primary)] text-[12px] leading-[18px] font-medium px-4 py-1">
                  {dateStr}, {trackFull[track as keyof typeof trackFull] || track}, Race {raceNum}
                </div>
                {/* Rows */}
                {starters.map((starter, idx) => {
                  const roles = horseToRoles.get(starter.horseName) || { sires: [] };
                  const jockey = starter.jockey || roles.jockey || "Unknown";
                  const trainer = starter.trainer || roles.trainer || "Unknown";
                  const sireCandidates = [starter.sire1, starter.sire2, ...roles.sires].filter(Boolean) as string[];
                  const [sire1, sire2] = Array.from(new Set(sireCandidates)).slice(0, 2);
                  
                  // Use program_number (saddlecloth number) - doesn't change if horses scratch
                  const programNumber = starter.program_number;
                  const badgeStyle = getProgramNumberBadge(programNumber);
                  const jockeySelected = isConnectionSelected("jockey", jockey);
                  const trainerSelected = isConnectionSelected("trainer", trainer);
                  const sire1Selected = isConnectionSelected("sire", sire1);
                  const sire2Selected = isConnectionSelected("sire", sire2);
                  const jockeyConnectedHighlight = shouldHighlightConnected("jockey", jockey);
                  const trainerConnectedHighlight = shouldHighlightConnected("trainer", trainer);
                  const sire1ConnectedHighlight = shouldHighlightConnected("sire", sire1);
                  const sire2ConnectedHighlight = shouldHighlightConnected("sire", sire2);
                  // Only make connections clickable if NOT filtered from players panel
                  // When hasConnectionFilters is true, names are highlighted but NOT clickable
                  // Connection names are ONLY clickable when:
                  // 1. Connected Horses view is active (viewMode === "connected")
                  // 2. The connection is highlighted (appears in matchups)
                  // 3. No filters are active from Players panel
                  const jockeyInteractive = viewMode === "connected" && !hasConnectionFilters && jockeyConnectedHighlight;
                  const trainerInteractive = viewMode === "connected" && !hasConnectionFilters && trainerConnectedHighlight;
                  const sire1Interactive = viewMode === "connected" && !hasConnectionFilters && !!sire1 && sire1ConnectedHighlight;
                  const sire2Interactive = viewMode === "connected" && !hasConnectionFilters && !!sire2 && sire2ConnectedHighlight;
                  
                  // Get colors for selected connections
                  const jockeyColor = getConnectionColor("jockey", jockey);
                  const trainerColor = getConnectionColor("trainer", trainer);
                  const sire1Color = getConnectionColor("sire", sire1);
                  const sire2Color = getConnectionColor("sire", sire2);
          
          return (
            <div
                      key={`${starter.track}-${starter.race}-${starter.horseName}`}
                      className={`border-b border-[var(--content-15)] flex items-center gap-3 pl-5 pr-0 py-1 ${idx === starters.length - 1 ? "" : ""}`}
                    >
                      {/* Left block: Program Number (saddlecloth) + odds + horse name */}
                      <div className="w-[132px] shrink-0 flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-1">
                          <div className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] leading-[18px] font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
                            {programNumber ?? ""}
                          </div>
                          <div className="text-[12px] leading-[18px] text-[var(--text-primary)] font-medium">{starter.mlOddsFrac || "—"}</div>
              </div>
                        <div className="px-1">
                          <div className="flex items-center gap-1">
                            <div className="text-[12px] leading-[18px] font-semibold text-[var(--text-primary)] truncate">{starter.horseName}</div>
                            {starter.isAE && (
                              <span className="text-[10px] leading-[14px] font-semibold bg-yellow-100 text-yellow-800 px-1 rounded">AE</span>
                            )}
                          </div>
                    </div>
                      </div>
                      {/* Right block: connections in 2 rows */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex w-full">
                          <div
                            role={jockeyInteractive ? "button" : undefined}
                            tabIndex={jockeyInteractive ? 0 : undefined}
                            data-connection-clickable="jockey"
                            data-connection-value={jockey}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 transition-colors rounded ${
                              jockeySelected && jockeyColor
                                ? `${jockeyColor.bgLight} border ${jockeyColor.border} ring-1 ${jockeyColor.border} text-white shadow-sm`
                                : jockeySelected
                                ? "bg-[var(--brand)] text-white shadow-sm"
                                : jockeyConnectedHighlight
                                ? "bg-[var(--blue-50)] border border-[var(--brand)] ring-1 ring-[var(--brand)]/20"
                                : ""
                            } ${jockeyInteractive ? 'cursor-pointer' : ''}`}
                            onClick={jockeyInteractive ? () => handleConnectionNameClickInStarters(jockey, "jockey") : undefined}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && jockeyInteractive) {
                                e.preventDefault();
                                handleConnectionNameClickInStarters(jockey, "jockey");
                              }
                            }}
                          >
                            <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                              jockeySelected && jockeyColor
                                ? `${jockeyColor.bg} text-white`
                                : jockeySelected
                                ? "bg-white text-[var(--brand)]"
                                : jockeyConnectedHighlight
                                ? "bg-[var(--brand)] text-white"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>J</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              jockeySelected && jockeyColor
                                ? jockeyColor.text
                                : jockeySelected
                                ? "text-white"
                                : jockeyConnectedHighlight
                                ? "text-[var(--brand)]"
                                : "text-[var(--text-primary)]"
                            }`}>{jockey}</span>
                          </div>
                          <div
                            role={trainerInteractive ? "button" : undefined}
                            tabIndex={trainerInteractive ? 0 : undefined}
                            data-connection-clickable="trainer"
                            data-connection-value={trainer}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 transition-colors rounded ${
                              trainerSelected && trainerColor
                                ? `${trainerColor.bgLight} border ${trainerColor.border} ring-1 ${trainerColor.border} rounded text-white shadow-sm`
                                : trainerSelected
                                ? "bg-[var(--brand)] rounded text-white shadow-sm"
                                : trainerConnectedHighlight
                                ? "bg-[var(--blue-50)] border border-[var(--brand)] ring-1 ring-[var(--brand)]/20 rounded"
                                : ""
                            }`}
                            onClick={trainerInteractive ? () => handleConnectionNameClickInStarters(trainer, "trainer") : undefined}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && trainerInteractive) {
                                e.preventDefault();
                                handleConnectionNameClickInStarters(trainer, "trainer");
                              }
                            }}
                          >
                            <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                              trainerSelected && trainerColor
                                ? `${trainerColor.bg} text-white`
                                : trainerSelected
                                ? "bg-white text-[var(--brand)]"
                                : trainerConnectedHighlight
                                ? "bg-[var(--brand)] text-white"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>T</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              trainerSelected && trainerColor
                                ? trainerColor.text
                                : trainerSelected
                                ? "text-white"
                                : trainerConnectedHighlight
                                ? "text-[var(--brand)]"
                                : "text-[var(--text-primary)]"
                            }`} data-connection-name data-connection-role="trainer">{trainer}</span>
                          </div>
                        </div>
                        <div className="flex w-full">
                          <div 
                            role={sire1Interactive ? "button" : undefined}
                            tabIndex={sire1Interactive ? 0 : undefined}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 transition-colors ${
                              sire1Selected && sire1Color
                                ? `${sire1Color.bgLight} border ${sire1Color.border} ring-1 ${sire1Color.border} rounded text-white shadow-sm`
                                : sire1Selected
                                ? "bg-[var(--brand)] rounded text-white shadow-sm"
                                : sire1ConnectedHighlight
                                ? "bg-[var(--blue-50)] border border-[var(--brand)] ring-1 ring-[var(--brand)]/20 rounded"
                                : ""
                            }`}
                            onClick={sire1Interactive && sire1 ? () => handleConnectionNameClickInStarters(sire1, "sire") : undefined}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && sire1Interactive && sire1) {
                                e.preventDefault();
                                handleConnectionNameClickInStarters(sire1, "sire");
                              }
                            }}
                          >
                            <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                              sire1Selected && sire1Color
                                ? `${sire1Color.bg} text-white`
                                : sire1Selected
                                ? "bg-white text-[var(--brand)]"
                                : sire1ConnectedHighlight
                                ? "bg-[var(--brand)] text-white"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>S</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              sire1Selected && sire1Color
                                ? sire1Color.text
                                : sire1Selected
                                ? "text-white"
                                : sire1ConnectedHighlight
                                ? "text-[var(--brand)]"
                                : "text-[var(--text-primary)]"
                            }`} data-connection-name data-connection-role="sire">{sire1 || "—"}</span>
                          </div>
                          <div 
                            role={sire2Interactive ? "button" : undefined}
                            tabIndex={sire2Interactive ? 0 : undefined}
                            data-connection-clickable="sire"
                            data-connection-value={sire2 || ""}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 transition-colors rounded ${
                              sire2Selected && sire2Color
                                ? `${sire2Color.bgLight} border ${sire2Color.border} ring-1 ${sire2Color.border} rounded text-white shadow-sm`
                                : sire2Selected
                                ? "bg-[var(--brand)] rounded text-white shadow-sm"
                                : sire2ConnectedHighlight
                                ? "bg-[var(--blue-50)] border border-[var(--brand)] ring-1 ring-[var(--brand)]/20 rounded"
                                : ""
                            }`}
                            onClick={sire2Interactive && sire2 ? () => handleConnectionNameClickInStarters(sire2, "sire") : undefined}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && sire2Interactive && sire2) {
                                e.preventDefault();
                                handleConnectionNameClickInStarters(sire2, "sire");
                              }
                            }}
                          >
                            <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                              sire2Selected && sire2Color
                                ? `${sire2Color.bg} text-white`
                                : sire2Selected
                                ? "bg-white text-[var(--brand)]"
                                : sire2ConnectedHighlight
                                ? "bg-[var(--brand)] text-white"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>S</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              sire2Selected && sire2Color
                                ? sire2Color.text
                                : sire2Selected
                                ? "text-white"
                                : sire2ConnectedHighlight
                                ? "text-[var(--brand)]"
                                : "text-[var(--text-primary)]"
                            }`} data-connection-name data-connection-role="sire">{sire2 || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
        </div>
      </div>
    </Card>
  );
}

