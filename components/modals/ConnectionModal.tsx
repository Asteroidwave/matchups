"use client";

import React, { useState } from "react";
import { Connection, Starter } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

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
        points: Number.parseFloat(points),
        odds,
      });
      
      totalPoints += Number.parseFloat(points);
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
  const [activeTab, setActiveTab] = useState<"connected" | "past">("connected");
  const { connections: allConnections } = useApp();
  
  if (!connection) return null;
  
  const pastPerformance = generatePastPerformance(connection);
  
  // Group starters by track and race for "Connected Horses" tab
  const racesMap = new Map<string, Starter[]>();
  
  for (const starter of connection.starters) {
    if (starter.scratched) continue;
    
    const key = `${starter.track}-${starter.race}`;
    if (!racesMap.has(key)) {
      racesMap.set(key, []);
    }
    racesMap.get(key)!.push(starter);
  }
  
  // Sort by track then by race
  const races = Array.from(racesMap.entries()).sort(([a], [b]) => {
    const [trackA, raceA] = a.split("-");
    const [trackB, raceB] = b.split("-");
    const trackOrder = ["BAQ", "GP", "KEE", "SA"];
    const trackDiff = trackOrder.indexOf(trackA) - trackOrder.indexOf(trackB);
    return trackDiff !== 0 ? trackDiff : Number.parseInt(raceA) - Number.parseInt(raceB);
  });
  
  // Track full names mapping
  const trackFullName: Record<string, string> = {
    BAQ: "Belmont",
    GP: "Gulfstream Park",
    KEE: "Keeneland",
    SA: "Santa Anita",
  };
  
  // Background color for the header based on role (single color)
  const headerBg = {
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

  // Calculate post positions for starters (EXACT same logic as StartersWindow)
  // We need ALL starters from ALL connections to get the correct post positions
  const postPositionsMap = new Map<string, Map<string, number>>();
  
  // Build all starters array in the EXACT same way as StartersWindow (preserving order)
  const allStartersList: Starter[] = [];
  for (const conn of allConnections) {
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
    // This matches StartersWindow lines 98-110 exactly
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
  
  const getPostBadge = (post?: number) => {
    if (!post) return "bg-gray-300 text-gray-700";
    const palette = ["bg-green-500", "bg-blue-500", "bg-red-500", "bg-amber-500", "bg-purple-500", "bg-teal-500"];
    const color = palette[(post - 1) % palette.length];
    return `${color} text-white`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[880px] max-h-[90vh] p-0 flex flex-col">
        {/* Header - Single color design with overlapping circle */}
        <div className={`relative h-[162px] ${headerBg} text-white`}>
          <button
            onClick={onClose}
            className="absolute top-5 right-4 text-white hover:bg-white/20 rounded-full p-1 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Name and role section */}
          <div className="pt-[44px] px-6 pb-4">
            <div className="pl-[172px] flex items-center gap-3 h-[28px]">
              <h2 className="text-[20px] font-semibold leading-[28px]">{connection.name}</h2>
              <div className="text-[14px] font-medium leading-[20px] text-white/80">{connection.role.toUpperCase()}</div>
            </div>
          </div>
          
          {/* Stats section */}
          <div className="px-6 pb-5 pt-4">
            <div className="pl-[172px] flex items-end gap-[34px] h-full pb-4">
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">{connection.avgOdds.toFixed(2)}</div>
                <div className="text-[12px] font-medium leading-[18px] text-white/80">AVG. ODDS</div>
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">{String(connection.apps).padStart(2, '0')}</div>
                <div className="text-[12px] font-medium leading-[18px] text-white/80">APPEARANCES</div>
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">{connection.avpa30d.toFixed(2)}</div>
                <div className="text-[12px] font-medium leading-[18px] text-white/80">AVPA</div>
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">${connection.salarySum.toLocaleString()}</div>
                <div className="text-[12px] font-medium leading-[18px] text-white/80">SALARY</div>
              </div>
            </div>
          </div>
          
          {/* Circle avatar overlapping header */}
          <div className="absolute left-[34px] top-[34px] w-[108px] h-[108px] rounded-full bg-[var(--content-15)] flex items-center justify-center text-[64px] font-semibold leading-normal text-[var(--content-9)] z-20">
            {connection.name.charAt(0)}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="bg-[var(--surface-1)] border-b border-[var(--content-16)] flex items-end px-5 pt-2 h-12">
          <button
            onClick={() => setActiveTab("connected")}
            className={`px-3 py-2 font-medium text-[16px] leading-[24px] transition-colors relative flex flex-col items-center ${
              activeTab === "connected"
                ? "text-[var(--text-primary)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>Connected Horses</span>
            {activeTab === "connected" && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--brand)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`px-3 py-2 font-medium text-[16px] leading-[24px] transition-colors relative flex flex-col items-center ${
              activeTab === "past"
                ? "text-[var(--text-primary)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>Past Performance</span>
            {activeTab === "past" && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--brand)]" />
            )}
          </button>
        </div>
        
        {/* Content - Fixed height to prevent jumping */}
        <div className="overflow-y-auto" style={{ height: '500px' }}>
          {activeTab === "connected" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Table Header - Sticky (matching Figma table-header) */}
                <thead className="sticky top-0 bg-white border-b border-[var(--content-15)] z-10">
                  <tr>
                    <th colSpan={2} className="border-b border-[var(--content-15)] pb-1 pl-5 pr-0 pt-2 text-left">
                      <div className="flex items-center">
                        <div className="flex flex-col gap-2 w-[140px]">
                          <p className="font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">Horse</p>
                        </div>
                        <div className="flex flex-col flex-1 ml-[144px]">
                          <p className="font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">Connections</p>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {races.map(([key, starters]) => {
                    const [track, raceNum] = key.split("-");
                    const trackName = trackFullName[track] || track;
                    
                    return (
                      <React.Fragment key={key}>
                        {/* Div.rack.track.group.component - Race Header (gray band) */}
                        <tr className="bg-[var(--content-15)]">
                          <td colSpan={2} className="px-5 py-1 text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                            October 3, 2025, {trackName}, Race {raceNum}
                          </td>
                        </tr>
                        
                        {/* Horse rows for this race - table-header style */}
                        {starters.map((starter, idx) => {
                          // Get post position for this starter
                          const raceKey = `${starter.track}-${starter.race}`;
                          const horseKey = `${starter.track}-${starter.race}-${starter.horseName}`;
                          const racePostMap = postPositionsMap.get(raceKey);
                          const post = racePostMap?.get(horseKey);
                          
                          return (
                            <tr key={`${key}-${idx}`} className="border-b border-[var(--content-15)]">
                              {/* Horse Column - div.top style (140px width matching Figma) */}
                              <td className="w-[140px] py-3 pl-5 pr-0 align-top">
                                <div className="flex flex-col gap-2">
                                  {/* PP and Odds */}
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] font-semibold leading-[18px] ${
                                      post ? getPostBadge(post) : "bg-gray-300 text-gray-700"
                                    }`}>
                                      {post || "—"}
                                    </span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {starter.mlOddsFrac || "—"}
                                    </span>
                                  </div>
                                  {/* Horse Name */}
                                  <div>
                                    <div className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {starter.horseName}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {/* Connections Column - Frame style with 144px gap from horse column */}
                              <td className="flex-1 pl-[144px] align-top">
                                <div className="flex flex-col">
                                  {/* Top row: Jockey and Trainer */}
                                  <div className="flex border-b border-[var(--content-15)]">
                                    <div className={`flex-1 border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "jockey" && starter.jockey === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">J</span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.jockey || "—"}
                                      </span>
                                    </div>
                                    <div className={`flex-1 px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "trainer" && starter.trainer === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">T</span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.trainer || "—"}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Bottom row: Sire 1 and Sire 2 */}
                                  <div className="flex">
                                    <div className={`flex-1 border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "sire" && starter.sire1 === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.sire1 || "—"}
                                      </span>
                                    </div>
                                    <div className={`flex-1 px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "sire" && starter.sire2 === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.sire2 || "—"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {activeTab === "past" && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b border-[var(--content-15)]">
                  <tr>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Race</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Horse</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Finish Position</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Group by track/date for separators
                    const grouped = new Map<string, Array<{ perf: PastPerformance; raceIdx: number; race: typeof pastPerformance[0]['races'][0] }>>();
                    
                    pastPerformance.forEach((perf, perfIdx) => {
                      perf.races.forEach((race, raceIdx) => {
                        const key = `${perf.date}-${perf.track}`;
                        if (!grouped.has(key)) {
                          grouped.set(key, []);
                        }
                        grouped.get(key)!.push({ perf, raceIdx, race });
                      });
                    });
                    
                    const result: JSX.Element[] = [];
                    const entries = Array.from(grouped.entries());
                    
                    entries.forEach(([key, races], groupIdx) => {
                      const [date, track] = key.split('-');
                      const trackName = trackFullName[track] || track;
                      
                      // Add separator/header (except for first)
                      if (groupIdx > 0) {
                        result.push(
                          <tr key={`separator-${key}`} className="bg-gray-100">
                            <td colSpan={4} className="py-1 px-4">
                              <div className="h-px bg-gray-300"></div>
                            </td>
                          </tr>
                        );
                      }
                      
                      // Add track header
                      result.push(
                        <tr key={`header-${key}`} className="bg-[var(--content-15)]">
                          <td colSpan={4} className="py-1 px-4 text-[12px] font-medium text-[var(--text-primary)]">
                            {date}, {trackName}
                          </td>
                        </tr>
                      );
                      
                      // Add race rows
                      races.forEach(({ race, raceIdx }, idx) => {
                        result.push(
                          <tr key={`${key}-${raceIdx}`} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 text-gray-900">Race {race.race}</td>
                            <td className="py-2 px-4 text-gray-700">{race.horse}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPlaceColor(race.position)}`}>
                                {race.position === 0 ? "—" : race.position}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right font-semibold text-gray-900">
                              {race.points.toFixed(1) || 0}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
