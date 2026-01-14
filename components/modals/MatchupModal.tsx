"use client";

import { useState } from "react";
import { Matchup, Starter, Connection } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { setPoints } from "@/lib/scoring";
import { useApp } from "@/contexts/AppContext";

interface MatchupModalProps {
  readonly matchup: Matchup | null;
  readonly selectedSet: "A" | "B" | "C";
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function MatchupModal({
  matchup,
  selectedSet,
  isOpen,
  onClose,
}: MatchupModalProps) {
  const { connections } = useApp();
  const [selectedTrackA, setSelectedTrackA] = useState<Record<string, string | null>>({});
  const [selectedTrackB, setSelectedTrackB] = useState<Record<string, string | null>>({});
  const [selectedTrackC, setSelectedTrackC] = useState<Record<string, string | null>>({});
  
  if (!matchup) return null;
  
  const is3Way = !!matchup.setC && matchup.setC.connections.length > 0;
  
  const setAPoints = setPoints(matchup.setA);
  const setBPoints = setPoints(matchup.setB);
  const setCPoints = matchup.setC ? setPoints(matchup.setC) : 0;
  
  // Calculate Points/1K (points per 1K salary)
  const setAPointsPer1K = matchup.setA.salaryTotal > 0 ? (setAPoints / matchup.setA.salaryTotal) * 1000 : 0;
  const setBPointsPer1K = matchup.setB.salaryTotal > 0 ? (setBPoints / matchup.setB.salaryTotal) * 1000 : 0;
  const setCPointsPer1K = matchup.setC && matchup.setC.salaryTotal > 0 ? (setCPoints / matchup.setC.salaryTotal) * 1000 : 0;
  
  const getPlaceColor = (place: number | undefined) => {
    if (!place) return "";
    if (place === 1) return "bg-green-100 text-green-800";
    if (place === 2) return "bg-blue-100 text-blue-800";
    if (place === 3) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };
  
  // Calculate post positions for ALL starters (EXACT same logic as StartersWindow)
  // We need ALL starters from ALL connections in the app to get the correct post positions (matching starters panel)
  const calculatePostPositions = () => {
    const postPositionsMap = new Map<string, Map<string, number>>();
    
    // Build all starters array from ALL connections (preserving order) - EXACT same as StartersWindow
    const allStartersList: Starter[] = [];
    for (const conn of connections) {
      for (const starter of conn.starters) {
        if (starter.scratched) continue;
        allStartersList.push(starter);
      }
    }
    
    // Group by race (preserving order from allStartersList)
    const allRacesMap = new Map<string, Starter[]>();
    for (const starter of allStartersList) {
      const raceKey = `${starter.track}-${starter.race}`;
      if (!allRacesMap.has(raceKey)) {
        allRacesMap.set(raceKey, []);
      }
      allRacesMap.get(raceKey)!.push(starter);
    }
    
    // Assign post positions within each race (EXACT same logic as StartersWindow)
    for (const [raceKey, raceStarters] of Array.from(allRacesMap.entries())) {
      // Keep first-seen order within the race and assign posts sequentially 1..N
      const seen = new Set<string>();
      const ordered: Starter[] = [];
      for (const s of raceStarters) {
        if (seen.has(s.horseName)) continue;
        seen.add(s.horseName);
        ordered.push(s);
      }
      
      const racePostMap = new Map<string, number>();
      let post = 1;
      for (const s of ordered) {
        const horseKey = `${s.track}-${s.race}-${s.horseName}`;
        racePostMap.set(horseKey, post++);
      }
      postPositionsMap.set(raceKey, racePostMap);
    }
    
    return postPositionsMap;
  };
  
  // Calculate post positions once using ALL connections (matching starters panel)
  const postPositionsMap = calculatePostPositions();
  
  const getPostBadge = (post?: number) => {
    if (!post) return "bg-gray-300 text-gray-700";
    const palette = ["bg-green-500", "bg-blue-500", "bg-red-500", "bg-amber-500", "bg-purple-500", "bg-teal-500"];
    const color = palette[(post - 1) % palette.length];
    return `${color} text-white`;
  };
  
  // Get unique tracks for a connection
  const getConnectionTracks = (conn: Connection): string[] => {
    const tracks = new Set<string>();
    for (const starter of conn.starters) {
      tracks.add(starter.track);
    }
    return Array.from(tracks).sort();
  };
  
  // Get filtered starters for a connection based on selected track
  const getFilteredStarters = (conn: Connection, selectedTrack: string | null): Starter[] => {
    if (!selectedTrack) return conn.starters;
    return conn.starters.filter(s => s.track === selectedTrack);
  };
  
  // Calculate filtered stats for a connection based on selected track
  const getFilteredStats = (conn: Connection, selectedTrack: string | null) => {
    const filteredStarters = getFilteredStarters(conn, selectedTrack);
    
    const filteredSalary = filteredStarters.reduce((sum, s) => sum + (s.salary || 0), 0);
    const filteredPoints = filteredStarters.reduce((sum, s) => {
      // Only count points for top 3 finishes
      if (s.pos && s.pos >= 1 && s.pos <= 3) {
        return sum + (s.points || 0);
      }
      return sum;
    }, 0);
    const filteredApps = filteredStarters.length;
    
    // Calculate average odds from filtered starters
    const oddsValues: number[] = [];
    for (const starter of filteredStarters) {
      if (starter.decimalOdds && starter.decimalOdds > 0) {
        oddsValues.push(starter.decimalOdds);
      } else if (starter.mlOddsFrac) {
        // Try to parse fractional odds (e.g., "5/2" -> 3.5)
        const parts = starter.mlOddsFrac.split('/');
        if (parts.length === 2) {
          const num = Number.parseFloat(parts[0]);
          const den = Number.parseFloat(parts[1]);
          if (!Number.isNaN(num) && !Number.isNaN(den) && den > 0) {
            oddsValues.push(1 + (num / den));
          }
        }
      }
    }
    const filteredAvgOdds = oddsValues.length > 0 
      ? oddsValues.reduce((sum, val) => sum + val, 0) / oddsValues.length 
      : conn.avgOdds;
    
    const filteredPointsPer1K = filteredSalary > 0 ? (filteredPoints / filteredSalary) * 1000 : 0;
    
    return {
      salary: filteredSalary,
      points: filteredPoints,
      apps: filteredApps,
      avgOdds: filteredAvgOdds,
      pointsPer1K: filteredPointsPer1K,
      avpa30d: conn.avpa30d, // Keep original AVPA 30D as it's not track-specific
    };
  };
  
  const setTrackFilterA = (connId: string, track: string | null) => {
    setSelectedTrackA((prev) => ({
      ...prev,
      [connId]: track,
    }));
  };
  
  const setTrackFilterB = (connId: string, track: string | null) => {
    setSelectedTrackB((prev) => ({
      ...prev,
      [connId]: track,
    }));
  };
  
  const setTrackFilterC = (connId: string, track: string | null) => {
    setSelectedTrackC((prev) => ({
      ...prev,
      [connId]: track,
    }));
  };
  
  // Helper function to render a set panel
  const renderSetPanel = (
    setSide: typeof matchup.setA, 
    setLabel: "A" | "B" | "C", 
    setPointsVal: number, 
    pointsPer1K: number,
    selectedTrackState: Record<string, string | null>,
    setTrackFilter: (connId: string, track: string | null) => void
  ) => (
    <div className={`space-y-4 p-4 rounded-xl border-2 ${
      selectedSet === setLabel ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
    }`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Set {setLabel}</h3>
        {selectedSet === setLabel && (
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
            Selected
          </span>
        )}
      </div>
      
      {/* Summary Box */}
      <div className="bg-gray-100 rounded-lg p-2 text-center">
        <div className="text-xl font-bold text-blue-600 mb-2">
          Total Points: {setPointsVal.toFixed(1)}
        </div>
        <div className="text-sm items-center text-center space-y-0.5">
          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-600 w-[90px] text-right">Total Salary</span>
            <span className="text-gray-600">:</span>
            <span className="font-semibold text-gray-900 ml-1">${setSide.salaryTotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-600 w-[90px] text-right">Points/$1K</span>
            <span className="text-gray-600">:</span>
            <span className="font-semibold text-gray-900 ml-1">{pointsPer1K.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {setSide.connections.map((conn) => {
        const tracks = getConnectionTracks(conn);
        const selectedTrack = selectedTrackState[conn.id] ?? null;
        const filteredStarters = getFilteredStarters(conn, selectedTrack);
        const filteredStats = getFilteredStats(conn, selectedTrack);
        
        return (
          <div key={conn.id} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="font-bold text-base text-gray-900">{conn.name}</div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  conn.role === "jockey" ? "bg-blue-100 text-blue-800" :
                  conn.role === "trainer" ? "bg-green-100 text-green-800" :
                  "bg-amber-100 text-amber-800"
                }`}>
                  {conn.role.toUpperCase()}
                </span>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Apps</div>
                    <div className="font-bold text-sm text-gray-900">{filteredStats.apps}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Avg Odds</div>
                    <div className="font-bold text-sm text-gray-900">
                      {filteredStats.avgOdds > 0 ? filteredStats.avgOdds.toFixed(1) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">AVPA (90D)</div>
                    <div className="font-bold text-sm text-gray-900">
                      {filteredStats.avpa30d > 0 ? filteredStats.avpa30d.toFixed(1) : "—"}
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Salary</div>
                      <div className="font-bold text-sm text-gray-900">${filteredStats.salary.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Points</div>
                      <div className="font-bold text-lg text-gray-900">{filteredStats.points.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Points/1K$</div>
                      <div className="font-bold text-lg text-gray-900">{filteredStats.pointsPer1K.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Top Finishes */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Top Finishes{tracks.length === 1 ? `: ${tracks[0]}` : ":"}</div>
                {tracks.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setTrackFilter(conn.id, null)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedTrack === null
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      All
                    </button>
                    {tracks.map((track) => (
                      <button
                        key={track}
                        onClick={() => setTrackFilter(conn.id, track)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedTrack === track
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {track}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Starters table - simplified for space */}
              <div className="border border-gray-300 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-2 px-2 text-xs font-semibold text-gray-700">Horse</th>
                      <th className="text-left py-2 px-2 text-xs font-semibold text-gray-700">Fin</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStarters.slice(0, 10).map((starter, idx) => {
                      const raceKey = `${starter.track}-${starter.race}`;
                      const horseKey = `${starter.track}-${starter.race}-${starter.horseName}`;
                      const racePostMap = postPositionsMap.get(raceKey);
                      const post = racePostMap?.get(horseKey);
                      
                      return (
                        <tr key={idx} className="border-b border-gray-200">
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1">
                              <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-semibold ${
                                post ? getPostBadge(post) : "bg-gray-300 text-gray-700"
                              }`}>
                                {post || "—"}
                              </span>
                              <span className="text-xs font-medium text-gray-900 truncate max-w-20">{starter.horseName}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPlaceColor(starter.pos)}`}>
                              {starter.pos || "—"}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right font-medium text-gray-900 text-xs">
                            {starter.points?.toFixed(1) || "0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${is3Way ? "max-w-7xl" : "max-w-6xl"} max-h-[90vh] overflow-y-auto`}>
        <DialogTitle className="text-2xl font-bold mb-4 flex items-center gap-3">
          Matchup Details
          {is3Way && (
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-600 border border-purple-500/30 rounded text-sm font-semibold">
              1v1v1
            </span>
          )}
        </DialogTitle>
        
        <div className={`grid gap-4 ${is3Way ? "grid-cols-3" : "grid-cols-2"}`}>
          {/* Set A */}
          {renderSetPanel(matchup.setA, "A", setAPoints, setAPointsPer1K, selectedTrackA, setTrackFilterA)}
          
          {/* Set B */}
          {renderSetPanel(matchup.setB, "B", setBPoints, setBPointsPer1K, selectedTrackB, setTrackFilterB)}
          
          {/* Set C (only for 3-way) */}
          {is3Way && matchup.setC && renderSetPanel(matchup.setC, "C", setCPoints, setCPointsPer1K, selectedTrackC, setTrackFilterC)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

