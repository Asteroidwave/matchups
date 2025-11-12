"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

interface TrackSelectorProps {
  selectedTrack: string;
  onTrackSelect: (track: string) => void;
  availableTracks: string[];
  isLoading?: boolean;
}

export const TRACK_LABELS: Record<string, string> = {
  BAQ: "Belmont",
  GP: "Gulfstream Park",
  KEE: "Keeneland",
  SA: "Santa Anita",
  CD: "Churchill Downs",
  DMR: "Del Mar",
  LRL: "Laurel Park",
  MNR: "Mountaineer Park",
  IND: "Horseshoe Indianapolis",
  MIXED: "Mixed Tracks",
};

export const TRACK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BAQ: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-700" },
  GP: { bg: "bg-green-500/10", border: "border-green-500", text: "text-green-700" },
  KEE: { bg: "bg-purple-500/10", border: "border-purple-500", text: "text-purple-700" },
  SA: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-700" },
  CD: { bg: "bg-yellow-500/10", border: "border-yellow-500", text: "text-yellow-700" },
  DMR: { bg: "bg-indigo-500/10", border: "border-indigo-500", text: "text-indigo-700" },
  LRL: { bg: "bg-pink-500/10", border: "border-pink-500", text: "text-pink-700" },
  MNR: { bg: "bg-orange-500/10", border: "border-orange-500", text: "text-orange-700" },
  IND: { bg: "bg-sky-500/10", border: "border-sky-500", text: "text-sky-700" },
  MIXED: { bg: "bg-slate-500/10", border: "border-slate-500", text: "text-slate-700" },
};

export function TrackSelector({
  selectedTrack,
  onTrackSelect,
  availableTracks,
  isLoading = false,
}: TrackSelectorProps) {
  // Filter and sort tracks
  const tracks = useMemo(() => {
    const sorted = [...availableTracks].sort();
    // Move "MIXED" to the end if it exists
    const mixed = sorted.find((t) => t === "MIXED");
    const others = sorted.filter((t) => t !== "MIXED");
    return mixed ? [...others, mixed] : others;
  }, [availableTracks]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10">
        <div className="text-sm text-[var(--text-tertiary)]">Loading tracks...</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center gap-2 h-10">
        <div className="text-sm text-[var(--text-tertiary)]">No tracks available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tracks.map((track) => {
        const isSelected = selectedTrack === track;
        const color = TRACK_COLORS[track];
        const label = TRACK_LABELS[track] || track;

        return (
          <button
            key={track}
            onClick={() => onTrackSelect(track)}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap ${
              isSelected
                ? `${color.bg} ${color.text} border-2 ${color.border}`
                : "bg-[var(--blue-50)] text-[var(--brand)] border-2 border-transparent hover:opacity-80"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            title={label}
          >
            {track}
          </button>
        );
      })}
    </div>
  );
}

