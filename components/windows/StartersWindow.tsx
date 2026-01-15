"use client";

import { useMemo, useState, useEffect } from "react";
import { Connection, Starter } from "@/types";
import { Card } from "@/components/ui/card";
import { useApp } from "@/contexts/AppContext";
import { X, ChevronDown } from "lucide-react";

interface StartersWindowProps {
  readonly connections: Connection[];
  readonly selectedConnection: Connection | null;
  readonly onConnectionClick: (connection: Connection | null) => void;
  readonly onConnectionBoxClick?: (connection: Connection) => void;
  readonly matchups?: Array<{ setA: { connections: Connection[] }; setB: { connections: Connection[] } }>;
  readonly onConnectionClickToMatchup?: (connectionId: string, fromConnectedHorsesView: boolean) => void;
  readonly selectedTracks?: string[];
  readonly selectedDate?: string;
}

const trackColors: Record<string, { bg: string; border: string; text: string }> = {
  BAQ: { bg: "bg-blue-400/20", border: "border-blue-300", text: "text-blue-500 dark:text-blue-300" },
  AQU: { bg: "bg-sky-400/20", border: "border-sky-300", text: "text-sky-500 dark:text-sky-300" },
  GP: { bg: "bg-emerald-400/20", border: "border-emerald-300", text: "text-emerald-500 dark:text-emerald-300" },
  SA: { bg: "bg-rose-400/20", border: "border-rose-300", text: "text-rose-500 dark:text-rose-300" },
  DMR: { bg: "bg-cyan-400/20", border: "border-cyan-300", text: "text-cyan-500 dark:text-cyan-300" },
  LRL: { bg: "bg-pink-400/20", border: "border-pink-300", text: "text-pink-500 dark:text-pink-300" },
  MVR: { bg: "bg-amber-400/20", border: "border-amber-300", text: "text-amber-500 dark:text-amber-300" },
  PEN: { bg: "bg-violet-400/20", border: "border-violet-300", text: "text-violet-500 dark:text-violet-300" },
  PRX: { bg: "bg-indigo-400/20", border: "border-indigo-300", text: "text-indigo-500 dark:text-indigo-300" },
  KEE: { bg: "bg-purple-400/20", border: "border-purple-300", text: "text-purple-500 dark:text-purple-300" },
};

