"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cacheProfile, getCachedProfile, clearCachedProfile } from "@/lib/auth/profileCache";

interface UserProfile {
  id: string;
  email: string;
  isAdmin: boolean;
  bankroll: number;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user profile from Supabase
  const loadProfile = useCallback(async (userId: string) => {
    try {
      if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Loading profile for user:', userId);
    }
      
      // Get current session to ensure we're authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('❌ No session found');
        return;
      }
      
      console.log('✅ Session found, user:', session.user.email);
      
      // First, try to get profile from 'profiles' table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('📊 Profile query result:', { 
        hasData: !!data, 
        error: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        } : null 
      });

      if (error) {
        console.error('❌ Profile query error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        
        if (error.code === 'PGRST116') {
          // No rows returned - profile doesn't exist, create it
          console.log('⚠️ Profile not found (PGRST116), creating new profile...');
          
          const email = session.user.email || user?.email || '';
          
          // Try to insert profile
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{
              id: userId,
              email,
              is_admin: false,
              bankroll: 1000,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (insertError) {
            console.error('❌ Error creating profile:', insertError);
            console.error('Insert error details:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
            });
            return;
          }

          if (newProfile) {
            console.log('✅ Profile created:', newProfile);
            setProfile({
              id: newProfile.id,
              email: newProfile.email || email,
              isAdmin: newProfile.is_admin || false,
              bankroll: newProfile.bankroll || 1000,
              createdAt: newProfile.created_at || new Date().toISOString(),
            });
          }
        } else if (error.code === '42501' || error.message?.includes('permission')) {
          // RLS policy violation
          console.error('🚫 RLS Policy Error - Profile exists but cannot be read');
          console.error('This usually means Row Level Security policies are blocking access.');
          console.error('Check your RLS policies in Supabase for the profiles table.');
        }
        return;
      }

      if (data) {
        const profileData = {
          id: data.id,
          email: data.email || user?.email || '',
          isAdmin: data.is_admin === true, // Explicit boolean check
          bankroll: data.bankroll || 1000,
          createdAt: data.created_at || new Date().toISOString(),
        };
        
        console.log('✅ Profile loaded from database:', {
          id: profileData.id,
          email: profileData.email,
          isAdmin: profileData.isAdmin,
          bankroll: profileData.bankroll,
        });
        
        setProfile(profileData);
        
        // Cache profile for fast reload
        cacheProfile(profileData, userId);
      } else {
        console.warn('⚠️ Query succeeded but no data returned');
      }
    } catch (err) {
      console.error('❌ Exception in loadProfile:', err);
      if (err instanceof Error) {
        console.error('Error stack:', err.stack);
      }
    }
  }, [user?.email]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    // Try to load cached profile first for instant UI
    const cached = getCachedProfile();
    if (cached && cached.profile) {
      console.log('⚡ Using cached profile for instant UI');
      setProfile(cached.profile);
    }
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Safety timeout: ensure isLoading is set to false even if profile loading hangs
        loadingTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('⏰ Profile load timeout - setting isLoading to false');
            setIsLoading(false);
          }
        }, 2000); // 2 second max wait (reduced from 3s for faster UX)
        
        // Verify cached profile matches current user
        if (cached && cached.userId === session.user.id) {
          console.log('✅ Cached profile matches current user');
          // Still refresh from server to ensure latest data
          loadProfile(session.user.id)
            .catch((err) => {
              console.error('❌ Error loading profile:', err);
              // Set loading to false even on error so UI doesn't hang
              if (mounted) {
                setIsLoading(false);
              }
            })
            .finally(() => {
              if (mounted) {
                setIsLoading(false);
                if (loadingTimeout) clearTimeout(loadingTimeout);
              }
            });
        } else {
          // Clear stale cache and load fresh
          if (cached) {
            console.log('🔄 Cached profile doesn\'t match user, clearing cache');
            clearCachedProfile();
          }
          loadProfile(session.user.id)
            .catch((err) => {
              console.error('❌ Error loading profile:', err);
              // Set loading to false even on error so UI doesn't hang
              if (mounted) {
                setIsLoading(false);
              }
            })
            .finally(() => {
              if (mounted) {
                setIsLoading(false);
                if (loadingTimeout) clearTimeout(loadingTimeout);
              }
            });
        }
      } else {
        // No session, clear cache
        if (cached) {
          clearCachedProfile();
        }
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // Only update state if session actually changed (prevent loops)
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Only load profile if user changed (prevent loops)
        if (!user || user.id !== session.user.id) {
          await loadProfile(session.user.id);
        }
      } else {
        setProfile(null);
        clearCachedProfile();
      }

      if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [loadProfile, router, user?.id]); // Add user.id to prevent unnecessary re-runs

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (data.user) {
      // Profile will be created automatically by database trigger or in loadProfile
      if (data.session) {
        await loadProfile(data.user.id);
      }
    }

    return { error };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (data.user && data.session) {
      // Update state immediately
      setSession(data.session);
      setUser(data.user);
      // Load profile (this will update profile state)
      await loadProfile(data.user.id);
      // Redirect after a brief delay to ensure state is updated
      setTimeout(() => {
        router.push('/matchups');
      }, 100);
    }

    return { error };
  }, [loadProfile, router]);

  const signOut = useCallback(async () => {
    try {
      // Clear all state first
      setProfile(null);
      setUser(null);
      setSession(null);
      setIsLoading(false); // Ensure loading state is cleared
      
      // Clear cached profile
      clearCachedProfile();
      
      // Clear session storage
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        // Clear Supabase auth token from localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('auth-token') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        // Continue anyway - clear local state
      }
      
      // Use window.location for hard redirect to clear all state
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Error in signOut:', err);
      // Force redirect even if there's an error
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }, [user?.id, loadProfile]);

  const value = React.useMemo(() => ({
    user,
    session,
    profile,
    isLoading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  }), [user, session, profile, isLoading, signUp, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

