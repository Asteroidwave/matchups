"use client";

import { useEffect } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  
  // Get cached profile for admin routes (if profile not loaded yet)
  const getCachedAdminProfile = React.useCallback(() => {
    if (!requireAdmin || !user) return null;
    try {
      const { getCachedProfile } = require('@/lib/auth/profileCache');
      const cached = getCachedProfile();
      if (cached && cached.profile && cached.userId === user.id && cached.profile.isAdmin) {
        return cached.profile;
      }
    } catch (e) {
      // Cache check failed, ignore
    }
    return null;
  }, [requireAdmin, user]);
  
  const cachedProfile = React.useMemo(() => getCachedAdminProfile(), [getCachedAdminProfile]);
  
  // Determine if we have valid admin access
  const hasAdminAccess = React.useMemo(() => {
    if (!requireAdmin) return true;
    if (profile && profile.isAdmin) return true;
    if (cachedProfile && cachedProfile.isAdmin) return true;
    return false;
  }, [requireAdmin, profile, cachedProfile]);

  useEffect(() => {
    // Don't check anything while actively loading initial session
    if (isLoading && !user) {
      return;
    }

    // Check if user is authenticated
    if (!user) {
      console.log('🔒 ProtectedRoute: No user, redirecting to login');
      router.push('/login');
      return;
    }

    // If admin is required, check access
    if (requireAdmin) {
      // Only log once per state change to reduce console spam
      if (hasAdminAccess) {
        console.log('✅ Admin access granted');
      } else if (!isLoading) {
        console.log('❌ Not an admin, redirecting to matchups');
        router.push('/matchups');
        return;
      }
      // If loading, just wait - don't redirect yet
    }
  }, [user?.id, profile?.isAdmin, isLoading, requireAdmin, router, hasAdminAccess]); // Use user.id and profile.isAdmin to prevent unnecessary re-runs

  // Show loading only if we don't have necessary data
  // If we have cached profile for admin, we can show content immediately
  if (isLoading && !user) {
    // Still loading session
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <div className="text-[var(--text-primary)]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  // For admin routes: check if we have access (profile or cache)
  if (requireAdmin) {
    if (!hasAdminAccess) {
      // No access yet - show loading if still loading, otherwise will redirect
      if (isLoading) {
        return (
          <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-[var(--text-primary)]">Loading...</div>
              <div className="text-sm text-[var(--text-tertiary)]">
                Verifying admin access...
              </div>
            </div>
          </div>
        );
      }
      return null; // Will redirect
    }
    // Have admin access - show content
    console.log('✅ ProtectedRoute: Rendering admin content');
  }

  return <>{children}</>;
}

