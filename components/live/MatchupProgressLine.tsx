"use client";

import { RaceNode } from './RaceNode';

interface ConnectionRace {
  raceNumber: number;
  track: string;
  horseName: string;
  status: 'pending' | 'running' | 'finished';
  position?: number | null;
  points?: number;
  odds?: string;
  postTime?: string;
}

interface MatchupProgressLineProps {
  matchupId: string;
  setAName: string;
  setBName: string;
  chosenSide: 'A' | 'B';
  setARaces: ConnectionRace[];
  setBRaces: ConnectionRace[];
  setAPoints: number;
  setBPoints: number;
  status: 'pending' | 'in_progress' | 'setA_won' | 'setB_won' | 'tied';
  onRaceClick?: (race: ConnectionRace) => void;
}

export function MatchupProgressLine({
  matchupId,
  setAName,
  setBName,
  chosenSide,
  setARaces,
  setBRaces,
  setAPoints,
  setBPoints,
  status,
  onRaceClick,
}: MatchupProgressLineProps) {
  const getStatusColor = () => {
    if (status === 'pending') return 'border-gray-300';
    if (status === 'in_progress') {
      if (setAPoints > setBPoints) return 'border-green-500 bg-green-50';
      if (setBPoints > setAPoints) return 'border-red-500 bg-red-50';
      return 'border-yellow-500 bg-yellow-50';
    }
    if (status === 'setA_won' || status === 'setB_won') {
      const won = (chosenSide === 'A' && status === 'setA_won') || (chosenSide === 'B' && status === 'setB_won');
      return won ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50';
    }
    return 'border-gray-300';
  };

  const getStatusIcon = () => {
    if (status === 'pending') return '⏳';
    if (status === 'in_progress') {
      if (setAPoints > setBPoints) return '🟢';
      if (setBPoints > setAPoints) return '🔴';
      return '🟡';
    }
    if (status === 'setA_won' || status === 'setB_won') {
      const won = (chosenSide === 'A' && status === 'setA_won') || (chosenSide === 'B' && status === 'setB_won');
      return won ? '✅' : '❌';
    }
    return '○';
  };

  // Merge all races and sort by race number
  const allRaces = [...setARaces, ...setBRaces].sort((a, b) => {
    if (a.track !== b.track) return a.track.localeCompare(b.track);
    return a.raceNumber - b.raceNumber;
  });

  // For pending status, show grey circles
  const getCircleColor = (side: 'A' | 'B') => {
    if (status === 'pending') return 'bg-gray-300 border-gray-400';
    
    const isWon = (side === 'A' && status === 'setA_won') || (side === 'B' && status === 'setB_won');
    const isLost = (side === 'A' && status === 'setB_won') || (side === 'B' && status === 'setA_won');
    
    if (isWon) return 'bg-green-500 border-green-600';
    if (isLost) return 'bg-red-500 border-red-600';
    return 'bg-gray-300 border-gray-400';
  };

  return (
    <div className={`border-2 rounded-lg p-4 transition-all bg-white ${getStatusColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Status circles instead of emoji for pending */}
          {status === 'pending' ? (
            <div className="flex gap-1">
              <div className={`w-6 h-6 rounded-full border-2 ${getCircleColor('A')}`} />
              <div className={`w-6 h-6 rounded-full border-2 ${getCircleColor('B')}`} />
            </div>
          ) : (
            <span className="text-2xl">{getStatusIcon()}</span>
          )}
          <div>
            <div className="font-semibold text-sm">
              <span className={chosenSide === 'A' ? 'text-blue-600 font-bold' : ''}>{setAName}</span>
              {' vs '}
              <span className={chosenSide === 'B' ? 'text-blue-600 font-bold' : ''}>{setBName}</span>
            </div>
            <div className="text-xs text-gray-600">
              {chosenSide === 'A' ? `Picked ${setAName}` : `Picked ${setBName}`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            <span className={setAPoints > setBPoints ? 'text-green-600' : ''}>{setAPoints}</span>
            {' - '}
            <span className={setBPoints > setAPoints ? 'text-red-600' : ''}>{setBPoints}</span>
          </div>
          <div className="text-xs text-gray-600">Points</div>
        </div>
      </div>

      {/* Race Nodes */}
      <div className="space-y-3">
        {/* Set A Races */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Set A: {setAName}</div>
          <div className="flex items-center gap-2">
            {setARaces.map((race, idx) => {
              const won = race.status === 'finished' && (race.points || 0) > 0;
              return (
                <div key={idx} className="flex items-center">
                  <RaceNode
                    raceNumber={race.raceNumber}
                    track={race.track}
                    status={race.status}
                    horseName={race.horseName}
                    position={race.position}
                    points={race.points}
                    odds={race.odds}
                    postTime={race.postTime}
                    won={race.status === 'finished' ? won : undefined}
                    onClick={onRaceClick ? () => onRaceClick(race) : undefined}
                  />
                  {idx < setARaces.length - 1 && (
                    <div className={`h-0.5 w-4 ${
                      race.status === 'finished' ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Set B Races */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Set B: {setBName}</div>
          <div className="flex items-center gap-2">
            {setBRaces.map((race, idx) => {
              const won = race.status === 'finished' && (race.points || 0) > 0;
              return (
                <div key={idx} className="flex items-center">
                  <RaceNode
                    raceNumber={race.raceNumber}
                    track={race.track}
                    status={race.status}
                    horseName={race.horseName}
                    position={race.position}
                    points={race.points}
                    odds={race.odds}
                    postTime={race.postTime}
                    won={race.status === 'finished' ? won : undefined}
                    onClick={onRaceClick ? () => onRaceClick(race) : undefined}
                  />
                  {idx < setBRaces.length - 1 && (
                    <div className={`h-0.5 w-4 ${
                      race.status === 'finished' ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

