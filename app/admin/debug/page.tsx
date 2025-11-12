"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminDebugPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [dbProfile, setDbProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDatabase = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!user?.id) {
        throw new Error('No user ID');
      }

      console.log('🔍 Checking database for user ID:', user.id);

      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (dbError) {
        console.error('❌ Database error:', dbError);
        if (dbError.code === 'PGRST116') {
          setError('Profile does not exist in database. Try clicking "Create Profile" below.');
        } else {
          setError(`Database error: ${dbError.message} (Code: ${dbError.code})`);
        }
        return;
      }

      setDbProfile(data);
      console.log('📊 Database profile found:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error checking database:', err);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!user?.id) {
        throw new Error('No user ID');
      }

      const { data, error: createError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          email: user.email,
          is_admin: false,
          bankroll: 1000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      setDbProfile(data);
      await refreshProfileData();
      alert('Profile created successfully! Now you can make yourself admin in Supabase.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create profile');
      console.error('Error creating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfileData = async () => {
    setLoading(true);
    await refreshProfile();
    await checkDatabase();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--surface-1)] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Admin Debug Page</h1>
          
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold mb-2">Current User State</h2>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto">
                {JSON.stringify({ user, profile }, null, 2)}
              </pre>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={checkDatabase} disabled={loading}>
                Check Database
              </Button>
              <Button onClick={refreshProfileData} disabled={loading}>
                Refresh Profile
              </Button>
              <Button onClick={createProfile} disabled={loading} variant="outline">
                Create Profile (if missing)
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {dbProfile && (
              <div>
                <h2 className="font-semibold mb-2">Database Profile</h2>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(dbProfile, null, 2)}
                </pre>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <p className="font-semibold">Admin Status:</p>
                  <p className={dbProfile.is_admin ? 'text-green-600' : 'text-red-600'}>
                    {dbProfile.is_admin ? '✅ IS ADMIN' : '❌ NOT ADMIN'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Email: {dbProfile.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

