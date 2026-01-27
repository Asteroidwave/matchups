import { SetSide } from "@/types";

interface SetStatsProps {
  setSide: SetSide;
}

export function SetStats({ setSide }: SetStatsProps) {
  if (setSide.connections.length < 2) return null;
  
  // Sum of apps
  const totalApps = setSide.connections.reduce((sum, c) => sum + c.apps, 0);
  
  // Average of avgOdds (weighted by apps)
  const totalOdds = setSide.connections.reduce((sum, c) => sum + (c.avgOdds * c.apps), 0);
  const avgOdds = totalApps > 0 ? totalOdds / totalApps : 0;
  
  // Average of FP1K 30D (weighted by apps)
  const totalAvpa = setSide.connections.reduce((sum, c) => sum + (c.avpa30d * c.apps), 0);
  const avgAvpa30d = totalApps > 0 ? totalAvpa / totalApps : 0;
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="text-xs font-semibold text-gray-600 mb-2">Set Totals (2+ connections)</div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-500">Apps</div>
          <div className="font-bold text-gray-900">{totalApps}</div>
        </div>
        <div>
          <div className="text-gray-500">Avg Odds</div>
          <div className="font-bold text-gray-900">
            {avgOdds > 0 ? avgOdds.toFixed(1) : "—"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">FP1K (30D)</div>
          <div className="font-bold text-gray-900">
            {avgAvpa30d > 0 ? avgAvpa30d.toFixed(1) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

