"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPickerProps {
  raceDates: string[];  // ISO date strings of race days
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  selectedTracks?: string[];
}

export function CalendarPicker({
  raceDates,
  selectedDate,
  onDateSelect,
  selectedTracks = [],
}: CalendarPickerProps) {
  // Convert race dates to a Set for quick lookup
  const raceDateSet = useMemo(() => new Set(raceDates), [raceDates]);

  // Find the range of months with races
  const { minMonth, maxMonth, availableMonths } = useMemo(() => {
    if (raceDates.length === 0) {
      const now = new Date();
      return {
        minMonth: new Date(now.getFullYear(), now.getMonth(), 1),
        maxMonth: new Date(now.getFullYear(), now.getMonth(), 1),
        availableMonths: [],
      };
    }

    const sorted = [...raceDates].sort();
    const min = new Date(sorted[0]);
    const max = new Date(sorted[sorted.length - 1]);

    // Get unique months
    const months = new Set<string>();
    for (const date of raceDates) {
      months.add(date.substring(0, 7)); // 'YYYY-MM'
    }

    return {
      minMonth: new Date(min.getFullYear(), min.getMonth(), 1),
      maxMonth: new Date(max.getFullYear(), max.getMonth(), 1),
      availableMonths: Array.from(months).sort(),
    };
  }, [raceDates]);

  // Current displayed month
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Default to the first month with races, or current month
    if (availableMonths.length > 0) {
      const [year, month] = availableMonths[0].split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date();
  });

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const hasRacesThisMonth = availableMonths.includes(monthKey);

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      return newDate >= minMonth ? newDate : prev;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      return newDate <= maxMonth ? newDate : prev;
    });
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Day of week for first day (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [currentMonth]);

  // Format date for comparison
  const formatDateKey = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--content-15)] rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          disabled={currentMonth <= minMonth}
          className="p-2 rounded-lg hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-primary)]" />
        </button>

        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>

        <button
          onClick={goToNextMonth}
          disabled={currentMonth >= maxMonth}
          className="p-2 rounded-lg hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-[var(--text-primary)]" />
        </button>
      </div>

      {/* No races message */}
      {selectedTracks.length > 0 && !hasRacesThisMonth && (
        <div className="text-center py-4 text-[var(--content-9)] text-sm mb-4 bg-[var(--surface-2)] rounded-lg">
          No races for selected tracks in {monthNames[currentMonth.getMonth()]}
        </div>
      )}

      {/* Day names header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div 
            key={day} 
            className="text-center text-xs font-medium text-[var(--content-9)] py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="p-2" />;
          }

          const dateKey = formatDateKey(day);
          const hasRace = raceDateSet.has(dateKey);
          const isSelected = selectedDate === dateKey;

          return (
            <button
              key={day}
              onClick={() => hasRace && onDateSelect(dateKey)}
              disabled={!hasRace}
              className={`
                p-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isSelected
                  ? 'bg-[var(--calendar-selected)] text-white shadow-md transform scale-105'
                  : hasRace
                    ? 'bg-[var(--calendar-race-day)] text-white hover:opacity-90 cursor-pointer'
                    : 'text-[var(--content-9)] cursor-not-allowed'
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-[var(--content-15)] flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-[var(--calendar-race-day)]" />
          <span className="text-[var(--text-secondary)]">Race Day</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-[var(--calendar-selected)]" />
          <span className="text-[var(--text-secondary)]">Selected</span>
        </div>
      </div>

      {/* Selected date display */}
      {selectedDate && (
        <div className="mt-3 text-center text-sm text-[var(--text-primary)] font-medium">
          Selected: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      )}
    </div>
  );
}
