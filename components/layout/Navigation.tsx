"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Home, BarChart3, Trophy, Shield, LogOut, LogIn, Loader2, Radio } from "lucide-react";

export function Navigation() {
  // ALL hooks must be called before any conditional returns
  const pathname = usePathname();
  const router = useRouter();
  const { bankroll } = useApp();
  const { user, profile, isLoading: authLoading, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Don't show navigation on login/signup pages
  if (pathname === '/login' || pathname === '/signup') {
    return null;
  }
  
  // Only show navigation for authenticated users
  if (!user && !authLoading) {
    return null;
  }
  
  // Show all navigation items for authenticated users
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/live", label: "Live", icon: Radio },
    { href: "/results", label: "Results", icon: BarChart3 },
  ];
  
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Clear session storage and local storage
      sessionStorage.clear();
      localStorage.removeItem('sb-' + (process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].split('//')[1] || '') + '-auth-token');
      
      await signOut();
      
      // Force a hard reload to clear all state
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out:', err);
      setIsSigningOut(false);
      // Still redirect even if there's an error
      window.location.href = '/login';
    }
  };
  
  return (
    <nav className="bg-[var(--brand)] border-b border-[var(--content-16)] sticky top-0 z-50">
      <div className="px-5">
        <div className="flex items-center justify-between h-[72px]">
          {/* Title */}
          <Link href="/" className="flex items-center gap-3">
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
            {profile?.isAdmin && (
              <Link
                href="/admin"
                className={`px-6 py-3 rounded-[10px] flex items-center gap-2 text-[18px] leading-6 font-semibold transition-all relative
                  ${
                    pathname === "/admin"
                      ? "text-white bg-white/10"
                      : "text-white/90 hover:bg-[#E6F0FF]/40 hover:text-white"
                  }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
                {pathname === "/admin" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </Link>
            )}
          </div>
          
          {/* Right Side - Auth & Balance */}
          <div className="flex items-center gap-4">
            {authLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : user ? (
              <>
                {/* Balance */}
                <div className="text-right not-italic">
                  <div className="text-[11px] leading-[15px] text-white/70">Balance</div>
                  <div className="text-[14px] leading-5 font-semibold text-white">
                    ${(profile?.bankroll || bankroll).toFixed(2)}
                  </div>
                </div>
                {/* User email & Logout */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">
                    {user.email}
                    {profile?.isAdmin && (
                      <span className="ml-2 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-xs">
                        Admin
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="text-white hover:bg-white/10"
                    title="Sign Out"
                  >
                    {isSigningOut ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/login')}
                className="text-white hover:bg-white/10"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

