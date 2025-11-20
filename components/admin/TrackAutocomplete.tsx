"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, X, MapPin } from "lucide-react";
import { searchTracks, getTrackByCode, TrackInfo } from "@/lib/tracks";

interface TrackAutocompleteProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TrackAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Search track name or code...",
  disabled = false 
}: TrackAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update search term when value changes externally
  useEffect(() => {
    if (value) {
      const track = getTrackByCode(value);
      setSearchTerm(track ? track.name : value);
    } else {
      setSearchTerm("");
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTracks = searchTerm ? searchTracks(searchTerm) : [];

  const handleSelect = (track: TrackInfo) => {
    onChange(track.code);
    setSearchTerm(track.name);
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(true);
    setHighlightedIndex(0);
    
    // If user types a code, try to find it
    if (term.length === 3 && term === term.toUpperCase()) {
      const track = getTrackByCode(term);
      if (track) {
        onChange(track.code);
        setSearchTerm(track.name);
        setIsOpen(false);
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredTracks.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < filteredTracks.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredTracks[highlightedIndex]) {
          handleSelect(filteredTracks[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleClear = () => {
    setSearchTerm("");
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {isOpen && filteredTracks.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto border border-[var(--content-15)] bg-[var(--surface-1)] shadow-lg">
          <div className="p-1">
            {filteredTracks.map((track, index) => (
              <button
                key={track.code}
                type="button"
                onClick={() => handleSelect(track)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  index === highlightedIndex
                    ? 'bg-[var(--brand)]/10 text-[var(--brand)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--content-15)]'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <div className="flex-1">
                    <div className="font-medium">{track.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {track.code} {track.state && `• ${track.state}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {isOpen && searchTerm && filteredTracks.length === 0 && (
        <Card className="absolute z-50 w-full mt-1 p-3 border border-[var(--content-15)] bg-[var(--surface-1)] shadow-lg">
          <div className="text-sm text-[var(--text-tertiary)] text-center">
            No tracks found matching &quot;{searchTerm}&quot;
          </div>
        </Card>
      )}
    </div>
  );
}

