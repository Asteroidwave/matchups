"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CountdownTimerProps {
  targetTime: string | null; // ISO datetime string
  onExpire?: () => void;
  showIcon?: boolean;
  variant?: "default" | "destructive" | "secondary";
}

export function CountdownTimer({ 
  targetTime, 
  onExpire,
  showIcon = true,
  variant = "default"
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!targetTime) {
      setTimeLeft("");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Closed");
        setIsExpired(true);
        if (onExpire && !isExpired) {
          onExpire();
        }
        return;
      }

      // Calculate time components
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format display - always show seconds
      let display = "";
      if (days > 0) {
        display = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        display = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        display = `${minutes}m ${seconds}s`;
      } else {
        display = `${seconds}s`;
      }

      setTimeLeft(display);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onExpire, isExpired]);

  if (!targetTime || !timeLeft) {
    return null;
  }

  return (
    <Badge 
      variant={isExpired ? "destructive" : variant as any}
      className="flex items-center gap-1.5"
    >
      {showIcon && <Clock className="w-3 h-3" />}
      {timeLeft}
    </Badge>
  );
}
