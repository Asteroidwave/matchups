import { Connection } from "@/types";

interface ConnectionCardProps {
  readonly connection: Connection;
  readonly compact?: boolean;
  readonly onClick?: () => void;
  readonly onNameClick?: () => void;
  readonly isHighlighted?: boolean;
  readonly showSalary?: boolean;
}

const trackColors: Record<string, { bg: string; text: string }> = {
  BAQ: { bg: "bg-blue-500", text: "text-blue-500" },
  GP: { bg: "bg-green-500", text: "text-green-500" },
  KEE: { bg: "bg-purple-500", text: "text-purple-500" },
  SA: { bg: "bg-red-500", text: "text-red-500" },
};

export function ConnectionCard({ connection, compact = false, onClick, onNameClick, isHighlighted = false, showSalary = true }: ConnectionCardProps) {
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
      className={`w-full text-left rounded-lg border-2 p-4 ${
        isHighlighted
          ? "bg-[var(--blue-50)] border-[var(--brand)] shadow-md"
          : "bg-[var(--surface-1)] border-[var(--content-15)] hover:border-[var(--content-9)]"
      } ${onClick ? "cursor-pointer transition-all" : ""}`}
      onClick={onClick}
    >
      {/* Name and Salary Row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div 
              className={`font-bold ${compact ? "text-base" : "text-lg"} text-[var(--text-primary)] truncate ${
                onNameClick ? "hover:text-[var(--btn-link)] cursor-pointer" : ""
              }`}
              onClick={(e) => {
                if (onNameClick) {
                  e.stopPropagation();
                  onNameClick();
                }
              }}
              title={connection.name}
            >
              {connection.name}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${roleColor}`}>
                {connection.role.toUpperCase()}
              </span>
              {connection.trackSet.map((track) => {
                const trackColorForTrack = trackColors[track] || { bg: "bg-gray-500", text: "text-gray-500" };
                return (
                  <span key={track} className={`px-1 py-0.5 rounded text-[8px] font-bold text-white ${trackColorForTrack.bg}`}>
                    {track}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        {showSalary && (
          <div className="text-right ml-4">
            <div className="text-lg font-bold text-[var(--text-primary)]">
              ${connection.salarySum.toLocaleString()}
            </div>
          </div>
        )}
      </div>
      
      {/* Divider */}
      <div className="border-t border-[var(--content-15)] my-2"></div>
      
      {/* Stats - Left Aligned */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-left">
          <div className="text-xs text-[var(--text-primary)]/60 mb-1">Apps</div>
          <div className={`font-bold text-[var(--text-primary)] ${compact ? "text-sm" : "text-base"}`}>
            {connection.apps}
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-[var(--text-primary)]/60 mb-1">Avg Odds</div>
          <div className={`font-bold text-[var(--text-primary)] ${compact ? "text-sm" : "text-base"}`}>
            {connection.avgOdds > 0 ? connection.avgOdds.toFixed(1) : "—"}
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-[var(--text-primary)]/60 mb-1">AVPA (30D)</div>
          <div className={`font-bold text-[var(--text-primary)] ${compact ? "text-sm" : "text-base"}`}>
            {connection.avpa30d > 0 ? connection.avpa30d.toFixed(1) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

