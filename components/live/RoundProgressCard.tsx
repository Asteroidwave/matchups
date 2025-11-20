"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MatchupProgressLine } from './MatchupProgressLine';
import { RaceDetailModal } from './RaceDetailModal';

interface MatchupProgress {
  matchupId: string;
  chosenSide: 'A' | 'B';
  setA: {
    connections: any[];
    currentPoints: number;
    totalRaces: number;
    finishedRaces: number;
  };
  setB: {
    connections: any[];
    currentPoints: number;
    totalRaces: number;
    finishedRaces: number;
  };
  status: 'pending' | 'in_progress' | 'setA_won' | 'setB_won' | 'tied';
  winner: 'A' | 'B' | null;
}

interface SimulatedRace {
  track: string;
  raceNumber: number;
  status: 'pending' | 'running' | 'finished';
  postTime?: string;
  post_time?: string;
  scheduledStart?: Date | string;
  results?: Array<{
    track: string;
    race: number;
    horseName: string;
    position: number;
    points: number;
    jockey?: string;
    trainer?: string;
    sire1?: string;
    program_number?: number;
    mlOddsFrac?: string;
  }>;
}

interface RoundProgressCardProps {
  roundId: string;
  entryAmount: number;
  multiplier: number;
  isFlex: boolean;
  picks: Array<{ matchupId: string; chosen: 'A' | 'B' }>;
  matchups: MatchupProgress[];
  status: 'pending' | 'in_progress' | 'won' | 'lost';
  wonMatchups: number;
  lostMatchups: number;
  totalPoints: number;
  potentialWinnings: number;
  races?: SimulatedRace[]; // Optional: pass races to access results
}

