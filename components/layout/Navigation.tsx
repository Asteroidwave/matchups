"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Home, BarChart3, Trophy } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();
  const { bankroll } = useApp();
  
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/matchups", label: "Lobby", icon: Trophy },
    { href: "/results", label: "Results", icon: BarChart3 },
  ];
  
  return (
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
          
          {/* Right side - Theme Toggle and Balance */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Balance */}
            <div className="text-right not-italic">
              <div className="text-[11px] leading-[15px] text-white/70">Balance</div>
              <div className="text-[14px] leading-5 font-semibold text-white">${bankroll.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
