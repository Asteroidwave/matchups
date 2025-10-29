"use client";

import { useState } from "react";
import { Connection, Starter } from "@/types";
import { Card } from "@/components/ui/card";

interface StartersWindowProps {
  readonly connections: Connection[];
  readonly selectedConnection: Connection | null;
  readonly onConnectionClick: (connection: Connection | null) => void;
  readonly onConnectionBoxClick?: (connection: Connection) => void;
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
}: StartersWindowProps) {
  const [selectedTrack, setSelectedTrack] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"horses" | "connected">("horses");
  
  // Get all unique tracks
  const allTracks = ["BAQ", "GP", "KEE", "SA"];
  
  // Get all starters, filtered by selected connection if filtering
  const allStarters: (Starter & { connectionType: "jockey" | "trainer" | "sire"; connectionName: string })[] = [];
  
  for (const conn of connections) {
    for (const starter of conn.starters) {
      if (starter.scratched) continue;
      
      // Filter by track
      if (selectedTrack !== "ALL" && starter.track !== selectedTrack) continue;
      
      // Filter by selected connection if filtering
      if (selectedConnection && viewMode === "connected") {
        const matchesConnection = 
          (conn.role === "jockey" && starter.jockey === selectedConnection.name) ||
          (conn.role === "trainer" && starter.trainer === selectedConnection.name) ||
          (conn.role === "sire" && (starter.sire1 === selectedConnection.name || starter.sire2 === selectedConnection.name));
        
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
  });
  
  const getPlaceColor = (place?: number) => {
    if (!place || place === 0) return "bg-gray-200 text-gray-700";
    if (place === 1) return "bg-green-500 text-white";
    if (place === 2) return "bg-blue-500 text-white";
    if (place === 3) return "bg-red-500 text-white";
    return "bg-gray-400 text-white";
  };
  
  return (
    <Card className="bg-white h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Starters</h2>
          {selectedConnection && (
            <button
              onClick={() => onConnectionClick(null as any)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear Filter
            </button>
          )}
        </div>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setViewMode("horses")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "horses"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Horses
          </button>
          <button
            onClick={() => setViewMode("connected")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "connected"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Connected Horses
          </button>
        </div>
        
        {/* Track Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTrack("ALL")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedTrack === "ALL"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  selectedTrack === track
                    ? `${color.bg} ${color.text} border-2 ${color.border}`
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {track}
              </button>
            );
          })}
        </div>
        
        {selectedConnection && (
          <div className="mt-3 p-2 bg-blue-50 rounded-md border border-blue-200">
            <div className="text-xs text-gray-600 mb-1">Filtering by:</div>
            <div className="font-semibold text-blue-900">
              {selectedConnection.name} ({selectedConnection.role})
            </div>
            {selectedConnection.trackSet.length > 1 && (
              <div className="text-xs text-blue-700 mt-1">
                Active on {selectedConnection.trackSet.length} tracks
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Race List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {races.map(([key, starters]) => {
          const [track, raceNum] = key.split("-");
          const color = trackColors[track] || trackColors.BAQ;
          
          // Get unique horses in this race
          const uniqueHorses = new Map<string, typeof starters[0]>();
          for (const starter of starters) {
            if (!uniqueHorses.has(starter.horseName)) {
              uniqueHorses.set(starter.horseName, starter);
            }
          }
          
          return (
            <div
              key={key}
              className={`border-2 rounded-lg p-3 ${color.border} ${color.bg}`}
            >
              <div className="font-semibold text-sm text-gray-700 mb-2">
                {track} - Race {raceNum}
              </div>
              
              <div className="space-y-1.5">
                {Array.from(uniqueHorses.values()).map((starter) => (
                  <div
                    key={`${starter.track}-${starter.race}-${starter.horseName}`}
                    className="flex items-center gap-2 bg-white rounded p-2 border border-gray-200 hover:shadow-sm"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${getPlaceColor(starter.pos)}`}>
                      {starter.pos || starter.horseName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {starter.horseName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {starter.jockey && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="text-blue-600 hover:text-blue-800 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              const conn = connections.find(c => c.name === starter.jockey && c.role === "jockey");
                              if (conn) {
                                if (onConnectionBoxClick) {
                                  onConnectionBoxClick(conn);
                                } else {
                                  onConnectionClick(conn);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                const conn = connections.find(c => c.name === starter.jockey && c.role === "jockey");
                                if (conn) {
                                  if (onConnectionBoxClick) {
                                    onConnectionBoxClick(conn);
                                  } else {
                                    onConnectionClick(conn);
                                  }
                                }
                              }
                            }}
                          >
                            J: <span className="font-medium">{starter.jockey}</span>
                          </span>
                        )}
                        {starter.trainer && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="text-green-600 hover:text-green-800 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              const conn = connections.find(c => c.name === starter.trainer && c.role === "trainer");
                              if (conn) {
                                if (onConnectionBoxClick) {
                                  onConnectionBoxClick(conn);
                                } else {
                                  onConnectionClick(conn);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                const conn = connections.find(c => c.name === starter.trainer && c.role === "trainer");
                                if (conn) {
                                  if (onConnectionBoxClick) {
                                    onConnectionBoxClick(conn);
                                  } else {
                                    onConnectionClick(conn);
                                  }
                                }
                              }
                            }}
                          >
                            T: <span className="font-medium">{starter.trainer}</span>
                          </span>
                        )}
                        {(starter.sire1 || starter.sire2) && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="text-amber-600 hover:text-amber-800 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              const conn = connections.find(c => 
                                (c.name === starter.sire1 || c.name === starter.sire2) && c.role === "sire"
                              );
                              if (conn) {
                                if (onConnectionBoxClick) {
                                  onConnectionBoxClick(conn);
                                } else {
                                  onConnectionClick(conn);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                const conn = connections.find(c => 
                                  (c.name === starter.sire1 || c.name === starter.sire2) && c.role === "sire"
                                );
                                if (conn) {
                                  if (onConnectionBoxClick) {
                                    onConnectionBoxClick(conn);
                                  } else {
                                    onConnectionClick(conn);
                                  }
                                }
                              }
                            }}
                          >
                            S: <span className="font-medium">{starter.sire1 || starter.sire2}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {starter.mlOddsFrac || "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

