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
  const { connections: allConnections } = useApp();
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);

  if (!matchup || !isOpen) return null;

  // Render a single connection modal (same structure as ConnectionModal)
  
  const renderConnectionModal = (
    connection: Connection,
    activeTab: "connected" | "past",
    setActiveTab: (tab: "connected" | "past") => void,
    isSetB: boolean = false
  ) => {
    const scrollRef = isSetB ? scrollRefB : scrollRefA;
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
      <div className="w-[616px] p-0 flex flex-col rounded-lg bg-[var(--surface-1)] shadow-lg border border-[var(--content-15)] flex-shrink-0" style={{ maxHeight: '63vh', height: '63vh' }}>
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
            touchAction: 'pan-y'
          }}
        >
          {activeTab === "connected" && (
            <div style={{ width: '100%' }}>
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
                            {sessionStorage.getItem('selectedDateFromLobby') || 'Today'}, {trackName}, Race {raceNum}
                          </td>
                        </tr>
                        
                        {/* Horse rows for this race - table-header style */}
                        {starters.map((starter, idx) => {
                          // Use program_number (saddlecloth number) directly from backend
                          const programNumber = starter.program_number;
                          const badgeStyle = getProgramNumberBadge(programNumber);
                          
                          return (
                            <tr key={`${key}-${idx}`} className="border-b border-[var(--content-15)]">
                              {/* Horse Column - div.top style (140px width matching Figma) */}
                              <td className="w-[140px] py-3 pl-5 pr-0 align-top">
                                <div className="flex flex-col gap-1.5">
                                  {/* Program Number and Odds in a row */}
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[12px] font-semibold leading-[18px] flex-shrink-0 ${badgeStyle.bg} ${badgeStyle.text}`}>
                                      {programNumber ?? "—"}
                                    </span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {starter.mlOddsFrac || "—"}
                                    </span>
                                  </div>
                                  {/* Horse Name */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                                      {starter.horseName}
                                    </span>
                                    {starter.isAE && (
                                      <span className="text-[10px] leading-[14px] font-semibold bg-yellow-100 text-yellow-800 px-1 rounded">AE</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {/* Connections Column - Frame style with 144px gap from horse column */}
                              <td className="flex-1 pl-[144px] align-top">
                                <div className="grid grid-cols-2 border border-[var(--content-15)]">
                                  {/* Top row: Jockey and Trainer */}
                                  <div className={`border-r border-b border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "jockey" && starter.jockey === connection.name ? "bg-[var(--blue-50)]" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">J</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.jockey || "—"}
                                    </span>
                                  </div>
                                  <div className={`border-b border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "trainer" && starter.trainer === connection.name ? "bg-[var(--blue-50)]" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">T</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.trainer || "—"}
                                    </span>
                                  </div>
                                  {/* Bottom row: Sire 1 and Sire 2 */}
                                  <div className={`border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "sire" && starter.sire1 === connection.name ? "bg-[var(--blue-50)]" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                    <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] truncate">
                                      {starter.sire1 || "—"}
                                    </span>
                                  </div>
                                  <div className={`px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    connection.role === "sire" && starter.sire2 === connection.name ? "bg-[var(--blue-50)]" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--blue-50)] text-[var(--brand)] text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  Past Performance Coming Soon
                </h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Historical race data and performance metrics will be available in a future update.
                </p>
              </div>
            </div>
          )}
          {activeTab === "past" && false && ( // Hidden old implementation
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
                            {sessionStorage.getItem('selectedDateFromLobby') || 'Today'}, {trackName}, Race {raceNum}
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
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay 
          className="fixed inset-0 z-[100] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        
        {/* Modal Container - Side by side with gap */}
        <DialogPrimitive.Content 
          className="fixed left-[50%] top-[50%] z-[101] flex items-start justify-center gap-3 pt-8 pb-8 translate-x-[-50%] translate-y-[-50%] pointer-events-none w-full max-w-[1400px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={onClose}
        >
          {/* Set A Modal */}
          {matchup?.setA?.connections?.length > 0 ? (
            <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              {renderConnectionModal(
                matchup.setA.connections[0],
                activeTabSetA,
                setActiveTabSetA,
                false
              )}
            </div>
          ) : null}

          {/* Set B Modal */}
          {matchup?.setB?.connections?.length > 0 ? (
            <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              {renderConnectionModal(
                matchup.setB.connections[0],
                activeTabSetB,
                setActiveTabSetB,
                true
              )}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
