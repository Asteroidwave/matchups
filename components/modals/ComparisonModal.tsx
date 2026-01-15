"use client";

import React, { useState, useRef, useEffect } from "react";
import { Matchup, Connection, Starter, PastPerformanceEntry } from "@/types";
import { Dialog } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { getConnectionHistory } from "@/lib/parseJson";

interface ComparisonModalProps {
  matchup: Matchup | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ComparisonModal({ matchup, isOpen, onClose }: ComparisonModalProps) {
  const [activeTabSetA, setActiveTabSetA] = useState<"connected" | "past">("connected");
  const [activeTabSetB, setActiveTabSetB] = useState<"connected" | "past">("connected");
  const [activeTabSetC, setActiveTabSetC] = useState<"connected" | "past">("connected");
  // Track which connection index is being viewed for each set (for multi-connection sets)
  const [connectionIndexA, setConnectionIndexA] = useState(0);
  const [connectionIndexB, setConnectionIndexB] = useState(0);
  const [connectionIndexC, setConnectionIndexC] = useState(0);
  // Past performance data and loading state for each set
  const [pastPerfA, setPastPerfA] = useState<PastPerformanceEntry[]>([]);
  const [pastPerfB, setPastPerfB] = useState<PastPerformanceEntry[]>([]);
  const [pastPerfC, setPastPerfC] = useState<PastPerformanceEntry[]>([]);
  const [isLoadingA, setIsLoadingA] = useState(false);
  const [isLoadingB, setIsLoadingB] = useState(false);
  const [isLoadingC, setIsLoadingC] = useState(false);
  // Expanded rows for past performance
  const [expandedRowsA, setExpandedRowsA] = useState<Set<string>>(new Set());
  const [expandedRowsB, setExpandedRowsB] = useState<Set<string>>(new Set());
  const [expandedRowsC, setExpandedRowsC] = useState<Set<string>>(new Set());
  
  const { connections: allConnections, selectedTracks } = useApp();
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);
  const scrollRefC = useRef<HTMLDivElement>(null);
  
