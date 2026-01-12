'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, X } from 'lucide-react';

interface TrackDatePickerProps {
  availableTracks: { code: string; name: string; dates: string[] }[];
  selectedTracks: string[];
  selectedDate: string;
  onTracksChange: (tracks: string[]) => void;
  onDateChange: (date: string) => void;
  isOpen: boolean;
  onClose: () => void;
  maxTracks?: number;
}

const TRACK_NAMES: Record<string, string> = {
  AQU: 'Aqueduct',
  SA: 'Santa Anita',
  GP: 'Gulfstream Park',
  DMR: 'Del Mar',
  PRX: 'Parx Racing',
  PEN: 'Penn National',
  LRL: 'Laurel Park',
  MVR: 'Mountaineer',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function TrackDatePicker({
  availableTracks,
  selectedTracks,
  selectedDate,
  onTracksChange,
  onDateChange,
  isOpen,
  onClose,
  maxTracks = 3,
}: TrackDatePickerProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Get available dates for selected tracks (intersection of dates)
  const availableDatesSet = useMemo(() => {
    if (selectedTracks.length === 0) return new Set<string>();
    
    const dateSets = selectedTracks.map(trackCode => {
      const track = availableTracks.find(t => t.code === trackCode);
      return new Set(track?.dates || []);
    });
    
    // Find intersection
    if (dateSets.length === 1) return dateSets[0];
    
    const intersection = new Set<string>();
    dateSets[0].forEach(date => {
      if (dateSets.every(set => set.has(date))) {
        intersection.add(date);
      }
    });
    
    return intersection;
  }, [selectedTracks, availableTracks]);
  
  // Get available months (only 2025)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    availableDatesSet.forEach(date => {
      const d = new Date(date);
      if (d.getFullYear() === 2025) {
        months.add(`2025-${d.getMonth()}`);
      }
    });
    return Array.from(months)
      .map(m => {
        const [year, month] = m.split('-').map(Number);
        return { year, month };
      })
      .sort((a, b) => a.month - b.month);
  }, [availableDatesSet]);
  
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  
  // Reset month index when tracks change
  useEffect(() => {
    if (availableMonths.length > 0 && selectedDate) {
      const date = new Date(selectedDate);
      const idx = availableMonths.findIndex(m => m.month === date.getMonth() && m.year === date.getFullYear());
      if (idx >= 0) {
        setCurrentMonthIndex(idx);
      } else {
        setCurrentMonthIndex(0);
      }
    } else {
      setCurrentMonthIndex(0);
    }
  }, [selectedTracks, availableMonths, selectedDate]);
  
  const currentMonth = availableMonths[currentMonthIndex] || { year: 2025, month: 0 };
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
    const startPadding = firstDay.getDay();
    
    const days: { date: Date; isCurrentMonth: boolean; hasRaces: boolean; isSelected: boolean }[] = [];
    
    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(currentMonth.year, currentMonth.month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        hasRaces: false,
        isSelected: false,
      });
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(currentMonth.year, currentMonth.month, day);
      const dateStr = date.toISOString().split('T')[0];
      const hasRaces = availableDatesSet.has(dateStr);
      const isSelected = dateStr === selectedDate;
      
      days.push({
        date,
        isCurrentMonth: true,
        hasRaces,
        isSelected,
      });
    }
    
    // Next month padding to fill grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(currentMonth.year, currentMonth.month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        hasRaces: false,
        isSelected: false,
      });
    }
    
    return days;
  }, [currentMonth, availableDatesSet, selectedDate]);
  
  const goToPrevMonth = () => {
    if (currentMonthIndex > 0) {
      setCurrentMonthIndex(currentMonthIndex - 1);
    }
  };
  
  const goToNextMonth = () => {
    if (currentMonthIndex < availableMonths.length - 1) {
      setCurrentMonthIndex(currentMonthIndex + 1);
    }
  };
  
  const formatDateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleDateSelect = (day: typeof calendarDays[0]) => {
    if (!day.hasRaces || !day.isCurrentMonth) return;
    const dateStr = formatDateLocal(day.date);
    onDateChange(dateStr);
    onClose();
  };
  
  const handleTrackToggle = (trackCode: string) => {
    if (selectedTracks.includes(trackCode)) {
      onTracksChange(selectedTracks.filter(t => t !== trackCode));
    } else if (selectedTracks.length < maxTracks) {
      onTracksChange([...selectedTracks, trackCode]);
    }
  };
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="bg-[var(--surface-1)] border border-[var(--content-15)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--content-15)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="font-bold text-[var(--text-primary)] text-lg">Select Tracks & Date</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Track Selector */}
        <div className="px-5 py-4 border-b border-[var(--content-15)]">
          <label className="text-xs text-[var(--text-secondary)] mb-3 block flex items-center gap-1 uppercase tracking-wide">
            <MapPin className="w-3.5 h-3.5" />
            Select up to {maxTracks} Tracks
          </label>
          <div className="grid grid-cols-4 gap-2">
            {availableTracks.map(track => {
              const isSelected = selectedTracks.includes(track.code);
              const isDisabled = !isSelected && selectedTracks.length >= maxTracks;
              return (
                <button
                  key={track.code}
                  onClick={() => !isDisabled && handleTrackToggle(track.code)}
                  disabled={isDisabled}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-[var(--brand)] text-white shadow-lg'
                      : isDisabled
                      ? 'bg-[var(--surface-2)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
                      : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {track.code}
                </button>
              );
            })}
          </div>
          {selectedTracks.length > 0 && (
            <p className="text-sm text-[var(--text-secondary)] mt-3">
              <span className="font-medium text-[var(--text-primary)]">
                {selectedTracks.map(t => TRACK_NAMES[t] || t).join(', ')}
              </span>
              <span className="mx-2">•</span>
              <span>{availableDatesSet.size} matching race days</span>
            </p>
          )}
        </div>
        
        {/* Calendar */}
        <div className="p-5">
          {selectedTracks.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select at least one track to see available dates</p>
            </div>
          ) : availableMonths.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No matching race days found for selected tracks</p>
            </div>
          ) : (
            <>
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevMonth}
                  disabled={currentMonthIndex === 0}
                  className={`p-2 rounded-lg transition-colors ${
                    currentMonthIndex === 0
                      ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                      : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h3 className="font-bold text-[var(--text-primary)] text-lg">
                    {MONTHS[currentMonth.month]} {currentMonth.year}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {currentMonthIndex + 1} of {availableMonths.length} months
                  </p>
                </div>
                <button
                  onClick={goToNextMonth}
                  disabled={currentMonthIndex === availableMonths.length - 1}
                  className={`p-2 rounded-lg transition-colors ${
                    currentMonthIndex === availableMonths.length - 1
                      ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                      : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-[var(--text-secondary)] py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateSelect(day)}
                    disabled={!day.hasRaces || !day.isCurrentMonth}
                    className={`
                      aspect-square flex items-center justify-center text-sm rounded-xl transition-all font-medium
                      ${!day.isCurrentMonth ? 'text-[var(--text-tertiary)] opacity-30' : ''}
                      ${day.isCurrentMonth && !day.hasRaces ? 'text-[var(--text-tertiary)] cursor-not-allowed' : ''}
                      ${day.hasRaces && day.isCurrentMonth && !day.isSelected 
                        ? 'bg-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white cursor-pointer' 
                        : ''}
                      ${day.isSelected 
                        ? 'bg-red-500 text-white ring-2 ring-red-500 ring-offset-2 ring-offset-[var(--surface-1)] shadow-lg' 
                        : ''}
                    `}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-5 text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/30" />
                  <span>Race Day</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>Selected</span>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Current Selection */}
        {selectedDate && selectedTracks.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--content-15)] bg-[var(--surface-2)]">
            <p className="text-sm text-center">
              <span className="text-[var(--text-secondary)]">Current: </span>
              <span className="font-bold text-[var(--text-primary)]">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[var(--text-secondary)]"> @ </span>
              <span className="font-bold text-[var(--brand)]">
                {selectedTracks.map(t => TRACK_NAMES[t] || t).join(', ')}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact button version for the header
export function TrackDateButton({
  selectedTracks,
  selectedDate,
  onClick,
}: {
  selectedTracks: string[];
  selectedDate: string;
  onClick: () => void;
}) {
  const formattedDate = selectedDate
    ? new Date(selectedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Select Date';
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--content-15)] transition-colors"
    >
      <MapPin className="w-4 h-4 text-[var(--brand)]" />
      <span className="font-medium text-[var(--text-primary)]">
        {selectedTracks.length > 0 ? selectedTracks.join(', ') : 'Select'}
      </span>
      <span className="text-[var(--text-tertiary)]">•</span>
      <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
      <span className="text-[var(--text-secondary)]">{formattedDate}</span>
    </button>
  );
}
