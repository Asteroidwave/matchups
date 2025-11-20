"use client";

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Circle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface RaceNodeProps {
  raceNumber: number;
  track: string;
  status: 'pending' | 'running' | 'finished';
  horseName?: string;
  position?: number | null;
  points?: number;
  odds?: string;
  postTime?: string;
  won?: boolean; // Did this connection win/place/show?
  onClick?: () => void;
}

export function RaceNode({
  raceNumber,
  track,
  status,
  horseName,
  position,
  points = 0,
  odds,
  postTime,
  won,
  onClick,
}: RaceNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getNodeColor = () => {
    if (status === 'pending') return 'bg-gray-300 border-gray-400';
    if (status === 'running') return 'bg-yellow-400 border-yellow-500 animate-pulse';
    if (status === 'finished') {
      if (won === true) return 'bg-green-500 border-green-600';
      if (won === false) return 'bg-red-500 border-red-600';
      return 'bg-blue-500 border-blue-600';
    }
    return 'bg-gray-300 border-gray-400';
  };

  const getIcon = () => {
    if (status === 'pending') return <Clock className="w-3 h-3 text-gray-600" />;
    if (status === 'running') return <Circle className="w-3 h-3 text-yellow-800" />;
    if (status === 'finished') {
      if (won === true) return <CheckCircle className="w-3 h-3 text-white" />;
      if (won === false) return <XCircle className="w-3 h-3 text-white" />;
      return <Circle className="w-3 h-3 text-white" />;
    }
    return <Circle className="w-3 h-3" />;
  };

  const tooltipContent = (
    <div className="text-xs space-y-1">
      <div className="font-semibold">{track} Race {raceNumber}</div>
      {horseName && <div>Horse: {horseName}</div>}
      {odds && <div>Odds: {odds}</div>}
      {postTime && <div>Post: {postTime}</div>}
      {status === 'finished' && (
        <>
          {position !== null && position !== undefined && (
            <div>Position: {position > 0 ? `${position}${['st', 'nd', 'rd'][position - 1] || 'th'}` : 'N/A'}</div>
          )}
          <div className="font-semibold text-green-400">Points: {points}</div>
        </>
      )}
      {status === 'running' && <div className="text-yellow-400">In Progress...</div>}
      {status === 'pending' && <div className="text-gray-400">Not Started</div>}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              relative w-8 h-8 rounded-full border-2 flex items-center justify-center
              transition-all duration-200 cursor-pointer
              ${getNodeColor()}
              ${isHovered ? 'scale-110 shadow-lg' : ''}
              ${onClick ? 'hover:scale-110 hover:shadow-lg' : ''}
            `}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {getIcon()}
            {status === 'finished' && points > 0 && (
              <div className="absolute -top-2 -right-2 bg-white rounded-full px-1 text-[10px] font-bold text-green-600 border border-green-500 shadow">
                +{points}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

