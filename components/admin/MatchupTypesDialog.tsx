"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { PerMatchupTypeSettings } from "./PerMatchupTypeSettings";
import { MatchupCalculationSettings } from "./MatchupCalculationSettings";
import { fetchWithAuth } from "@/lib/api/authInterceptor";

interface MatchupTypesDialogProps {
  contestId: string;
  contestTrack: string;
  contestDate: string;
  currentMatchupTypes: string[];
  currentStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MATCHUP_TYPES = [
  { value: 'jockey_vs_jockey', label: 'Jockey vs Jockey (JvJ)' },
  { value: 'trainer_vs_trainer', label: 'Trainer vs Trainer (TvT)' },
  { value: 'sire_vs_sire', label: 'Sire vs Sire (SvS)' },
  { value: 'mixed', label: 'Mixed Matchups (Same/Diff Track)' },
  { value: 'cross_track', label: 'Cross-Track (Must be Diff Tracks)' },
];

export function MatchupTypesDialog({
  contestId,
  contestTrack,
  contestDate,
  currentMatchupTypes,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
}: MatchupTypesDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(currentMatchupTypes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [matchupStats, setMatchupStats] = useState<any[] | null>(null);
  const [showPerTypeSettings, setShowPerTypeSettings] = useState(false);
  const [perTypeSettings, setPerTypeSettings] = useState<Record<string, MatchupCalculationSettings>>({});

  useEffect(() => {
    setSelectedTypes(currentMatchupTypes);
  }, [currentMatchupTypes, isOpen]);

  // Poll operation status
  useEffect(() => {
    if (!operationId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/operations/${operationId}`, {});

        if (response.ok) {
          const data = await response.json();
          const status = data.operation?.status;
          setOperationStatus(status);

          if (status === 'completed' || status === 'failed') {
            setIsPolling(false);
            if (status === 'completed') {
              // Store stats for display
              const stats = data.operation?.result_data?.stats;
              console.log('Received stats from backend:', stats);
              if (stats) {
                setMatchupStats(stats);
              }
              // Wait a moment for backend to finish updating, then refresh
              setTimeout(() => {
                onSuccess();
              }, 500);
              // Don't auto-close - let user see the stats
            }
          }
        }
      } catch (err) {
        console.error('Error polling operation:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [operationId, isPolling, onSuccess, onClose]);

  const handleToggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSettingsComplete = (settings: Record<string, MatchupCalculationSettings>) => {
    setPerTypeSettings(settings);
    setShowPerTypeSettings(false);
    // Automatically submit after settings are configured
    handleSubmit(settings);
  };

  const handleSubmit = async (settings?: Record<string, MatchupCalculationSettings>) => {
    if (selectedTypes.length === 0) {
      setError('Please select at least one matchup type');
      return;
    }

    // If settings not provided, show per-type settings flow
    if (!settings && Object.keys(perTypeSettings).length === 0) {
      setShowPerTypeSettings(true);
      return;
    }

    const finalSettings = settings || perTypeSettings;

    setError(null);
    setIsSubmitting(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'You must be logged in');
      }

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Send settings for each matchup type
      const response = await fetchWithAuth(`${BACKEND_URL}/api/admin/contests/${contestId}/matchup-types`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchup_types: selectedTypes,
          calculation_settings: finalSettings, // Send per-type settings
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set matchup types');
      }

      const data = await response.json();
      
      if (data.operation_id) {
        setOperationId(data.operation_id);
        setIsPolling(true);
        setOperationStatus('processing');
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set matchup types');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusMessage = () => {
    if (operationStatus === 'processing') {
      return 'Calculating matchups... This may take a few moments.';
    }
    if (operationStatus === 'completed') {
      return 'Matchups calculated successfully!';
    }
    if (operationStatus === 'failed') {
      return 'Matchup calculation failed. Please try again.';
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ minHeight: '600px' }}>
        <DialogHeader>
          <DialogTitle>Set Matchup Types</DialogTitle>
          <DialogDescription>
            Select which matchup types to calculate for {contestTrack} on {contestDate}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {getStatusMessage() && (
          <Alert className={operationStatus === 'completed' ? 'bg-green-500/10 border-green-500/20' : ''}>
            <AlertDescription className={operationStatus === 'completed' ? 'text-green-600 dark:text-green-400' : ''}>
              <div className="flex items-center gap-2">
                {operationStatus === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
                {operationStatus === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                {getStatusMessage()}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {operationStatus === 'completed' && matchupStats && matchupStats.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">
              Matchup Generation Summary
            </h3>
            <div className="space-y-3">
              {matchupStats.map((stat, idx) => (
                <div key={idx} className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {stat.typeLabel}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                    <div>• Unique {stat.type.includes('jockey') ? 'Jockeys' : stat.type.includes('trainer') ? 'Trainers' : stat.type.includes('sire') ? 'Sires' : 'Connections'}: {stat.uniqueConnections}</div>
                    <div>• Eligible Connections: {stat.eligibleConnections}</div>
                    <div>• Min Salary: ${stat.minSalary?.toLocaleString?.() ?? stat.minSalary}</div>
                    <div>• Min Appearances Filter: {stat.applyMinAppearances ? `On (≥ ${stat.minAppearances})` : 'Off'}</div>
                    <div>• Generated Pool: <span className="font-semibold">{stat.poolCount}</span></div>
                    <div>• Display Count: <span className="font-semibold">{stat.displayCount}</span> (requested {stat.requested})</div>
                    <div>• Theoretical Maximums:</div>
                    <div className="ml-4 space-y-0.5">
                      {Object.entries(stat.theoreticalMax).map(([pattern, max]) => {
                        if (pattern === 'total') return null;
                        return (
                          <div key={pattern} className="text-xs">
                            {pattern}: {max.toLocaleString()}
                          </div>
                        );
                      })}
                      <div className="text-xs font-medium mt-1">
                        Total: {stat.theoreticalMax.total?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showPerTypeSettings ? (
          <PerMatchupTypeSettings
            selectedTypes={selectedTypes}
            onComplete={handleSettingsComplete}
            onCancel={() => setShowPerTypeSettings(false)}
          />
        ) : (
          <>
            <div className="space-y-3 py-4">
              <Label className="text-sm font-semibold">Select Matchup Types:</Label>
              {MATCHUP_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.value}
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={() => handleToggleType(type.value)}
                    disabled={isSubmitting || isPolling}
                  />
                  <Label
                    htmlFor={type.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isPolling}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSubmit()}
                disabled={isSubmitting || isPolling || selectedTypes.length === 0}
                className="bg-[var(--brand)]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Setting...
                  </>
                ) : (
                  'Configure Settings'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

