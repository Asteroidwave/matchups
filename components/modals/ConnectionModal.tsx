"use client";

import React, { useState, useEffect } from "react";
import { Connection, Starter, PastPerformanceEntry } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { getConnectionHistory } from "@/lib/parseJson";

interface ConnectionModalProps {
  connection: Connection | null;
  isOpen: boolean;
  onClose: () => void;
}

// Past Performance Tab Component with collapsible rows (MM Matchups style)
function PastPerformanceTab({
  pastPerformance,
  isLoadingPP,
  trackFullName,
  getPlaceColor,
  getPostBadge,
}: {
  pastPerformance: PastPerformanceEntry[];
  isLoadingPP: boolean;
  trackFullName: Record<string, string>;
  getPlaceColor: (place?: number) => string;
  getPostBadge: (post?: number) => string;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  
  if (isLoadingPP) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
        <span className="ml-2 text-[var(--text-secondary)]">Loading past performance...</span>
      </div>
    );
  }
  
  if (pastPerformance.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)]">
        No past performance data available
      </div>
    );
  }
  
  // Group by date + track (using a separator that won't conflict with date format)
  const grouped = new Map<string, PastPerformanceEntry[]>();
  pastPerformance.forEach((entry) => {
    const key = `${entry.date}|${entry.track}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  });
  
  const entries = Array.from(grouped.entries());
  
  return (
    <div className="overflow-x-auto">
      {/* Table Header - MM Matchups style */}
      <div className="sticky top-0 bg-[var(--surface-1)] border-b border-[var(--content-15)] z-10 px-5 py-2">
        <div className="grid grid-cols-12 gap-2 text-[12px] font-medium text-[var(--text-tertiary)]">
          <div className="col-span-4">Race Day</div>
          <div className="col-span-2 text-right">Salary</div>
          <div className="col-span-2 text-right">Appearances</div>
          <div className="col-span-2 text-right">AVPA</div>
          <div className="col-span-2 text-right">Points</div>
        </div>
      </div>
      
      {/* Collapsible rows */}
      <div className="divide-y divide-[var(--content-15)]">
        {entries.map(([key, races]) => {
          const [date, track] = key.split('|');
          const trackName = trackFullName[track] || track;
          const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });
          
          // Calculate summary stats for this day
          const totalSalary = races.reduce((sum, r) => sum + (r.salary || 0), 0);
          const appearances = races.length;
          const avgAVPA = races.reduce((sum, r) => sum + (r.avpa || 0), 0) / appearances;
          const totalScore = races.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
          
          const isExpanded = expandedRows.has(key);
          
          return (
            <div key={key}>
              {/* Summary Row (Clickable) */}
              <button
                onClick={() => toggleRow(key)}
                className="w-full px-5 py-3 hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="grid grid-cols-12 gap-2 items-center text-[14px]">
                  <div className="col-span-4 flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                    )}
                    <span className="font-medium text-[var(--text-primary)]">{formattedDate}</span>
                    <span className="text-[var(--text-secondary)]">{track}</span>
                  </div>
                  <div className="col-span-2 text-right font-medium text-[var(--text-primary)]">
                    ${totalSalary.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right text-[var(--text-primary)]">
                    {appearances}
                  </div>
                  <div className="col-span-2 text-right text-[var(--text-primary)]">
                    {avgAVPA.toFixed(2)}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-[var(--text-primary)]">
                    {totalScore.toFixed(2)}
                  </div>
                </div>
              </button>
              
              {/* Expanded Detail Rows */}
              {isExpanded && (
                <div className="bg-[var(--surface-2)] border-t border-[var(--content-15)]">
                  {/* Detail Header */}
                  <div className="px-5 py-2 grid grid-cols-12 gap-2 text-[11px] font-medium text-[var(--text-tertiary)] border-b border-[var(--content-15)]">
                    <div className="col-span-1">Race</div>
                    <div className="col-span-5">Horse</div>
                    <div className="col-span-3 text-right">Position</div>
                    <div className="col-span-3 text-right">Points</div>
                  </div>
                  
                  {/* Detail Rows */}
                  {races.map((entry, idx) => (
                    <div
                      key={`${key}-${idx}`}
                      className="px-5 py-2 grid grid-cols-12 gap-2 items-center text-[13px] border-b border-[var(--content-15)] last:border-b-0"
                    >
                      <div className="col-span-1">
                        <span className="font-medium text-[var(--text-primary)]">{entry.race}</span>
                      </div>
                      <div className="col-span-5 flex items-center gap-2">
                        {/* Post position badge */}
                        <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[11px] font-semibold ${getPostBadge(entry.postPosition || entry.race)}`}>
                          {entry.postPosition || idx + 1}
                        </span>
                        {/* M/L Odds */}
                        <span className="text-[var(--text-secondary)] text-[12px]">
                          {entry.finalOdds ? `${entry.finalOdds.toFixed(0)}/1` : "—"}
                        </span>
                        {/* Horse Name */}
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {entry.horse}
                        </span>
                      </div>
                      <div className="col-span-3 text-right">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-semibold ${getPlaceColor(entry.finish)}`}>
                          {entry.finish === 1 ? "1st" : entry.finish === 2 ? "2nd" : entry.finish === 3 ? "3rd" : entry.finish === 0 ? "—" : `${entry.finish}th`}
                        </span>
                      </div>
                      <div className="col-span-3 text-right font-medium text-[var(--text-primary)]">
                        {entry.totalPoints?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
                {/* Table Header - Sticky */}
                <thead className="sticky top-0 bg-[var(--surface-1)] border-b border-[var(--content-15)] z-10">
                  <tr>
                    <th colSpan={2} className="border-b border-[var(--content-15)] pb-1 pl-5 pr-2 pt-2 text-left">
                      <div className="flex items-center">
                        <div className="flex flex-col gap-2 w-[130px]">
                          <p className="font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">Horse</p>
                        </div>
                        <div className="flex flex-col flex-1 ml-4">
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
                              {/* Horse Column - compact for more connection space */}
                              <td className="w-[300px] py-3 pl-5 pr-0 align-top">
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
                              {/* Connections Column - Wider grid */}
                              <td className="flex-1 pl-4 pr-2 align-top">
                                <div className="flex flex-col">
                                  {/* Top row: Jockey and Trainer */}
                                  <div className="flex border-b border-[var(--content-15)]">
                                    <div className={`flex-1 border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "jockey" && starter.jockey === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--jockey)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">J</span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.jockey || "—"}
                                      </span>
                                    </div>
                                    <div className={`flex-1 px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "trainer" && starter.trainer === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--trainer)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">T</span>
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
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--sire)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.sire1 || "—"}
                                      </span>
                                    </div>
                                    <div className={`flex-1 px-3 py-2 flex items-center gap-1.5 ${
                                      connection.role === "sire" && starter.sire2 === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--sire)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
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
            <PastPerformanceTab
              pastPerformance={pastPerformance}
              isLoadingPP={isLoadingPP}
              trackFullName={trackFullName}
              getPlaceColor={getPlaceColor}
              getPostBadge={getPostBadge}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