export function RoundProgressCard({
  roundId,
  entryAmount,
  multiplier,
  isFlex,
  picks,
  matchups,
  status,
  wonMatchups,
  lostMatchups,
  totalPoints,
  potentialWinnings,
  races = [],
}: RoundProgressCardProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Default closed
  const [collapsedPicks, setCollapsedPicks] = useState<Set<number>>(new Set()); // Track collapsed individual picks
  const [raceModalOpen, setRaceModalOpen] = useState(false);
  const [selectedRaceData, setSelectedRaceData] = useState<{
    track: string;
    raceNumber: number;
    postTime?: string;
    yourHorses: any[];
    allResults?: any[];
  } | null>(null);
  
  const togglePickCollapse = (pickIndex: number) => {
    setCollapsedPicks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pickIndex)) {
        newSet.delete(pickIndex);
      } else {
        newSet.add(pickIndex);
      }
      return newSet;
    });
  };
  
  const handleRaceNodeClick = (race: any, matchup: any, isYourSet: boolean) => {
    const track = race.track;
    const raceNumber = race.race || race.raceNumber;
    
    // Find the race in simulation to get full results
    const simulatedRace = races.find(r => 
      r.track === track && r.raceNumber === raceNumber && r.status === 'finished'
    );
    
    // Get your horse from the current set
    const yourSet = isYourSet ? matchup.setA : matchup.setB;
    const opponentSet = isYourSet ? matchup.setB : matchup.setA;
    
    // Find all horses from your set in this race
    const yourHorses: any[] = [];
    yourSet.connections.forEach((conn: any) => {
      if (conn.starters) {
        conn.starters.forEach((starter: any) => {
          if (starter.track === track && starter.race === raceNumber) {
            yourHorses.push({
              horseName: starter.horseName || race.horseName,
              programNumber: starter.program_number || race.program_number,
              position: starter.position || race.pos || race.position,
              points: starter.points || race.points || 0,
              odds: starter.mlOddsFrac || race.mlOddsFrac || race.odds,
              jockey: starter.jockey || race.jockey,
              trainer: starter.trainer || race.trainer,
              sire1: starter.sire1 || race.sire1,
              connection: conn.name || 'Unknown',
              isYourPick: true,
            });
          }
        });
      }
    });
    
    // Find opponent horses from the same race
    const opponentHorses: any[] = [];
    opponentSet.connections.forEach((conn: any) => {
      if (conn.starters) {
        conn.starters.forEach((starter: any) => {
          if (starter.track === track && starter.race === raceNumber) {
            opponentHorses.push({
              horseName: starter.horseName,
              programNumber: starter.program_number,
              position: starter.position,
              points: starter.points || 0,
              odds: starter.mlOddsFrac || starter.odds,
              jockey: starter.jockey,
              trainer: starter.trainer,
              sire1: starter.sire1,
              connection: conn.name || 'Unknown',
              isYourPick: false,
            });
          }
        });
      }
    });
    
    // Combine your horses and opponent horses
    const allMatchupHorses = [...yourHorses, ...opponentHorses];
    
    // Get full race results if available
    const allResults: any[] = simulatedRace?.results?.map(result => {
      // Check if this result is in our matchup horses
      const isInMatchup = allMatchupHorses.some(h => 
        h.horseName === result.horseName && h.programNumber === result.program_number
      );
      
      return {
        horseName: result.horseName,
        programNumber: result.program_number,
        position: result.position,
        points: result.points,
        odds: result.mlOddsFrac,
        jockey: result.jockey,
        trainer: result.trainer,
        sire1: result.sire1,
        connection: allMatchupHorses.find(h => h.horseName === result.horseName)?.connection,
        isYourPick: isInMatchup && allMatchupHorses.find(h => h.horseName === result.horseName)?.isYourPick || false,
      };
    }) || [];
    
    // Build race data for modal
    const raceData = {
      track,
      raceNumber,
      postTime: race.postTime,
      yourHorses: allMatchupHorses,
      allResults,
    };
    
    setSelectedRaceData(raceData);
    setRaceModalOpen(true);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'won':
        return <Badge className="bg-green-500">✅ Won</Badge>;
      case 'lost':
        return <Badge className="bg-red-500">❌ Lost</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500">🟡 Live</Badge>;
      default:
        return <Badge variant="outline">⏳ Pending</Badge>;
    }
  };

  const getCardColor = () => {
    // Remove colored backgrounds - use neutral for all
    return 'border-gray-300 bg-white';
  };

  return (
    <div>
      {/* Race Detail Modal */}
      {selectedRaceData && (
        <RaceDetailModal
          isOpen={raceModalOpen}
          onClose={() => setRaceModalOpen(false)}
          track={selectedRaceData.track}
          raceNumber={selectedRaceData.raceNumber}
          postTime={selectedRaceData.postTime}
          yourHorses={selectedRaceData.yourHorses}
          allResults={selectedRaceData.allResults}
        />
      )}
      
      <Card className={`border-2 ${getCardColor()} overflow-hidden`}>
      {/* Header - Like Underdog design */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[RoundProgressCard] Toggling expansion for round:', roundId, 'Current state:', isExpanded);
          setIsExpanded(!isExpanded);
        }}
        className="w-full px-6 py-4 text-left hover:bg-gray-100 transition-colors bg-gray-50 border-2 border-gray-300 cursor-pointer"
      >
        {/* Row 1: Picks info and dropdown */}
        <div className="flex items-start justify-between mb-3">
          {/* Left: Picks count and names */}
          <div>
            <div className="text-lg font-bold text-[var(--text-primary)] mb-1">
              {picks.length} Picks
            </div>
            <div className="text-sm text-gray-600">
              {matchups.map((m, idx) => {
                const chosenSet = m.chosenSide === 'A' ? m.setA : m.setB;
                const firstName = chosenSet.connections[0]?.name?.split(' ')[0] || 'Unknown';
                return firstName;
              }).join(', ')}
            </div>
          </div>
          
          {/* Right: Dropdown arrow */}
          <div>
            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-px bg-gray-300 mb-3"></div>
        
        {/* Row 2: Status circles and result */}
        <div className="flex items-center justify-between">
          {/* Left: Status circles */}
          <div className="flex gap-1.5">
            {matchups.map((m, idx) => {
              // Get chosen side for this matchup
              const pickForMatchup = picks[idx];
              const chosenSideForCircle = (pickForMatchup as any)?.chosen || (pickForMatchup as any)?.side || m.chosenSide;
              
              // Check if this matchup was won or lost
              const matchupWon = (chosenSideForCircle === 'A' && m.status === 'setA_won') || (chosenSideForCircle === 'B' && m.status === 'setB_won');
              const matchupLost = (chosenSideForCircle === 'A' && m.status === 'setB_won') || (chosenSideForCircle === 'B' && m.status === 'setA_won');
              const matchupInProgress = m.status === 'in_progress';
              
              // Check if all races are finished
              const allRacesFinished = races && races.length > 0 && races.every((r: any) => r.status === 'finished');
              
              let circleColor = 'bg-gray-300 border-gray-400'; // Pending
              let pulseCircle = '';
              if (matchupWon) circleColor = 'bg-green-500 border-green-600';
              else if (matchupLost) circleColor = 'bg-red-500 border-red-600';
              else if (matchupInProgress && !allRacesFinished) {
                circleColor = 'bg-yellow-500 border-yellow-600';
                pulseCircle = 'animate-pulse-glow';
              }
              
              return (
                <div
                  key={idx}
                  className={`w-7 h-7 rounded-full border-2 ${circleColor} ${pulseCircle} flex items-center justify-center`}
                >
                  {matchupWon && <span className="text-white text-sm font-bold">✓</span>}
                  {matchupLost && <span className="text-white text-sm font-bold">✗</span>}
                </div>
              );
            })}
          </div>
          
          {/* Right: Result with background */}
          <div>
            {status === 'won' ? (
              <div className="px-3 py-1.5 rounded bg-green-100 text-green-700 font-bold text-base">
                Won ${potentialWinnings.toFixed(2)}
              </div>
            ) : status === 'lost' ? (
              <div className="px-3 py-1.5 rounded bg-red-100 text-red-700 font-bold text-base">
                Lost ${entryAmount.toFixed(2)}
              </div>
            ) : (
              <div className="text-base font-semibold text-gray-600">
                ${entryAmount} Entry
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-200 bg-white">
          {matchups && matchups.length > 0 ? (
            matchups.map((matchup, index) => {
            // Get connection names
            const setANames = matchup.setA.connections.map(c => c.name).join(', ');
            const setBNames = matchup.setB.connections.map(c => c.name).join(', ');
            
            // Get role and track for Set A
            const setARole = matchup.setA.connections[0]?.role || 'unknown';
            const setATrack = matchup.setA.connections[0]?.starters?.[0]?.track || matchup.setA.connections[0]?.track || '';
            
            // Get role and track for Set B
            const setBRole = matchup.setB.connections[0]?.role || 'unknown';
            const setBTrack = matchup.setB.connections[0]?.starters?.[0]?.track || matchup.setB.connections[0]?.track || '';
            
            // Calculate stats for Set A
            const setAApps = matchup.setA.connections.reduce((sum, c) => sum + (c.starters?.length || 0), 0);
            const setAAvgOdds = matchup.setA.connections[0]?.avgOdds?.toFixed(1) || 'N/A';
            
            // Calculate stats for Set B
            const setBApps = matchup.setB.connections.reduce((sum, c) => sum + (c.starters?.length || 0), 0);
            const setBAvgOdds = matchup.setB.connections[0]?.avgOdds?.toFixed(1) || 'N/A';
            
            // Find which side was chosen - use index-based matching since matchupIds don't align
            const pickForThisMatchup = picks[index];
            // Try both 'chosen' and 'side' properties
            const chosenSide = (pickForThisMatchup as any)?.chosen || (pickForThisMatchup as any)?.side || matchup.chosenSide;
            
            const isChosen = (side: 'A' | 'B') => chosenSide === side;
            
            // Determine if this pick won or lost
            const isWon = (chosenSide === 'A' && matchup.status === 'setA_won') || (chosenSide === 'B' && matchup.status === 'setB_won');
            const isLost = (chosenSide === 'A' && matchup.status === 'setB_won') || (chosenSide === 'B' && matchup.status === 'setA_won');
            
            console.log('[RoundProgressCard] Matchup', index + 1, ':', {
              matchupId: matchup.matchupId,
              pickIndex: index,
              pickData: pickForThisMatchup,
              chosenSide,
              status: matchup.status,
              setAPoints: matchup.setA.currentPoints,
              setBPoints: matchup.setB.currentPoints,
              isChosenA: isChosen('A'),
              isChosenB: isChosen('B'),
              isWon,
              isLost
            });

            // Helper to get badge color
            const getBadgeColor = (role: string) => {
              if (role === 'jockey') return 'bg-blue-100 text-blue-800 border-blue-300';
              if (role === 'trainer') return 'bg-purple-100 text-purple-800 border-purple-300';
              if (role === 'sire') return 'bg-green-100 text-green-800 border-green-300';
              return 'bg-gray-100 text-gray-800 border-gray-300';
            };

            // Helper to get role label
            const getRoleLabel = (role: string) => {
              if (role === 'jockey') return 'Jockey';
              if (role === 'trainer') return 'Trainer';
              if (role === 'sire') return 'Sire';
              return 'Unknown';
            };

            // Helper to get track badge color
            const getTrackBadgeColor = (track: string) => {
              const trackColors: Record<string, string> = {
                'AQU': 'bg-blue-500 text-white border-blue-600',
                'BAQ': 'bg-cyan-500 text-white border-cyan-600',
                'BEL': 'bg-indigo-500 text-white border-indigo-600',
                'CD': 'bg-amber-500 text-white border-amber-600',
                'DMR': 'bg-black text-white border-gray-800',
                'GP': 'bg-green-500 text-white border-green-600',
                'KEE': 'bg-purple-500 text-white border-purple-600',
                'LRL': 'bg-pink-500 text-white border-pink-600',
                'SA': 'bg-red-500 text-white border-red-600',
              };
              return trackColors[track] || 'bg-gray-500 text-white border-gray-600';
            };

            const isPickCollapsed = collapsedPicks.has(index);
            const chosenSet = chosenSide === 'A' ? matchup.setA : matchup.setB;
            const chosenName = chosenSet.connections[0]?.name || 'Unknown';
            const chosenPoints = chosenSet.currentPoints;
            const pickWon = isWon;
            const pickLost = isLost;

            // Render Set Card helper function
            const renderSetCard = (set: any, isChosenSet: boolean, side: 'A' | 'B') => {
              return (
                <div className={`border-2 rounded-lg overflow-hidden mb-3 ${
                  isChosenSet && pickWon ? 'border-green-500 bg-green-50' : 
                  isChosenSet && pickLost ? 'border-red-500 bg-red-50' : 
                  isChosenSet ? 'border-blue-500 bg-blue-50' : 
                  'border-gray-300 bg-white'
                }`}>
                  {/* Grid layout: 2 rows (connections) + 1 column (total points) */}
                  <div className="grid grid-cols-[1fr_auto] gap-0">
                    {/* Left column: Connection rows */}
                    <div className="flex flex-col">
                      {set?.connections?.map((conn: any, connIdx: number) => {
                        const connStarters = conn.starters || [];
                        
                        // Group starters by track for this connection
                        const startersByTrack = new Map<string, any[]>();
                        connStarters.forEach((starter: any) => {
                          const track = starter.track;
                          if (!startersByTrack.has(track)) {
                            startersByTrack.set(track, []);
                          }
                          startersByTrack.get(track)!.push(starter);
                        });
                        
                        // Render a progress bar for each track this connection appears in
                        return (
                          <div key={`conn-${connIdx}`} className={`${
                            connIdx > 0 ? 'border-t-2 border-gray-300' : ''
                          }`}>
                            {Array.from(startersByTrack.entries()).map(([track, starters], trackIdx) => {
                              // Get all race numbers for this track to determine total races - USE ACTUAL RACES, NOT ASSUMED 10
                              const allRaceNums = starters.map((s: any) => s.race || s.raceNumber).filter((n: any): n is number => typeof n === 'number');
                              const maxRaceOnTrack = allRaceNums.length > 0 ? Math.max(...allRaceNums) : 1;
                              
                              // Check races array to see what races actually exist for this track
                              const actualRacesForTrack = races ? races.filter((r: any) => r.track === track).map(r => r.raceNumber) : [];
                              const maxActualRace = actualRacesForTrack.length > 0 ? Math.max(...actualRacesForTrack) : maxRaceOnTrack;
                              
                              // Use the actual maximum race, not an assumed 10
                              const totalRacesOnTrack = maxActualRace;
                              
                              // Calculate finished count for this connection's starters - only count actually finished races
                              const finishedCount = starters.filter((s: any) => s.finished === true).length;
                              const effectiveFinishedCount = finishedCount;
                              
                              // Only show yellow progress line when matchup is in progress or completed (won/lost) and has finished races
                              const shouldShowProgress = (matchup.status === 'in_progress' || matchup.status === 'setA_won' || matchup.status === 'setB_won') && effectiveFinishedCount > 0;
                              
                              // Format post time in CT - check multiple sources
                              const formatPostTimeCT = (starter: any): string => {
                                // Try multiple property names for post time in starter
                                let postTimeStr = starter.postTime || 
                                                 starter.post_time || 
                                                 starter.post || 
                                                 starter.mtp ||
                                                 starter.scheduledStart ||
                                                 starter.postTimeCT;
                                
                                // If not found in starter, try to get from the connection's starters array
                                if (!postTimeStr && conn.starters) {
                                  const connStarter = conn.starters.find((s: any) => 
                                    s.track === starter.track && 
                                    s.race === (starter.race || starter.raceNumber)
                                  );
                                  if (connStarter) {
                                    postTimeStr = connStarter.postTime || 
                                                 connStarter.post_time || 
                                                 connStarter.post || 
                                                 connStarter.mtp ||
                                                 connStarter.scheduledStart;
                                  }
                                }
                                
                                // If still not found, try to get from races array
                                if (!postTimeStr && races && races.length > 0) {
                                  const race = races.find((r: any) => 
                                    r.track === starter.track && 
                                    r.raceNumber === (starter.race || starter.raceNumber)
                                  );
                                  if (race) {
                                    postTimeStr = race.postTime || 
                                                 race.post_time || 
                                                 race.scheduledStart ||
                                                         (typeof race.scheduledStart === 'object' && race.scheduledStart instanceof Date ? race.scheduledStart.toISOString() : race.scheduledStart);
                                  }
                                }
                                
                                // If still not found, check all other starters in this connection for the same race
                                if (!postTimeStr && conn.starters) {
                                  const sameRaceStarter = conn.starters.find((s: any) => 
                                    s.track === starter.track && 
                                    (s.race === (starter.race || starter.raceNumber) || s.raceNumber === (starter.race || starter.raceNumber))
                                  );
                                  if (sameRaceStarter && sameRaceStarter !== starter) {
                                    postTimeStr = sameRaceStarter.postTime || 
                                                 sameRaceStarter.post_time || 
                                                 sameRaceStarter.post || 
                                                 sameRaceStarter.mtp ||
                                                 sameRaceStarter.scheduledStart;
                                  }
                                }
                                
                                if (!postTimeStr) return '';
                                
                                try {
                                  const date = new Date(postTimeStr);
                                  if (isNaN(date.getTime())) return '';
                                  
                                  return date.toLocaleTimeString('en-US', { 
                                    timeZone: 'America/Chicago',
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  }) + ' CT';
                                } catch {
                                  return '';
                                }
                              };
                              
                              return (
                                <div key={`track-${trackIdx}`} className={`flex items-center gap-4 p-4 ${
                                  trackIdx > 0 ? 'border-t border-gray-200' : ''
                                } ${
                                  isChosenSet && pickWon ? 'bg-green-50' : 
                                  isChosenSet && pickLost ? 'bg-red-50' : 
                                  isChosenSet ? 'bg-blue-50' : ''
                                }`}>
                                  {/* Connection info card (once per connection) */}
                                  {trackIdx === 0 && (
                                    <div className="flex-shrink-0 w-64 p-3 bg-gray-50 rounded-lg border border-gray-300">
                                      {/* Row 1: Name and Salary */}
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-base">{conn.name}</div>
                                        <div className="text-base font-bold text-[var(--text-primary)]">
                                          ${(conn.salarySum || 0).toLocaleString()}
                                        </div>
                                      </div>
                                      {/* Row 2: Role and Track badges */}
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge className={`text-xs ${getBadgeColor(conn.role || 'unknown')}`}>
                                          {getRoleLabel(conn.role || 'unknown')}
                                        </Badge>
                                        <Badge className={`text-xs font-bold ${getTrackBadgeColor(track)}`}>
                                          {track}
                                        </Badge>
                                      </div>
                                      {/* Stats */}
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Apps</div>
                                          <div className="text-sm font-semibold text-gray-900">{connStarters.length}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Avg. Odds</div>
                                          <div className="text-sm font-semibold text-gray-900">{(conn.avgOdds?.toFixed(1) || 'N/A')}</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* If multi-track connection, show connection info with track badge */}
                                  {trackIdx > 0 && (
                                    <div className="flex-shrink-0 w-64 p-3 bg-gray-50 rounded-lg border border-gray-300">
                                      {/* Row 1: Name and Salary */}
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-base">{conn.name}</div>
                                        <div className="text-base font-bold text-[var(--text-primary)]">
                                          ${(conn.salarySum || 0).toLocaleString()}
                                        </div>
                                      </div>
                                      {/* Row 2: Role and Track badges */}
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge className={`text-xs ${getBadgeColor(conn.role || 'unknown')}`}>
                                          {getRoleLabel(conn.role || 'unknown')}
                                        </Badge>
                                        <Badge className={`text-xs font-bold ${getTrackBadgeColor(track)}`}>
                                          {track}
                                        </Badge>
                                      </div>
                                      {/* Stats */}
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Apps</div>
                                          <div className="text-sm font-semibold text-gray-900">{starters.length}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Avg. Odds</div>
                                          <div className="text-sm font-semibold text-gray-900">{(conn.avgOdds?.toFixed(1) || 'N/A')}</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Progress bar for this track - shows full race schedule with nodes only where connection participates */}
                                  <div className="flex-1 px-4 relative">
                                    <div className="relative flex items-center px-2" style={{ minHeight: '80px' }}>
                                      
                                      {/* Background line - represents full race schedule */}
                                      <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-1 bg-gray-300 rounded-full" style={{ zIndex: 0 }}></div>
                                      
                                      {/* Progress overlay line - yellow when in progress */}
                                      {shouldShowProgress && (() => {
                                        const now = new Date();
                                        const fiveMinutesInMs = 5 * 60 * 1000;
                                        
                                        // Get all race numbers for this connection, sorted
                                        const connectionRaceNums = Array.from(new Set(
                                          starters.map((s: any) => s.race || s.raceNumber).filter((n: any): n is number => typeof n === 'number')
                                        )).sort((a, b) => a - b);
                                        
                                        // Get ALL races for this track (not just connection races) to determine progress
                                        const allTrackRaces = races ? races.filter((r: any) => r.track === track).map(r => r.raceNumber).sort((a: number, b: number) => a - b) : [];
                                        const firstTrackRace = allTrackRaces.length > 0 ? Math.min(...allTrackRaces) : 1;
                                        const lastTrackRace = allTrackRaces.length > 0 ? Math.max(...allTrackRaces) : totalRacesOnTrack;
                                        
                                        // Find the last finished race across ALL track races (not just connection races)
                                        let lastFinishedRace: number | null = null;
                                        let nextActiveRace: number | null = null;
                                        
                                        // Check all track races, not just connection races
                                        for (const raceNum of allTrackRaces) {
                                          const raceData = races?.find((r: any) => 
                                            r.track === track && r.raceNumber === raceNum
                                          );
                                          const raceStatus = raceData?.status || 'pending';
                                          
                                          if (raceStatus === 'finished') {
                                            lastFinishedRace = raceNum;
                                            continue;
                                          }
                                          
                                          // Check if race is running
                                          if (raceStatus === 'running') {
                                            nextActiveRace = raceNum;
                                            break;
                                          }
                                          
                                          // Check if race is 5 min to post (check any starter for this race)
                                          const raceDataForPostTime = races?.find((r: any) => r.track === track && r.raceNumber === raceNum);
                                          if (raceDataForPostTime?.postTime || raceDataForPostTime?.scheduledStart) {
                                            const postTimeStr = raceDataForPostTime.postTime || raceDataForPostTime.scheduledStart;
                                            const postTimeDate = new Date(postTimeStr);
                                            const timeUntilPost = postTimeDate.getTime() - now.getTime();
                                            if (timeUntilPost > 0 && timeUntilPost <= fiveMinutesInMs) {
                                              nextActiveRace = raceNum;
                                              break;
                                            }
                                          }
                                        }
                                        
                                        // Calculate progress width - extend to last finished race OR last track race if all are finished
                                        // Also add padding: extend a bit before first race and after last race
                                        let progressWidth = '0%';
                                        let progressLeft = '0%';
                                        
                                        if (nextActiveRace !== null) {
                                          // Progress up to the next active race (5 min to post or running)
                                          // Add padding: start a bit before first race, end at next active race
                                          const paddingPercent = 3; // 3% padding on each side
                                          const positionPercent = totalRacesOnTrack > 1 
                                            ? ((nextActiveRace - 1) / (totalRacesOnTrack - 1)) * 100
                                            : 50;
                                          progressLeft = `${paddingPercent}%`;
                                          progressWidth = `${Math.min(positionPercent + paddingPercent, 100 - paddingPercent * 2)}%`;
                                        } else if (lastFinishedRace !== null) {
                                          // Progress up to the last finished race OR all track races if all are finished
                                          // If all track races are finished, extend to 100% (minus padding)
                                          const allRacesFinished = allTrackRaces.every((raceNum: number) => {
                                            const raceData = races?.find((r: any) => r.track === track && r.raceNumber === raceNum);
                                            return raceData?.status === 'finished';
                                          });
                                          
                                          if (allRacesFinished) {
                                            // All races finished - extend to end with padding
                                            const paddingPercent = 3;
                                            progressLeft = `${paddingPercent}%`;
                                            progressWidth = `${100 - paddingPercent * 2}%`;
                                          } else {
                                            // Progress up to last finished race with padding
                                            const paddingPercent = 3;
                                            const positionPercent = totalRacesOnTrack > 1 
                                              ? ((lastFinishedRace - 1) / (totalRacesOnTrack - 1)) * 100
                                              : 50;
                                            progressLeft = `${paddingPercent}%`;
                                            progressWidth = `${Math.min(positionPercent + paddingPercent, 100 - paddingPercent * 2)}%`;
                                          }
                                        } else {
                                          // No finished or active races - show minimal progress with padding
                                          const paddingPercent = 3;
                                          progressLeft = `${paddingPercent}%`;
                                          progressWidth = `${paddingPercent}%`;
                                        }
                                        
                                        return (
                                          <div 
                                            className="absolute top-1/2 transform -translate-y-1/2 h-1 bg-yellow-500 rounded-full transition-all duration-500"
                                            style={{ 
                                              left: progressLeft,
                                              width: progressWidth,
                                              zIndex: 0 // Lower z-index so nodes appear above
                                            }}
                                          ></div>
                                        );
                                      })()}
                                      
                                      {/* Race nodes - positioned by actual race number on the track */}
                                      <div className="relative w-full" style={{ zIndex: 10 }}>
                                        {(() => {
                                          // Group starters by race number to handle multiple horses in same race
                                          const startersByRace = new Map<number, any[]>();
                                          starters.forEach((starter: any) => {
                                            const raceNum = starter.race || starter.raceNumber;
                                            if (raceNum) {
                                              if (!startersByRace.has(raceNum)) {
                                                startersByRace.set(raceNum, []);
                                              }
                                              startersByRace.get(raceNum)!.push(starter);
                                            }
                                          });
                                          
                                          // Render one node per unique race
                                          return Array.from(startersByRace.entries()).map(([raceNum, raceStarters], raceIdx) => {
                                            // Use first starter for post time and other data
                                            const starter = raceStarters[0];
                                            const horseCount = raceStarters.length;
                                            
                                            // Aggregate points and finished status for all horses in this race
                                            const totalPoints = raceStarters.reduce((sum, s) => sum + (s.points || 0), 0);
                                            const hasFinished = raceStarters.some((s: any) => s.finished === true);
                                            
                                            // Find race status from races array
                                            const raceData = races?.find((r: any) => 
                                              r.track === starter.track && r.raceNumber === raceNum
                                            );
                                            const raceStatus = raceData?.status || 'pending';
                                            const isRaceRunning = raceStatus === 'running';
                                            const isRaceFinished = raceStatus === 'finished' || hasFinished;
                                            
                                            // Position: Race 1 = 0%, Race 2 = 11%, Race 5 = 44%, Race 10 = 100%
                                            const positionPercent = totalRacesOnTrack > 1 
                                              ? ((raceNum - 1) / (totalRacesOnTrack - 1)) * 100
                                              : 50;
                                            
                                            // Determine node color based on race status
                                            let nodeColor = 'border-gray-300 bg-white';
                                            let pulseClass = '';
                                            
                                            // Check if matchup is finished (won/lost/tied)
                                            const matchupFinished = matchup.status === 'setA_won' || matchup.status === 'setB_won' || matchup.status === 'tied';
                                            
                                            // Check if all races are finished
                                            const allRacesFinished = races && races.length > 0 && races.every((r: any) => r.status === 'finished');
                                            
                                            if (isRaceFinished) {
                                              // Race finished - black/gray node
                                              nodeColor = 'border-gray-900 bg-gray-900';
                                            } else if (isRaceRunning) {
                                              // Race is live - pulse yellow
                                              nodeColor = 'border-yellow-500 bg-yellow-500';
                                              pulseClass = 'animate-pulse';
                                            } else if (matchupFinished || allRacesFinished) {
                                              // Matchup is finished or all races are done, don't pulse - use gray for pending races
                                              nodeColor = 'border-gray-300 bg-white';
                                            } else if (starter.postTime) {
                                              const postTimeDate = new Date(starter.postTime);
                                              const now = new Date();
                                              const timeUntilPost = postTimeDate.getTime() - now.getTime();
                                              const fiveMinutesInMs = 5 * 60 * 1000;
                                              
                                              // Only pulse if race is about to start (5 min to post) and matchup is still in progress
                                              if (timeUntilPost > 0 && timeUntilPost <= fiveMinutesInMs && !matchupFinished && !allRacesFinished) {
                                                nodeColor = 'border-yellow-500 bg-yellow-500';
                                                pulseClass = 'animate-pulse';
                                              }
                                            }
                                            
                                            // Get race details for tooltip
                                            const raceResult = raceData?.results?.find((r: any) => 
                                              r.horseName === starter.horseName && r.track === starter.track && r.race === raceNum
                                            );
                                            const position = raceResult?.position || starter.position;
                                            const mlOdds = starter.ml_odds_frac || starter.mlOddsFrac || starter.ml_odds || 'N/A';
                                            
                                            return (
                                              <div 
                                                key={`race-${raceNum}`}
                                                className="absolute flex flex-col items-center group cursor-pointer"
                                                style={{
                                                  left: `${positionPercent}%`,
                                                  top: '50%',
                                                  transform: 'translate(-50%, -50%)'
                                                }}
                                                onClick={() => hasFinished && handleRaceNodeClick(starter, matchup, isChosenSet)}
                                              >
                                                {/* Race number above */}
                                                <div className="absolute -top-7 text-[10px] font-bold text-gray-700 whitespace-nowrap">
                                                  R{raceNum}
                                                </div>
                                                
                                                {/* Circle node with count badge if multiple horses */}
                                                <div className="relative" style={{ zIndex: 30 }}>
                                                  {/* White background to block progress bar behind pulsing nodes */}
                                                  <div className="absolute inset-0 bg-white rounded-full" style={{ zIndex: 29 }}></div>
                                                  <div className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${nodeColor} ${pulseClass} relative`} style={{ zIndex: 30 }}></div>
                                                  {/* Count badge - show when more than 1 horse in this race - HIGHER z-index to appear in front */}
                                                  {horseCount > 1 && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white" style={{ zIndex: 40 }}>
                                                      {horseCount}
                                                    </div>
                                                  )}
                                                </div>
                                                
                                                {/* Post time below in CT */}
                                                <div className="absolute -bottom-7 text-[9px] font-medium text-gray-600 whitespace-nowrap">
                                                  {formatPostTimeCT(starter) || '—'}
                                                </div>
                                                
                                                {/* Hover tooltip with race details */}
                                                {hasFinished && (
                                                  <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                                                    <div className="font-bold mb-1">Race {raceNum} - {starter.track}</div>
                                                    <div className="space-y-0.5">
                                                      <div>Horse: {starter.horseName || 'N/A'}</div>
                                                      <div>Position: {position || 'N/A'}</div>
                                                      <div>Points: {totalPoints.toFixed(2)}</div>
                                                      <div>M/L Odds: {mlOdds}</div>
                                                    </div>
                                                    {/* Tooltip arrow */}
                                                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Points box layout - depends on set size */}
                                  {set?.connections?.length === 1 ? (
                                    /* Single connection: show individual points box */
                                    (() => {
                                      // Only show when races have actually finished (not just started)
                                      // Also ensure we're not showing points before simulation actually runs
                                      const racesFinished = races && races.length > 0 && races.some((r: any) => r.status === 'finished');
                                      if (!racesFinished) return null;
                                      
                                      // Only count points from starters that have actually finished (have position/points from finished races)
                                      const connPoints = (conn.starters || []).reduce((sum: number, s: any) => {
                                        // Only count points if the starter has finished (has position) AND the race is finished
                                        if (s.finished === true || (s.position !== undefined && s.position !== null)) {
                                          const raceFinished = races?.find((r: any) => 
                                            r.track === s.track && r.raceNumber === (s.race || s.raceNumber) && r.status === 'finished'
                                          );
                                          if (raceFinished) {
                                            return sum + (s.points || 0);
                                          }
                                        }
                                        return sum;
                                      }, 0);
                                      
                                      return (
                                        <div className="flex-shrink-0 w-28 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                                          <div className="text-xs text-gray-500 mb-1">Points</div>
                                          <div className={`text-2xl font-bold ${
                                            isChosenSet && pickWon ? 'text-green-600' :
                                            isChosenSet && pickLost ? 'text-red-600' :
                                            'text-[var(--text-primary)]'
                                          }`}>
                                            {connPoints.toFixed(1)}
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    /* Two connections: no individual points boxes - save space for progress bar */
                                    null
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Right column: Total points box with individual connection points above/below (only for sets with 2 connections) */}
                    {set?.connections?.length === 2 && (() => {
                      // Only show when races have actually finished (not just started)
                      // Also ensure we're not showing points before simulation actually runs
                      const racesFinished = races && races.length > 0 && races.some((r: any) => r.status === 'finished');
                      if (!racesFinished) return null;
                      
                      // Calculate points for each connection and total
                      // Only count points from starters that have actually finished (have position/points from finished races)
                      const connectionPoints = set.connections.map((connection: any, idx: number) => {
                        const points = (connection.starters || []).reduce((ptSum: number, starter: any) => {
                          // Only count points if the starter has finished (has position) AND the race is finished
                          if (starter.finished === true || (starter.position !== undefined && starter.position !== null)) {
                            const raceFinished = races?.find((r: any) => 
                              r.track === starter.track && r.raceNumber === (starter.race || starter.raceNumber) && r.status === 'finished'
                            );
                            if (raceFinished) {
                              return ptSum + (starter.points || 0);
                            }
                          }
                          return ptSum;
                        }, 0);
                        return { name: connection.name || 'Unknown', points, index: idx };
                      });
                      
                      const totalSetPoints = connectionPoints.reduce((sum, conn) => sum + conn.points, 0);
                      
                      return (
                        <div className="flex flex-col items-center justify-center px-6 py-4">
                          {/* Connection 1 points - above total box with spacing */}
                          <div className="text-sm font-semibold text-gray-700 px-3 py-1.5 bg-blue-100 rounded-lg border border-blue-300 mb-3">
                            {connectionPoints[0]?.name.split(' ')[0] || 'Conn1'}: {connectionPoints[0]?.points.toFixed(1) || '0.0'} pts
                          </div>
                          
                          {/* Total Points Box - centered between the two connection points */}
                          <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 text-center min-w-[160px]">
                            <div className="text-xs text-gray-700 font-semibold mb-1">Total Points</div>
                            <div className={`text-2xl font-bold ${
                              isChosenSet && pickWon ? 'text-green-600' :
                              isChosenSet && pickLost ? 'text-red-600' :
                              'text-blue-600'
                            }`}>
                              {totalSetPoints.toFixed(1)}
                            </div>
                          </div>
                          
                          {/* Connection 2 points - below total box with spacing */}
                          <div className="text-sm font-semibold text-gray-700 px-3 py-1.5 bg-blue-100 rounded-lg border border-blue-300 mt-3">
                            {connectionPoints[1]?.name.split(' ')[0] || 'Conn2'}: {connectionPoints[1]?.points.toFixed(1) || '0.0'} pts
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            };

            return (
              <div key={matchup.matchupId || `matchup-${index}`} className="pt-3 first:pt-3">
                {/* Matchup container with border - highlight green if won, red if lost */}
                <div className={`bg-white rounded-lg border-2 overflow-hidden transition-colors ${
                  pickWon ? 'border-green-500 bg-green-50' : 
                  pickLost ? 'border-red-500 bg-red-50' : 
                  'border-gray-300'
                }`}>
                  {/* Matchup number - clickable to collapse */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePickCollapse(index);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-sm font-semibold">
                        Pick #{index + 1}
                      </Badge>
                      <span className="text-sm font-medium text-gray-700">{chosenName}</span>
                      {/* Status badge - show won/lost when matchup is decided */}
                      {matchup.status === 'setA_won' || matchup.status === 'setB_won' || matchup.status === 'tied' ? (
                        <Badge className={`text-xs ${
                          pickWon ? 'bg-green-500 text-white' : 
                          pickLost ? 'bg-red-500 text-white' : 
                          'bg-gray-500 text-white'
                        }`}>
                          {pickWon ? '✓ Won' : pickLost ? '✗ Lost' : 'Tied'}
                        </Badge>
                      ) : matchup.status === 'in_progress' ? (
                        <Badge className="bg-yellow-500 text-white text-xs">🟡 Live</Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {isPickCollapsed && (
                        <div className={`px-3 py-1 rounded font-bold text-sm ${
                          pickWon ? 'bg-green-100 text-green-700' : 
                          pickLost ? 'bg-red-100 text-red-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {chosenPoints} pts
                        </div>
                      )}
                      {isPickCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  
                  {/* Pick details - collapsible */}
                  {!isPickCollapsed && (
                    <div className="p-4 bg-gray-50">
                      <div className="flex flex-col gap-3">
                        {/* Set A */}
                        {renderSetCard(matchup.setA, isChosen('A'), 'A')}
                        
                        {/* Set B */}
                        {renderSetCard(matchup.setB, isChosen('B'), 'B')}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          );
        })
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              No matchup details available
            </div>
          )}
        </div>
      )}
    </Card>
    </div>
  );
}

