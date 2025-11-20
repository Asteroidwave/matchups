/**
 * User Dashboard Page - Complete user profile and data management
 * NEW PAGE: Shows the power of the relational database system
 */
"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { UserBankrollDisplay } from '@/components/UserBankrollDisplay';
import { UserRoundsHistory } from '@/components/UserRoundsHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Settings, 
  TrendingUp, 
  Trophy, 
  Calendar, 
  Target,
  AlertCircle,
  CheckCircle,
  GamepadIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function UserDashboardPage() {
  const { user } = useAuth();
  const userData = useUserData();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileUpdates, setProfileUpdates] = useState({
    username: '',
    displayName: '',
    favoriteTracks: []
  });

  useEffect(() => {
    if (userData.profile) {
      setProfileUpdates({
        username: userData.profile.username || '',
        displayName: userData.profile.displayName || '',
        favoriteTracks: userData.profile.favoriteTracks || []
      });
    }
  }, [userData.profile]);

  const handleUpdateProfile = async () => {
    const success = await userData.updateProfile(profileUpdates);
    if (success) {
      setEditingProfile(false);
      alert('✅ Profile updated successfully!');
    } else {
      alert('❌ Failed to update profile');
    }
  };

  if (!user?.id) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access your dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {userData.profile?.displayName || userData.profile?.username || 'Player'}!
          </p>
        </div>
        
        {userData.profile && (
          <Badge variant="outline" className="bg-green-50 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Data Synced
          </Badge>
        )}
      </div>

      {/* Migration Notice */}
      {userData.needsMigration && (
        <Alert className="bg-blue-50 border-blue-200">
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            We found your existing game data! 
            <Button 
              variant="link" 
              className="p-0 ml-2 text-blue-600"
              onClick={userData.migrateData}
              disabled={userData.loading}
            >
              {userData.loading ? 'Migrating...' : 'Migrate to Account →'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile</span>
              </CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <Input
                      value={profileUpdates.username}
                      onChange={(e) => setProfileUpdates(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Choose a username"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Display Name</label>
                    <Input
                      value={profileUpdates.displayName}
                      onChange={(e) => setProfileUpdates(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="How others see you"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button onClick={handleUpdateProfile}>
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setEditingProfile(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Username</label>
                      <div className="font-medium">
                        @{userData.profile?.username || 'Not set'}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-500">Display Name</label>
                      <div className="font-medium">
                        {userData.profile?.displayName || 'Not set'}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <div className="font-medium">{userData.profile?.email}</div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-500">Subscription</label>
                      <Badge variant="outline">
                        {userData.profile?.subscriptionTier || 'Free'}
                      </Badge>
                    </div>
                  </div>
                  
                  {userData.profile?.favoriteTracks && userData.profile.favoriteTracks.length > 0 && (
                    <div>
                      <label className="text-sm text-gray-500">Favorite Tracks</label>
                      <div className="flex space-x-2 mt-1">
                        {userData.profile.favoriteTracks.map((track) => (
                          <Badge key={track} variant="secondary">
                            {track}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => setEditingProfile(true)}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Performance Analytics</span>
              </CardTitle>
              <CardDescription>
                Your gaming statistics and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-2xl font-bold">
                    ${userData.profile?.totalWinnings || 0}
                  </div>
                  <div className="text-sm text-gray-500">Total Winnings</div>
                </div>
                
                <div className="text-center">
                  <GamepadIcon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">
                    {userData.profile?.totalEntries || 0}
                  </div>
                  <div className="text-sm text-gray-500">Games Played</div>
                </div>
                
                <div className="text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">
                    {userData.profile?.winPercentage || 0}%
                  </div>
                  <div className="text-sm text-gray-500">Win Rate</div>
                </div>
                
                <div className="text-center">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">
                    {userData.rounds.filter(r => {
                      const roundDate = new Date(r.createdAt);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return roundDate >= weekAgo;
                    }).length}
                  </div>
                  <div className="text-sm text-gray-500">This Week</div>
                </div>
              </div>
              
              {/* Recent performance trend */}
              {userData.rounds.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Recent Performance</h4>
                  <div className="flex space-x-1">
                    {userData.rounds.slice(0, 10).map((round, index) => (
                      <div
                        key={round.id}
                        className={`w-3 h-3 rounded-full ${
                          round.status === 'won' || round.actualPayout > 0
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                        title={`Round ${index + 1}: ${round.status} - $${round.actualPayout || 0}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Last 10 rounds • Green = Win, Red = Loss
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <UserBankrollDisplay />
        </div>
      </div>
    </div>
  );
}
