/**
 * Migration Prompt Component
 * Prompts users to migrate their localStorage data to the new relational system
 */
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Database, Upload, X } from "lucide-react";
import { useRelationalApp } from "@/contexts/RelationalAppContext";

export function MigrationPrompt() {
  const { 
    hasMigratedFromLocalStorage, 
    migrationStatus, 
    migrateFromLocalStorage,
    userProfile 
  } = useRelationalApp();

  const [localStorageData, setLocalStorageData] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Check for localStorage data on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !userProfile) return;

    try {
      const rounds = localStorage.getItem('horse-racing-rounds');
      const history = localStorage.getItem('horse-racing-rounds-history');
      const bankroll = localStorage.getItem('bankroll');

      const hasData = rounds || history;
      if (hasData && !hasMigratedFromLocalStorage) {
        const data = {
          rounds: rounds ? JSON.parse(rounds).length : 0,
          history: history ? JSON.parse(history).length : 0,
          bankroll: bankroll ? parseFloat(bankroll) : 0
        };
        setLocalStorageData(data);
        setShowPrompt(true);
      }
    } catch (error) {
      console.error('Error checking localStorage:', error);
    }
  }, [userProfile, hasMigratedFromLocalStorage]);

  const handleMigration = async () => {
    await migrateFromLocalStorage();
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || hasMigratedFromLocalStorage) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-500" />
              <CardTitle>Data Migration Available</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissPrompt}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            We found your existing game data that can be transferred to your new account
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {localStorageData && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Data Found:</h4>
              <ul className="text-sm space-y-1">
                <li>• {localStorageData.rounds} game rounds</li>
                <li>• {localStorageData.history} history entries</li>
                <li>• ${localStorageData.bankroll} current bankroll</li>
              </ul>
            </div>
          )}

          {migrationStatus === 'pending' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your game data is currently stored locally. Migrate it to your account for permanent access across all devices.
              </AlertDescription>
            </Alert>
          )}

          {migrationStatus === 'in_progress' && (
            <div className="space-y-2">
              <Progress value={50} className="w-full" />
              <p className="text-sm text-gray-600">Migrating your data...</p>
            </div>
          )}

          {migrationStatus === 'complete' && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Migration complete! Your data is now safely stored in your account.
              </AlertDescription>
            </Alert>
          )}

          {migrationStatus === 'error' && (
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Migration failed. Your local data is still safe. Try again or contact support.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            {migrationStatus === 'pending' && (
              <>
                <Button onClick={handleMigration} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Migrate Data
                </Button>
                <Button variant="outline" onClick={dismissPrompt}>
                  Later
                </Button>
              </>
            )}

            {migrationStatus === 'complete' && (
              <Button onClick={dismissPrompt} className="w-full">
                Continue
              </Button>
            )}

            {migrationStatus === 'error' && (
              <>
                <Button onClick={handleMigration} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button variant="outline" onClick={dismissPrompt}>
                  Cancel
                </Button>
              </>
            )}
          </div>

          <div className="text-xs text-gray-500">
            <p>✅ Your data will be permanently stored in the cloud</p>
            <p>✅ Access from any device with your account</p>
            <p>✅ Complete game history preserved</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// useRelationalApp hook is defined in RelationalAppContext.tsx
// Removed duplicate definition to fix naming conflict
