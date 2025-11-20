/**
 * Custom hook to manage session refresh and auto-reload
 * Prevents session expiration issues on admin pages
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

interface UseSessionRefreshOptions {
  /**
   * Time in milliseconds before session expires to refresh it
   * Default: 10 minutes (600000ms)
   */
  refreshBeforeExpiry?: number;
  
  /**
   * Maximum session duration in milliseconds
   * After this time, page will auto-reload
   * Default: 1 hour (3600000ms)
   */
  maxSessionDuration?: number;
  
  /**
   * Whether to enable auto-reload when max duration is reached
   * Default: true
   */
  enableAutoReload?: boolean;
  
  /**
   * Only enable on admin pages
   * Default: false (works everywhere)
   */
  adminOnly?: boolean;
  
  /**
   * Whether to show a countdown banner
   * Default: true
   */
  showBanner?: boolean;
}

/**
 * Returns time remaining in a human-readable format
 */
export function useSessionCountdown(maxDuration: number, startTime: number) {
  const [timeRemaining, setTimeRemaining] = useState<number>(maxDuration);

  useEffect(() => {
    const updateCountdown = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, maxDuration - elapsed);
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [maxDuration, startTime]);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return { minutes, seconds, totalMs: timeRemaining };
}

/**
 * Hook to keep session alive and auto-reload after max duration
 * 
 * @example
 * // On admin page
 * useSessionRefresh({ 
 *   maxSessionDuration: 90 * 60 * 1000, // 90 minutes
 *   adminOnly: true 
 * });
 */
export function useSessionRefresh(options: UseSessionRefreshOptions = {}) {
  const {
    refreshBeforeExpiry = 10 * 60 * 1000, // 10 minutes before expiry
    maxSessionDuration = 60 * 60 * 1000, // 1 hour (60 minutes)
    enableAutoReload = true,
    adminOnly = false,
    showBanner = true,
  } = options;

  const { session, profile, refreshProfile } = useAuth();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const [timeRemaining, setTimeRemaining] = useState<number>(maxSessionDuration);

  useEffect(() => {
    // Only run if user is authenticated
    if (!session || !session.user) {
      return;
    }

    // If adminOnly is true, only run if user is admin
    if (adminOnly && !profile?.isAdmin) {
      return;
    }

    // Get token expiration time
    const getTokenExpiry = (): number | null => {
      if (!session.expires_at) return null;
      // expires_at is Unix timestamp in seconds, convert to milliseconds
      return session.expires_at * 1000;
    };

    const refreshSession = async (reason: string = 'proactive') => {
      try {
        console.log(`🔄 Refreshing session (${reason})...`);
        
        // First, check if current session is still valid
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          console.warn('⚠️ No current session found, attempting to refresh...');
        }
        
        // Refresh the session
        const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('❌ Error refreshing session:', error);
          // If refresh fails, try to get a new session one more time
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            console.error('⚠️ Session refresh failed and no valid session found. Page may need reload.');
            // If we're on admin page and session is truly dead, reload after a delay
            if (adminOnly) {
              setTimeout(() => {
                console.log('🔄 Reloading page due to session failure...');
                window.location.reload();
              }, 2000);
            }
          } else {
            console.log('✅ Retry successful, session found');
          }
        } else if (newSession) {
          console.log('✅ Session refreshed successfully');
          // Don't refresh profile here - it can cause loops
          // Profile will be refreshed naturally when session changes
          // Update session start time since we got a fresh session
          sessionStartTimeRef.current = Date.now();
        }
      } catch (err) {
        console.error('❌ Exception refreshing session:', err);
      }
    };

    const scheduleRefresh = () => {
      // Clear existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      const expiryTime = getTokenExpiry();
      if (!expiryTime) {
        console.warn('⚠️ Cannot determine token expiry, scheduling refresh every 30 minutes');
        // Fallback: refresh every 30 minutes
        refreshIntervalRef.current = setInterval(refreshSession, 30 * 60 * 1000);
        return;
      }

      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      const refreshTime = Math.max(timeUntilExpiry - refreshBeforeExpiry, 60000); // At least 1 minute

      console.log(`⏰ Session expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, will refresh in ${Math.round(refreshTime / 1000 / 60)} minutes`);

      refreshIntervalRef.current = setTimeout(() => {
        refreshSession().then(() => {
          // After refresh, reschedule the next refresh
          scheduleRefresh();
        });
      }, refreshTime);
    };

    // Schedule auto-reload after max duration
    if (enableAutoReload) {
      // Clear existing timeout
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }

      const timeSinceStart = Date.now() - sessionStartTimeRef.current;
      const timeUntilReload = maxSessionDuration - timeSinceStart;

      if (timeUntilReload > 0) {
        console.log(`⏰ Auto-reload scheduled in ${Math.round(timeUntilReload / 1000 / 60)} minutes`);
        
        reloadTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Max session duration reached, auto-reloading page...');
          window.location.reload();
        }, timeUntilReload);
      } else {
        // Already past max duration, reload immediately
        console.log('🔄 Session duration exceeded, reloading immediately...');
        window.location.reload();
      }
    }

    // Initial schedule
    scheduleRefresh();

    // Keep-alive: Refresh every 10 minutes regardless of expiry time
    // This prevents session expiry during inactivity and keeps buttons responsive
    keepAliveIntervalRef.current = setInterval(() => {
      refreshSession('keep-alive');
    }, 10 * 60 * 1000); // Every 10 minutes (more frequent for better responsiveness)

    // Update countdown banner
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTimeRef.current;
      const remaining = Math.max(0, maxSessionDuration - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    // Also listen for token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED' && newSession) {
        console.log('✅ Token refreshed by Supabase');
        // Reschedule refresh based on new expiry time
        scheduleRefresh();
        // Reset session start time
        sessionStartTimeRef.current = Date.now();
      } else if (event === 'SIGNED_OUT') {
        console.log('⚠️ User signed out');
      }
    });

    // Cleanup
    return () => {
      if (refreshIntervalRef.current) {
        clearTimeout(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
      clearInterval(countdownInterval);
      subscription.unsubscribe();
    };
  }, [session?.user?.id, profile?.isAdmin, refreshBeforeExpiry, maxSessionDuration, enableAutoReload, adminOnly]);

  // Update countdown when maxDuration changes
  useEffect(() => {
    const elapsed = Date.now() - sessionStartTimeRef.current;
    const remaining = Math.max(0, maxSessionDuration - elapsed);
    setTimeRemaining(remaining);
  }, [maxSessionDuration]);

  // Reset session start time when session changes
  useEffect(() => {
    if (session) {
      sessionStartTimeRef.current = Date.now();
      // Reset countdown
      setTimeRemaining(maxSessionDuration);
    }
  }, [session?.user?.id, maxSessionDuration]); // Only reset when user changes

  return {
    timeRemaining,
    minutes: Math.floor(timeRemaining / 60000),
    seconds: Math.floor((timeRemaining % 60000) / 1000),
  };
}

