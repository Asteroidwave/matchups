/**
 * Auth Interceptor for API Requests
 * Automatically refreshes session before API calls if needed
 */

import { supabase } from '@/lib/supabase/client';

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

// REMOVED: Global event listeners and keep-alive interval
// These were causing infinite loops and page lockups
// Session refresh is now handled only on-demand via ensureValidSession()
// and by components that explicitly need it (like useSessionRefresh hook)

/**
 * Ensure session is valid before API call
 * Refreshes if needed
 */
export async function ensureValidSession(): Promise<string | null> {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.warn('⚠️ No session found, attempting refresh...');
      // Try to refresh
      const { data: { session: newSession } } = await supabase.auth.refreshSession();
      if (newSession) {
        return newSession.access_token;
      }
      return null;
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
    if (expiresAt) {
      const timeUntilExpiry = expiresAt - Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (timeUntilExpiry < fiveMinutes) {
        // Token expiring soon, refresh proactively
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = supabase.auth.refreshSession().then(() => {
            isRefreshing = false;
            refreshPromise = null;
          }).catch(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
        }
        
        // Wait for refresh to complete
        if (refreshPromise) {
          await refreshPromise;
        }
        
        // Get refreshed session
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        if (refreshedSession) {
          return refreshedSession.access_token;
        }
      }
    }

    return session.access_token;
  } catch (err) {
    console.error('❌ Error ensuring valid session:', err);
    return null;
  }
}

/**
 * Fetch with automatic session refresh
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await ensureValidSession();
  
  if (!token) {
    throw new Error('No valid session available');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If 401, try refreshing and retry once
  if (response.status === 401) {
    console.warn('⚠️ 401 Unauthorized, refreshing session and retrying...');
    const newToken = await ensureValidSession();
    if (newToken) {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });
    }
  }

  return response;
}

