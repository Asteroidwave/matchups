"use client";

import { Connection } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Trophy } from "lucide-react";

interface CompareModalProps {
  connection1: Connection | null;
  connection2: Connection | null;
  connection3?: Connection | null;  // Optional third connection for 3-way
  isOpen: boolean;
  onClose: () => void;
}

// Helper to render a connection card
function ConnectionCompareCard({ 
  connection, 
  isWinner, 
  rank 
}: { 
  connection: Connection; 
  isWinner: boolean; 
  rank?: number;
}) {
  const roleColor = {
    jockey: "bg-[var(--jockey)] text-white",
    trainer: "bg-[var(--trainer)] text-white",
    sire: "bg-[var(--sire)] text-white",
  }[connection.role];
  
  return (
    <div className={`border-2 rounded-xl p-4 transition-all ${
      isWinner 
        ? "border-[var(--success)] bg-[var(--success)]/5 shadow-lg" 
        : "border-[var(--border)] bg-[var(--surface-1)]"
    }`}>
      {/* Header with name and winner badge */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-bold text-[var(--text-primary)] truncate pr-2">
            {connection.name}
          </h3>
          {isWinner && (
            <div className="flex items-center gap-1 px-2 py-1 bg-[var(--success)] text-white rounded-full text-xs font-bold flex-shrink-0">
              <Trophy className="w-3 h-3" />
              {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${roleColor}`}>
            {connection.role.toUpperCase()}
          </span>
          {connection.trackSet.map((track) => (
            <span key={track} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--track-bg)] text-[var(--track)] border border-[var(--track)]/50">
              {track}
            </span>
          ))}
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[var(--text-tertiary)] text-xs">Salary</div>
          <div className="font-bold text-[var(--text-primary)]">${connection.salarySum.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[var(--text-tertiary)] text-xs">Apps</div>
          <div className="font-bold text-[var(--text-primary)]">{connection.apps}</div>
        </div>
        <div>
          <div className="text-[var(--text-tertiary)] text-xs">Avg Odds</div>
          <div className="font-bold text-[var(--text-primary)]">{connection.avgOdds.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[var(--text-tertiary)] text-xs">AVPA (90D)</div>
          <div className="font-bold text-[var(--text-primary)]">{connection.avpa30d.toFixed(2)}</div>
        </div>
        <div className="col-span-2 pt-2 border-t border-[var(--border)]">
          <div className="text-[var(--text-tertiary)] text-xs">Total Points</div>
          <div className="font-bold text-xl text-[var(--text-primary)]">{connection.pointsSum.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

export function CompareModal({ connection1, connection2, connection3, isOpen, onClose }: CompareModalProps) {
  if (!connection1 || !connection2) return null;
  
  const is3Way = !!connection3;
  
  // Calculate rankings
  const connections = [connection1, connection2, connection3].filter(Boolean) as Connection[];
  const sortedByPoints = [...connections].sort((a, b) => b.pointsSum - a.pointsSum);
  
  const getRank = (conn: Connection) => {
    const idx = sortedByPoints.findIndex(c => c.id === conn.id);
    return idx + 1;
  };
  
  const winner = sortedByPoints[0];
  const secondPlace = sortedByPoints[1];
  const thirdPlace = sortedByPoints[2];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${is3Way ? "max-w-5xl" : "max-w-4xl"} max-h-[90vh] overflow-y-auto p-0`}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--surface-1)] border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Compare Connections</h2>
              {is3Way && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-600 border border-purple-500/30 rounded text-xs font-semibold">
                  3-Way
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Connection Cards */}
        <div className="p-6">
          <div className={`grid gap-4 ${is3Way ? "grid-cols-3" : "grid-cols-2"}`}>
            <ConnectionCompareCard 
              connection={connection1} 
              isWinner={winner.id === connection1.id}
              rank={getRank(connection1)}
            />
            <ConnectionCompareCard 
              connection={connection2} 
              isWinner={winner.id === connection2.id}
              rank={getRank(connection2)}
            />
            {connection3 && (
              <ConnectionCompareCard 
                connection={connection3} 
                isWinner={winner.id === connection3.id}
                rank={getRank(connection3)}
              />
            )}
          </div>
          
          {/* Results Summary */}
          <div className="mt-6 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Results</div>
            <div className="space-y-2">
              {/* Winner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--success)] text-white flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <span className="font-medium text-[var(--text-primary)]">{winner.name}</span>
                </div>
                <span className="font-bold text-[var(--success)]">{winner.pointsSum.toFixed(1)} pts</span>
              </div>
              
              {/* Second Place */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--text-tertiary)] text-white flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <span className="font-medium text-[var(--text-secondary)]">{secondPlace.name}</span>
                </div>
                <span className="text-[var(--text-secondary)]">{secondPlace.pointsSum.toFixed(1)} pts</span>
              </div>
              
              {/* Third Place (if 3-way) */}
              {thirdPlace && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--text-muted)] text-white flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <span className="font-medium text-[var(--text-tertiary)]">{thirdPlace.name}</span>
                  </div>
                  <span className="text-[var(--text-tertiary)]">{thirdPlace.pointsSum.toFixed(1)} pts</span>
                </div>
              )}
              
              {/* Point Differences */}
              <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)]">
                <div>Margin: {(winner.pointsSum - secondPlace.pointsSum).toFixed(1)} pts over 2nd</div>
                {thirdPlace && (
                  <div>Spread: {(winner.pointsSum - thirdPlace.pointsSum).toFixed(1)} pts total</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
