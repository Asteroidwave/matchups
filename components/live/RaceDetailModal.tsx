"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { X, Trophy, TrendingUp, TrendingDown } from 'lucide-react';

interface RaceHorse {
  horseName: string;
  programNumber?: number;
  position?: number;
  points?: number;
  odds?: string;
  jockey?: string;
  trainer?: string;
  sire1?: string;
  connection?: string; // The connection in your matchup
  isYourPick?: boolean; // Is this horse from your chosen set?
}

interface RaceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: string;
  raceNumber: number;
  postTime?: string;
  yourHorses: RaceHorse[]; // Horses from your matchup
  allResults?: RaceHorse[]; // Full race field (optional)
}

export function RaceDetailModal({
  isOpen,
  onClose,
  track,
  raceNumber,
  postTime,
  yourHorses,
  allResults = [],
}: RaceDetailModalProps) {
  const [selectedTab, setSelectedTab] = useState<'your-horses' | 'full-results'>('your-horses');
  
  // Sort horses by position
  const sortedYourHorses = [...yourHorses].sort((a, b) => (a.position || 999) - (b.position || 999));
  const sortedAllResults = [...allResults].sort((a, b) => (a.position || 999) - (b.position || 999));
  
  const getPositionBadge = (position?: number) => {
    if (!position) return null;
    
    let colorClass = '';
    if (position === 1) colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-400';
    else if (position === 2) colorClass = 'bg-gray-200 text-gray-800 border-gray-400';
    else if (position === 3) colorClass = 'bg-orange-100 text-orange-800 border-orange-400';
    else colorClass = 'bg-gray-100 text-gray-600 border-gray-300';
    
    const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
    
    return (
      <Badge className={`${colorClass} border text-sm font-bold`}>
        {position}{suffix}
        {position === 1 && ' 🏆'}
      </Badge>
    );
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {track} Race {raceNumber}
              </DialogTitle>
              {postTime && (
                <div className="text-sm text-gray-600 mt-1">Post Time: {postTime}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="your-horses">
                Your Matchup ({yourHorses.length})
              </TabsTrigger>
              <TabsTrigger value="full-results">
                Full Results ({allResults.length || 'N/A'})
              </TabsTrigger>
            </TabsList>
            
            {/* Your Horses Tab */}
            <TabsContent value="your-horses" className="space-y-3 mt-4">
              {sortedYourHorses.map((horse, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    horse.isYourPick
                      ? 'bg-blue-50 border-blue-500 shadow-md'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Program Number Badge */}
                      <div className="w-8 h-8 bg-gray-900 text-white rounded flex items-center justify-center font-bold">
                        {horse.programNumber || '?'}
                      </div>
                      
                      {/* Horse Name */}
                      <div>
                        <div className="text-lg font-bold">{horse.horseName}</div>
                        {horse.connection && (
                          <div className="text-sm text-gray-600">
                            {horse.connection} {horse.isYourPick && '(Your Pick)'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Position & Points */}
                    <div className="flex items-center gap-4">
                      {getPositionBadge(horse.position)}
                      {horse.points !== undefined && horse.points > 0 && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            +{horse.points}
                          </div>
                          <div className="text-xs text-gray-600">Points</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Additional Info */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">M/L Odds</div>
                      <div className="font-semibold">{horse.odds || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Jockey</div>
                      <div className="font-semibold">{horse.jockey || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Trainer</div>
                      <div className="font-semibold">{horse.trainer || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ))}
              
              {yourHorses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No horses in this matchup ran in this race.
                </div>
              )}
            </TabsContent>
            
            {/* Full Results Tab */}
            <TabsContent value="full-results" className="space-y-2 mt-4">
              {allResults.length > 0 ? (
                <div className="space-y-2">
                  {sortedAllResults.map((horse, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        horse.isYourPick
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Program Number */}
                        <div className="w-7 h-7 bg-gray-900 text-white rounded flex items-center justify-center font-bold text-sm">
                          {horse.programNumber || '?'}
                        </div>
                        
                        {/* Position Badge */}
                        {getPositionBadge(horse.position)}
                        
                        {/* Horse Name */}
                        <div className="font-semibold">{horse.horseName}</div>
                        
                        {/* Odds */}
                        <div className="text-sm text-gray-600">{horse.odds}</div>
                      </div>
                      
                      {/* Points */}
                      {horse.points !== undefined && horse.points > 0 && (
                        <div className="text-lg font-bold text-green-600">
                          +{horse.points} pts
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Full race results not available.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

