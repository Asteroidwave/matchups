"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { MatchupCalculationSettings as MatchupSettingsComponent, type MatchupCalculationSettings, DEFAULT_SETTINGS, DEFAULT_SETTINGS_BY_TYPE } from "./MatchupCalculationSettings";

type MatchupSettings = MatchupCalculationSettings;

interface PerMatchupTypeSettingsProps {
  selectedTypes: string[];
  onComplete: (settings: Record<string, MatchupSettings>) => void;
  onCancel: () => void;
}

const MATCHUP_TYPE_LABELS: Record<string, string> = {
  'jockey_vs_jockey': 'Jockey vs Jockey (JvJ)',
  'trainer_vs_trainer': 'Trainer vs Trainer (TvT)',
  'sire_vs_sire': 'Sire vs Sire (SvS)',
  'mixed': 'Mixed Matchups',
};

export function PerMatchupTypeSettings({
  selectedTypes,
  onComplete,
  onCancel,
}: PerMatchupTypeSettingsProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState<Record<string, MatchupSettings>>(() => {
    const initial: Record<string, MatchupSettings> = {};
    selectedTypes.forEach(type => {
      // Use per-type defaults if available, otherwise use general defaults
      initial[type] = { ...(DEFAULT_SETTINGS_BY_TYPE[type] || DEFAULT_SETTINGS) };
    });
    return initial;
  });

  const currentType = selectedTypes[currentStep];
  const isLastStep = currentStep === selectedTypes.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      // Show summary
      setCurrentStep(selectedTypes.length);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === selectedTypes.length) {
      // Back from summary to last type
      setCurrentStep(selectedTypes.length - 1);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSettingsChange = (newSettings: MatchupSettings) => {
    setSettings(prev => ({
      ...prev,
      [currentType]: newSettings,
    }));
  };

  const estimateTotalTime = () => {
    let totalSeconds = 0;
    selectedTypes.forEach(type => {
      const s = settings[type];
      const baseTimePerMatchup = 50; // milliseconds
      const baseTimePerType = 1000; // milliseconds
      const estimatedMs = (
        s.count * baseTimePerMatchup +
        baseTimePerType
      ) * s.maxAttempts / 500;
      totalSeconds += Math.round(estimatedMs / 1000);
    });
    return totalSeconds;
  };

  // Summary view
  if (currentStep === selectedTypes.length) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Settings Summary</h3>
          <p className="text-sm text-[var(--text-tertiary)]">
            Review your settings before calculating matchups
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {selectedTypes.map((type, idx) => {
            const s = settings[type];
            return (
              <Card key={type} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{MATCHUP_TYPE_LABELS[type] || type}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(idx)}
                  >
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[var(--text-tertiary)]">Matchups:</span>{' '}
                    <span className="font-medium">{s.count}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Tolerance:</span>{' '}
                    <span className="font-medium">${s.tolerance}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Max Attempts:</span>{' '}
                    <span className="font-medium">{s.maxAttempts}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">1v1 Preference:</span>{' '}
                    <span className="font-medium">{Math.round(s.prefer1v1 * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Min Salary:</span>{' '}
                    <span className="font-medium">${s.minSalary.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Min Appearances:</span>{' '}
                    <span className="font-medium">
                      {s.minAppearancesEnabled ? `≥ ${s.minAppearances}` : 'Disabled'}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Estimated total calculation time:</strong> {estimateTotalTime()} seconds
            <br />
            <span className="text-xs">
              This is an estimate. Actual time may vary based on data complexity.
            </span>
          </AlertDescription>
        </Alert>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={() => onComplete(settings)} className="bg-[var(--brand)]">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Calculate Matchups
          </Button>
        </div>
      </div>
    );
  }

  // Per-type settings view
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-sm text-[var(--text-tertiary)] mb-1">
          Step {currentStep + 1} of {selectedTypes.length}
        </div>
        <h3 className="text-lg font-semibold">
          Configure {MATCHUP_TYPE_LABELS[currentType] || currentType}
        </h3>
        <p className="text-sm text-[var(--text-tertiary)]">
          Set calculation settings for this matchup type
        </p>
      </div>

      <div style={{ minHeight: '400px' }}>
        <MatchupSettingsComponent
          settings={settings[currentType]}
          onChange={handleSettingsChange}
        />
      </div>

      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          onClick={isFirstStep ? onCancel : handleBack}
          disabled={false}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={handleNext} className="bg-[var(--brand)]">
          {isLastStep ? 'Review Summary' : 'Next'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

