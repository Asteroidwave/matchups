"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TrackDatePicker } from "@/components/TrackDatePicker";
import { Home, BarChart3, Trophy, MapPin, Calendar, Menu, X } from "lucide-react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
      <div className="px-3 sm:px-5">
        <div className="flex items-center justify-between h-14 sm:h-[72px]">
          {/* Title */}
          <Link href="/matchups" className="flex items-center gap-2 sm:gap-3">
            <span className="text-[14px] sm:text-[16px] leading-6 font-semibold tracking-[-0.2px] text-white">Matchups</span>
          </Link>
          
          {/* Navigation Links - Centered (hidden on mobile) */}
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === "/" && pathname === "/matchups");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 lg:px-6 py-2 lg:py-3 rounded-[10px] flex items-center gap-2 text-[14px] lg:text-[18px] leading-6 font-semibold transition-all relative
                    ${
                      isActive
                        ? "text-white bg-white/10"
                        : "text-white/90 hover:bg-[#E6F0FF]/40 hover:text-white"
                    }`}
                >
                  <Icon className="w-4 h-4 lg:hidden" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden">{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </Link>
              );
            })}
          </div>
          
          {/* Right side - Track/Date picker, Theme Toggle, and Balance */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Track and Date Selector - Responsive */}
            <button
              onClick={() => setIsDatePickerOpen(true)}
              className="hidden sm:flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm font-medium">
                {selectedTracks.length > 0 ? selectedTracks.join(", ") : "Track"}
              </span>
              <span className="text-white/60 hidden lg:inline">•</span>
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 hidden lg:block" />
              <span className="text-xs sm:text-sm font-medium hidden lg:inline">
                {formatDisplayDate(selectedDate)}
              </span>
            </button>
            
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Balance - Compact on mobile */}
            <div className="flex items-center gap-1 sm:gap-2 bg-white/10 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-xs sm:text-sm">💰</span>
              </div>
              <div className="text-right not-italic">
                <div className="text-[12px] sm:text-[14px] leading-5 font-semibold text-white">
                  ${bankroll >= 1000 ? `${(bankroll/1000).toFixed(1)}k` : bankroll.toFixed(0)}
                </div>
              </div>
            </div>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-3 border-t border-white/10 mt-2 pt-3">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href === "/" && pathname === "/matchups");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg flex items-center gap-3 text-[16px] font-medium transition-all
                      ${
                        isActive
                          ? "text-white bg-white/20"
                          : "text-white/80 hover:bg-white/10"
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {/* Mobile Track/Date selector */}
              <button
                onClick={() => {
                  setIsDatePickerOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="px-4 py-3 rounded-lg flex items-center gap-3 text-[16px] font-medium text-white/80 hover:bg-white/10 transition-all"
              >
                <MapPin className="w-5 h-5" />
                <span>{selectedTracks.join(", ")} • {formatDisplayDate(selectedDate)}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
      
      {/* Track Date Picker Modal */}
      <TrackDatePicker
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        availableTracks={availableTracks}
        selectedTracks={selectedTracks}
        selectedDate={selectedDate}
        onTracksChange={setSelectedTracks}
        onDateChange={(date) => {
          setSelectedDate(date);
          setIsDatePickerOpen(false);
        }}
      />
    </>
  );
}
