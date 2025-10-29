import { Connection } from "@/types";

interface ConnectionCardProps {
  connection: Connection;
  compact?: boolean;
  onClick?: () => void;
}

const trackColors: Record<string, { bg: string; text: string }> = {
  BAQ: { bg: "bg-blue-500", text: "text-blue-500" },
  GP: { bg: "bg-green-500", text: "text-green-500" },
  KEE: { bg: "bg-purple-500", text: "text-purple-500" },
  SA: { bg: "bg-red-500", text: "text-red-500" },
};

export function ConnectionCard({ connection, compact = false, onClick }: ConnectionCardProps) {
  const roleColor = {
    jockey: "bg-blue-100 text-blue-800",
    trainer: "bg-green-100 text-green-800",
    sire: "bg-amber-100 text-amber-800",
  }[connection.role];
  
  // Get primary track (first one)
  const primaryTrack = connection.trackSet[0] || "";
  const trackColor = trackColors[primaryTrack] || { bg: "bg-gray-500", text: "text-gray-500" };
  
  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 ${compact ? "" : ""} ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div 
            className={`font-bold ${compact ? "text-base" : "text-lg"} text-gray-900 mb-2 ${
              onClick ? "hover:text-blue-600" : ""
            }`}
          >
            {connection.name}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${roleColor}`}>
              {connection.role.toUpperCase()}
            </span>
            {primaryTrack && (
              <span className={`px-2 py-1 rounded-md text-xs font-bold text-white ${trackColor.bg}`}>
                {primaryTrack}
              </span>
            )}
            {connection.trackSet.length > 1 && (
              <span className="text-xs text-gray-500">
                +{connection.trackSet.length - 1} more
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Salary - Prominent */}
      <div className="mb-3 pb-3 border-b border-gray-200">
        <div className="text-xs text-gray-500 mb-1">Salary</div>
        <div className="text-lg font-bold text-gray-900">
          ${connection.salarySum.toLocaleString()}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Apps</div>
          <div className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base"}`}>
            {connection.apps}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Avg Odds</div>
          <div className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base"}`}>
            {connection.avgOdds > 0 ? connection.avgOdds.toFixed(1) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">AVPA (30D)</div>
          <div className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base"}`}>
            {connection.avpa30d > 0 ? connection.avpa30d.toFixed(1) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

