"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TrackDatePicker } from "@/components/TrackDatePicker";
import { Home, BarChart3, Trophy, MapPin, Calendar } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();
  const { 
    bankroll, 
    selectedTracks, 
    selectedDate, 
    availableTracks, 
    setSelectedTracks, 
    setSelectedDate 
  } = useApp();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/matchups", label: "Lobby", icon: Trophy },
    { href: "/results", label: "Results", icon: BarChart3 },
  ];
  
  // Format date for display
  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  return (
    <>
      <nav className="bg-[var(--brand)] border-b border-[var(--content-16)] sticky top-0 z-50">
        <div className="px-5">
          <div className="flex items-center justify-between h-[72px]">
            {/* Title */}
            <Link href="/matchups" className="flex items-center gap-3">
              <span className="text-[16px] leading-6 font-semibold tracking-[-0.2px] text-white">Matchups</span>
            </Link>
            
            {/* Navigation Links - Centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href === "/" && pathname === "/matchups");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-6 py-3 rounded-[10px] flex items-center gap-2 text-[18px] leading-6 font-semibold transition-all relative
                      ${
                        isActive
                          ? "text-white bg-white/10"
                          : "text-white/90 hover:bg-[#E6F0FF]/40 hover:text-white"
                      }`}
                  >
                    <Icon className="w-4 h-4 hidden" />
                    <span>{item.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                  </Link>
                );
              })}
            </div>
            
            {/* Right side - Track/Date picker, Theme Toggle, and Balance */}
            <div className="flex items-center gap-4">
              {/* Track and Date Selector - Beat the House style */}
              <button
                onClick={() => setIsDatePickerOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {selectedTracks.length > 0 ? selectedTracks.join(", ") : "Select Track"}
                </span>
                <span className="text-white/60">•</span>
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {formatDisplayDate(selectedDate)}
                </span>
              </button>
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* Balance */}
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-sm">💰</span>
                </div>
                <div className="text-right not-italic">
                  <div className="text-[14px] leading-5 font-semibold text-white">${bankroll.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Track Date Picker Modal */}
      <TrackDatePicker
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        availableTracks={availableTracks}
        selectedTracks={selectedTracks}
        selectedDate={selectedDate}
        onSelectTracks={setSelectedTracks}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setIsDatePickerOpen(false);
        }}
      />
    </>
  );
}
