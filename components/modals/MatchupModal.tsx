"use client";

import { Matchup } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConnectionCard } from "@/components/cards/ConnectionCard";
import { setPoints, setAvpaRace } from "@/lib/scoring";

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
  if (!matchup) return null;
  
  const setAPoints = setPoints(matchup.setA);
  const setBPoints = setPoints(matchup.setB);
  const setAAvpa = setAvpaRace(matchup.setA);
  const setBAvpa = setAvpaRace(matchup.setB);
  
  const getPlaceColor = (place: number | undefined) => {
    if (!place) return "";
    if (place === 1) return "bg-green-100 text-green-800";
    if (place === 2) return "bg-blue-100 text-blue-800";
    if (place === 3) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
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
            
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <div className="text-sm text-gray-600 mb-1">Total Salary</div>
              <div className="text-2xl font-bold text-gray-900">
                ${matchup.setA.salaryTotal.toLocaleString()}
              </div>
              <div className="mt-2 text-lg font-semibold text-blue-600">
                {setAPoints.toFixed(1)} pts
              </div>
              <div className="text-sm font-medium text-gray-700 mt-1">
                AVPA (Race): {setAAvpa.toFixed(1)}
              </div>
            </div>
            
            {matchup.setA.connections.map((conn) => (
              <div key={conn.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <ConnectionCard connection={conn} compact />
                
                {/* Connection Points & AVPA */}
                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Points</div>
                    <div className="font-semibold text-gray-900">{conn.pointsSum.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">AVPA (Race)</div>
                    <div className="font-semibold text-gray-900">{conn.avpaRace.toFixed(1)}</div>
                  </div>
                </div>
                
                {/* Top Finishes - Table Format (includes all races, even 0 points) */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Top Finishes:</div>
                  <div className="overflow-x-auto max-h-[132px] overflow-y-auto border border-gray-200 rounded">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Horse</th>
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Track</th>
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Race</th>
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Finish</th>
                          <th className="text-right py-1 px-2 font-semibold text-gray-700">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Group starters by track
                          const groupedByTrack = new Map<string, typeof conn.starters>();
                          for (const starter of conn.starters) {
                            if (!groupedByTrack.has(starter.track)) {
                              groupedByTrack.set(starter.track, []);
                            }
                            groupedByTrack.get(starter.track)!.push(starter);
                          }
                          
                          const tracks = Array.from(groupedByTrack.keys());
                          const result: JSX.Element[] = [];
                          
                          tracks.forEach((track, trackIdx) => {
                            const starters = groupedByTrack.get(track)!;
                            
                            // Add separator row (except for first track)
                            if (trackIdx > 0) {
                              result.push(
                                <tr key={`separator-${track}`} className="bg-gray-100">
                                  <td colSpan={5} className="py-1 px-2">
                                    <div className="h-px bg-gray-300"></div>
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Add track header
                            result.push(
                              <tr key={`header-${track}`} className="bg-gray-50">
                                <td colSpan={5} className="py-1 px-2 font-semibold text-gray-700 text-[10px]">
                                  {track}
                                </td>
                              </tr>
                            );
                            
                            // Add starters for this track
                            starters.forEach((starter, idx) => {
                              result.push(
                                <tr key={`${track}-${idx}`} className="border-b border-gray-100">
                                  <td className="py-1 px-2 text-gray-900">{starter.horseName}</td>
                                  <td className="py-1 px-2 text-gray-600">{starter.track}</td>
                                  <td className="py-1 px-2 text-gray-600">R{starter.race}</td>
                                  <td className="py-1 px-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPlaceColor(starter.pos)}`}>
                                      {starter.pos || "—"}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2 text-right font-medium text-gray-900">
                                    {starter.points?.toFixed(1) || 0}
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
            ))}
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
            
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <div className="text-sm text-gray-600 mb-1">Total Salary</div>
              <div className="text-2xl font-bold text-gray-900">
                ${matchup.setB.salaryTotal.toLocaleString()}
              </div>
              <div className="mt-2 text-lg font-semibold text-blue-600">
                {setBPoints.toFixed(1)} pts
              </div>
              <div className="text-sm font-medium text-gray-700 mt-1">
                AVPA (Race): {setBAvpa.toFixed(1)}
              </div>
            </div>
            
            {matchup.setB.connections.map((conn) => (
              <div key={conn.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <ConnectionCard connection={conn} compact />
                
                {/* Connection Points & AVPA */}
                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Points</div>
                    <div className="font-semibold text-gray-900">{conn.pointsSum.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">AVPA (Race)</div>
                    <div className="font-semibold text-gray-900">{conn.avpaRace.toFixed(1)}</div>
                  </div>
                </div>
                
                {/* Top Finishes - Table Format (includes all races, even 0 points) */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Top Finishes:</div>
                  <div className="overflow-x-auto max-h-[132px] overflow-y-auto border border-gray-200 rounded">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Horse</th>
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Track</th>
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Race</th>
                          <th className="text-left py-1 px-2 font-semibold text-gray-700">Finish</th>
                          <th className="text-right py-1 px-2 font-semibold text-gray-700">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Group starters by track
                          const groupedByTrack = new Map<string, typeof conn.starters>();
                          for (const starter of conn.starters) {
                            if (!groupedByTrack.has(starter.track)) {
                              groupedByTrack.set(starter.track, []);
                            }
                            groupedByTrack.get(starter.track)!.push(starter);
                          }
                          
                          const tracks = Array.from(groupedByTrack.keys());
                          const result: JSX.Element[] = [];
                          
                          tracks.forEach((track, trackIdx) => {
                            const starters = groupedByTrack.get(track)!;
                            
                            // Add separator row (except for first track)
                            if (trackIdx > 0) {
                              result.push(
                                <tr key={`separator-${track}`} className="bg-gray-100">
                                  <td colSpan={5} className="py-1 px-2">
                                    <div className="h-px bg-gray-300"></div>
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Add track header
                            result.push(
                              <tr key={`header-${track}`} className="bg-gray-50">
                                <td colSpan={5} className="py-1 px-2 font-semibold text-gray-700 text-[10px]">
                                  {track}
                                </td>
                              </tr>
                            );
                            
                            // Add starters for this track
                            starters.forEach((starter, idx) => {
                              result.push(
                                <tr key={`${track}-${idx}`} className="border-b border-gray-100">
                                  <td className="py-1 px-2 text-gray-900">{starter.horseName}</td>
                                  <td className="py-1 px-2 text-gray-600">{starter.track}</td>
                                  <td className="py-1 px-2 text-gray-600">R{starter.race}</td>
                                  <td className="py-1 px-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPlaceColor(starter.pos)}`}>
                                      {starter.pos || "—"}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2 text-right font-medium text-gray-900">
                                    {starter.points?.toFixed(1) || 0}
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
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
