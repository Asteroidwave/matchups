"use client";

import { Connection } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface CompareModalProps {
  connection1: Connection | null;
  connection2: Connection | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CompareModal({ connection1, connection2, isOpen, onClose }: CompareModalProps) {
  if (!connection1 || !connection2) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Compare Connections</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Connection 1 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{connection1.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  (() => {
                    if (connection1.role === "jockey") return "bg-blue-100 text-blue-800";
                    if (connection1.role === "trainer") return "bg-green-100 text-green-800";
                    return "bg-amber-100 text-amber-800";
                  })()
                }`}>
                  {connection1.role.toUpperCase()}
                </span>
                <span className="text-xs text-gray-600">
                  {connection1.trackSet.join(", ")}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Salary</div>
                <div className="font-bold text-gray-900">${connection1.salarySum.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Apps</div>
                <div className="font-bold text-gray-900">{connection1.apps}</div>
              </div>
              <div>
                <div className="text-gray-500">Avg Odds</div>
                <div className="font-bold text-gray-900">{connection1.avgOdds.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">AVPA (30D)</div>
                <div className="font-bold text-gray-900">{connection1.avpa30d.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Points</div>
                <div className="font-bold text-gray-900">{connection1.pointsSum.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-gray-500">AVPA (Race)</div>
                <div className="font-bold text-gray-900">{connection1.avpaRace.toFixed(1)}</div>
              </div>
            </div>
          </div>
          
          {/* Connection 2 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{connection2.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  (() => {
                    if (connection2.role === "jockey") return "bg-blue-100 text-blue-800";
                    if (connection2.role === "trainer") return "bg-green-100 text-green-800";
                    return "bg-amber-100 text-amber-800";
                  })()
                }`}>
                  {connection2.role.toUpperCase()}
                </span>
                <span className="text-xs text-gray-600">
                  {connection2.trackSet.join(", ")}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Salary</div>
                <div className="font-bold text-gray-900">${connection2.salarySum.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Apps</div>
                <div className="font-bold text-gray-900">{connection2.apps}</div>
              </div>
              <div>
                <div className="text-gray-500">Avg Odds</div>
                <div className="font-bold text-gray-900">{connection2.avgOdds.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">AVPA (30D)</div>
                <div className="font-bold text-gray-900">{connection2.avpa30d.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Points</div>
                <div className="font-bold text-gray-900">{connection2.pointsSum.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-gray-500">AVPA (Race)</div>
                <div className="font-bold text-gray-900">{connection2.avpaRace.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Winner Highlight */}
        <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
          <div className="text-sm font-medium text-gray-900">
            Winner: {connection1.pointsSum > connection2.pointsSum ? connection1.name : connection2.name}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {Math.abs(connection1.pointsSum - connection2.pointsSum).toFixed(1)} point difference
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

