"use client";

import { useState } from "react";
import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface MatchupCalculationSettings {
  count: number;
  tolerance: number;
  sizes: number[];
  prefer1v1: number; // 0-1, probability of 1v1 vs multi
  maxAttempts: number;
  minSalary: number;
  minAppearances: number;
  minAppearancesEnabled: boolean;
}

interface MatchupCalculationSettingsProps {
  settings: MatchupCalculationSettings;
  onChange: (settings: MatchupCalculationSettings) => void;
}

// Default settings matching unified_matchup_generator.py
export const DEFAULT_SETTINGS: MatchupCalculationSettings = {
  count: 10, // Will be overridden per-type
  tolerance: 300, // Unified generator default
  sizes: [1, 2],
  prefer1v1: 0.8,
  maxAttempts: 500,
  minSalary: 1000,
  minAppearances: 1,
  minAppearancesEnabled: false,
};

// Per-type defaults - these represent what the admin wants to SHOW to users
// Backend will automatically generate 3x this amount for the pool
// Frontend will randomly select from the pool
export const DEFAULT_SETTINGS_BY_TYPE: Record<string, MatchupCalculationSettings> = {
  jockey_vs_jockey: {
    count: 10, // Show 10, backend generates 30 for pool
    tolerance: 300,
    sizes: [1, 2],
    prefer1v1: 0.9, // Higher preference for 1v1 (jockeys are most popular)
    maxAttempts: 500,
    minSalary: 1000,
    minAppearances: 2,
    minAppearancesEnabled: false,
  },
  trainer_vs_trainer: {
    count: 10, // Show 10, backend generates 30 for pool
    tolerance: 300,
    sizes: [1, 2],
    prefer1v1: 0.9, // Higher preference for 1v1 (trainers are popular)
    maxAttempts: 500,
    minSalary: 1000,
    minAppearances: 2,
    minAppearancesEnabled: false,
  },
  sire_vs_sire: {
    count: 8, // Show 8, backend generates 24 for pool
    tolerance: 300,
    sizes: [1, 2],
    prefer1v1: 0.8, // Moderate preference for 1v1
    maxAttempts: 500,
    minSalary: 1000,
    minAppearances: 1,
    minAppearancesEnabled: false,
  },
  mixed: {
    count: 15, // Show 15, backend generates 45 for pool
    tolerance: 300,
    sizes: [1, 2],
    prefer1v1: 0.7, // Lower preference (mixed benefits from variety)
    maxAttempts: 500,
    minSalary: 1000,
    minAppearances: 1,
    minAppearancesEnabled: false,
  },
};

