import { SetSide } from "@/types";
import { ConnectionCard } from "./ConnectionCard";
import { SetStats } from "./SetStats";

interface SetCardProps {
  readonly setSide: SetSide;
  readonly label?: string;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onConnectionClick?: (connectionId: string) => void;
  readonly onConnectionNameClick?: (connectionId: string) => void;
  readonly showSalary?: boolean;
  readonly showPoints?: boolean;
  readonly showAvpaRace?: boolean;
  readonly highlightedConnectionId?: string;
}

export function SetCard({
  setSide,
  label,
  isSelected,
  onSelect,
  onConnectionClick,
  onConnectionNameClick,
  showSalary = true,
  showPoints = false,
  showAvpaRace = false,
  highlightedConnectionId,
}: SetCardProps) {
  const connectionCount = setSide.connections.length;
  const totalPoints = setSide.connections.reduce((sum, c) => sum + c.pointsSum, 0);
  const totalAvpaRace = setSide.salaryTotal > 0 
    ? (1000 * totalPoints) / setSide.salaryTotal 
    : 0;
  
  const isSingleConnection = connectionCount === 1;
  
  return (
    <div
      className={`
        rounded-xl border-2 p-4 transition-all
        ${isSelected 
          ? "border-[var(--brand)] bg-[var(--blue-50)] shadow-md" 
          : "border-[var(--content-15)] bg-[var(--surface-1)] hover:border-[var(--content-9)]"
        }
      `}
    >
      {/* Top Row: Salary and Select Button */}
      <div 
        role="button"
        tabIndex={0}
        className="bg-[var(--blue-50)] rounded-lg p-3 mb-4 flex items-center justify-between border border-[var(--content-16)] cursor-pointer hover:bg-[var(--blue-50)]/80 transition-colors"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {showSalary ? (
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            ${setSide.salaryTotal.toLocaleString()}
          </div>
        ) : (
          <div />
        )}
        <button
          type="button"
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
            isSelected 
              ? "bg-[var(--brand)] text-white" 
              : "bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--content-15)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? "Selected" : "Select"}
        </button>
      </div>
      
      {/* Connection Cards */}
      <div className="space-y-2">
        {setSide.connections.map((conn) => (
          <ConnectionCard 
            key={conn.id} 
            connection={conn}
            onClick={onConnectionClick ? () => onConnectionClick(conn.id) : undefined}
            onNameClick={onConnectionNameClick ? () => onConnectionNameClick(conn.id) : undefined}
            isHighlighted={conn.id === highlightedConnectionId}
            showSalary={!isSingleConnection}
            compact={false}
          />
        ))}
      </div>
      
      {/* Set Stats (if 2+ connections) */}
      <SetStats setSide={setSide} />
    </div>
  );
}
