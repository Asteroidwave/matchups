import { Matchup } from "@/types";
import { SetCard } from "./SetCard";
import { GitCompare } from "lucide-react";

interface HighlightColor {
  bg: string;
  light: string;
  border: string;
  text: string;
}

interface MatchupCardProps {
  readonly matchup: Matchup;
  readonly selected?: "A" | "B" | "C";
  readonly onSelect: (side: "A" | "B" | "C") => void;
  readonly onConnectionClick?: (connectionId: string) => void;
  readonly onConnectionNameClick?: (connectionId: string) => void;
  readonly showPoints?: boolean;
  readonly showAvpaRace?: boolean;
  readonly highlightedConnectionId?: string;
  readonly matchupNumber?: number;
  readonly onCompareClick?: () => void;
  readonly getPlayerHighlightColor?: (connectionId: string) => HighlightColor | null;
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
  getPlayerHighlightColor,
}: MatchupCardProps) {
  const is3Way = !!matchup.setC && matchup.setC.connections.length > 0;
  const typeLabel = is3Way 
    ? `${matchup.setA.connections.length}v${matchup.setB.connections.length}v${matchup.setC!.connections.length}`
    : `${matchup.setA.connections.length}v${matchup.setB.connections.length}`;
  
  return (
    <div className="w-full">
      {/* Grey band header */}
      <div className="bg-[var(--content-15)] text-[var(--text-primary)] text-[10px] sm:text-[12px] leading-[18px] font-medium px-2 sm:px-4 py-1 flex items-center justify-between">
        <span className="flex items-center gap-1 sm:gap-2">
          <span className="hidden sm:inline">Matchup</span>
          <span className="sm:hidden">#</span>
          {matchupNumber !== undefined ? matchupNumber : ''}
          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-semibold border ${
            is3Way 
              ? 'bg-purple-500/20 text-purple-600 border-purple-500/30' 
              : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--content-15)]'
          }`}>
            {typeLabel}
          </span>
        </span>
        {onCompareClick && (
          <button
            onClick={onCompareClick}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
            aria-label="Compare matchups"
          >
            <GitCompare className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
      {/* Matchup content - responsive grid */}
      <div className="bg-[var(--surface-1)] border-b border-[var(--content-15)]">
        <div className={`grid gap-2 sm:gap-4 p-2 sm:p-4 ${
          is3Way 
            ? 'grid-cols-1 sm:grid-cols-3' 
            : 'grid-cols-1 sm:grid-cols-2'
        }`}>
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
            getPlayerHighlightColor={getPlayerHighlightColor}
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
            getPlayerHighlightColor={getPlayerHighlightColor}
          />
          {is3Way && matchup.setC && (
            <SetCard
              setSide={matchup.setC}
              label={undefined}
              isSelected={selected === "C"}
              onSelect={() => onSelect("C")}
              onConnectionClick={onConnectionClick}
              onConnectionNameClick={onConnectionNameClick}
              showSalary={true}
              showPoints={showPoints}
              showAvpaRace={showAvpaRace}
              highlightedConnectionId={highlightedConnectionId}
              getPlayerHighlightColor={getPlayerHighlightColor}
          />
          )}
        </div>
      </div>
    </div>
  );
}