  // Debug: Log scroll container dimensions
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        [scrollRefA, scrollRefB, scrollRefC].forEach((ref, idx) => {
          if (ref.current) {
            const el = ref.current;
            const computed = window.getComputedStyle(el);
            console.log(`[Scroll Debug ${['A', 'B', 'C'][idx]}]`, {
              clientHeight: el.clientHeight,
              scrollHeight: el.scrollHeight,
              offsetHeight: el.offsetHeight,
              overflow: computed.overflow,
              overflowY: computed.overflowY,
              height: computed.height,
              maxHeight: computed.maxHeight,
              canScroll: el.scrollHeight > el.clientHeight,
              parentHeight: el.parentElement?.clientHeight,
            });
          }
        });
      }, 500);
    }
  }, [isOpen, activeTabSetA, activeTabSetB, activeTabSetC]);
  
  // Load past performance when tab is switched to "past"
  useEffect(() => {
    if (activeTabSetA === "past" && matchup?.setA?.connections?.[connectionIndexA] && isOpen) {
      const conn = matchup.setA.connections[connectionIndexA];
      setIsLoadingA(true);
      getConnectionHistory(conn.name, conn.role, selectedTracks[0] || 'AQU', 10)
        .then(setPastPerfA)
        .catch(() => setPastPerfA([]))
        .finally(() => setIsLoadingA(false));
    }
  }, [activeTabSetA, connectionIndexA, matchup?.setA?.connections, isOpen, selectedTracks]);
  
  useEffect(() => {
    if (activeTabSetB === "past" && matchup?.setB?.connections?.[connectionIndexB] && isOpen) {
      const conn = matchup.setB.connections[connectionIndexB];
      setIsLoadingB(true);
      getConnectionHistory(conn.name, conn.role, selectedTracks[0] || 'AQU', 10)
        .then(setPastPerfB)
        .catch(() => setPastPerfB([]))
        .finally(() => setIsLoadingB(false));
    }
  }, [activeTabSetB, connectionIndexB, matchup?.setB?.connections, isOpen, selectedTracks]);
  
  useEffect(() => {
    if (activeTabSetC === "past" && matchup?.setC?.connections?.[connectionIndexC] && isOpen) {
      const conn = matchup.setC.connections[connectionIndexC];
      setIsLoadingC(true);
      getConnectionHistory(conn.name, conn.role, selectedTracks[0] || 'AQU', 10)
        .then(setPastPerfC)
        .catch(() => setPastPerfC([]))
        .finally(() => setIsLoadingC(false));
    }
  }, [activeTabSetC, connectionIndexC, matchup?.setC?.connections, isOpen, selectedTracks]);

  if (!matchup || !isOpen) return null;
  
  const is3Way = !!matchup.setC && matchup.setC.connections.length > 0;
  
  // Get connection counts for each set
  const setACount = matchup.setA?.connections?.length || 0;
  const setBCount = matchup.setB?.connections?.length || 0;
  const setCCount = matchup.setC?.connections?.length || 0;

  // Render a single connection modal (same structure as ConnectionModal)
  
  const renderConnectionModal = (
    connection: Connection,
    activeTab: "connected" | "past",
    setActiveTab: (tab: "connected" | "past") => void,
    setId: "A" | "B" | "C" = "A",
    connectionIndex: number = 0,
    totalConnections: number = 1,
    onPrevConnection?: () => void,
    onNextConnection?: () => void,
    pastPerformance: PastPerformanceEntry[] = [],
    isLoadingPP: boolean = false,
    expandedRows: Set<string> = new Set(),
    toggleExpandedRow?: (key: string) => void
  ) => {
    const scrollRef = setId === "A" ? scrollRefA : setId === "B" ? scrollRefB : scrollRefC;
    
    // For 3-way matchups, use wider modals to prevent salary cutoff
    const modalWidth = is3Way ? "w-[560px]" : "w-[640px]";
    // Background color for the header based on role (single color)
    const headerBg = {
      jockey: "bg-blue-600",
      trainer: "bg-green-600",
      sire: "bg-amber-600",
    }[connection.role];
    
    const hasMultipleConnections = totalConnections > 1;
    const canGoPrev = connectionIndex > 0;
    const canGoNext = connectionIndex < totalConnections - 1;

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
      <div className={`${modalWidth} p-0 flex flex-col rounded-lg bg-[var(--surface-1)] shadow-lg border border-[var(--content-15)] flex-shrink-0 overflow-hidden`} style={{ height: '85vh', maxHeight: '85vh', pointerEvents: 'auto' }}>
        {/* Header - Matching ConnectionModal style */}
        <div className={`relative h-[140px] ${headerBg} text-white flex-shrink-0 rounded-t-lg`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-1 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Navigation arrows for multi-connection sets */}
          {hasMultipleConnections && (
            <div className="absolute top-4 left-4 flex items-center gap-1 z-10 bg-white/20 rounded-full px-2 py-1">
              <button
                onClick={onPrevConnection}
                disabled={!canGoPrev}
                className={`p-0.5 rounded-full transition-colors ${canGoPrev ? 'hover:bg-white/20 text-white' : 'text-white/40 cursor-not-allowed'}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-white font-medium">{connectionIndex + 1}/{totalConnections}</span>
              <button
                onClick={onNextConnection}
                disabled={!canGoNext}
                className={`p-0.5 rounded-full transition-colors ${canGoNext ? 'hover:bg-white/20 text-white' : 'text-white/40 cursor-not-allowed'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Name and role section - positioned to leave space for avatar */}
          <div className="pt-[32px] px-5">
            <div className="pl-[100px] flex items-center gap-3">
              <h2 className="text-[18px] font-semibold leading-[24px] truncate max-w-[280px]">{connection.name}</h2>
              <span className="text-[12px] font-medium text-white/80 bg-white/20 px-2 py-0.5 rounded">
                {connection.role.toUpperCase()}
              </span>
            </div>
          </div>
          
          {/* Stats section */}
          <div className="px-5 pt-3 pb-4">
            <div className="pl-[100px] flex items-end gap-5">
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">{connection.avgOdds.toFixed(2)}</div>
                <div className="text-[11px] font-medium leading-[16px] text-white/70">AVG ODDS</div>
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">{String(connection.apps).padStart(2, '0')}</div>
                <div className="text-[11px] font-medium leading-[16px] text-white/70">APPS</div>
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">{connection.avpa30d.toFixed(2)}</div>
                <div className="text-[11px] font-medium leading-[16px] text-white/70">AVPA</div>
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-[20px]">${connection.salarySum.toLocaleString()}</div>
                <div className="text-[11px] font-medium leading-[16px] text-white/70">SALARY</div>
              </div>
            </div>
          </div>
          
          {/* Circle avatar overlapping header */}
          <div className="absolute left-[20px] top-[24px] w-[80px] h-[80px] rounded-full bg-[var(--content-15)] flex items-center justify-center text-[42px] font-semibold leading-normal text-[var(--content-9)] z-20">
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
        
        {/* Content - Scrollable area - takes remaining space */}
        <div 
          ref={scrollRef}
          className="overflow-y-auto overflow-x-hidden"
          style={{ 
            flex: '1 1 auto',
            minHeight: 0,
            maxHeight: 'calc(85vh - 140px - 48px)', // Explicit max height
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain', // Prevent scroll chaining to parent
            touchAction: 'pan-y', // Enable vertical touch scrolling
          }}
          onWheel={(e) => {
            // Ensure wheel events scroll this container, not parent
            e.stopPropagation();
          }}
        >
          {activeTab === "connected" && (
            <div>
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
                          
                          // Check if this connection matches - use includes for more robust matching
                          const connName = connection.name.trim().toLowerCase();
                          const isJockeyMatch = connection.role === "jockey" && starter.jockey?.trim().toLowerCase() === connName;
                          const isTrainerMatch = connection.role === "trainer" && starter.trainer?.trim().toLowerCase() === connName;
                          const isSire1Match = connection.role === "sire" && starter.sire1?.trim().toLowerCase() === connName;
                          const isSire2Match = connection.role === "sire" && starter.sire2?.trim().toLowerCase() === connName;
                          
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
                                    isJockeyMatch ? "bg-blue-100 dark:bg-blue-900/40" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--jockey)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">J</span>
                                    <span className={`text-[14px] font-medium leading-[20px] truncate ${
                                      isJockeyMatch ? "text-blue-700 dark:text-blue-300 font-bold" : "text-[var(--text-primary)]"
                                    }`}>
                                      {starter.jockey || "—"}
                                    </span>
                                  </div>
                                  <div className={`border-b border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    isTrainerMatch ? "bg-green-100 dark:bg-green-900/40" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--trainer)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">T</span>
                                    <span className={`text-[14px] font-medium leading-[20px] truncate ${
                                      isTrainerMatch ? "text-green-700 dark:text-green-300 font-bold" : "text-[var(--text-primary)]"
                                    }`}>
                                      {starter.trainer || "—"}
                                    </span>
                                  </div>
                                  {/* Bottom row: Sire 1 and Sire 2 */}
                                  <div className={`border-r border-[var(--content-15)] px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    isSire1Match ? "bg-amber-100 dark:bg-amber-900/40" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--sire)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                    <span className={`text-[14px] font-medium leading-[20px] truncate ${
                                      isSire1Match ? "text-amber-700 dark:text-amber-300 font-bold" : "text-[var(--text-primary)]"
                                    }`}>
                                      {starter.sire1 || "—"}
                                    </span>
                                  </div>
                                  <div className={`px-3 py-2 flex items-center gap-1.5 min-h-[44px] ${
                                    isSire2Match ? "bg-amber-100 dark:bg-amber-900/40" : ""
                                  }`}>
                                    <span className="w-4 h-4 rounded-[4px] bg-[var(--sire)] text-white text-[11px] font-semibold leading-[15px] flex items-center justify-center flex-shrink-0">S</span>
                                    <span className={`text-[14px] font-medium leading-[20px] truncate ${
                                      isSire2Match ? "text-amber-700 dark:text-amber-300 font-bold" : "text-[var(--text-primary)]"
                                    }`}>
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
                <>
                  {/* Header - Same as ConnectionModal */}
                  <div className="sticky top-0 bg-[var(--surface-1)] border-b border-[var(--content-15)] z-10 px-5 py-2">
                    <div className="grid grid-cols-12 gap-2 text-[12px] font-medium text-[var(--text-tertiary)]">
                      <div className="col-span-4">Race Day</div>
                      <div className="col-span-2 text-right">Salary</div>
                      <div className="col-span-2 text-right">Appearances</div>
                      <div className="col-span-2 text-right">AVPA</div>
                      <div className="col-span-2 text-right">Points</div>
                    </div>
                  </div>
                  
                  {/* Collapsible rows - Same as ConnectionModal */}
                  <div className="divide-y divide-[var(--content-15)]">
                    {(() => {
                      // Group by date + track
                      const grouped = new Map<string, PastPerformanceEntry[]>();
                      pastPerformance.forEach((entry) => {
                        const key = `${entry.date}|${entry.track}`;
                        if (!grouped.has(key)) grouped.set(key, []);
                        grouped.get(key)!.push(entry);
                      });
                      
                      return Array.from(grouped.entries()).map(([key, ppEntries]) => {
                        const [date, track] = key.split('|');
                        const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric'
                        });
                        
                        const totalSalary = ppEntries.reduce((sum, r) => sum + (r.salary || 0), 0);
                        const appearances = ppEntries.length;
                        const avgAVPA = ppEntries.reduce((sum, r) => sum + (r.avpa || 0), 0) / appearances;
                        const totalScore = ppEntries.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
                        const isExpanded = expandedRows.has(key);
                        
                        return (
                          <div key={key}>
                            {/* Summary Row (Clickable) */}
                            <button
                              onClick={() => toggleExpandedRow?.(key)}
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
                                {ppEntries.map((entry, idx) => (
                                  <div
                                    key={`${key}-${idx}`}
                                    className="px-5 py-2 grid grid-cols-12 gap-2 items-center text-[13px] border-b border-[var(--content-15)] last:border-b-0"
                                  >
                                    <div className="col-span-1 text-[var(--text-secondary)]">
                                      {entry.race}
                                    </div>
                                    <div className="col-span-5 flex items-center gap-2">
                                      <span className="font-medium text-[var(--text-primary)]">{entry.horse}</span>
                                    </div>
                                    <div className="col-span-3 text-right">
                                      <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-[11px] font-semibold ${
                                        entry.finish === 1 ? 'bg-green-100 text-green-800' :
                                        entry.finish === 2 ? 'bg-blue-100 text-blue-800' :
                                        entry.finish === 3 ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {entry.finish ? `${entry.finish}${entry.finish === 1 ? 'st' : entry.finish === 2 ? 'nd' : entry.finish === 3 ? 'rd' : 'th'}` : '—'}
                                      </span>
                                    </div>
                                    <div className="col-span-3 text-right font-medium text-[var(--text-primary)]">
                                      {(entry.totalPoints || 0).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
        {/* Backdrop with blur */}
        <DialogPrimitive.Overlay 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
          onClick={onClose}
          style={{ pointerEvents: 'auto' }}
        />
        
        {/* Modal Container - Side by side with minimal gap */}
        <div 
          className={`relative z-50 flex items-stretch justify-center gap-2 pt-2 pb-2 ${is3Way ? 'px-2' : ''}`} 
          style={{ height: '85vh', pointerEvents: 'auto' }}
        >
          {/* Set A Modal */}
          {matchup?.setA?.connections?.length > 0 ? (
            <div className="h-full">
              {renderConnectionModal(
                matchup.setA.connections[connectionIndexA] || matchup.setA.connections[0],
                activeTabSetA,
                setActiveTabSetA,
                "A",
                connectionIndexA,
                setACount,
                () => setConnectionIndexA(prev => Math.max(0, prev - 1)),
                () => setConnectionIndexA(prev => Math.min(setACount - 1, prev + 1)),
                pastPerfA,
                isLoadingA,
                expandedRowsA,
                (key) => setExpandedRowsA(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              )}
            </div>
          ) : null}

          {/* Set B Modal */}
          {matchup?.setB?.connections?.length > 0 ? (
            <div className="h-full">
              {renderConnectionModal(
                matchup.setB.connections[connectionIndexB] || matchup.setB.connections[0],
                activeTabSetB,
                setActiveTabSetB,
                "B",
                connectionIndexB,
                setBCount,
                () => setConnectionIndexB(prev => Math.max(0, prev - 1)),
                () => setConnectionIndexB(prev => Math.min(setBCount - 1, prev + 1)),
                pastPerfB,
                isLoadingB,
                expandedRowsB,
                (key) => setExpandedRowsB(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              )}
            </div>
          ) : null}
          
          {/* Set C Modal (only for 3-way matchups) */}
          {is3Way && matchup?.setC?.connections?.length > 0 ? (
            <div className="h-full">
              {renderConnectionModal(
                matchup.setC.connections[connectionIndexC] || matchup.setC.connections[0],
                activeTabSetC,
                setActiveTabSetC,
                "C",
                connectionIndexC,
                setCCount,
                () => setConnectionIndexC(prev => Math.max(0, prev - 1)),
                () => setConnectionIndexC(prev => Math.min(setCCount - 1, prev + 1)),
                pastPerfC,
                isLoadingC,
                expandedRowsC,
                (key) => setExpandedRowsC(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
