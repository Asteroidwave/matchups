"use client";

import { useState } from "react";
import { Connection, Starter } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, ChevronDown, ChevronRight } from "lucide-react";

interface ConnectionModalProps {
  connection: Connection | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PastPerformance {
  date: string;
  track: string;
  races: Array<{
    race: number;
    horse: string;
    position: number;
    points: number;
    odds: string;
  }>;
  summary: {
    salary: number;
    appearances: number;
    avpa: number;
    score: number;
  };
}

// Generate fake past performance data (1-5 races)
function generatePastPerformance(connection: Connection): PastPerformance[] {
  const performances: PastPerformance[] = [];
  const numPerformances = Math.floor(Math.random() * 5) + 1; // 1-5
  
  const dates = [
    "October 25, 2025",
    "October 23, 2025",
    "October 20, 2025",
    "October 18, 2025",
    "October 15, 2025",
  ];
  
  const tracks = connection.trackSet.length > 0 ? connection.trackSet : ["BAQ", "GP", "KEE", "SA"];
  
  for (let i = 0; i < numPerformances; i++) {
    const date = dates[i] || `October ${25 - i}, 2025`;
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    const numRaces = Math.floor(Math.random() * 3) + 1; // 1-3 races per day
    
    const races = [];
    let totalPoints = 0;
    let totalSalary = 0;
    
    for (let j = 0; j < numRaces; j++) {
      const race = j + 1;
      const position = Math.random() > 0.6 ? Math.floor(Math.random() * 6) + 1 : 0; // 60% chance of placing
      const points = position >= 1 && position <= 3 
        ? (Math.random() * 40 + 10).toFixed(2)
        : "0.00";
      const odds = `${Math.floor(Math.random() * 20) + 1}/${Math.floor(Math.random() * 5) + 1}`;
      const salary = Math.floor(Math.random() * 1500) + 500;
      
      races.push({
        race,
        horse: `Horse ${i + 1}-${j + 1}`,
        position,
        points: parseFloat(points),
        odds,
      });
      
      totalPoints += parseFloat(points);
      totalSalary += salary;
    }
    
    performances.push({
      date,
      track,
      races,
      summary: {
        salary: totalSalary,
        appearances: numRaces,
        avpa: totalSalary > 0 ? (1000 * totalPoints) / totalSalary : 0,
        score: totalPoints * 1.5, // Score calculation
      },
    });
  }
  
  return performances;
}

const trackColors: Record<string, { bg: string; border: string }> = {
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500" },
  GP: { bg: "bg-green-500/10", border: "border-green-500" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500" },
  SA: { bg: "bg-red-500/10", border: "border-red-500" },
};

export function ConnectionModal({ connection, isOpen, onClose }: ConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<"connected" | "scratch" | "past">("connected");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  
  if (!connection) return null;
  
  const pastPerformance = generatePastPerformance(connection);
  
  // Group starters by race for "Connected Horses" tab
  const racesMap = new Map<string, Starter[]>();
  
  for (const starter of connection.starters) {
    if (starter.scratched) continue;
    
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
    return trackDiff !== 0 ? trackDiff : parseInt(raceA) - parseInt(raceB);
  });
  
  const roleColor = {
    jockey: "bg-blue-600",
    trainer: "bg-green-600",
    sire: "bg-amber-600",
  }[connection.role];
  
  const getPlaceColor = (place?: number) => {
    if (!place || place === 0) return "bg-gray-500 text-white";
    if (place === 1) return "bg-green-500 text-white";
    if (place === 2) return "bg-blue-500 text-white";
    if (place === 3) return "bg-red-500 text-white";
    return "bg-gray-400 text-white";
  };
  
  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className={`${roleColor} text-white p-6 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {connection.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{connection.name}</h2>
              <div className="text-white/90">{connection.role.toUpperCase()}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-white/80">Avg Odds</div>
              <div className="text-xl font-bold">{connection.avgOdds.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-white/80">Appearances</div>
              <div className="text-xl font-bold">{connection.apps}</div>
            </div>
            <div>
              <div className="text-white/80">AVPA</div>
              <div className="text-xl font-bold">{connection.avpa30d.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-white/80">Salary</div>
              <div className="text-xl font-bold">${connection.salarySum.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab("connected")}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === "connected"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Connected Horses
            {activeTab === "connected" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("scratch")}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === "scratch"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Scratch Adjustment
            {activeTab === "scratch" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === "past"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Past Performance
            {activeTab === "past" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {activeTab === "connected" && (
            <>
              <h3 className="text-xl font-bold mb-4">Connected Horses</h3>
              
              <div className="space-y-4">
                {races.map(([key, starters]) => {
                  const [track, raceNum] = key.split("-");
                  const trackColor = trackColors[track] || { bg: "bg-gray-500/10", border: "border-gray-500" };
                  
                  return (
                    <div
                      key={key}
                      className={`border-2 rounded-lg p-4 ${trackColor.border} ${trackColor.bg}`}
                    >
                      <div className="font-semibold text-sm text-gray-600 mb-3">
                        {track} - Race {raceNum}
                      </div>
                      
                      <div className="space-y-2">
                        {starters.map((starter, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${getPlaceColor(starter.pos)}`}
                              >
                                {starter.pos || "—"}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{starter.horseName}</div>
                                <div className="text-xs text-gray-500">
                                  {starter.mlOddsFrac || "N/A"}
                                </div>
                              </div>
                            </div>
                            
                            {/* Connections */}
                            <div className="flex items-center gap-2">
                              {starter.jockey && (
                                <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  J: {starter.jockey}
                                </div>
                              )}
                              {starter.trainer && (
                                <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                  T: {starter.trainer}
                                </div>
                              )}
                              {(starter.sire1 || starter.sire2) && (
                                <div className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                                  S: {starter.sire1 || starter.sire2}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          
          {activeTab === "scratch" && (
            <div className="text-center py-8 text-gray-500">
              Scratch adjustment data coming soon
            </div>
          )}
          
          {activeTab === "past" && (
            <>
              <h3 className="text-xl font-bold mb-4">Past Performance</h3>
              
              <div className="space-y-4">
                {pastPerformance.map((perf, idx) => {
                  const isExpanded = expandedDates.has(perf.date);
                  
                  return (
                    <div key={idx} className="border border-gray-200 rounded-lg">
                      <div
                        className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleDate(perf.date)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                          <div className="font-semibold text-gray-900">{perf.date} {perf.track}</div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Salary:</span>{" "}
                            <span className="font-semibold">${perf.summary.salary.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Apps:</span>{" "}
                            <span className="font-semibold">{perf.summary.appearances}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">AVPA:</span>{" "}
                            <span className="font-semibold">{perf.summary.avpa.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Score:</span>{" "}
                            <span className="font-semibold">{perf.summary.score.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-200">
                          <div className="space-y-2">
                            {perf.races.map((race, raceIdx) => (
                              <div
                                key={raceIdx}
                                className="grid grid-cols-4 gap-4 p-2 bg-white rounded border border-gray-100 hover:bg-gray-50"
                              >
                                <div className="font-medium text-gray-900">Race {race.race}</div>
                                <div className="text-gray-700">{race.horse}</div>
                                <div>
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${getPlaceColor(race.position)}`}>
                                    {race.position === 0 ? "—" : `${race.position}st`}
                                  </span>
                                </div>
                                <div className="text-right font-semibold text-gray-900">
                                  {race.points.toFixed(2)} pts
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
