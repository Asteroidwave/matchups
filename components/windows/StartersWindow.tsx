"use client";

import { useMemo, useState } from "react";
import { Connection, Starter } from "@/types";
import { Card } from "@/components/ui/card";

interface StartersWindowProps {
  readonly connections: Connection[];
  readonly selectedConnection: Connection | null;
  readonly onConnectionClick: (connection: Connection | null) => void;
  readonly onConnectionBoxClick?: (connection: Connection) => void;
  readonly matchups?: Array<{ setA: { connections: Connection[] }; setB: { connections: Connection[] } }>;
  readonly onConnectionClickToMatchup?: (connectionId: string, fromConnectedHorsesView: boolean) => void;
}

const trackColors: Record<string, { bg: string; border: string; text: string }> = {
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-700" },
  GP: { bg: "bg-green-500/10", border: "border-green-500", text: "text-green-700" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500", text: "text-purple-700" },
  SA: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-700" },
};

export function StartersWindow({
  connections,
  selectedConnection,
  onConnectionClick,
  onConnectionBoxClick,
  matchups = [],
  onConnectionClickToMatchup,
}: StartersWindowProps) {
  const [selectedTrack, setSelectedTrack] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"horses" | "connected">("horses");
  
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
  
  // Get all unique tracks
  const allTracks = ["BAQ", "GP", "KEE", "SA"];
  
  // Get all starters, filtered by selected connection if filtering
  const allStarters: (Starter & { connectionType: "jockey" | "trainer" | "sire"; connectionName: string })[] = [];
  
  for (const conn of connections) {
    // If "Connected Horses" view is active, only show connections that are in matchups
    if (viewMode === "connected" && !selectedConnection && !matchupConnectionIds.has(conn.id)) {
      continue;
    }
    
    for (const starter of conn.starters) {
      if (starter.scratched) continue;
      
      // Filter by track
      if (selectedTrack !== "ALL" && starter.track !== selectedTrack) continue;
      
      // Filter by selected connection if filtering (works in both horses and connected view)
      if (selectedConnection) {
        const matchesConnection = 
          (selectedConnection.role === "jockey" && starter.jockey === selectedConnection.name) ||
          (selectedConnection.role === "trainer" && starter.trainer === selectedConnection.name) ||
          (selectedConnection.role === "sire" && (starter.sire1 === selectedConnection.name || starter.sire2 === selectedConnection.name));
        
        if (!matchesConnection) {
          continue;
        }
      }
      
      allStarters.push({
        ...starter,
        connectionType: conn.role,
        connectionName: conn.name,
      });
    }
  }
  
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
    const trackOrder = ["BAQ", "GP", "KEE", "SA"];
    const trackDiff = trackOrder.indexOf(trackA) - trackOrder.indexOf(trackB);
    return trackDiff !== 0 ? trackDiff : Number.parseInt(raceA) - Number.parseInt(raceB);
  }).map(([key, starters]) => {
    // Keep first-seen order within the race and assign posts sequentially 1..N
    const seen = new Set<string>();
    const ordered: typeof starters = [] as any;
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
    return [key, ordered] as [string, typeof starters];
  });
 
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
          {selectedConnection && (
            <button
              onClick={() => handleViewModeChange("horses")}
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
          
          {/* Visual Separator */}
          <div className="w-px h-4 bg-[var(--content-15)] mx-01"></div>
          
          {/* Track Filter Buttons */}
          <button
            onClick={() => setSelectedTrack("ALL")}
            className={`px-2 py-1 rounded text-[13px] font-medium transition-colors whitespace-nowrap ${
              selectedTrack === "ALL"
                ? "bg-[var(--btn-default)] text-white"
                : "bg-[var(--blue-50)] text-[var(--brand)] hover:opacity-90"
            }`}
          >
            All Tracks
          </button>
          {allTracks.map((track) => {
            const color = trackColors[track];
            return (
              <button
                key={track}
                onClick={() => setSelectedTrack(track)}
                className={`px-2 py-1 rounded text-[13px] font-medium transition-colors whitespace-nowrap ${
                  selectedTrack === track
                    ? `${color.bg} ${color.text} border-2 ${color.border}`
                    : "bg-[var(--blue-50)] text-[var(--brand)] hover:opacity-90"
                }`}
              >
                {track}
              </button>
            );
          })}
        </div>
        
        {selectedConnection && (
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
            const trackFull = { BAQ: "Belmont", GP: "Gulfstream Park", KEE: "Keeneland", SA: "Santa Anita" } as const;
            const dateStr = "October 3, 2025";
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
                  // @ts-expect-error transient
                  const post = starter.__post as number | undefined;
                  return (
                    <div
                      key={`${starter.track}-${starter.race}-${starter.horseName}`}
                      className={`border-b border-[var(--content-15)] flex items-center gap-3 pl-5 pr-0 py-1 ${idx === starters.length - 1 ? "" : ""}`}
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
                          <div 
                            role={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(jockey, "jockey") ? "button" : undefined}
                            tabIndex={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(jockey, "jockey") ? 0 : undefined}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                              selectedConnection?.role === "jockey" && jockey === selectedConnection?.name
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
                              selectedConnection?.role === "jockey" && jockey === selectedConnection?.name
                                ? "bg-white text-[var(--brand)]"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>J</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              selectedConnection?.role === "jockey" && jockey === selectedConnection?.name
                                ? "text-white"
                                : "text-[var(--text-primary)]"
                            }`}>{jockey}</span>
                          </div>
                          <div 
                            role={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(trainer, "trainer") ? "button" : undefined}
                            tabIndex={viewMode === "connected" && !selectedConnection && isConnectionInMatchups(trainer, "trainer") ? 0 : undefined}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                              selectedConnection?.role === "trainer" && trainer === selectedConnection?.name
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
                              selectedConnection?.role === "trainer" && trainer === selectedConnection?.name
                                ? "bg-white text-[var(--brand)]"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>T</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              selectedConnection?.role === "trainer" && trainer === selectedConnection?.name
                                ? "text-white"
                                : "text-[var(--text-primary)]"
                            }`}>{trainer}</span>
                          </div>
                        </div>
                        <div className="flex w-full">
                          <div 
                            role={sire1 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire1 || "", "sire") ? "button" : undefined}
                            tabIndex={sire1 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire1 || "", "sire") ? 0 : undefined}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                              selectedConnection?.role === "sire" && sire1 === selectedConnection?.name
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
                              selectedConnection?.role === "sire" && sire1 === selectedConnection?.name
                                ? "bg-white text-[var(--brand)]"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>S</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              selectedConnection?.role === "sire" && sire1 === selectedConnection?.name
                                ? "text-white"
                                : "text-[var(--text-primary)]"
                            }`}>{sire1 || "Unknown"}</span>
                          </div>
                          <div 
                            role={sire2 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire2 || "", "sire") ? "button" : undefined}
                            tabIndex={sire2 && viewMode === "connected" && !selectedConnection && isConnectionInMatchups(sire2 || "", "sire") ? 0 : undefined}
                            className={`flex-1 min-w-0 px-3 py-1 flex items-center gap-1.5 ${
                              selectedConnection?.role === "sire" && sire2 === selectedConnection?.name
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
                              selectedConnection?.role === "sire" && sire2 === selectedConnection?.name
                                ? "bg-white text-[var(--brand)]"
                                : "bg-[var(--blue-50)] text-[var(--brand)]"
                            }`}>S</span>
                            <span className={`text-[12px] leading-[18px] font-semibold truncate ${
                              selectedConnection?.role === "sire" && sire2 === selectedConnection?.name
                                ? "text-white"
                                : "text-[var(--text-primary)]"
                            }`}>{sire2 || "Unknown"}</span>
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

