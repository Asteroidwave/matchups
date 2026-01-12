"use client";

import React, { useState, useEffect } from "react";
import { Connection, Starter, PastPerformanceEntry } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { getConnectionHistory } from "@/lib/parseExcel";

interface ConnectionModalProps {
  connection: Connection | null;
  isOpen: boolean;
  onClose: () => void;
}

const trackColors: Record<string, { bg: string; border: string }> = {
  AQU: { bg: "bg-blue-500/10", border: "border-blue-500" },
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500" },
  GP: { bg: "bg-green-500/10", border: "border-green-500" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500" },
  SA: { bg: "bg-red-500/10", border: "border-red-500" },
  DMR: { bg: "bg-cyan-500/10", border: "border-cyan-500" },
  PRX: { bg: "bg-rose-500/10", border: "border-rose-500" },
  PEN: { bg: "bg-violet-500/10", border: "border-violet-500" },
  LRL: { bg: "bg-pink-500/10", border: "border-pink-500" },
  MVR: { bg: "bg-amber-500/10", border: "border-amber-500" },
};

export function ConnectionModal({ connection, isOpen, onClose }: ConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<"connected" | "past">("connected");
  const { connections: allConnections, selectedTracks } = useApp();
  const [pastPerformance, setPastPerformance] = useState<PastPerformanceEntry[]>([]);
  const [isLoadingPP, setIsLoadingPP] = useState(false);
  
  // Load past performance when opening past tab
  useEffect(() => {
    if (activeTab === "past" && connection && isOpen) {
      setIsLoadingPP(true);
      const loadPP = async () => {
        try {
          const trackCode = selectedTracks[0] || connection.trackSet[0] || 'AQU';
          const history = await getConnectionHistory(connection.name, connection.role, trackCode, 10);
          setPastPerformance(history);
        } catch (err) {
          console.error('Failed to load past performance:', err);
          setPastPerformance([]);
        } finally {
          setIsLoadingPP(false);
        }
      };
      loadPP();
    }
  }, [activeTab, connection, isOpen, selectedTracks]);
  
  if (!connection) return null;
  
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
    AQU: "Aqueduct",
    BAQ: "Belmont",
    GP: "Gulfstream Park",
    KEE: "Keeneland",
    SA: "Santa Anita",
    DMR: "Del Mar",
    PRX: "Parx Racing",
    PEN: "Penn National",
    LRL: "Laurel Park",
    MVR: "Mountaineer",
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
              {isLoadingPP ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
                  <span className="ml-2 text-[var(--text-secondary)]">Loading past performance...</span>
                </div>
              ) : pastPerformance.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  No past performance data available
                </div>
              ) : (
                <table className="w-full">
                  {/* Table Header - Same style as Connected Horses */}
                  <thead className="sticky top-0 bg-[var(--surface-1)] border-b border-[var(--content-15)] z-10">
                    <tr>
                      <th colSpan={2} className="border-b border-[var(--content-15)] pb-1 pl-5 pr-0 pt-2 text-left">
                        <div className="flex items-center">
                          <div className="flex flex-col gap-2 w-[140px]">
                            <p className="font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">Race Info</p>
                          </div>
                          <div className="flex flex-col flex-1 ml-[144px]">
                            <p className="font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">Performance</p>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group by date for separators
                      const grouped = new Map<string, PastPerformanceEntry[]>();
                      
                      pastPerformance.forEach((entry) => {
                        const key = `${entry.date}-${entry.track}`;
                        if (!grouped.has(key)) {
                          grouped.set(key, []);
                        }
                        grouped.get(key)!.push(entry);
                      });
                      
                      const result: JSX.Element[] = [];
                      const entries = Array.from(grouped.entries());
                      
                      entries.forEach(([key, races], groupIdx) => {
                        const [date, track] = key.split('-');
                        const trackName = trackFullName[track] || track;
                        const formattedDate = new Date(date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        });
                        
                        // Add track header (gray band - same as Connected Horses)
                        result.push(
                          <tr key={`header-${key}`} className="bg-[var(--content-15)]">
                            <td colSpan={2} className="px-5 py-1 text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                              {formattedDate}, {trackName}
                            </td>
                          </tr>
                        );
                        
                        // Add race rows - same style as Connected Horses
                        races.forEach((entry, idx) => {
                          result.push(
                            <tr key={`${key}-${idx}`} className="border-b border-[var(--content-15)]">
                              {/* Left Column - Race Info (same width as Horse column) */}
                              <td className="w-[140px] py-3 pl-5 pr-0 align-top">
                                <div className="flex flex-col gap-2">
                                  {/* Race number and odds */}
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] font-semibold leading-[18px] ${getPostBadge(entry.race)}`}>
                                      R{entry.race}
                                    </span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {entry.finalOdds ? `${entry.finalOdds.toFixed(1)}/1` : "—"}
                                    </span>
                                  </div>
                                  {/* Horse Name */}
                                  <div>
                                    <div className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {entry.horse}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {/* Right Column - Performance */}
                              <td className="flex-1 pl-[144px] align-top">
                                <div className="flex">
                                  {/* Finish Position */}
                                  <div className="flex-1 border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5">
                                    <span className="text-[12px] font-medium text-[var(--text-tertiary)]">Finish:</span>
                                    <span className={`px-2 py-0.5 rounded text-[12px] font-semibold ${getPlaceColor(entry.finish)}`}>
                                      {entry.finish === 0 ? "—" : entry.finish}
                                    </span>
                                  </div>
                                  {/* Points */}
                                  <div className="flex-1 px-3 py-2 flex items-center gap-1.5">
                                    <span className="text-[12px] font-medium text-[var(--text-tertiary)]">Points:</span>
                                    <span className="text-[14px] font-semibold leading-[20px] text-[var(--text-primary)]">
                                      {entry.totalPoints?.toFixed(1) || "0.0"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      });
                      
                      return result;
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
