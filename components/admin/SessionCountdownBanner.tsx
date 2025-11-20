"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionCountdownBannerProps {
  minutes: number;
  seconds: number;
  onRefresh?: () => void;
}

export function SessionCountdownBanner({ minutes, seconds, onRefresh }: SessionCountdownBannerProps) {
  const isLowTime = minutes < 5;
  const isVeryLowTime = minutes < 2;

  if (minutes === 0 && seconds === 0) {
    return null; // Don't show when time is up (reload will happen)
  }

  return (
    <Alert 
      className={`mb-4 ${
        isVeryLowTime 
          ? 'bg-red-500/10 border-red-500/20' 
          : isLowTime 
          ? 'bg-yellow-500/10 border-yellow-500/20'
          : 'bg-blue-500/10 border-blue-500/20'
      }`}
    >
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${
            isVeryLowTime ? 'text-red-500' : isLowTime ? 'text-yellow-500' : 'text-blue-500'
          }`} />
          <span className={`font-medium ${
            isVeryLowTime ? 'text-red-500' : isLowTime ? 'text-yellow-500' : 'text-blue-500'
          }`}>
            Session expires in: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="ml-4"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Now
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

