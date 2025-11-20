"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Circle, Trophy, MapPin } from "lucide-react";

interface TrackPreviewProps {
  preview: {
    races_count?: number;
    horses_count?: number;
    non_scratched_count?: number;
    jockeys_count?: number;
    trainers_count?: number;
    sires_count?: number;
    post_times?: string[];
    first_post_time?: string | null;
    last_post_time?: string | null;
    lock_time?: string | null;
    track_code?: string;
    date?: string;
  };
  trackName?: string;
}

export function TrackPreview({ preview, trackName }: TrackPreviewProps) {
  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const stats = [
    {
      label: 'Races',
      value: preview.races_count || 0,
      icon: Trophy,
      color: 'text-blue-600',
    },
    {
      label: 'Total Horses',
      value: preview.horses_count || 0,
      icon: Circle,
      color: 'text-green-600',
    },
    {
      label: 'Non-Scratched',
      value: preview.non_scratched_count || 0,
      icon: Users,
      color: 'text-purple-600',
    },
    {
      label: 'Jockeys',
      value: preview.jockeys_count || 0,
      icon: Users,
      color: 'text-orange-600',
    },
    {
      label: 'Trainers',
      value: preview.trainers_count || 0,
      icon: Users,
      color: 'text-red-600',
    },
    {
      label: 'Sires',
      value: preview.sires_count || 0,
      icon: Circle,
      color: 'text-indigo-600',
    },
  ];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <MapPin className="w-6 h-6 text-[var(--brand)]" />
        <div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            {trackName || preview.track_code}
          </h3>
          {preview.date && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Calendar className="w-4 h-4" />
              <span>{new Date(preview.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--content-15)] border border-[var(--content-16)]"
            >
              <Icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <div className="text-sm text-[var(--text-tertiary)]">{stat.label}</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">
                  {stat.value.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {preview.post_times && preview.post_times.length > 0 && (
        <div className="pt-4 border-t border-[var(--content-16)]">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            Post Times
          </div>
          <div className="flex flex-wrap gap-2">
            {preview.post_times.slice(0, 10).map((time, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {formatDate(time)}
              </Badge>
            ))}
            {preview.post_times.length > 10 && (
              <Badge variant="outline" className="text-xs">
                +{preview.post_times.length - 10} more
              </Badge>
            )}
          </div>
          {preview.first_post_time && preview.last_post_time && (
            <div className="mt-2 text-xs text-[var(--text-tertiary)] space-y-1">
              <div>First: {formatDate(preview.first_post_time)}</div>
              <div>Last: {formatDate(preview.last_post_time)}</div>
              {preview.lock_time && (
                <div>Entries lock at: {formatDate(preview.lock_time)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

