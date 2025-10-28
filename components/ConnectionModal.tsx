"use client";

import { Connection, Starter } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface ConnectionModalProps {
  connection: Connection | null;
  isOpen: boolean;
  onClose: () => void;
}

const trackColors: Record<string, { bg: string; border: string }> = {
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500" },
  GP: { bg: "bg-green-500/10", border: "border-green-500" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500" },
  SA: { bg: "bg-red-500/10", border: "border-red-500" },
};

export function ConnectionModal({ connection, isOpen, onClose }: ConnectionModalProps) {
  if (!connection) return null;
  
  // Group starters by race
  const racesMap = new Map<string, Starter[]>();
  
  for (const starter of connection.starters) {
    if (starter.scratched) continue;
    
    const key = `${starter.track}-${starter.race}`;
    if (!racesMap.has(key)) {
      racesMap.set(key, []);
    }
    racesMap.get(key)!.push(starter);
  }
  
  const races = Array.from(racesMap.entries()).sort(([a], [b]) => {
    const [trackA, raceA] = a.split("-");
    const [trackB, raceB] = b.split("-");
    const trackOrder = ["BAQ", "GP", "KEE", "SA"];
    const trackDiff = trackOrder.indexOf(trackA) - trackOrder.indexOf(trackB);
    return trackDiff !== 0 ? trackDiff : parseInt(raceA) - parseInt(raceB);
  });
  
  const roleColor = {
    jockey: "bg-blue-600",
    trainer: "bg-green-600",
    sire: "bg-amber-600",
  }[connection.role];
  
  const primaryTrack = connection.trackSet[0] || "";
  const trackColor = trackColors[primaryTrack] || { bg: "bg-gray-500/10", border: "border-gray-500" };
  
  const getPlaceColor = (place?: number) => {
    if (!place) return "";
    if (place === 1) return "bg-green-500 text-white";
    if (place === 2) return "bg-blue-500 text-white";
    if (place === 3) return "bg-red-500 text-white";
    return "bg-gray-500 text-white";
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className={`${roleColor} text-white p-6 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {connection.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{connection.name}</h2>
              <div className="text-white/90">{connection.role.toUpperCase()}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-white/80">Avg Odds</div>
              <div className="text-xl font-bold">{connection.avgOdds.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-white/80">Appearances</div>
              <div className="text-xl font-bold">{connection.apps}</div>
            </div>
            <div>
              <div className="text-white/80">AVPA</div>
              <div className="text-xl font-bold">{connection.avpa30d.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-white/80">Salary</div>
              <div className="text-xl font-bold">${connection.salarySum.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Connected Horses</h3>
          
          <div className="space-y-4">
            {races.map(([key, starters]) => {
              const [track, raceNum] = key.split("-");
              const trackColor = trackColors[track] || { bg: "bg-gray-500/10", border: "border-gray-500" };
              
              return (
                <div
                  key={key}
                  className={`border-2 rounded-lg p-4 ${trackColor.border} ${trackColor.bg}`}
                >
                  <div className="font-semibold text-sm text-gray-600 mb-3">
                    {track} - Race {raceNum}
                  </div>
                  
                  <div className="space-y-2">
                    {starters.map((starter, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${getPlaceColor(starter.pos)}`}
                          >
                            {starter.pos || "—"}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{starter.horseName}</div>
                            <div className="text-xs text-gray-500">
                              {starter.mlOddsFrac || "N/A"} • Points: {starter.points?.toFixed(1) || "0"}
                            </div>
                          </div>
                        </div>
                        
                        {/* Connections */}
                        <div className="flex items-center gap-2">
                          {starter.jockey && (
                            <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              J: {starter.jockey}
                            </div>
                          )}
                          {starter.trainer && (
                            <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              T: {starter.trainer}
                            </div>
                          )}
                          {(starter.sire1 || starter.sire2) && (
                            <div className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                              S: {starter.sire1 || starter.sire2}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
