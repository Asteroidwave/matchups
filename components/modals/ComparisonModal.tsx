"use client";

import React, { useState, useRef } from "react";
import { Matchup, Connection, Starter } from "@/types";
import { Dialog } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

interface ComparisonModalProps {
  matchup: Matchup | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ComparisonModal({ matchup, isOpen, onClose }: ComparisonModalProps) {
  const [activeTabSetA, setActiveTabSetA] = useState<"connected" | "past">("connected");
  const [activeTabSetB, setActiveTabSetB] = useState<"connected" | "past">("connected");
  const [activeTabSetC, setActiveTabSetC] = useState<"connected" | "past">("connected");
  const { connections: allConnections } = useApp();
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);
  const scrollRefC = useRef<HTMLDivElement>(null);

  if (!matchup || !isOpen) return null;
  
  const is3Way = !!matchup.setC && matchup.setC.connections.length > 0;

  // Render a single connection modal (same structure as ConnectionModal)
  
  const renderConnectionModal = (
    connection: Connection,
    activeTab: "connected" | "past",
    setActiveTab: (tab: "connected" | "past") => void,
    setId: "A" | "B" | "C" = "A"
  ) => {
    const scrollRef = setId === "A" ? scrollRefA : setId === "B" ? scrollRefB : scrollRefC;
    
    // For 3-way matchups, use slightly wider modals to prevent cutoff
    const modalWidth = is3Way ? "w-[480px]" : "w-[620px]";
    // Background color for the header based on role (single color)
    const headerBg = {
      jockey: "bg-blue-600",
      trainer: "bg-green-600",
      sire: "bg-amber-600",
    }[connection.role];

    // Track full names mapping
    const trackFullName: Record<string, string> = {
      BAQ: "Belmont",
      GP: "Gulfstream Park",
      KEE: "Keeneland",
      SA: "Santa Anita",
    };

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

    // Calculate post positions for starters (EXACT same logic as StartersWindow)
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
      <div className={`${modalWidth} p-0 flex flex-col rounded-lg bg-[var(--surface-1)] shadow-lg border border-[var(--content-15)] flex-shrink-0`} style={{ maxHeight: '63vh', height: '63vh', pointerEvents: 'auto' }}>
        {/* Header - Single color design with overlapping circle */}
        <div className={`relative h-[162px] ${headerBg} text-white flex-shrink-0`}>
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
        <div className="bg-[var(--surface-1)] border-b border-[var(--content-16)] flex items-end px-5 pt-2 h-12 flex-shrink-0">
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
        
        {/* Content - Fixed height to prevent jumping - exact same pattern as ConnectionModal */}
        <div 
          ref={scrollRef}
          className="overflow-y-auto" 
          style={{ 
            height: '350px',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            position: 'relative',
            touchAction: 'pan-y',
            pointerEvents: 'auto',
            isolation: 'isolate'
          }}
          onWheel={(e) => {
            if (scrollRef.current) {
              e.stopPropagation();
              const delta = e.deltaY;
              scrollRef.current.scrollTop += delta;
              e.preventDefault();
            }
          }}
        >
          {activeTab === "connected" && (
            <div style={{ width: '100%' }}>
              <table className="w-full">
                {/* Table Header - Sticky (matching Figma table-header) */}
                <thead className="sticky top-0 bg-[var(--surface-1)] border-b border-[var(--content-15)] z-10">
                  <tr>
                    <th colSpan={2} className="border-b border-[var(--content-15)] pb-1 pl-4 pr-2 pt-2 text-left">
                      <div className="flex items-center">
                        <div className="flex flex-col gap-2 w-[120px]">
                          <p className="font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">Horse</p>
                        </div>
                        <div className="flex flex-col flex-1 ml-2">
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
                              {/* Horse Column - compact to give more space to connections */}
                              <td className="w-[115px] py-3 pl-4 pr-0 align-top">
                                <div className="flex flex-col gap-1.5">
                                  {/* PP and Odds in a row */}
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] font-semibold leading-[18px] flex-shrink-0 ${
                                      post ? getPostBadge(post) : "bg-gray-300 text-gray-700"
                                    }`}>
                                      {post || "—"}
                                    </span>
                                    <span className="text-[13px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {starter.mlOddsFrac || "—"}
                                    </span>
                                  </div>
                                  {/* Horse Name */}
                                  <div className="text-[13px] font-medium leading-[20px] text-[var(--text-primary)] truncate max-w-[100px]">
                                    {starter.horseName}
                                  </div>
                                </div>
                              </td>
                              {/* Connections Column - Wider grid with less gap from horse column */}
                              <td className="flex-1 pl-2 pr-2 align-top">
                                <div className="grid grid-cols-2 border border-[var(--content-15)]">
                                  {/* Top row: Jockey and Trainer */}
                                  <div className={`border-r border-b border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "jockey" && starter.jockey === connection.name ? "bg-[var(--jockey)]/15" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--jockey)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">J</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.jockey || "—"}
                                    </span>
                                  </div>
                                  <div className={`border-b border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "trainer" && starter.trainer === connection.name ? "bg-[var(--trainer)]/15" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--trainer)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">T</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.trainer || "—"}
                                    </span>
                                  </div>
                                  {/* Bottom row: Sire 1 and Sire 2 */}
                                  <div className={`border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "sire" && starter.sire1 === connection.name ? "bg-[var(--sire)]/15" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--sire)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.sire1 || "—"}
                                    </span>
                                  </div>
                                  <div className={`px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "sire" && starter.sire2 === connection.name ? "bg-[var(--sire)]/15" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--sire)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.sire2 || "—"}
                                    </span>
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
            <div style={{ width: '100%' }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-white border-b border-[var(--content-15)] z-10">
                  <tr>
                    <th className="text-left px-5 py-2 font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">
                      Race
                    </th>
                    <th className="text-left px-5 py-2 font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">
                      Horse
                    </th>
                    <th className="text-left px-5 py-2 font-medium text-[14px] leading-[20px] text-[var(--text-tertiary)]">
                      Finish Position
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {races.map(([key, starters]) => {
                    const [track, raceNum] = key.split("-");
                    const trackName = trackFullName[track] || track;
                    
                    return (
                      <React.Fragment key={key}>
                        <tr className="bg-[var(--content-15)]">
                          <td colSpan={3} className="px-5 py-1 text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                            October 3, 2025, {trackName}, Race {raceNum}
                          </td>
                        </tr>
                        {starters.map((starter, idx) => (
                          <tr key={`${key}-${idx}`} className="border-b border-[var(--content-15)]">
                            <td className="px-5 py-3 text-[14px] text-[var(--text-primary)]">
                              {track} R{raceNum}
                            </td>
                            <td className="px-5 py-3 text-[14px] font-medium text-[var(--text-primary)]">
                              {starter.horseName}
                            </td>
                            <td className="px-5 py-3 text-[14px] text-[var(--text-primary)]">
                              {starter.pos || "—"}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 pointer-events-auto" onClick={onClose} />
        
        {/* Modal Container - Side by side with gap */}
        <div className={`relative z-50 flex items-start justify-center gap-3 pointer-events-none pt-8 pb-8 ${is3Way ? 'px-4' : ''}`}>
          {/* Set A Modal */}
          {matchup?.setA?.connections?.length > 0 ? (
            <div className="pointer-events-auto">
              {renderConnectionModal(
                matchup.setA.connections[0],
                activeTabSetA,
                setActiveTabSetA,
                "A"
              )}
            </div>
          ) : null}

          {/* Set B Modal */}
          {matchup?.setB?.connections?.length > 0 ? (
            <div className="pointer-events-auto">
              {renderConnectionModal(
                matchup.setB.connections[0],
                activeTabSetB,
                setActiveTabSetB,
                "B"
              )}
            </div>
          ) : null}
          
          {/* Set C Modal (only for 3-way matchups) */}
          {is3Way && matchup?.setC?.connections?.length > 0 ? (
            <div className="pointer-events-auto">
              {renderConnectionModal(
                matchup.setC.connections[0],
                activeTabSetC,
                setActiveTabSetC,
                "C"
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
