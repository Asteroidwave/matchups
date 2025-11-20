/**
 * User Rounds History - Shows rounds from relational database
 * REPLACES localStorage-based rounds display
 */
"use client";

import React from 'react';
import { useUserData } from '@/hooks/useUserData';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GamepadIcon, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

export function UserRoundsHistory() {
  const userData = useUserData();
  const { rounds: fallbackRounds } = useApp();

  // Use relational data if authenticated, otherwise fall back to old system
  const rounds = userData.profile?.id ? userData.rounds : fallbackRounds;
  const isAuthenticated = !!userData.profile?.id;

  const handleRefresh = async () => {
    if (isAuthenticated) {
      await userData.loadUserData();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <GamepadIcon className="h-5 w-5" />
              <span>Game History</span>
            </CardTitle>
            <CardDescription>
              {isAuthenticated 
                ? 'Your complete contest history from the cloud'
                : 'Local game history (sign in to save permanently)'
              }
            </CardDescription>
          </div>
          
          {isAuthenticated && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={userData.loading}
            >
              <RefreshCw className={`h-4 w-4 ${userData.loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {userData.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700 text-sm">{userData.error}</span>
            </div>
          </div>
        )}

        {rounds.length === 0 ? (
          <div className="text-center py-8">
            <GamepadIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-2">No game history yet</p>
            <p className="text-sm text-gray-400">
              {isAuthenticated 
                ? 'Your rounds will appear here as you play contests'
                : 'Sign in to see your complete game history'
              }
            </p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {rounds.map((round: any) => (
                <div key={round.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge 
                        variant={
                          round.status === 'won' || round.winnings > 0 
                            ? 'default' 
                            : round.status === 'lost' || round.winnings === 0 
                            ? 'destructive' 
                            : 'secondary'
                        }
                      >
                        {isAuthenticated ? round.status?.toUpperCase() : (round.winnings > 0 ? 'WON' : 'LOST')}
                      </Badge>
                      
                      <span className="text-sm font-medium">
                        {round.contestName || round.id || 'Contest'}
                      </span>
                      
                      {round.contestDate && (
                        <span className="text-xs text-gray-500">
                          {new Date(round.contestDate).toLocaleDateString()}
                        </span>
                      )}
                      
                      {!isAuthenticated && (
                        <span className="text-xs text-blue-500">Local Data</span>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      {round.totalPicks || round.picks?.length || 0} picks
                      {round.correctPicks !== undefined && (
                        <span> • {round.correctPicks} correct</span>
                      )}
                      {round.winPercentage !== undefined && (
                        <span> • {round.winPercentage.toFixed(1)}% accuracy</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {(round.actualPayout || round.winnings || 0) > 0 ? (
                        <span className="text-green-600">
                          +${round.actualPayout || round.winnings}
                        </span>
                      ) : (
                        <span className="text-red-600">
                          -${round.entryAmount || round.entry_amount || 0}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      ${round.entryAmount || round.entry_amount || 0} entry
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {/* Migration prompt for localStorage users */}
        {!isAuthenticated && userData.needsMigration && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800 font-medium">Save Your Progress</span>
            </div>
            <p className="text-blue-700 text-sm mb-3">
              Create an account to save your game history permanently and access it from any device.
            </p>
            <Button 
              size="sm" 
              onClick={userData.migrateData}
              disabled={userData.loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {userData.loading ? 'Migrating...' : 'Save to Account'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
