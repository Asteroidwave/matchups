"use client";

import { useState } from "react";
import { Matchup, Starter, Connection } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { setPoints } from "@/lib/scoring";
import { useApp } from "@/contexts/AppContext";

interface MatchupModalProps {
  readonly matchup: Matchup | null;
  readonly selectedSet: "A" | "B";
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
  
  if (!matchup) return null;
  
  const setAPoints = setPoints(matchup.setA);
  const setBPoints = setPoints(matchup.setB);
  
  // Calculate Points/1K (points per 1K salary)
  const setAPointsPer1K = matchup.setA.salaryTotal > 0 ? (setAPoints / matchup.setA.salaryTotal) * 1000 : 0;
  const setBPointsPer1K = matchup.setB.salaryTotal > 0 ? (setBPoints / matchup.setB.salaryTotal) * 1000 : 0;
  
  const getPlaceColor = (place: number | undefined) => {
    if (!place) return "";
    if (place === 1) return "bg-green-100 text-green-800";
    if (place === 2) return "bg-blue-100 text-blue-800";
    if (place === 3) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };
  
  // Use program_number (saddlecloth number) directly from backend data
  const getProgramNumberBadge = (programNumber?: number | null) => {
    if (!programNumber || programNumber < 1) {
      return { bg: "bg-gray-300", text: "text-gray-700", number: null };
    }
    
    // Standard saddlecloth colors (exact hex values from racing app)
    const colors: Record<number, { bg: string; text: string }> = {
      1: { bg: "bg-[#DC2626]", text: "text-white" },
      2: { bg: "bg-[#F0FFFF]", text: "text-black" },
      3: { bg: "bg-[#005CE8]", text: "text-white" },
      4: { bg: "bg-[#ECC94B]", text: "text-black" },
      5: { bg: "bg-[#16A34A]", text: "text-white" },
      6: { bg: "bg-[#800080]", text: "text-white" },
      7: { bg: "bg-[#F97316]", text: "text-black" },
      8: { bg: "bg-[#F9A8D4]", text: "text-black" },
      9: { bg: "bg-[#99F6E4]", text: "text-black" },
      10: { bg: "bg-[#800080]", text: "text-white" },
      11: { bg: "bg-[#000080]", text: "text-white" },
      12: { bg: "bg-[#36CD30]", text: "text-black" },
      13: { bg: "bg-[#8A2CE6]", text: "text-white" },
      14: { bg: "bg-[#817E01]", text: "text-white" },
      15: { bg: "bg-[#ABA96F]", text: "text-black" },
      16: { bg: "bg-[#2A557B]", text: "text-white" },
    };
    
    if (programNumber <= 16 && colors[programNumber]) {
      return { ...colors[programNumber], number: programNumber };
    }
    
    // For numbers > 16, cycle through colors
    const colorArray = Object.values(colors);
    const index = (programNumber - 1) % colorArray.length;
    return { ...colorArray[index], number: programNumber };
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
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-2xl font-bold mb-4">Matchup Details</DialogTitle>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Set A */}
          <div className={`space-y-4 p-4 rounded-xl border-2 ${
            selectedSet === "A" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Set A</h3>
              {selectedSet === "A" && (
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Selected
              </span>
            )}
            </div>
            
            {/* Summary Box - Points more prominent */}
            <div className="bg-gray-100 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-blue-600 mb-2">
                Total Points: {setAPoints.toFixed(1)}
              </div>
              <div className="text-sm items-center text-center space-y-0.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-gray-600 w-[90px] text-right">Total Salary</span>
                  <span className="text-gray-600">:</span>
                  <span className="font-semibold text-gray-900 ml-1">${matchup.setA.salaryTotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-gray-600 w-[90px] text-right">Points/$1K</span>
                  <span className="text-gray-600">:</span>
                  <span className="font-semibold text-gray-900 ml-1">{setAPointsPer1K.toFixed(2)}</span>
              </div>
              </div>
            </div>
            
            {matchup.setA.connections.map((conn) => {
              const tracks = getConnectionTracks(conn);
              const selectedTrack = selectedTrackA[conn.id] ?? null;
              const filteredStarters = getFilteredStarters(conn, selectedTrack);
              const filteredStats = getFilteredStats(conn, selectedTrack);
              
              return (
              <div key={conn.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  {/* Connection Name and Role */}
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
                      {conn.trackSet.map((track) => {
                        const trackColors: Record<string, string> = {
                          BAQ: "bg-blue-500",
                          GP: "bg-green-500",
                          KEE: "bg-purple-500",
                          SA: "bg-red-500",
                        };
                        return (
                          <span key={track} className={`px-1 py-0.5 rounded text-[8px] font-bold text-white ${trackColors[track] || "bg-gray-500"}`}>
                            {track}
                          </span>
                        );
                      })}
                    </div>
                    
                    {/* Connection Details Box - Expanded with Stats */}
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
                          <div className="text-xs text-gray-500 mb-1">AVPA (30D)</div>
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
                  
                  {/* Top Finishes - Larger table without scrolling */}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-700">Top Finishes{tracks.length === 1 ? `: ${tracks[0]}` : ":"}</div>
                      {/* Track Filter Toggle */}
                      {tracks.length > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setTrackFilterA(conn.id, null)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              selectedTrack === null
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            All Tracks
                          </button>
                          {tracks.map((track) => (
                            <button
                              key={track}
                              onClick={() => setTrackFilterA(conn.id, track)}
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
                    
                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-gray-300">
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700">Horse</th>
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700">Race</th>
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700">Finish</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-700">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group starters by track
                            const groupedByTrack = new Map<string, typeof filteredStarters>();
                            for (const starter of filteredStarters) {
                              if (!groupedByTrack.has(starter.track)) {
                                groupedByTrack.set(starter.track, []);
                              }
                              groupedByTrack.get(starter.track)!.push(starter);
                            }
                            
                            const trackList = Array.from(groupedByTrack.keys());
                            const result: JSX.Element[] = [];
                            
                            trackList.forEach((track, trackIdx) => {
                              const starters = groupedByTrack.get(track)!;
                              
                              // Add separator row (except for first track)
                              if (trackIdx > 0) {
                                result.push(
                                  <tr key={`separator-${track}`} className="bg-gray-50">
                                    <td colSpan={4} className="py-2 px-3">
                                      <div className="h-px bg-gray-300"></div>
                                    </td>
                                  </tr>
                                );
                              }
                              
                              // Add track header
                              result.push(
                                <tr key={`header-${track}`} className="bg-gray-100">
                                  <td colSpan={4} className="py-2 px-3 font-bold text-gray-800 text-sm">
                                    {track}
                                  </td>
                                </tr>
                              );
                              
                              // Add starters for this track
                              starters.forEach((starter, idx) => {
                                // Use program_number (saddlecloth number) directly from backend
                                const programNumber = starter.program_number;
                                const badgeStyle = getProgramNumberBadge(programNumber);
                                
                                result.push(
                                  <tr key={`${track}-${idx}`} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] leading-[18px] font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
                                          {programNumber ?? "—"}
                                        </span>
                                        <span className="text-[12px] leading-[18px] text-gray-600 font-medium">{starter.mlOddsFrac || "—"}</span>
                                        <span className="text-[12px] leading-[18px] font-semibold text-gray-900">{starter.horseName}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-gray-600 text-sm">R{starter.race}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPlaceColor(starter.pos)}`}>
                                        {starter.pos || "—"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 text-sm">
                                      {starter.points?.toFixed(2) || "0.00"}
                                    </td>
                                  </tr>
                                );
                              });
                            });
                            
                            return result;
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Set B */}
          <div className={`space-y-4 p-4 rounded-xl border-2 ${
            selectedSet === "B" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Set B</h3>
              {selectedSet === "B" && (
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Selected
              </span>
            )}
            </div>
            
            {/* Summary Box - Points more prominent */}
            <div className="bg-gray-100 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-blue-600 mb-2">
                Total Points: {setBPoints.toFixed(1)}
              </div>
              <div className="text-sm items-center text-center space-y-0.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-gray-600 w-[90px] text-right">Total Salary</span>
                  <span className="text-gray-600">:</span>
                  <span className="font-semibold text-gray-900 ml-1">${matchup.setB.salaryTotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-gray-600 w-[90px] text-right">Points/$1K</span>
                  <span className="text-gray-600">:</span>
                  <span className="font-semibold text-gray-900 ml-1">{setBPointsPer1K.toFixed(2)}</span>
              </div>
              </div>
            </div>
            
            {matchup.setB.connections.map((conn) => {
              const tracks = getConnectionTracks(conn);
              const selectedTrack = selectedTrackB[conn.id] ?? null;
              const filteredStarters = getFilteredStarters(conn, selectedTrack);
              const filteredStats = getFilteredStats(conn, selectedTrack);
              
              return (
              <div key={conn.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  {/* Connection Name and Role */}
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
                      {conn.trackSet.map((track) => {
                        const trackColors: Record<string, string> = {
                          BAQ: "bg-blue-500",
                          GP: "bg-green-500",
                          KEE: "bg-purple-500",
                          SA: "bg-red-500",
                        };
                        return (
                          <span key={track} className={`px-1 py-0.5 rounded text-[8px] font-bold text-white ${trackColors[track] || "bg-gray-500"}`}>
                            {track}
                          </span>
                        );
                      })}
                    </div>
                    
                    {/* Connection Details Box - Expanded with Stats */}
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
                          <div className="text-xs text-gray-500 mb-1">AVPA (30D)</div>
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
                  
                  {/* Top Finishes - Larger table without scrolling */}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-700">Top Finishes{tracks.length === 1 ? `: ${tracks[0]}` : ":"}</div>
                      {/* Track Filter Toggle */}
                      {tracks.length > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setTrackFilterB(conn.id, null)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              selectedTrack === null
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            All Tracks
                          </button>
                          {tracks.map((track) => (
                            <button
                              key={track}
                              onClick={() => setTrackFilterB(conn.id, track)}
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
                    
                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-gray-300">
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700">Horse</th>
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700">Race</th>
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700">Finish</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-700">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group starters by track
                            const groupedByTrack = new Map<string, typeof filteredStarters>();
                            for (const starter of filteredStarters) {
                              if (!groupedByTrack.has(starter.track)) {
                                groupedByTrack.set(starter.track, []);
                              }
                              groupedByTrack.get(starter.track)!.push(starter);
                            }
                            
                            const trackList = Array.from(groupedByTrack.keys());
                            const result: JSX.Element[] = [];
                            
                            trackList.forEach((track, trackIdx) => {
                              const starters = groupedByTrack.get(track)!;
                              
                              // Add separator row (except for first track)
                              if (trackIdx > 0) {
                                result.push(
                                  <tr key={`separator-${track}`} className="bg-gray-50">
                                    <td colSpan={4} className="py-2 px-3">
                                      <div className="h-px bg-gray-300"></div>
                                    </td>
                                  </tr>
                                );
                              }
                              
                              // Add track header
                              result.push(
                                <tr key={`header-${track}`} className="bg-gray-100">
                                  <td colSpan={4} className="py-2 px-3 font-bold text-gray-800 text-sm">
                                    {track}
                                  </td>
                                </tr>
                              );
                              
                              // Add starters for this track
                              starters.forEach((starter, idx) => {
                                // Use program_number (saddlecloth number) directly from backend
                                const programNumber = starter.program_number;
                                const badgeStyle = getProgramNumberBadge(programNumber);
                                
                                result.push(
                                  <tr key={`${track}-${idx}`} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] leading-[18px] font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
                                          {programNumber ?? "—"}
                                        </span>
                                        <span className="text-[12px] leading-[18px] text-gray-600 font-medium">{starter.mlOddsFrac || "—"}</span>
                                        <span className="text-[12px] leading-[18px] font-semibold text-gray-900">{starter.horseName}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-gray-600 text-sm">R{starter.race}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPlaceColor(starter.pos)}`}>
                                        {starter.pos || "—"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 text-sm">
                                      {starter.points?.toFixed(2) || "0.00"}
                                    </td>
                                  </tr>
                                );
                              });
                            });
                            
                            return result;
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
