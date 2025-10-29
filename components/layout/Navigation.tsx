"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { Home, BarChart3, Trophy } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();
  const { bankroll } = useApp();
  
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/matchups", label: "Matchups", icon: Trophy },
    { href: "/results", label: "Results", icon: BarChart3 },
  ];
  
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-gray-900">
              HR
            </div>
            <span className="text-xl font-bold text-gray-900">Horse Racing</span>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href === "/" && pathname === "/matchups");
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                    ${isActive 
                      ? "bg-gray-900 text-white" 
                      : "text-gray-600 hover:bg-gray-100"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
          
          {/* Bankroll */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">Bankroll</div>
              <div className="text-lg font-bold text-gray-900">${bankroll.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

