"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ConnectionComprehensiveStats, getConnectionComprehensiveStats } from "@/lib/parseJson";

interface ConnectionStatsTabProps {
  connectionName: string;
  role: 'jockey' | 'trainer' | 'sire';
  trackCodes: string[];
}

// FP1K Performance Bar Chart Component (DraftKings style)
function AvpaPerformanceChart({ 
  data, 
  avgAvpa 
}: { 
  data: { date: string; avpa: number; races: number; points: number; salary: number }[];
  avgAvpa: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-secondary)]">
        No performance data available
      </div>
    );
  }

  const maxAvpa = Math.max(...data.map(d => d.avpa), avgAvpa) * 1.2;
  const barAreaHeight = 100; // Increased height for better tooltip visibility
  const avgLineOffset = maxAvpa > 0 ? (avgAvpa / maxAvpa) * barAreaHeight : 0;

  return (
    <div className="relative pt-4">
      {/* Header with label and yearly average */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-medium text-[var(--text-primary)]">Recent FP1K Performance</span>
        <span className="text-[12px] text-[var(--text-secondary)]">
          Year Avg: <span className="font-bold text-orange-400">{avgAvpa.toFixed(1)}</span>
        </span>
      </div>
      
      {/* Chart area with bars - full width */}
      <div className="relative">
        {/* Average line spanning full width */}
        <div 
          className="absolute left-0 right-0 border-t-2 border-dashed border-orange-400 z-10 pointer-events-none"
          style={{ bottom: `${avgLineOffset + 28}px` }}
        >
          <span className="absolute -right-1 -top-4 text-[10px] text-orange-400 font-medium bg-[var(--surface-2)] px-1 rounded">
            {avgAvpa.toFixed(1)}
          </span>
        </div>
        
        {/* Bars grid - full width */}
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((item, idx) => {
            const barHeight = maxAvpa > 0 ? Math.max((item.avpa / maxAvpa) * barAreaHeight, 4) : 4;
            const isAboveAvg = item.avpa >= avgAvpa;
            const formattedDate = new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { 
              month: '2-digit', 
              day: '2-digit' 
            });
            
            // Determine tooltip position based on bar index
            const isLeftEdge = idx <= 1;
            const isRightEdge = idx >= data.length - 2;
            const tooltipAlign = isLeftEdge ? 'left-0' : isRightEdge ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const arrowAlign = isLeftEdge ? 'left-4' : isRightEdge ? 'right-4' : 'left-1/2 -translate-x-1/2';
            
            return (
              <div 
                key={`avpa-${item.date}-${idx}`} 
                className="flex flex-col items-center relative group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Hover tooltip - smart positioning */}
                {hoveredIdx === idx && (
                  <div className={`absolute bottom-full mb-2 ${tooltipAlign} z-30 bg-[var(--surface-3)] border border-[var(--content-15)] rounded-lg p-3 shadow-lg min-w-[160px]`}>
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] mb-2 text-center border-b border-[var(--content-15)] pb-2">
                      {new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <span className="text-[var(--text-tertiary)]">Horses</span>
                      <span className="text-[var(--text-primary)] font-medium text-right">{item.races}</span>
                      <span className="text-[var(--text-tertiary)]">Total Pts</span>
                      <span className="text-[var(--text-primary)] font-semibold text-right">{item.points.toFixed(1)}</span>
                      <span className="text-[var(--text-tertiary)]">Salary</span>
                      <span className="text-[var(--text-primary)] font-medium text-right">${item.salary.toLocaleString()}</span>
                      <span className="text-[var(--text-tertiary)]">FP1K</span>
                      <span className={`font-bold text-right ${isAboveAvg ? 'text-orange-400' : 'text-gray-400'}`}>{item.avpa.toFixed(2)}</span>
                    </div>
                    {/* Tooltip arrow pointing down */}
                    <div className={`absolute top-full ${arrowAlign} border-4 border-transparent border-t-[var(--surface-3)]`} />
                  </div>
                )}
                
                {/* FP1K label above bar - colored based on avg */}
                <span className={`text-[11px] font-semibold mb-1 ${
                  isAboveAvg ? 'text-orange-400' : 'text-[var(--text-secondary)]'
                }`}>
                  {item.avpa.toFixed(1)}
                </span>
                
                {/* Bar container */}
                <div className="relative w-full" style={{ height: `${barAreaHeight}px` }}>
                  {/* Bar */}
                  <div 
                    className={`absolute bottom-0 left-1 right-1 rounded-t-sm transition-all ${
                      isAboveAvg ? 'bg-orange-500' : 'bg-gray-500'
                    } ${hoveredIdx === idx ? 'opacity-100' : 'opacity-80'}`}
                    style={{ height: `${barHeight}px` }}
                  />
                </div>
                
                {/* Date label - more prominent */}
                <span className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                  {formattedDate}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Stats Table Component (TwinSpires style)
function StatsTable({ 
  title,
  headers,
  rows,
  highlightFirst = false,
}: { 
  title: string;
  headers: string[];
  rows: (string | number)[][];
  highlightFirst?: boolean;
}) {
  return (
    <div className="mb-6">
      <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2 px-1">
        {title}
      </h4>
      <div className="border border-[var(--content-15)] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--surface-2)] border-b border-[var(--content-15)]">
          <div className="grid gap-2 px-3 py-2" style={{ 
            gridTemplateColumns: `minmax(100px, 1.5fr) repeat(${headers.length - 1}, 1fr)` 
          }}>
            {headers.map((header, idx) => (
              <div 
                key={idx} 
                className={`text-[11px] font-semibold text-[var(--text-tertiary)] uppercase ${
                  idx > 0 ? 'text-right' : ''
                }`}
              >
                {header}
              </div>
            ))}
          </div>
        </div>
        
        {/* Rows */}
        <div className="divide-y divide-[var(--content-15)]">
          {rows.map((row, rowIdx) => (
            <div 
              key={rowIdx} 
              className={`grid gap-2 px-3 py-2 ${
                highlightFirst && rowIdx === 0 ? 'bg-[var(--brand)]/5' : ''
              }`}
              style={{ 
                gridTemplateColumns: `minmax(100px, 1.5fr) repeat(${headers.length - 1}, 1fr)` 
              }}
            >
              {row.map((cell, cellIdx) => (
                <div 
                  key={cellIdx} 
                  className={`text-[13px] ${
                    cellIdx > 0 ? 'text-right' : ''
                  } ${
                    cellIdx === 0 
                      ? 'font-medium text-[var(--text-primary)]' 
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {typeof cell === 'number' 
                    ? (cell % 1 === 0 ? cell : cell.toFixed(1))
                    : cell
                  }
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConnectionStatsTab({ connectionName, role, trackCodes }: ConnectionStatsTabProps) {
  const [stats, setStats] = useState<ConnectionComprehensiveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getConnectionComprehensiveStats(connectionName, role, trackCodes);
        setStats(data);
      } catch (err) {
        console.error('Failed to load connection stats:', err);
        setError('Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [connectionName, role, trackCodes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
        <span className="ml-2 text-[var(--text-secondary)]">Loading stats...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)]">
        {error || 'No stats available'}
      </div>
    );
  }

  // Prepare key stats table rows
  const keyStatsHeaders = ['Period', 'Starts', 'Win', 'Place', 'Show', 'Win%', 'ITM%', 'FP1K'];
  const keyStatsRows = stats.keyStats.map(s => [
    s.period,
    s.starts,
    s.wins,
    s.places,
    s.shows,
    `${s.winPct.toFixed(0)}%`,
    `${s.itmPct.toFixed(0)}%`,
    s.avpa.toFixed(2),
  ]);

  // Prepare surface stats table rows
  const surfaceHeaders = ['Surface', 'Starts', 'Win%', 'ITM%', 'Avg Pts', 'FP1K'];
  const surfaceRows = stats.surfaceStats
    .filter(s => s.starts > 0)
    .map(s => [
      s.surface,
      s.starts,
      `${s.winPct.toFixed(0)}%`,
      `${s.itmPct.toFixed(0)}%`,
      s.avgPoints.toFixed(1),
      s.avpa.toFixed(2),
    ]);

  // Prepare odds stats table rows - with ITM%
  const oddsHeaders = ['Odds Range', 'Starts', 'Win%', 'ITM%', 'Avg Pts', 'FP1K'];
  const oddsRows = stats.oddsStats
    .filter(s => s.starts > 0)
    .map(s => [
      s.label,
      s.starts,
      `${s.winPct.toFixed(0)}%`,
      `${s.itmPct?.toFixed(0) || 0}%`,
      s.avgPoints.toFixed(1),
      s.avpa.toFixed(2),
    ]);

  // Prepare field size stats table rows
  const fieldSizeHeaders = ['Field Size', 'Starts', 'Win%', 'ITM%', 'Avg Pts'];
  const fieldSizeRows = stats.fieldSizeStats
    .filter(s => s.starts > 0)
    .map(s => [
      s.fieldSize,
      s.starts,
      `${s.winPct.toFixed(0)}%`,
      `${s.itmPct.toFixed(0)}%`,
      s.avgPoints.toFixed(1),
    ]);

  // Prepare FP1K chart data with points and salary for tooltip
  const avpaChartData = stats.recentPerformance.map(p => ({
    date: p.date,
    avpa: p.avpa,
    races: p.races,
    points: p.points,
    salary: p.salary,
  }));

  return (
    <div className="px-5 py-4">
      {/* FP1K Performance Graph */}
      <div className="mb-6 p-4 bg-[var(--surface-2)] rounded-lg">
        <AvpaPerformanceChart 
          data={avpaChartData} 
          avgAvpa={stats.overallAvgAvpa}
        />
      </div>

      {/* Key Stats */}
      <StatsTable
        title="Key Stats"
        headers={keyStatsHeaders}
        rows={keyStatsRows}
        highlightFirst
      />

      {/* Surface Stats */}
      {surfaceRows.length > 0 && (
        <StatsTable
          title="Surface Breakdown"
          headers={surfaceHeaders}
          rows={surfaceRows}
        />
      )}

      {/* Odds-Based Stats */}
      {oddsRows.length > 0 && (
        <StatsTable
          title="Performance by Odds"
          headers={oddsHeaders}
          rows={oddsRows}
        />
      )}

      {/* Field Size Stats */}
      {fieldSizeRows.length > 0 && (
        <StatsTable
          title="Performance by Field Size"
          headers={fieldSizeHeaders}
          rows={fieldSizeRows}
        />
      )}

      {/* Distance Stats */}
      {stats.distanceStats && stats.distanceStats.filter(s => s.starts > 0).length > 0 && (
        <StatsTable
          title="Performance by Distance"
          headers={['Distance', 'Starts', 'Win%', 'ITM%', 'Avg Pts', 'FP1K']}
          rows={stats.distanceStats.filter(s => s.starts > 0).map(s => [
            s.distance,
            s.starts,
            `${s.winPct.toFixed(0)}%`,
            `${s.itmPct.toFixed(0)}%`,
            s.avgPoints.toFixed(1),
            s.avpa.toFixed(2),
          ])}
        />
      )}

      {/* Post Position Stats */}
      {stats.postPositionStats && stats.postPositionStats.filter(s => s.starts > 0).length > 0 && (
        <StatsTable
          title="Performance by Post Position"
          headers={['Position', 'Starts', 'Win%', 'Avg Pts', 'FP1K']}
          rows={stats.postPositionStats.filter(s => s.starts > 0).map(s => [
            s.position,
            s.starts,
            `${s.winPct.toFixed(0)}%`,
            s.avgPoints.toFixed(1),
            s.avpa.toFixed(2),
          ])}
        />
      )}

      {/* Consistency Card - Full Width with Range Context */}
      {stats.consistencyScore && (
        <div className="p-4 bg-[var(--surface-2)] rounded-lg border border-[var(--content-15)] mb-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">Consistency</h4>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                How predictable is this connection? Lower variation = safer pick.
              </p>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
              stats.consistencyScore.rating === 'Very Consistent' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
              stats.consistencyScore.rating === 'Consistent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
              stats.consistencyScore.rating === 'Variable' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            }`}>
              {stats.consistencyScore.rating}
            </span>
          </div>
          
          {/* FP1K Range Visual with Prominent Average */}
          <div className="bg-[var(--surface-1)] rounded p-3 mb-3">
            {/* Prominent Year Average */}
            <div className="text-center mb-3 pb-3 border-b border-[var(--content-15)]">
              <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Year Average FP1K</div>
              <div className="text-[28px] font-bold text-orange-400">{stats.overallAvgAvpa.toFixed(1)}</div>
            </div>
            
            {/* Range visualization */}
            <div className="text-[10px] text-[var(--text-tertiary)] mb-2 text-center">Expected Range (±1 Std Dev)</div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-[10px] text-red-400 mb-0.5">Low Day</div>
                <div className="text-[16px] font-bold text-red-400">
                  {Math.max(0, stats.overallAvgAvpa - stats.consistencyScore.avpaStdDev).toFixed(1)}
                </div>
              </div>
              <div className="flex-1 mx-4 h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative">
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-orange-400 rounded-full"
                  style={{ left: '50%', transform: 'translate(-50%, -50%)' }}
                />
              </div>
              <div className="text-center">
                <div className="text-[10px] text-green-400 mb-0.5">High Day</div>
                <div className="text-[16px] font-bold text-green-400">
                  {(stats.overallAvgAvpa + stats.consistencyScore.avpaStdDev).toFixed(1)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)]">FP1K Variation</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">±{stats.consistencyScore.avpaStdDev.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Points Variation</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">±{stats.consistencyScore.pointsStdDev.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Jockey/Trainer Combo Stats - Only for jockeys and trainers */}
      {stats.comboStats && stats.comboStats.combos.length > 0 && role !== 'sire' && (
        <StatsTable
          title="Best Jockey-Trainer Combo"
          headers={['Partner', 'Starts', 'Win%', 'Avg Pts', 'FP1K']}
          rows={stats.comboStats.combos.map(c => [
            c.name,
            c.starts,
            `${c.winPct.toFixed(0)}%`,
            c.avgPoints.toFixed(1),
            c.avpa.toFixed(2),
          ])}
        />
      )}

      {/* Favorite Performance Cards */}
      {stats.favoriteStats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* On Favourites */}
          <div className="p-4 bg-[var(--surface-2)] rounded-lg border border-[var(--content-15)]">
            <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2">On Favourites</h4>
            <p className="text-[10px] text-[var(--text-tertiary)] mb-3 leading-tight">
              Performance when riding/training horses at low odds (&lt;3/1) - the public expects them to win.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--text-secondary)]">Times on Favourites</span>
                <span className="text-[12px] font-medium text-[var(--text-primary)]">
                  {stats.favoriteStats.asFavorite.starts}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--text-secondary)]">Win Rate</span>
                <span className="text-[12px] font-semibold text-green-500">
                  {stats.favoriteStats.asFavorite.winPct.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--text-secondary)]">FP1K on Favs</span>
                <span className="text-[12px] font-medium text-[var(--text-primary)]">
                  {stats.favoriteStats.asFavorite.avpa.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Not On Favourites */}
          <div className="p-4 bg-[var(--surface-2)] rounded-lg border border-[var(--content-15)]">
            <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2">Not On Favourites</h4>
            <p className="text-[10px] text-[var(--text-tertiary)] mb-3 leading-tight">
              Performance at higher odds (3/1+). Higher win rate here = good at finding value/upsets.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--text-secondary)]">Wins at 3/1+</span>
                <span className="text-[12px] font-semibold text-orange-500">
                  {stats.favoriteStats.beatFavoriteCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--text-secondary)]">Win Rate</span>
                <span className="text-[12px] font-medium text-[var(--text-primary)]">
                  {stats.favoriteStats.beatFavoritePct.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--text-secondary)]">FP1K as Longshot</span>
                <span className="text-[12px] font-medium text-[var(--text-primary)]">
                  {stats.favoriteStats.notFavorite.avpa.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Odds Performance */}
      {stats.finalOddsStats && (stats.finalOddsStats.steamCount > 0 || stats.finalOddsStats.driftCount > 0) && (
        <div className="mb-6">
          <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2 px-1">
            Market Movement (ML → Final Odds)
          </h4>
          
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-2 bg-[var(--surface-2)] rounded text-center">
              <div className="text-[11px] text-[var(--text-tertiary)]">Avg ML Odds</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                {stats.finalOddsStats.avgMlOdds.toFixed(1)}/1
              </div>
            </div>
            <div className="p-2 bg-[var(--surface-2)] rounded text-center">
              <div className="text-[11px] text-[var(--text-tertiary)]">Avg Final Odds</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                {stats.finalOddsStats.avgFinalOdds.toFixed(1)}/1
              </div>
            </div>
            <div className="p-2 bg-[var(--surface-2)] rounded text-center">
              <div className="text-[11px] text-[var(--text-tertiary)]">Drift</div>
              <div className={`text-[14px] font-semibold ${stats.finalOddsStats.driftPct > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.finalOddsStats.driftPct > 0 ? '+' : ''}{stats.finalOddsStats.driftPct.toFixed(1)}%
              </div>
            </div>
          </div>
          
          {/* Steam vs Drift Performance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-semibold text-green-500">↓ STEAM</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">(odds shortened)</span>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] space-y-1">
                <div className="flex justify-between">
                  <span>Races</span>
                  <span className="text-[var(--text-primary)]">{stats.finalOddsStats.steamCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Win%</span>
                  <span className="text-[var(--text-primary)]">{stats.finalOddsStats.performanceWhenSteam.winPct.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Pts</span>
                  <span className="text-[var(--text-primary)]">{stats.finalOddsStats.performanceWhenSteam.avgPoints.toFixed(1)}</span>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-semibold text-red-500">↑ DRIFT</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">(odds lengthened)</span>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] space-y-1">
                <div className="flex justify-between">
                  <span>Races</span>
                  <span className="text-[var(--text-primary)]">{stats.finalOddsStats.driftCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Win%</span>
                  <span className="text-[var(--text-primary)]">{stats.finalOddsStats.performanceWhenDrift.winPct.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Pts</span>
                  <span className="text-[var(--text-primary)]">{stats.finalOddsStats.performanceWhenDrift.avgPoints.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* ML vs Final Odds Chart */}
          {stats.finalOddsStats.oddsComparisonChart && stats.finalOddsStats.oddsComparisonChart.length > 0 && (
            <div className="mt-4 p-3 bg-[var(--surface-2)] rounded-lg">
              <div className="text-[12px] font-medium text-[var(--text-primary)] mb-3">ML vs Final Odds Over Time</div>
              <div className="relative h-[120px]">
                {/* Chart grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="border-b border-[var(--content-15)] border-dashed" />
                  ))}
                </div>
                
                {/* Bars */}
                <div className="relative h-full flex items-end justify-between gap-1 px-1">
                  {stats.finalOddsStats.oddsComparisonChart.map((day, idx) => {
                    const maxOdds = Math.max(
                      ...stats.finalOddsStats.oddsComparisonChart.map(d => Math.max(d.mlOdds, d.finalOdds))
                    ) * 1.2 || 10;
                    const mlHeight = (day.mlOdds / maxOdds) * 100;
                    const finalHeight = (day.finalOdds / maxOdds) * 100;
                    const isSteam = day.finalOdds < day.mlOdds;
                    const formattedDate = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { 
                      month: '2-digit', 
                      day: '2-digit' 
                    });
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 bg-[var(--surface-3)] border border-[var(--content-15)] rounded p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity min-w-[120px] pointer-events-none">
                          <div className="text-[10px] font-medium text-[var(--text-primary)] mb-1">{formattedDate}</div>
                          <div className="text-[9px] space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-blue-400">ML:</span>
                              <span>{day.mlOdds.toFixed(1)}/1</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-orange-400">Final:</span>
                              <span>{day.finalOdds.toFixed(1)}/1</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Horses:</span>
                              <span>{day.horses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isSteam ? 'text-green-400' : 'text-red-400'}>
                                {isSteam ? '↓ Steam' : '↑ Drift'}:
                              </span>
                              <span>{isSteam ? day.steamCount : day.driftCount}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Bar group */}
                        <div className="w-full flex justify-center gap-0.5 h-[100px]">
                          {/* ML Odds bar */}
                          <div 
                            className="w-[6px] bg-blue-500 rounded-t-sm transition-all"
                            style={{ height: `${mlHeight}%` }}
                          />
                          {/* Final Odds bar */}
                          <div 
                            className={`w-[6px] rounded-t-sm transition-all ${isSteam ? 'bg-green-500' : 'bg-orange-500'}`}
                            style={{ height: `${finalHeight}%` }}
                          />
                        </div>
                        
                        {/* Date label */}
                        <span className="text-[8px] text-[var(--text-tertiary)] mt-1">{formattedDate}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-sm" />
                  <span className="text-[var(--text-tertiary)]">ML Odds</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-sm" />
                  <span className="text-[var(--text-tertiary)]">Final (Steam)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-sm" />
                  <span className="text-[var(--text-tertiary)]">Final (Drift)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data source note */}
      <div className="mt-4 text-center text-[11px] text-[var(--text-tertiary)]">
        Stats from {stats.tracksIncluded?.join(', ') || trackCodes.join(', ')} • 2025 Season
      </div>
    </div>
  );
}
