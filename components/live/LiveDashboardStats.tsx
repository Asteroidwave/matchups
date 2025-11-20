"use client";

import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface LiveDashboardStatsProps {
  wonRounds: number;
  lostRounds: number;
  liveRounds: number;
  totalWinnings: number;
  totalLosses: number;
  livePotential: number;
  onFilterClick?: (filter: 'won' | 'lost' | 'live') => void;
}

export function LiveDashboardStats({
  wonRounds,
  lostRounds,
  liveRounds,
  totalWinnings,
  totalLosses,
  livePotential,
  onFilterClick,
}: LiveDashboardStatsProps) {
  const netPL = totalWinnings - totalLosses;
  
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Won Card */}
      <button
        onClick={() => onFilterClick?.('won')}
        className="text-left transition-all hover:scale-105"
      >
        <Card className="p-5 bg-green-50 border-2 border-green-500 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-green-700">Won</div>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">{wonRounds}</div>
          <div className="text-sm text-green-700 mt-1">
            +${totalWinnings.toFixed(2)}
          </div>
        </Card>
      </button>
      
      {/* Lost Card */}
      <button
        onClick={() => onFilterClick?.('lost')}
        className="text-left transition-all hover:scale-105"
      >
        <Card className="p-5 bg-red-50 border-2 border-red-500 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-red-700">Lost</div>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">{lostRounds}</div>
          <div className="text-sm text-red-700 mt-1">
            -${totalLosses.toFixed(2)}
          </div>
        </Card>
      </button>
      
      {/* Live Card */}
      <button
        onClick={() => onFilterClick?.('live')}
        className="text-left transition-all hover:scale-105"
      >
        <Card className="p-5 bg-yellow-50 border-2 border-yellow-500 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-yellow-700">Live</div>
            <Activity className="w-5 h-5 text-yellow-600 animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-yellow-600">{liveRounds}</div>
          <div className="text-sm text-yellow-700 mt-1">
            ${livePotential.toFixed(2)} at stake
          </div>
        </Card>
      </button>
      
    </div>
  );
}

