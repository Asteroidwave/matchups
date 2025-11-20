"use client";

import React, { useMemo, useState } from "react";
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
  const { connections: contextConnections, matchups } = useApp();

  const allConnections = useMemo(() => {
    const mergeStarters = (existing: Starter[] = [], incoming: Starter[] = []) => {
      const combined = new Map<string, Starter>();
      for (const starter of existing) {
        if (!starter) continue;
        const key = `${starter.track || ""}-${starter.race ?? ""}-${starter.horseName || ""}`;
        combined.set(key, starter);
      }
      for (const starter of incoming) {
        if (!starter) continue;
        const key = `${starter.track || ""}-${starter.race ?? ""}-${starter.horseName || ""}`;
        if (!combined.has(key)) {
          combined.set(key, starter);
        }
      }
      return Array.from(combined.values());
    };

    const map = new Map<string, Connection>();

    const addConnection = (conn?: Connection | null) => {
      if (!conn || !conn.id) return;

      const sanitizedStarters = Array.isArray(conn.starters) ? conn.starters : [];
      const sanitizedTrackSet = Array.isArray(conn.trackSet) ? conn.trackSet : [];
      const existing = map.get(conn.id);

      if (!existing) {
        const derivedTracks = new Set<string>(sanitizedTrackSet.filter(Boolean));
        for (const starter of sanitizedStarters) {
          if (starter?.track) {
            derivedTracks.add(starter.track);
          }
        }
        map.set(conn.id, {
          ...conn,
          starters: [...sanitizedStarters],
          trackSet: Array.from(derivedTracks),
        });
        return;
      }

      const mergedStarters = mergeStarters(existing.starters || [], sanitizedStarters);
      const mergedTracks = new Set<string>([
        ...(existing.trackSet || []),
        ...sanitizedTrackSet.filter(Boolean),
      ]);
      for (const starter of sanitizedStarters) {
        if (starter?.track) {
          mergedTracks.add(starter.track);
        }
      }

      map.set(conn.id, {
        ...existing,
        ...conn,
        starters: mergedStarters,
        trackSet: Array.from(mergedTracks),
      });
    };

    for (const conn of contextConnections) {
      addConnection(conn);
    }
    for (const matchup of matchups) {
      for (const conn of matchup.setA.connections) {
        addConnection(conn);
      }
      for (const conn of matchup.setB.connections) {
        addConnection(conn);
      }
    }

    return Array.from(map.values());
  }, [contextConnections, matchups]);
  
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
  const contestDateFromSession = typeof window !== 'undefined' ? sessionStorage.getItem('selectedDate') : null;
  
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
  
  // Group by race and calculate post positions
  const raceGroups = new Map<string, Starter[]>();
  for (const starter of allStartersList) {
    const raceKey = `${starter.track}-${starter.race}`;
    if (!raceGroups.has(raceKey)) {
      raceGroups.set(raceKey, []);
    }
    raceGroups.get(raceKey)!.push(starter);
  }
  
  // For each race, sort by mlOdds (ascending) and assign post positions
  for (const [raceKey, starters] of Array.from(raceGroups.entries())) {
    const racePostMap = new Map<string, number>();
    const ordered = [...starters].sort((a, b) => {
      const oddsA = a.mlOdds ?? Number.POSITIVE_INFINITY;
      const oddsB = b.mlOdds ?? Number.POSITIVE_INFINITY;
      return oddsA - oddsB;
    });
    
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
    const bgColor = palette[(post - 1) % palette.length];
    return `${bgColor} text-white`;
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
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[968px] w-full max-h-[88vh] p-0 flex flex-col overflow-hidden"
      >
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
        
        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(88vh - 210px)' }}>
          {activeTab === "connected" && (
            <div className="overflow-x-auto pb-6">
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
                    const rawDate = contestDateFromSession;
                    let formattedDate = "—";
                    if (rawDate) {
                      const parsedDate = new Date(rawDate);
                      if (!isNaN(parsedDate.getTime())) {
                        formattedDate = parsedDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        });
                      } else {
                        formattedDate = rawDate;
                      }
                    }
                  
                  return (
                      <React.Fragment key={key}>
                        {/* Div.rack.track.group.component - Race Header (gray band) */}
                        <tr className="bg-[var(--content-15)]">
                          <td colSpan={2} className="px-5 py-1 text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                            {formattedDate}, {trackName}, Race {raceNum}
                          </td>
                        </tr>
                        
                        {/* Horse rows for this race - table-header style */}
                        {starters.map((starter, idx) => {
                          const raceKey = `${starter.track}-${starter.race}`;
                          const horseKey = `${starter.track}-${starter.race}-${starter.horseName}`;
                          const racePostMap = postPositionsMap.get(raceKey);
                          const post = racePostMap?.get(horseKey);
                          const programNumber = starter.program_number ?? (starter as any)?.programNumber ?? null;
                          const programBadge = getProgramNumberBadge(programNumber ?? undefined);

                          return (
                            <tr key={`${key}-${idx}`} className="border-b border-[var(--content-15)]">
                              <td className="w-[140px] py-2.5 pl-5 pr-0 align-top">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-6 h-6 rounded-[2px] flex items-center justify-center text-[12px] font-semibold leading-[18px] ${programBadge.bg} ${programBadge.text}`}
                                    >
                                      {programBadge.number ?? "—"}
                                    </span>
                                    <span className="text-[13px] font-medium leading-[18px] text-[var(--text-primary)]">
                                      {starter.mlOddsFrac || "—"}
                                    </span>
                                    {post && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPostBadge(post)}`}>
                                        PP {post}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.horseName}
                      </div>
                                    {starter.isAE && (
                                      <span className="text-[10px] leading-[14px] font-semibold bg-yellow-100 text-yellow-800 px-1 rounded">
                                        AE
                                      </span>
                                    )}
                              </div>
                                </div>
                              </td>
                              <td className="flex-1 pl-12 pr-5 align-top">
                                <div className="flex flex-col rounded-lg border border-[var(--content-15)] overflow-hidden">
                                  <div className="flex border-b border-[var(--content-15)]">
                                    <div className={`flex-1 border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 transition-colors ${
                                      connection.role === "jockey" && starter.jockey === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">
                                        J
                                      </span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.jockey || "—"}
                                      </span>
                                    </div>
                                    <div className={`flex-1 px-3 py-2 flex items-center gap-1.5 transition-colors ${
                                      connection.role === "trainer" && starter.trainer === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">
                                        T
                                      </span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.trainer || "—"}
                                      </span>
                              </div>
                            </div>
                                  <div className="flex">
                                    <div className={`flex-1 border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 transition-colors ${
                                      connection.role === "sire" && starter.sire1 === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">
                                        S
                                      </span>
                                      <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                        {starter.sire1 || "—"}
                                      </span>
                                    </div>
                                    <div className={`flex-1 px-3 py-2 flex items-center gap-1.5 transition-colors ${
                                      connection.role === "sire" && starter.sire2 === connection.name ? "bg-[var(--blue-50)]" : ""
                                    }`}>
                                      <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">
                                        S
                                      </span>
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
            <div className="p-6 text-center">
              <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Coming soon...
                        </div>
              <div className="text-sm text-[var(--text-tertiary)]">
                Past performance data will be available soon.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
