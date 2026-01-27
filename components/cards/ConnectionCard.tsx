import { Connection } from "@/types";

interface HighlightColor {
  bg: string;
  light: string;
  border: string;
  text: string;
}

interface ConnectionCardProps {
  readonly connection: Connection;
  readonly compact?: boolean;
  readonly onClick?: () => void;
  readonly onNameClick?: () => void;
  readonly isHighlighted?: boolean;
  readonly highlightColor?: HighlightColor | null;
  readonly showSalary?: boolean;
}

// Track badge colors - each track has a unique color
const trackColors: Record<string, { bg: string; text: string; border: string }> = {
  AQU: { bg: "bg-sky-500/20", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500/50" },
  DMR: { bg: "bg-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/50" },
  GP: { bg: "bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/50" },
  SA: { bg: "bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/50" },
  KEE: { bg: "bg-purple-500/20", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/50" },
  LRL: { bg: "bg-pink-500/20", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/50" },
  MVR: { bg: "bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/50" },
  PEN: { bg: "bg-violet-500/20", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/50" },
  PRX: { bg: "bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/50" },
  BAQ: { bg: "bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/50" },
};

const getTrackBadgeStyle = (track: string) => {
  const colors = trackColors[track] || { bg: "bg-gray-500/20", text: "text-gray-600 dark:text-gray-400", border: "border-gray-500/50" };
  return `${colors.bg} ${colors.text} border ${colors.border}`;
};

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

export function ConnectionCard({ connection, compact = false, onClick, onNameClick, isHighlighted = false, highlightColor, showSalary = true }: ConnectionCardProps) {
  const roleColor = roleColors[connection.role];
  
  // Determine highlight styling based on multi-select color or default
  const getHighlightStyles = () => {
    if (highlightColor) {
      // Multi-select highlight with specific color
      return `${highlightColor.light} border-2 ${highlightColor.border} shadow-md`;
    }
    if (isHighlighted) {
      // Default single highlight
      return "bg-[var(--blue-50)] border-[var(--brand)] shadow-md";
    }
    return "bg-[var(--surface-1)] border-[var(--content-15)] hover:border-[var(--content-9)]";
  };
  
  return (
    <div 
      className={`w-full text-left rounded-lg border-2 p-2 sm:p-4 ${getHighlightStyles()} ${onClick ? "cursor-pointer transition-all" : ""}`}
      onClick={onClick}
    >
      {/* Name and Salary Row */}
      <div className="flex items-start justify-between mb-1 sm:mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1 sm:gap-3">
            <div 
              className={`font-bold ${compact ? "text-sm sm:text-base" : "text-base sm:text-lg"} truncate ${
                highlightColor ? highlightColor.text : "text-[var(--text-primary)]"
              } ${
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
            <div className="flex items-center gap-1 flex-wrap">
              {/* Role badge (J/T/S) - solid colored */}
              <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-semibold text-white ${roleColor.badge}`}>
                {connection.role.toUpperCase()}
              </span>
              {/* Track badges - each track has unique color */}
              {connection.trackSet.map((track) => (
                <span key={track} className={`px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold ${getTrackBadgeStyle(track)}`}>
                    {track}
                  </span>
              ))}
            </div>
          </div>
        </div>
        {showSalary && (
          <div className="text-right ml-2 sm:ml-4">
            <div className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              ${connection.salarySum.toLocaleString()}
            </div>
          </div>
        )}
      </div>
      
      {/* Divider */}
      <div className="border-t border-[var(--content-15)] my-1 sm:my-2"></div>
      
      {/* Stats - Left Aligned */}
      <div className="grid grid-cols-3 gap-1 sm:gap-3">
        <div className="text-left">
          <div className="text-[10px] sm:text-xs text-[var(--text-primary)]/60 mb-0.5 sm:mb-1">Apps</div>
          <div className={`font-bold text-[var(--text-primary)] ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}>
            {connection.apps}
          </div>
        </div>
        <div className="text-left">
          <div className="text-[10px] sm:text-xs text-[var(--text-primary)]/60 mb-0.5 sm:mb-1">Avg Odds</div>
          <div className={`font-bold text-[var(--text-primary)] ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}>
            {connection.avgOdds > 0 ? connection.avgOdds.toFixed(1) : "—"}
          </div>
        </div>
        <div className="text-left">
          <div className="text-[10px] sm:text-xs text-[var(--text-primary)]/60 mb-0.5 sm:mb-1">FP1K</div>
          <div className={`font-bold text-[var(--text-primary)] ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}>
            {connection.avpa30d > 0 ? connection.avpa30d.toFixed(1) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

