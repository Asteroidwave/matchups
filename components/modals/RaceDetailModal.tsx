"use client";

import { Starter } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface RaceDetailModalProps {
  race: {
    track: string;
    race: number;
    starters: Starter[];
  };
  isOpen: boolean;
  onClose: () => void;
}

const trackColors: Record<string, { bg: string; border: string }> = {
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500" },
  GP: { bg: "bg-green-500/10", border: "border-green-500" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500" },
  SA: { bg: "bg-red-500/10", border: "border-red-500" },
};

export function RaceDetailModal({ race, isOpen, onClose }: RaceDetailModalProps) {
  if (!race) return null;
  
  const trackColor = trackColors[race.track] || { bg: "bg-gray-500/10", border: "border-gray-500" };
  
  // Sort starters by position
  const sortedStarters = [...race.starters].sort((a, b) => {
    const posA = a.pos || 999;
    const posB = b.pos || 999;
    return posA - posB;
  });
  
  const getPlaceColor = (place?: number) => {
    if (!place || place === 0) return "bg-gray-400 text-white";
    if (place === 1) return "bg-yellow-500 text-white";
    if (place === 2) return "bg-gray-400 text-white";
    if (place === 3) return "bg-orange-600 text-white";
    return "bg-gray-300 text-gray-700";
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {race.track} - Race {race.race}
            </h2>
            <div className="text-sm text-gray-600 mt-1">
              Complete Race Results
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className={`border-2 rounded-lg p-4 ${trackColor.border} ${trackColor.bg}`}>
          <div className="space-y-2">
            {sortedStarters.map((starter) => (
              <div
                key={`${starter.track}-${starter.race}-${starter.horseName}`}
                className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getPlaceColor(starter.pos)}`}>
                  {starter.pos || "—"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{starter.horseName}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                    {starter.jockey && <span>J: {starter.jockey}</span>}
                    {starter.trainer && <span>T: {starter.trainer}</span>}
                    {(starter.sire1 || starter.sire2) && <span>S: {starter.sire1 || starter.sire2}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {starter.mlOddsFrac || "N/A"}
                  </div>
                  {starter.points !== undefined && starter.points > 0 && (
                    <div className="text-xs text-gray-600">
                      {starter.points.toFixed(1)} pts
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Click on any connection name to view detailed information
        </div>
      </DialogContent>
    </Dialog>
  );
}

