/**
 * Relational Navigation - Enhanced navigation with user account features
 * REPLACES basic navigation with multi-user capabilities
 */
"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  LogOut, 
  Settings, 
  Trophy, 
  GamepadIcon,
  DollarSign,
  TrendingUp,
  Database,
  Home
} from 'lucide-react';

export function RelationalNavigation() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth(); // Get profile from AuthContext
  const userData = useUserData();
  const loggedAdminStatus = useRef(false);

  // Build nav items in correct order: Home, Matchups, Live, Results, Dashboard, Admin
  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/matchups', label: 'Matchups', icon: GamepadIcon },
    { href: '/live', label: 'Live', icon: TrendingUp },
    { href: '/results', label: 'Results', icon: Trophy },
  ];

  // Add user-specific nav items for authenticated users
  if (user?.id) {
    navItems.push(
      { href: '/user-dashboard', label: 'Dashboard', icon: User }
    );
    
    // Add admin access for admin users
    // Check both AuthContext profile and userData profile for admin status
    const isAdmin = profile?.isAdmin || userData.profile?.isAdmin;
    
    if (isAdmin) {
      // Only log once when admin status is first detected (reduce console spam)
              if (!loggedAdminStatus.current && process.env.NODE_ENV === 'development') {
                console.log('🔑 Admin access detected:', {
                  authContextAdmin: profile?.isAdmin,
                  userDataAdmin: userData.profile?.isAdmin,
                  email: user.email
                });
                loggedAdminStatus.current = true;
              }
      navItems.push(
        { href: '/admin', label: 'Admin', icon: Settings }
      );
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="border-b bg-[#094AAC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Main Navigation */}
          <div className="flex items-center space-x-10">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <GamepadIcon className="h-7 w-7 text-white" />
              <span className="font-bold text-xl text-white">
                Matchups
              </span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Account Section */}
          <div className="flex items-center space-x-6">
            {/* Bankroll Display for Authenticated Users */}
            {user?.id && userData.profile && (
              <div className="hidden sm:flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-md border border-white/20">
                <DollarSign className="h-5 w-5 text-white" />
                <span className="font-bold text-lg text-white">
                  ${userData.bankroll.toLocaleString()}
                </span>
                {userData.needsMigration && (
                  <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                    Migration Available
                  </Badge>
                )}
              </div>
            )}

            {/* User Menu or Sign In */}
            {user?.id ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-white/10">
                    <Avatar className="h-10 w-10 border-2 border-white/30">
                      <AvatarImage 
                        src={userData.profile?.avatarUrl} 
                        alt={userData.profile?.displayName || user.email}
                      />
                      <AvatarFallback className="bg-white/20 text-white border-2 border-white/30">
                        {getInitials(
                          userData.profile?.displayName || 
                          userData.profile?.username || 
                          user.email || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userData.profile?.displayName || userData.profile?.username || 'User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      {userData.profile && (
                        <div className="flex items-center space-x-2 pt-1">
                          <Badge variant="secondary" className="text-xs">
                            {userData.profile.subscriptionTier || 'Free'}
                          </Badge>
                          {userData.profile.totalEntries > 0 && (
                            <span className="text-xs text-gray-500">
                              {userData.profile.winPercentage || 0}% win rate
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link href="/user-dashboard" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/user-dashboard" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  {userData.profile && (
                    <DropdownMenuItem asChild>
                      <Link href="/user-dashboard" className="cursor-pointer">
                        <Trophy className="mr-2 h-4 w-4" />
                        <span>Stats ({userData.profile.totalEntries || 0} games)</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  {userData.needsMigration && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={userData.migrateData} className="text-blue-600">
                        <Database className="mr-2 h-4 w-4" />
                        <span>Migrate Local Data</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={signOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="bg-white text-[#094AAC] hover:bg-white/90">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-white/20 px-4 py-3 bg-[#094AAC]">
        <div className="flex items-center justify-between">
          <div className="flex space-x-4">
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center space-y-1 px-2 py-1 rounded text-xs ${
                    isActive
                      ? 'text-white bg-white/20'
                      : 'text-white/80'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          
          {user?.id && userData.profile && (
            <div className="text-xs text-right text-white">
              <div className="font-semibold">${userData.bankroll}</div>
              <div className="text-white/70">
                @{userData.profile.username || 'user'}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
