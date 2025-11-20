"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Save, Download, CheckCircle2, Loader2 } from "lucide-react";
import { TrackAutocomplete } from "./TrackAutocomplete";
import { TrackPreview } from "./TrackPreview";
import { getTrackDisplayName } from "@/lib/tracks";
import { fetchWithAuth } from "@/lib/api/authInterceptor";

interface TrackDataPreview {
  races_count: number;
  horses_count: number;
  non_scratched_count: number;
  track_code: string;
  date: string;
  fetched_at: string;
}

export function CreateContestForm() {
  const [track, setTrack] = useState("");
  const [date, setDate] = useState("");
  
  // New flow states
  const [trackDataId, setTrackDataId] = useState<string | null>(null);
  const [preview, setPreview] = useState<TrackDataPreview | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<"fetch" | "create">("fetch");

  const handleFetchTrackData = async () => {
    if (!track || !date) {
      setError("Please select track and date");
      return;
    }

    setError(null);
    setIsFetchingData(true);
    setPreview(null);
    setTrackDataId(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'You must be logged in');
      }

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const operationId = `fetch-track-${track}-${date}-${Date.now()}`;
      
      console.log(`[${operationId}] 🚀 Starting track data fetch for ${track} on ${date}`);
      console.log(`[${operationId}] 📡 Calling backend API...`);
      
      const startTime = Date.now();
      const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/tracks/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track,
          date,
        }),
      });
      
      const fetchTime = Date.now() - startTime;
      console.log(`[${operationId}] ⏱️  Fetch completed in ${fetchTime}ms`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch track data');
      }

      const data = await response.json();
      
      console.log(`[${operationId}] 📊 Response received:`, {
        success: data.success,
        cached: data.cached,
        hasPreview: !!data.preview,
        trackDataId: data.track_data_id,
      });
      
      if (data.success) {
        console.log(`[${operationId}] ✅ Track data fetched successfully`);
        console.log(`[${operationId}] 📈 Preview:`, data.preview);
        
        setTrackDataId(data.track_data_id);
        setPreview(data.preview);
        setStep("create");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error(data.error || 'Failed to fetch track data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch track data");
    } finally {
      setIsFetchingData(false);
    }
  };

  const handlePreview = async () => {
    if (!track || !date) {
      setError("Please select track and date");
      return;
    }

    setError(null);
    setIsFetchingData(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'You must be logged in');
      }

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/tracks/${track}/${date}/preview`, {});

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get preview');
      }

      const data = await response.json();
      
      if (data.success && data.preview) {
        setPreview(data.preview);
        setStep("create");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get preview");
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const operationId = `create-contest-${Date.now()}`;
    console.log(`[${operationId}] 🚀 Starting contest creation...`);
    console.log(`[${operationId}] 📋 Contest data:`, { track, date, track_data_id: trackDataId });

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error(`[${operationId}] ❌ Session error:`, sessionError);
        throw new Error(sessionError?.message || 'You must be logged in to create contests');
      }

      console.log(`[${operationId}] ✅ Session verified, user: ${session.user.email}`);

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      const payload = {
        track,
        date,
        track_data_id: trackDataId,
      };
      
      console.log(`[${operationId}] 📡 Calling backend API: ${BACKEND_URL}/api/admin/contests`);
      console.log(`[${operationId}] 📦 Payload:`, payload);
      
      const startTime = Date.now();
      const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/contests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const fetchTime = Date.now() - startTime;
      console.log(`[${operationId}] ⏱️  Request completed in ${fetchTime}ms, status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`[${operationId}] ❌ Error response:`, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to create contest`);
      }

      const result = await response.json();
      console.log(`[${operationId}] ✅ Contest created successfully:`, result);
      setSuccess(true);
      
      // Reset form
      setTrack("");
      setDate("");
      setTrackDataId(null);
      setPreview(null);
      setStep("fetch");
      
      // Notify other components
      window.dispatchEvent(new CustomEvent('contestChanged'));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contest");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setTrackDataId(null);
    setPreview(null);
    setStep("fetch");
    setError(null);
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription className="text-green-600 dark:text-green-400">
            {step === "fetch" ? "Track data fetched successfully!" : "Contest created successfully!"}
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: Fetch Track Data */}
      {step === "fetch" && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-[var(--brand)]" />
              <h3 className="text-lg font-semibold">Step 1: Fetch Track Data</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="track">Track</Label>
                <TrackAutocomplete
                  value={track}
                  onChange={setTrack}
                  placeholder="Search track name or code..."
                  disabled={isFetchingData}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => {
                    // On single click, show the calendar picker
                    const input = e.currentTarget;
                    if (input && typeof input.showPicker === 'function') {
                      try {
                        input.showPicker();
                      } catch (err) {
                        // Fallback for browsers that don't support showPicker
                        console.log('showPicker not supported, using default behavior');
                      }
                    }
                  }}
                  onDoubleClick={(e) => {
                    // On double click, allow manual typing
                    const input = e.currentTarget;
                    input.select();
                  }}
                    required
                  disabled={isFetchingData}
                  className="cursor-pointer"
                  style={{
                    colorScheme: 'light',
                  }}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleFetchTrackData}
              disabled={!track || !date || isFetchingData}
              className="w-full"
            >
              {isFetchingData ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Fetching Data...
                </>
              ) : (
                <>
                  <Download className="mr-2 w-4 h-4" />
                  Fetch Track Data from MongoDB
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Preview and Create Contest */}
      {step === "create" && preview && (
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold">Step 2: Preview & Create Contest</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Change Track/Date
              </Button>
            </div>

            {/* Preview */}
            <TrackPreview 
              preview={preview} 
              trackName={track ? getTrackDisplayName(track) : undefined}
            />

            {/* Create Contest Button */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 w-4 h-4" />
                      Create Contest
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="text-xs text-[var(--text-tertiary)]">
              <p>Note: After creating the contest, you can set matchup types in &quot;Manage Contests&quot; to trigger matchup calculations.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
