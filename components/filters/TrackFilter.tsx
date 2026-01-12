"use client";

import React from 'react';
import { TRACK_NAMES, TRACK_COLORS, getAvailableTracks } from '@/lib/data-loader';
import { Check, X } from 'lucide-react';

interface TrackFilterProps {
  selectedTracks: string[];
  onTrackChange: (tracks: string[]) => void;
  maxTracks?: number;
  availableTracks?: string[];
}

export function TrackFilter({
  selectedTracks,
  onTrackChange,
  maxTracks = 3,
  availableTracks,
}: TrackFilterProps) {
  const tracks = availableTracks || getAvailableTracks();

  const handleTrackClick = (track: string) => {
    if (selectedTracks.includes(track)) {
      // Remove track
      onTrackChange(selectedTracks.filter(t => t !== track));
    } else if (selectedTracks.length < maxTracks) {
      // Add track
      onTrackChange([...selectedTracks, track]);
    }
  };

  const clearAll = () => {
    onTrackChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--text-primary)]">
          Select Tracks (up to {maxTracks})
        </label>
        {selectedTracks.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-[var(--btn-link)] hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tracks.map((track) => {
          const isSelected = selectedTracks.includes(track);
          const colors = TRACK_COLORS[track] || { primary: '#6B7280', light: '#F3F4F6' };
          const isDisabled = !isSelected && selectedTracks.length >= maxTracks;

          return (
            <button
              key={track}
              onClick={() => handleTrackClick(track)}
              disabled={isDisabled}
              className={`
                relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                ${isSelected 
                  ? 'text-white shadow-md transform scale-105' 
                  : isDisabled
                    ? 'bg-[var(--surface-3)] text-[var(--content-9)] cursor-not-allowed opacity-50'
                    : 'bg-[var(--surface-2)] text-[var(--text-primary)] hover:shadow-sm border border-[var(--content-15)]'
                }
              `}
              style={isSelected ? { backgroundColor: colors.primary } : undefined}
            >
              <span className="flex items-center gap-2">
                {isSelected && <Check className="w-4 h-4" />}
                <span>{track}</span>
              </span>
              
              {/* Tooltip with full name */}
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 
                             bg-[var(--btn-default)] text-white text-xs px-2 py-1 rounded 
                             opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap
                             pointer-events-none z-10">
                {TRACK_NAMES[track] || track}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected tracks summary */}
      {selectedTracks.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>Selected:</span>
          {selectedTracks.map((track, i) => (
            <span key={track} className="flex items-center">
              <span 
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: TRACK_COLORS[track]?.primary || '#6B7280' }}
              />
              <span>{TRACK_NAMES[track] || track}</span>
              {i < selectedTracks.length - 1 && <span className="mx-1">,</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