export function MatchupCalculationSettings({
  settings,
  onChange,
}: MatchupCalculationSettingsProps) {
  // Sync local settings with prop changes
  const [localSettings, setLocalSettings] = useState<MatchupCalculationSettings>({
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  });

  // Update local settings when prop changes
  React.useEffect(() => {
    if (settings) {
      setLocalSettings({
        ...DEFAULT_SETTINGS,
        ...settings,
      });
    }
  }, [settings]);

  const updateSetting = <K extends keyof MatchupCalculationSettings>(
    key: K,
    value: MatchupCalculationSettings[K]
  ) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onChange(updated);
  };

  // Estimate calculation time based on settings
  const estimateTime = () => {
    const baseTimePerMatchup = 50; // milliseconds per matchup
    const baseTimePerType = 1000; // milliseconds per matchup type
    const estimatedMs = (
      localSettings.count * baseTimePerMatchup +
      baseTimePerType
    ) * localSettings.maxAttempts / 500;
    return Math.round(estimatedMs / 1000); // seconds
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-[var(--brand)]" />
        <h3 className="text-lg font-semibold">Matchup Calculation Settings</h3>
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Estimated calculation time: <strong>{estimateTime()} seconds</strong> per matchup type
          <br />
          <span className="text-xs">
            Based on {localSettings.count} matchups, tolerance {localSettings.tolerance}, 
            and {localSettings.maxAttempts} max attempts
          </span>
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {/* Matchup Count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="count">Matchups to Show</Label>
            <span className="text-sm text-[var(--text-tertiary)]">
              {localSettings.count} (backend generates {localSettings.count * 3} for pool)
            </span>
          </div>
          <Slider
            id="count"
            min={5}
            max={20}
            step={1}
            value={[localSettings.count]}
            onValueChange={([value]) => updateSetting('count', value)}
            className="w-full"
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            Number of matchups users will see. Backend automatically generates 3x this amount for instant reloads.
          </p>
        </div>

        {/* Tolerance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tolerance">Salary Tolerance</Label>
            <span className="text-sm text-[var(--text-tertiary)]">
              ${localSettings.tolerance}
            </span>
          </div>
          <Slider
            id="tolerance"
            min={100}
            max={2000}
            step={50}
            value={[localSettings.tolerance]}
            onValueChange={([value]) => updateSetting('tolerance', value)}
            className="w-full"
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            Maximum salary difference between sets (lower = more balanced, higher = more variety)
          </p>
        </div>

        {/* Prefer 1v1 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="prefer1v1">1v1 Preference</Label>
            <span className="text-sm text-[var(--text-tertiary)]">
              {Math.round(localSettings.prefer1v1 * 100)}%
            </span>
          </div>
          <Slider
            id="prefer1v1"
            min={0}
            max={1}
            step={0.05}
            value={[localSettings.prefer1v1]}
            onValueChange={([value]) => updateSetting('prefer1v1', value)}
            className="w-full"
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            Probability of generating 1v1 matchups vs multi-set matchups (2v1, 1v2)
          </p>
        </div>

        {/* Minimum Salary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="minSalary">Minimum Salary</Label>
            <span className="text-sm text-[var(--text-tertiary)]">
              ${localSettings.minSalary.toLocaleString()}
            </span>
          </div>
          <Input
            id="minSalary"
            type="number"
            min={0}
            step={100}
            value={localSettings.minSalary}
            onChange={(e) => updateSetting('minSalary', parseInt(e.target.value, 10) || 0)}
            className="w-full"
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            Connections must have a combined salary of at least this amount to be eligible for matchups.
          </p>
        </div>

        {/* Minimum Appearances Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="minAppearancesEnabled">Require Minimum Appearances</Label>
              <p className="text-xs text-[var(--text-tertiary)]">
                When enabled, connections must also meet the minimum appearance requirement after the salary filter.
              </p>
            </div>
            <Switch
              id="minAppearancesEnabled"
              checked={localSettings.minAppearancesEnabled}
              onCheckedChange={(checked) => updateSetting('minAppearancesEnabled', checked)}
            />
          </div>
        </div>

        {/* Minimum Appearances */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="minAppearances">Minimum Appearances</Label>
            <span className="text-sm text-[var(--text-tertiary)]">
              {localSettings.minAppearancesEnabled ? localSettings.minAppearances : 'Off'}
            </span>
          </div>
          <Slider
            id="minAppearances"
            min={1}
            max={10}
            step={1}
            value={[localSettings.minAppearances]}
            onValueChange={([value]) => updateSetting('minAppearances', value)}
            className="w-full"
            disabled={!localSettings.minAppearancesEnabled}
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            Connections must appear at least this many times to qualify when the toggle is enabled.
          </p>
        </div>

        {/* Max Attempts */}
        <div className="space-y-2">
          <Label htmlFor="maxAttempts">Max Attempts per Matchup</Label>
          <Input
            id="maxAttempts"
            type="number"
            min={100}
            max={2000}
            step={100}
            value={localSettings.maxAttempts}
            onChange={(e) => updateSetting('maxAttempts', parseInt(e.target.value) || 500)}
            className="w-full"
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            Maximum attempts to find a balanced matchup before giving up (higher = more thorough, slower)
          </p>
        </div>
      </div>
    </Card>
  );
}

