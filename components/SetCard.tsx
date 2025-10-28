import { SetSide } from "@/types";
import { ConnectionCard } from "./ConnectionCard";

interface SetCardProps {
  readonly setSide: SetSide;
  readonly label: string;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onConnectionClick?: (connectionId: string) => void;
  readonly showSalary?: boolean;
  readonly showPoints?: boolean;
  readonly showAvpaRace?: boolean;
}

export function SetCard({
  setSide,
  label,
  isSelected,
  onSelect,
  onConnectionClick,
  showSalary = true,
  showPoints = false,
  showAvpaRace = false,
}: SetCardProps) {
  const connectionCount = setSide.connections.length;
  const totalPoints = setSide.connections.reduce((sum, c) => sum + c.pointsSum, 0);
  const totalAvpaRace = setSide.salaryTotal > 0 
    ? (1000 * totalPoints) / setSide.salaryTotal 
    : 0;
  
  return (
    <div
      role="button"
      tabIndex={0}
      className={`
        rounded-xl border-2 p-4 cursor-pointer transition-all
        ${isSelected 
          ? "border-blue-500 bg-blue-50 shadow-md" 
          : "border-gray-200 bg-white hover:border-gray-300"
        }
      `}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-lg text-gray-900">{label}</div>
        {isSelected && (
          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
            Selected
          </div>
        )}
      </div>
      
      {/* Set Summary - Centered and Prominent */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4 text-center">
        {showSalary ? (
          <div className="text-2xl font-bold text-gray-900 mb-1">
            ${setSide.salaryTotal.toLocaleString()}
          </div>
        ) : null}
        <div className="text-sm text-gray-600">
          {connectionCount} connection{connectionCount === 1 ? "" : "s"}
        </div>
        {showPoints && (
          <div className="mt-2 text-lg font-semibold text-blue-600">
            {totalPoints.toFixed(1)} pts
          </div>
        )}
        {showAvpaRace && (
          <div className="mt-1 text-sm font-medium text-gray-700">
            AVPA (Race): {totalAvpaRace.toFixed(1)}
          </div>
        )}
      </div>
      
      {/* Connection Cards */}
      <div className="space-y-2">
        {setSide.connections.map((conn) => (
          <ConnectionCard 
            key={conn.id} 
            connection={conn}
            onClick={onConnectionClick ? () => onConnectionClick(conn.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
