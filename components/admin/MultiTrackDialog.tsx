"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchWithAuth } from "@/lib/api/authInterceptor";
import { Contest } from "./ContestManagement";

const MATCHUP_TYPE_OPTIONS = [
  { value: "jockey_vs_jockey", label: "Jockey vs Jockey" },
  { value: "trainer_vs_trainer", label: "Trainer vs Trainer" },
  { value: "sire_vs_sire", label: "Sire vs Sire" },
  { value: "mixed", label: "Mixed" },
  { value: "cross_track", label: "Cross-Track" },
];

interface MultiTrackDialogProps {
  contests: Contest[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MultiTrackDialog({
  contests,
  isOpen,
  onClose,
  onSuccess,
}: MultiTrackDialogProps) {
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    MATCHUP_TYPE_OPTIONS.map((opt) => opt.value)
  );
  const [numMatchups, setNumMatchups] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTracks([]);
      setSelectedTypes(MATCHUP_TYPE_OPTIONS.map((opt) => opt.value));
      setNumMatchups(20);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const tracksGroupedByDate = useMemo(() => {
    const groups = new Map<string, Contest[]>();
    contests.forEach((contest) => {
      const date = contest.date || "Unknown";
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(contest);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => (a > b ? 1 : -1));
  }, [contests]);

  const toggleTrack = (trackId: string) => {
    setSelectedTracks((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (selectedTracks.length < 2) {
      setError("Please select at least 2 tracks.");
      return;
    }
    
    if (selectedTracks.length > 20) {
      setError("Maximum 20 tracks supported.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const BACKEND_URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const response = await fetchWithAuth(
        `${BACKEND_URL}/api/admin/multi-track-matchups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contestIds: selectedTracks,
            numMatchups,
            matchupTypes: selectedTypes,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate multi-track matchups");
      }

      setSuccess(
        `Bundle ${data.bundleId ? `#${data.bundleId.slice(0, 8)}` : ""} generated ${
          data.matchups?.length || 0
        } matchups across ${data.tracks?.join(", ")}`
      );
      // Notify rest of app so Matchups page can re-fetch bundles for this date
      try {
        const date = contests.find(c => selectedTracks.includes(c.id))?.date;
        if (date && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('multiTrackBundlesUpdated', { detail: { date } }));
        }
      } catch {}
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Multi-Track Matchups</DialogTitle>
          <DialogDescription>
            Select 2 or more contests to build cross-track pools. You can select up to 20 tracks. 
            This will generate fresh matchups using the latest data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Tracks (select 2 or more, up to 20)
            </Label>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
              {tracksGroupedByDate.map(([date, dateContests]) => (
                <div key={date}>
                  <div className="text-xs uppercase text-[var(--text-secondary)] mb-1">
                    {date}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {dateContests.map((contest) => (
                      <label
                        key={contest.id}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                          selectedTracks.includes(contest.id)
                            ? "border-[var(--brand)] bg-[var(--blue-50)]"
                            : "border-[var(--content-20)] hover:border-[var(--brand)]"
                        }`}
                      >
                        <Checkbox
                          checked={selectedTracks.includes(contest.id)}
                          onCheckedChange={() => toggleTrack(contest.id)}
                        />
                        <div>
                          <div className="text-sm font-medium">
                            {contest.track}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)]">
                            {contest.status || "draft"}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Matchup Types (optional)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {MATCHUP_TYPE_OPTIONS.map((type) => (
                <label
                  key={type.value}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    selectedTypes.includes(type.value)
                      ? "border-[var(--brand)] bg-[var(--blue-50)]"
                      : "border-[var(--content-20)] hover:border-[var(--brand)]"
                  }`}
                >
                  <Checkbox
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value)}
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Pool Size (matchups to generate)
            </Label>
            <Input
              type="number"
              min={10}
              max={100}
              value={numMatchups}
              onChange={(event) => setNumMatchups(Number(event.target.value))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Generate Matchups"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

