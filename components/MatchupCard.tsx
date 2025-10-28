import { Matchup } from "@/types";
import { SetCard } from "./SetCard";

interface MatchupCardProps {
  readonly matchup: Matchup;
  readonly selected?: "A" | "B";
  readonly onSelect: (side: "A" | "B") => void;
  readonly onConnectionClick?: (connectionId: string) => void;
  readonly showPoints?: boolean;
  readonly showAvpaRace?: boolean;
}

export function MatchupCard({
  matchup,
  selected,
  onSelect,
  onConnectionClick,
  showPoints = false,
  showAvpaRace = false,
}: MatchupCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
      <div className="grid grid-cols-2 gap-6">
        <SetCard
          setSide={matchup.setA}
          label="Set A"
          isSelected={selected === "A"}
          onSelect={() => onSelect("A")}
          onConnectionClick={onConnectionClick}
          showSalary={true}
          showPoints={showPoints}
          showAvpaRace={showAvpaRace}
        />
        <SetCard
          setSide={matchup.setB}
          label="Set B"
          isSelected={selected === "B"}
          onSelect={() => onSelect("B")}
          onConnectionClick={onConnectionClick}
          showSalary={true}
          showPoints={showPoints}
          showAvpaRace={showAvpaRace}
        />
      </div>
    </div>
  );
}

