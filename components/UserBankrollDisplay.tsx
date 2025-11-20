/**
 * User Bankroll Display - Shows bankroll from relational database
 * REPLACES direct bankroll access from AppContext
 */
"use client";

import React from 'react';
import { useUserData } from '@/hooks/useUserData';
import { useApp } from '@/contexts/AppContext';
import { DollarSign, User, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function UserBankrollDisplay({ className }: { className?: string }) {
  const userData = useUserData();
  const { bankroll: fallbackBankroll } = useApp();

  // Use relational data if user authenticated, otherwise fall back to old system
  const bankroll = userData.profile?.id ? userData.bankroll : fallbackBankroll;
  const isAuthenticated = !!userData.profile?.id;
  const username = userData.profile?.username || userData.profile?.email;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">
                ${bankroll.toLocaleString()}
              </span>
            </div>
            
            {isAuthenticated && (
              <Badge variant="outline" className="bg-green-50 border-green-200">
                <User className="h-3 w-3 mr-1" />
                {username}
              </Badge>
            )}
            
            {!isAuthenticated && (
              <Badge variant="outline" className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Guest Mode
              </Badge>
            )}
          </div>
          
          <div className="text-sm text-gray-500">
            {isAuthenticated ? 'Cloud Saved' : 'Local Only'}
          </div>
        </div>
        
        {/* User stats if authenticated */}
        {isAuthenticated && userData.profile && (
          <div className="mt-3 pt-3 border-t">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="font-semibold">{userData.profile.totalEntries || 0}</div>
                <div className="text-gray-500">Games</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">${userData.profile.totalWinnings || 0}</div>
                <div className="text-gray-500">Won</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">{userData.profile.winPercentage || 0}%</div>
                <div className="text-gray-500">Win Rate</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Migration notice */}
        {!isAuthenticated && userData.needsMigration && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-blue-600">
              💡 Sign in to save your progress permanently
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
