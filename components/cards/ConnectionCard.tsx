import { Connection } from "@/types";

interface ConnectionCardProps {
  readonly connection: Connection;
  readonly compact?: boolean;
  readonly onClick?: () => void;
  readonly onNameClick?: () => void;
  readonly isHighlighted?: boolean;
  readonly showSalary?: boolean;
}

// Track badges use distinct purple styling to differentiate from connection role badges
const trackBadgeStyle = "bg-[var(--track-bg)] text-[var(--track)] border border-[var(--track)]/50";

// Role colors - Beat the House style for better dark mode support
const roleColors = {
  jockey: {
    bg: "bg-[var(--jockey)]/20",
    text: "text-[var(--jockey)]",
    badge: "bg-[var(--jockey)]"
  },
  trainer: {
    bg: "bg-[var(--trainer)]/20",
    text: "text-[var(--trainer)]",
    badge: "bg-[var(--trainer)]"
  },
  sire: {
    bg: "bg-[var(--sire)]/20",
    text: "text-[var(--sire)]",
    badge: "bg-[var(--sire)]"
  },
};

export function ConnectionCard({ connection, compact = false, onClick, onNameClick, isHighlighted = false, showSalary = true }: ConnectionCardProps) {
  const roleColor = roleColors[connection.role];
  
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
              {/* Role badge (J/T/S) - solid colored */}
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold text-white ${roleColor.badge}`}>
                {connection.role.toUpperCase()}
              </span>
              {/* Track badges - distinct purple style */}
              {connection.trackSet.map((track) => (
                <span key={track} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${trackBadgeStyle}`}>
                  {track}
                </span>
              ))}
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