export function StartersWindow({
  connections,
  selectedConnection,
  onConnectionClick,
  onConnectionBoxClick,
  matchups = [],
  onConnectionClickToMatchup,
  selectedTracks = [],
  selectedDate,
}: StartersWindowProps) {
  const [activeTrackFilter, setActiveTrackFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"horses" | "connected">("horses");
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set());
  
  // Multi-select filtering from AppContext
  const { 
    filterState, 
    togglePlayerFilter, 
    clearPlayerFilters,
    getPlayerHighlightColor 
  } = useApp();
  
  const hasMultiSelectFilters = filterState.selectedPlayers.length > 0;
  
  // Use selectedTracks from calendar picker if available, otherwise show ALL
  const tracksToShow = selectedTracks.length > 0 ? selectedTracks : ["ALL"];

  // Reset track filter if selection changes and active filter not present
  useEffect(() => {
    if (activeTrackFilter !== "ALL" && !selectedTracks.includes(activeTrackFilter)) {
      setActiveTrackFilter("ALL");
    }
  }, [selectedTracks, activeTrackFilter]);
  
  // Get all connection IDs that are in matchups (for "Connected Horses" filter)
  const matchupConnectionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const matchup of matchups) {
      for (const conn of matchup.setA.connections) {
        ids.add(conn.id);
      }
      for (const conn of matchup.setB.connections) {
        ids.add(conn.id);
      }
    }
    return ids;
  }, [matchups]);
  
  // Get connection ID by name and role (for highlighting in starters)
  const getConnectionIdByName = (name: string, role: "jockey" | "trainer" | "sire") => {
    return connections.find(c => c.name === name && c.role === role)?.id;
  };
  
  // Check if a connection name matches any connection in matchups
  const isConnectionInMatchups = (name: string, role: "jockey" | "trainer" | "sire") => {
    const connId = getConnectionIdByName(name, role);
    return connId ? matchupConnectionIds.has(connId) : false;
  };
  
  // Get multi-select highlight color for a connection by name/role
  const getConnectionHighlightByName = (name: string, role: "jockey" | "trainer" | "sire") => {
    const connId = getConnectionIdByName(name, role);
    if (!connId) return null;
    return getPlayerHighlightColor(connId);
  };
  
  // Check if a connection is in the multi-select filter
  const isConnectionInMultiSelect = (name: string, role: "jockey" | "trainer" | "sire") => {
    const connId = getConnectionIdByName(name, role);
    if (!connId) return false;
    return filterState.selectedPlayers.some(p => p.id === connId);
  };
  
  // Handle view mode changes
  const handleViewModeChange = (mode: "horses" | "connected") => {
    if (mode === "horses") {
      // Clear all filters when switching to horses view
      onConnectionClick(null);
      setViewMode("horses");
    } else {
      // Clicking "Connected Horses":
      // 1. If filtering by a specific connection in connected mode, clear the filter (stay in connected mode)
      // 2. If already in connected mode showing all connected horses, toggle back to horses
      // 3. If in horses mode, switch to connected mode (showing all connected horses)
      if (viewMode === "connected") {
        if (selectedConnection) {
          // Filtering by a connection - clear the filter and stay in connected mode
          onConnectionClick(null);
          // Stay in connected mode
        } else {
          // Already showing all connected horses - toggle back to horses
          setViewMode("horses");
          onConnectionClick(null);
        }
      } else {
        // Switch to connected mode (shows all connected horses)
        setViewMode("connected");
        // Clear any specific connection filter to show all connected horses
        onConnectionClick(null);
      }
    }
  };
  
  // When selectedConnection changes and we're in horses view, stay in horses view (filter mode)
  // This ensures the button shows "Horses" when filtering by a connection in default view
  
  // Handle connection name click in starters panel (when in Connected Horses view)
  const handleConnectionNameClickInStarters = (name: string, role: "jockey" | "trainer" | "sire") => {
    if (viewMode === "connected" && !selectedConnection) {
      const connId = getConnectionIdByName(name, role);
      if (connId && onConnectionClickToMatchup) {
        // Pass true to indicate this is from Connected Horses view (shouldn't filter starters)
        onConnectionClickToMatchup(connId, true);
      }
    }
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
  
  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "October 3, 2025";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  
  // Build base starters (only track/date filters, no player filters)
  const baseStarters: Starter[] = [];
  for (const conn of connections) {
    // If "Connected Horses" view is active, only show connections that are in matchups
    if (viewMode === "connected" && !selectedConnection && !matchupConnectionIds.has(conn.id)) {
      continue;
    }

    for (const starter of conn.starters) {
      if (starter.scratched) continue;
      
      // Date filter (respect selectedDate if provided)
      if (selectedDate && starter.date && starter.date !== selectedDate) {
        continue;
      }
      
      // Track filters
      if (activeTrackFilter !== "ALL") {
        if (starter.track !== activeTrackFilter) continue;
      } else if (selectedTracks.length > 0) {
        if (!selectedTracks.includes(starter.track)) continue;
      }

      baseStarters.push({ ...starter });
    }
  }

  // Assign post positions based on base starters per race
  const fullRaceMap = new Map<string, Starter[]>();
  for (const starter of baseStarters) {
    const key = `${starter.track}-${starter.race}`;
    if (!fullRaceMap.has(key)) fullRaceMap.set(key, []);
    fullRaceMap.get(key)!.push(starter);
  }
  for (const [, starters] of fullRaceMap.entries()) {
    const seen = new Set<string>();
    const ordered: Starter[] = [];
    for (const s of starters) {
      if (seen.has(s.horseName)) continue;
      seen.add(s.horseName);
      ordered.push(s);
    }
    let post = 1;
    for (const s of ordered) {
      // @ts-expect-error transient field used in view only
      s.__post = post++;
    }
    // replace with ordered to keep first-seen order
    fullRaceMap.set(`${ordered[0].track}-${ordered[0].race}`, ordered);
  }

  // Apply player filters to base starters
  const filteredStarters: (Starter & { connectionType?: "jockey" | "trainer" | "sire"; connectionName?: string })[] = [];
  for (const starter of baseStarters) {
    const hasMultiSelectFilter = filterState.selectedPlayers.length > 0;
    const hasSingleSelectFilter = selectedConnection !== null;

    if (hasMultiSelectFilter) {
      const matchesAnySelected = filterState.selectedPlayers.some(player => {
        if (player.role === "jockey" && starter.jockey === player.name) return true;
        if (player.role === "trainer" && starter.trainer === player.name) return true;
        if (player.role === "sire" && (starter.sire1 === player.name || starter.sire2 === player.name)) return true;
        return false;
      });
      if (!matchesAnySelected) continue;
    } else if (hasSingleSelectFilter) {
      const matchesConnection = 
        (selectedConnection!.role === "jockey" && starter.jockey === selectedConnection!.name) ||
        (selectedConnection!.role === "trainer" && starter.trainer === selectedConnection!.name) ||
        (selectedConnection!.role === "sire" && (starter.sire1 === selectedConnection!.name || starter.sire2 === selectedConnection!.name));
      if (!matchesConnection) continue;
    }

    filteredStarters.push(starter);
  }

  // Group filtered starters by race
  const filteredRacesMap = new Map<string, typeof filteredStarters>();
  for (const starter of filteredStarters) {
    const key = `${starter.track}-${starter.race}`;
    if (!filteredRacesMap.has(key)) filteredRacesMap.set(key, []);
    filteredRacesMap.get(key)!.push(starter);
  }

  const sortRaces = (entries: [string, Starter[]][]) =>
    entries.sort(([a], [b]) => {
      const [trackA, raceA] = a.split("-");
      const [trackB, raceB] = b.split("-");
      const trackOrder = ["AQU","BAQ","SA","DMR","GP","PRX","PEN","LRL","MVR","KEE","GPW","TAM","LRC"];
      const trackDiff = trackOrder.indexOf(trackA) - trackOrder.indexOf(trackB);
      return trackDiff !== 0 ? trackDiff : Number.parseInt(raceA) - Number.parseInt(raceB);
    });

  const races = sortRaces(Array.from(filteredRacesMap.entries()));
 
  const getPostBadge = (post?: number) => {
    if (!post) return "bg-gray-300 text-gray-700";
    const palette = ["bg-green-500", "bg-blue-500", "bg-red-500", "bg-amber-500", "bg-purple-500", "bg-teal-500"];
    const color = palette[(post - 1) % palette.length];
    return `${color} text-white`;
  };
  
  return (
    <Card className="bg-[var(--surface-1)] h-full flex flex-col rounded-lg shadow-lg border border-[var(--content-15)] overflow-hidden">
      {/* Header - Same line as other panels */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--content-15)]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Starters</h2>
          {(selectedConnection || hasMultiSelectFilters) && (
            <button
              onClick={() => {
                handleViewModeChange("horses");
                clearPlayerFilters();
              }}
              className="text-sm text-[var(--btn-link)] hover:opacity-90"
            >
              Clear All
            </button>
          )}
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
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap border ${
              viewMode === "horses"
                ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                : "bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--content-15)] hover:bg-[var(--surface-3)] hover:border-[var(--brand)]"
            }`}
          >
            Horses
          </button>
          <button
            onClick={() => handleViewModeChange("connected")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap border ${
              viewMode === "connected"
                ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                : "bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--content-15)] hover:bg-[var(--surface-3)] hover:border-[var(--brand)]"
            }`}
          >
            Connected Horses
          </button>
          
          {/* Track filter chips (for selected tracks) */}
          {selectedTracks.length > 0 && (
            <>
              <div className="w-px h-4 bg-[var(--content-15)] mx-1"></div>
              <button
                onClick={() => setActiveTrackFilter("ALL")}
                className={`px-3 py-1.5 rounded text-[13px] font-medium whitespace-nowrap border ${
                  activeTrackFilter === "ALL"
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                    : "bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--content-15)] hover:bg-[var(--surface-3)]"
                }`}
              >
                All
              </button>
              {selectedTracks.map((track) => {
                const color = trackColors[track] || { bg: "bg-gray-500/20", border: "border-gray-500", text: "text-gray-600 dark:text-gray-400" };
                const isActive = activeTrackFilter === track;
                return (
                  <button
                    key={track}
                    onClick={() => setActiveTrackFilter(isActive ? "ALL" : track)}
                    className={`px-3 py-1.5 rounded text-[13px] font-medium whitespace-nowrap border transition-colors ${
                      isActive
                        ? `${color.bg.replace('/20','/40')} ${color.text} border-2 ${color.border}`
                        : "bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--content-15)] hover:bg-[var(--surface-3)]"
                    }`}
                  >
                    {track}
                  </button>
                );
              })}
            </>
          )}
        </div>
        
        {/* Multi-select filter pills */}
        {hasMultiSelectFilters && (
          <div className="mt-3 px-3 py-2 bg-[var(--blue-50)] rounded-md border border-[var(--content-15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--text-tertiary)]">Filtering by {filterState.selectedPlayers.length} player{filterState.selectedPlayers.length > 1 ? 's' : ''}:</span>
              <button
                onClick={clearPlayerFilters}
                className="text-xs text-[var(--btn-link)] hover:opacity-90"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterState.selectedPlayers.map((player) => {
                const highlightColor = getPlayerHighlightColor(player.id);
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md border-2 ${highlightColor?.bg || 'bg-blue-500'}/20 ${highlightColor?.border || 'border-blue-500'}`}
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                      player.role === "jockey" 
                        ? "bg-blue-600 text-white"
                        : player.role === "trainer"
                        ? "bg-green-600 text-white"
                        : "bg-amber-600 text-white"
                    }`}>
                      {player.role.charAt(0)}
                    </span>
                    <span className={`text-[12px] font-medium ${highlightColor?.text || 'text-blue-500'}`}>
                      {player.name}
                    </span>
                    <button
                      onClick={() => togglePlayerFilter(player)}
                      className="ml-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      aria-label={`Remove ${player.name} filter`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Single select filter (legacy - only show if no multi-select filters) */}
        {selectedConnection && !hasMultiSelectFilters && (
          <div className="mt-3 px-3 py-2 bg-[var(--blue-50)] rounded-md border border-[var(--content-15)]">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">Filtering by:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    selectedConnection.role === "jockey" 
                      ? "bg-blue-600 text-white"
                      : selectedConnection.role === "trainer"
                      ? "bg-green-600 text-white"
                      : "bg-amber-600 text-white"
                  }`}>
                    {selectedConnection.role}
                  </span>
                </div>
                <div className="font-semibold text-[14px] text-[var(--brand)]">
                  {selectedConnection.name}
                </div>
                {selectedConnection.trackSet.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-[var(--text-tertiary)]">Active on</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedConnection.trackSet.map((track) => {
                        const color = trackColors[track];
                        return (
                          <span
                            key={track}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${color.bg.replace('/10', '')}`}
                          >
                            {track}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => onConnectionClick(null)}
                className="ml-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Clear filter"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Race List */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain', scrollBehavior: 'auto' }}>
        <div className="flex flex-col">
          {races.map(([key, starters]) => {
            const [track, raceNum] = key.split("-");
            const trackFull = { 
              AQU: "Aqueduct", 
              DMR: "Del Mar", 
              GP: "Gulfstream Park", 
              LRL: "Laurel Park", 
              MVR: "Mahoning Valley", 
              PEN: "Penn National", 
              PRX: "Parx", 
              SA: "Santa Anita",
              BAQ: "Belmont",
              KEE: "Keeneland"
            } as const;
            const displayDate = formatDate(selectedDate);
            const isFiltersActive = hasMultiSelectFilters || !!selectedConnection;
            const isExpanded = expandedRaces.has(key);
            const fullRace = fullRaceMap.get(key);
            const displayedStarters = isExpanded && fullRace ? fullRace : starters;

            return (
              <div key={key} className="w-full">
                {/* Grey band header */}
                <div className="bg-[var(--content-15)] text-[var(--text-primary)] text-[12px] leading-[18px] font-medium px-4 py-1 flex items-center justify-between">
                  <span>{displayDate}, {trackFull[track as keyof typeof trackFull] || track}, Race {raceNum}</span>
                  {isFiltersActive && fullRace && (
                    <button
                      className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      onClick={() => {
                        setExpandedRaces(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        });
                      }}
                    >
                      <span>{isExpanded ? "Hide full race" : "Show full race"}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                {/* Rows */}
                {displayedStarters.map((starter, idx) => {
                  const roles = horseToRoles.get(starter.horseName) || { sires: [] };
                  const jockey = starter.jockey || roles.jockey || "Unknown";
                  const trainer = starter.trainer || roles.trainer || "Unknown";
                  const sireCandidates = [starter.sire1, starter.sire2, ...roles.sires].filter(Boolean) as string[];
                  const [sire1, sire2] = Array.from(new Set(sireCandidates)).slice(0, 2);
                  // @ts-expect-error transient
                  const post = starter.__post as number | undefined;
                  return (
                    <div
                      key={`${starter.track}-${starter.race}-${starter.horseName}`}
                      className={`border-b border-[var(--border)] flex items-center gap-3 pl-5 pr-2 py-2 hover:bg-[var(--surface-hover)] transition-colors ${idx === starters.length - 1 ? "" : ""}`}
                    >
                      {/* Left block: PP + odds + horse name */}
                      <div className="w-[132px] shrink-0 flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-1">
                          <div className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] leading-[18px] font-semibold ${getPostBadge(post)}`}>{post ?? ""}</div>
                          <div className="text-[12px] leading-[18px] text-[var(--text-primary)] font-medium">{starter.mlOddsFrac || "—"}</div>
                        </div>
                        <div className="px-1">
                          <div className="text-[12px] leading-[18px] font-semibold text-[var(--text-primary)] truncate">{starter.horseName}</div>
                        </div>
                      </div>
                      {/* Right block: connections in 2 rows */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex w-full">
                          {(() => {
                            const jockeyHighlight = getConnectionHighlightByName(jockey, "jockey");
                            const isSingleSelectJockey = selectedConnection?.role === "jockey" && jockey === selectedConnection?.name;
                            const isMultiSelectJockey = !!jockeyHighlight;
                            return (
                              <div 
                                role={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(jockey, "jockey") ? "button" : undefined}
                                tabIndex={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(jockey, "jockey") ? 0 : undefined}
                                className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                                  isMultiSelectJockey
                                    ? `${jockeyHighlight.light} rounded border ${jockeyHighlight.border}`
                                    : isSingleSelectJockey
                                    ? "bg-[var(--brand)] rounded"
                                    : viewMode === "connected" && !selectedConnection && isConnectionInMatchups(jockey, "jockey")
                                    ? "bg-[var(--blue-50)] rounded cursor-pointer hover:bg-[var(--blue-50)]/80"
                                    : ""
                                }`}
                                onClick={() => handleConnectionNameClickInStarters(jockey, "jockey")}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === " ") && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(jockey, "jockey")) {
                                    e.preventDefault();
                                    handleConnectionNameClickInStarters(jockey, "jockey");
                                  }
                                }}
                              >
                                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                                  isSingleSelectJockey
                                    ? "bg-white text-[var(--jockey)]"
                                    : "bg-[var(--jockey)] text-white"
                                }`}>J</span>
                                <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                                  isMultiSelectJockey
                                    ? jockeyHighlight.text
                                    : isSingleSelectJockey
                                    ? "text-white"
                                    : "text-[var(--text-primary)]"
                                }`}>{jockey}</span>
                              </div>
                            );
                          })()}
                          {(() => {
                            const trainerHighlight = getConnectionHighlightByName(trainer, "trainer");
                            const isSingleSelectTrainer = selectedConnection?.role === "trainer" && trainer === selectedConnection?.name;
                            const isMultiSelectTrainer = !!trainerHighlight;
                            return (
                              <div 
                                role={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(trainer, "trainer") ? "button" : undefined}
                                tabIndex={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(trainer, "trainer") ? 0 : undefined}
                                className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                                  isMultiSelectTrainer
                                    ? `${trainerHighlight.light} rounded border ${trainerHighlight.border}`
                                    : isSingleSelectTrainer
                                    ? "bg-[var(--brand)] rounded"
                                    : viewMode === "connected" && !selectedConnection && isConnectionInMatchups(trainer, "trainer")
                                    ? "bg-[var(--blue-50)] rounded cursor-pointer hover:bg-[var(--blue-50)]/80"
                                    : ""
                                }`}
                                onClick={() => handleConnectionNameClickInStarters(trainer, "trainer")}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === " ") && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(trainer, "trainer")) {
                                    e.preventDefault();
                                    handleConnectionNameClickInStarters(trainer, "trainer");
                                  }
                                }}
                              >
                                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                                  isSingleSelectTrainer
                                    ? "bg-white text-[var(--trainer)]"
                                    : "bg-[var(--trainer)] text-white"
                                }`}>T</span>
                                <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                                  isMultiSelectTrainer
                                    ? trainerHighlight.text
                                    : isSingleSelectTrainer
                                    ? "text-white"
                                    : "text-[var(--text-primary)]"
                                }`}>{trainer}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex w-full">
                          {(() => {
                            const sire1Highlight = sire1 ? getConnectionHighlightByName(sire1, "sire") : null;
                            const isSingleSelectSire1 = selectedConnection?.role === "sire" && sire1 === selectedConnection?.name;
                            const isMultiSelectSire1 = !!sire1Highlight;
                            return (
                              <div 
                                role={sire1 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire1 || "", "sire") ? "button" : undefined}
                                tabIndex={sire1 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire1 || "", "sire") ? 0 : undefined}
                                className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                                  isMultiSelectSire1
                                    ? `${sire1Highlight!.light} rounded border ${sire1Highlight!.border}`
                                    : isSingleSelectSire1
                                    ? "bg-[var(--brand)] rounded"
                                    : sire1 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire1 || "", "sire")
                                    ? "bg-[var(--blue-50)] rounded cursor-pointer hover:bg-[var(--blue-50)]/80"
                                    : ""
                                }`}
                                onClick={() => {
                                  if (sire1) handleConnectionNameClickInStarters(sire1, "sire");
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === " ") && sire1 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire1, "sire")) {
                                    e.preventDefault();
                                    handleConnectionNameClickInStarters(sire1, "sire");
                                  }
                                }}
                              >
                                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                                  isSingleSelectSire1
                                    ? "bg-white text-[var(--sire)]"
                                    : "bg-[var(--sire)] text-white"
                                }`}>S</span>
                                <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                                  isMultiSelectSire1
                                    ? sire1Highlight!.text
                                    : isSingleSelectSire1
                                    ? "text-white"
                                    : "text-[var(--text-primary)]"
                                }`}>{sire1 || "Unknown"}</span>
                              </div>
                            );
                          })()}
                          {(() => {
                            const sire2Highlight = sire2 ? getConnectionHighlightByName(sire2, "sire") : null;
                            const isSingleSelectSire2 = selectedConnection?.role === "sire" && sire2 === selectedConnection?.name;
                            const isMultiSelectSire2 = !!sire2Highlight;
                            return (
                              <div 
                                role={sire2 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire2 || "", "sire") ? "button" : undefined}
                                tabIndex={sire2 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire2 || "", "sire") ? 0 : undefined}
                                className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                                  isMultiSelectSire2
                                    ? `${sire2Highlight!.light} rounded border ${sire2Highlight!.border}`
                                    : isSingleSelectSire2
                                    ? "bg-[var(--brand)] rounded"
                                    : sire2 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire2 || "", "sire")
                                    ? "bg-[var(--blue-50)] rounded cursor-pointer hover:bg-[var(--blue-50)]/80"
                                    : ""
                                }`}
                                onClick={() => {
                                  if (sire2) handleConnectionNameClickInStarters(sire2, "sire");
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === " ") && sire2 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire2, "sire")) {
                                    e.preventDefault();
                                    handleConnectionNameClickInStarters(sire2, "sire");
                                  }
                                }}
                              >
                                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] leading-[15px] font-semibold ${
                                  isSingleSelectSire2
                                    ? "bg-white text-[var(--sire)]"
                                    : "bg-[var(--sire)] text-white"
                                }`}>S</span>
                                <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                                  isMultiSelectSire2
                                    ? sire2Highlight!.text
                                    : isSingleSelectSire2
                                    ? "text-white"
                                    : "text-[var(--text-primary)]"
                                }`}>{sire2 || "Unknown"}</span>
                              </div>
                            );
                          })()}
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

