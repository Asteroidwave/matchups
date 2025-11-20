/**
 * User Dashboard - Shows user data from relational database
 * REPLACES localStorage-based components
 */
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUserData } from "@/hooks/useUserData";
import { User, TrendingUp, Trophy, DollarSign, GamepadIcon } from "lucide-react";

export function UserDashboard() {
  const { 
    profile, 
    bankroll, 
    rounds, 
    loading, 
    error,
    loadUserData,
    needsMigration,
    migrateData 
  } = useUserData();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p>Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-800">Error: {error}</p>
            <Button onClick={loadUserData} className="mt-2">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-4">
            <p>No user profile found. Please log in.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Migration Notice */}
      {needsMigration && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">Data Migration Available</CardTitle>
            <CardDescription className="text-blue-600">
              We found your existing game data that can be transferred to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={migrateData} className="bg-blue-600 hover:bg-blue-700">
              Migrate My Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>
              {profile.displayName || profile.username || 'User Profile'}
            </span>
          </CardTitle>
          <CardDescription>
            @{profile.username || 'no_username'} • {profile.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">${bankroll}</div>
            <div className="text-sm text-gray-500">Current Bankroll</div>
          </div>
          
          <div className="text-center">
            <Trophy className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">${profile.totalWinnings || 0}</div>
            <div className="text-sm text-gray-500">Total Winnings</div>
          </div>
          
          <div className="text-center">
            <GamepadIcon className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{profile.totalEntries || 0}</div>
            <div className="text-sm text-gray-500">Games Played</div>
          </div>
          
          <div className="text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{profile.winPercentage || 0}%</div>
            <div className="text-sm text-gray-500">Win Rate</div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Rounds Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Game History</CardTitle>
          <CardDescription>
            Your latest contest entries and results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GamepadIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No game history yet.</p>
              <p className="text-sm">Your rounds will appear here as you play contests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.slice(0, 5).map((round) => (
                <div key={round.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={round.status === 'won' ? 'default' : round.status === 'lost' ? 'destructive' : 'secondary'}
                      >
                        {round.status.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{round.contestName}</span>
                      <span className="text-sm text-gray-500">{round.contestDate}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {round.correctPicks}/{round.totalPicks} picks correct • {round.winPercentage.toFixed(1)}% accuracy
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {round.actualPayout > 0 ? (
                        <span className="text-green-600">+${round.actualPayout}</span>
                      ) : (
                        <span className="text-red-600">-${round.entryAmount}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      ${round.entryAmount} entry
                    </div>
                  </div>
                </div>
              ))}
              
              {rounds.length > 5 && (
                <div className="text-center pt-4">
                  <Button variant="outline" onClick={loadUserData}>
                    View All ({rounds.length} total)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Preferences */}
      {profile.favoriteTracks && profile.favoriteTracks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium">Favorite Tracks:</label>
              <div className="flex space-x-2 mt-2">
                {profile.favoriteTracks.map((track) => (
                  <Badge key={track} variant="outline">
                    {track}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
