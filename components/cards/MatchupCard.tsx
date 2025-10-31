import { Matchup } from "@/types";
import { SetCard } from "./SetCard";
import { GitCompare } from "lucide-react";

interface MatchupCardProps {
  readonly matchup: Matchup;
  readonly selected?: "A" | "B";
  readonly onSelect: (side: "A" | "B") => void;
  readonly onConnectionClick?: (connectionId: string) => void;
  readonly onConnectionNameClick?: (connectionId: string) => void;
  readonly showPoints?: boolean;
  readonly showAvpaRace?: boolean;
  readonly highlightedConnectionId?: string;
  readonly matchupNumber?: number;
  readonly onCompareClick?: () => void;
}

export function MatchupCard({
  matchup,
  selected,
  onSelect,
  onConnectionClick,
  onConnectionNameClick,
  showPoints = false,
  showAvpaRace = false,
  highlightedConnectionId,
  matchupNumber,
  onCompareClick,
}: MatchupCardProps) {
  return (
    <div className="w-full">
      {/* Grey band header */}
      <div className="bg-[var(--content-15)] text-[var(--text-primary)] text-[12px] leading-[18px] font-medium px-4 py-1 flex items-center justify-between">
        <span>Matchup {matchupNumber !== undefined ? matchupNumber : ''}</span>
        {onCompareClick && (
          <button
            onClick={onCompareClick}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Compare matchups"
          >
            <GitCompare className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Matchup content - full width */}
      <div className="bg-[var(--surface-1)] border-b border-[var(--content-15)]">
        <div className="grid grid-cols-2 gap-4 p-4">
          <SetCard
            setSide={matchup.setA}
            label={undefined}
            isSelected={selected === "A"}
            onSelect={() => onSelect("A")}
            onConnectionClick={onConnectionClick}
            onConnectionNameClick={onConnectionNameClick}
            showSalary={true}
            showPoints={showPoints}
            showAvpaRace={showAvpaRace}
            highlightedConnectionId={highlightedConnectionId}
          />
          <SetCard
            setSide={matchup.setB}
            label={undefined}
            isSelected={selected === "B"}
            onSelect={() => onSelect("B")}
            onConnectionClick={onConnectionClick}
            onConnectionNameClick={onConnectionNameClick}
            showSalary={true}
            showPoints={showPoints}
            showAvpaRace={showAvpaRace}
            highlightedConnectionId={highlightedConnectionId}
          />
        </div>
      </div>
    </div>
  );
}

