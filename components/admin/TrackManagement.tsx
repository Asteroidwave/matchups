"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Track {
  id: string;
  code: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function TrackManagement() {
  const { profile, isLoading: authLoading } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTracks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const operationId = `track-load-${Date.now()}`;
    console.log(`[${operationId}] Starting track load...`);
    
    try {
      // Add timeout to prevent infinite hangs (30 seconds for Supabase free tier)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
      });

      const queryPromise = supabase
        .from('tracks')
        .select('*')
        .order('code', { ascending: true });

      const { data, error: fetchError } = await Promise.race([
        queryPromise,
        timeoutPromise,
      ]) as { data: Track[] | null; error: any };

      if (fetchError) {
        console.error(`[${operationId}] Supabase error:`, fetchError);
        console.error(`[${operationId}] Error details:`, {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
        });
        throw fetchError;
      }

      setTracks(data || []);
      console.log(`[${operationId}] ✅ Loaded ${data?.length || 0} tracks`);
      
      if (data && data.length > 0) {
        console.log(`[${operationId}] Tracks:`, data.map(t => ({ id: t.id, code: t.code, name: t.name, status: t.status })));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load tracks";
      console.error(`[${operationId}] ❌ Error loading tracks:`, err);
      setError(errorMessage);
      
      // Always set loading to false, even on error
      setIsLoading(false);
      return;
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Wait for auth to be ready before loading tracks
    if (authLoading) {
      return;
    }
    
    loadTracks();
  }, [authLoading, loadTracks]);

  const handleToggleActive = async (track: Track) => {
    try {
      const { error: updateError } = await supabase
        .from('tracks')
        .update({ status: track.status === 'active' ? 'inactive' : 'active' })
        .eq('id', track.id);

      if (updateError) throw updateError;

      setSuccess(`Track ${track.code} ${track.status === 'inactive' ? 'enabled' : 'disabled'}`);
      await loadTracks();
      
      // Notify other components that tracks changed
      window.dispatchEvent(new CustomEvent('trackChanged'));
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update track");
      setTimeout(() => setError(null), 5000);
    }
  };

  const filteredTracks = tracks.filter(track =>
    track.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    track.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Track Management
        </h3>
        <p className="text-sm text-[var(--text-tertiary)]">
          Enable or disable tracks for players. Disabled tracks won&apos;t appear in the lobby or matchups.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription className="text-green-600 dark:text-green-400">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={loadTracks} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[var(--text-tertiary)]">Loading tracks...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Track Code</TableHead>
                <TableHead>Track Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTracks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-[var(--text-tertiary)]">
                    No tracks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTracks.map((track) => (
                  <TableRow key={track.id}>
                    <TableCell className="font-medium">
                      {track.code}
                    </TableCell>
                    <TableCell>{track.name}</TableCell>
                    <TableCell>
                      {track.status === 'active' ? (
                        <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Hidden</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Label htmlFor={`track-${track.id}`} className="text-sm">
                          {track.status === 'active' ? 'Visible' : 'Hidden'}
                        </Label>
                        <Switch
                          id={`track-${track.id}`}
                          checked={track.status === 'active'}
                          onCheckedChange={() => handleToggleActive(track)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

