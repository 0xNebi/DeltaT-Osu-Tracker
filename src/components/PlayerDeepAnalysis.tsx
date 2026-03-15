import { useMemo, useState } from 'react';
import { useMatchContext } from '../context/MatchContext';
import { FiArrowLeft, FiAward, FiBarChart2, FiTrendingUp, FiTarget, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { format } from 'date-fns';
import { StarRatingDisplay } from '../utils/starRating';


interface PlayerDeepAnalysisProps {
  playerId: number;
  onBack: () => void;
}

interface ModStats {
  mod: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgAccuracy: number;
  avgScore: number;
  bestAccuracy: number;
  bestScore: number;
}

interface MapPlayRecord {
  beatmapId: number;
  beatmapTitle: string;
  difficulty: string;
  starRating: number;
  timesPlayed: number;
  bestAccuracy: number;
  bestScore: number;
  avgAccuracy: number;
  lastPlayed: string;
  plays: PerformanceRecord[]; 
}

interface PerformanceRecord {
  matchId: number;
  matchName: string;
  beatmapTitle: string;
  difficulty: string;
  starRating: number;
  modAdjustedStarRating?: number; 
  timestamp: string;
  score: number;
  accuracy: number;
  combo: number;
  rank: string;
  mods: string[];
  position: number;
  totalPlayers: number;
}

const PlayerDeepAnalysis = ({ playerId, onBack }: PlayerDeepAnalysisProps) => {
  const { matches, playerLookup, settings } = useMatchContext();
  const player = playerLookup[playerId];
  
  
  const [expandedMaps, setExpandedMaps] = useState<Set<number>>(new Set());

  
  const playerPlays = useMemo(() => {
    const plays: PerformanceRecord[] = [];
    
    matches.forEach((match) => {
      match.games.forEach((game) => {
        const playerScore = game.scores?.find((s) => s.userId === playerId);
        if (!playerScore || !game.beatmap) return;

        
        const sortedScores = [...(game.scores || [])].sort((a, b) => {
          if (settings.useAccuracyForWins) {
            return (b.accuracy ?? 0) - (a.accuracy ?? 0);
          }
          return (b.score ?? 0) - (a.score ?? 0);
        });
        
        const position = sortedScores.findIndex((s) => s.userId === playerId) + 1;

        plays.push({
          matchId: match.id,
          matchName: match.name,
          beatmapTitle: game.beatmap.title,
          difficulty: game.beatmap.difficulty || 'Unknown',
          starRating: game.beatmap.starRating || 0,
          timestamp: game.startTime || match.startTime || '',
          score: playerScore.score,
          accuracy: playerScore.accuracy,
          combo: playerScore.maxCombo || 0,
          rank: playerScore.rank || playerScore.grade || 'F',
          mods: playerScore.mods || [],
          position,
          totalPlayers: game.scores?.length || 0,
        });
      });
    });

    return plays.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [matches, playerId, settings.useAccuracyForWins]);

  
  const modStats = useMemo(() => {
    const modMap = new Map<string, {
      plays: PerformanceRecord[];
      wins: number;
      losses: number;
    }>();

    playerPlays.forEach((play) => {
      const modKey = play.mods.length > 0 ? play.mods.join('+') : 'NoMod';
      const existing = modMap.get(modKey) || { plays: [], wins: 0, losses: 0 };
      
      existing.plays.push(play);
      if (play.position === 1) {
        existing.wins++;
      } else {
        existing.losses++;
      }
      
      modMap.set(modKey, existing);
    });

    const stats: ModStats[] = [];
    modMap.forEach((data, mod) => {
      const avgAccuracy = data.plays.reduce((sum, p) => sum + p.accuracy, 0) / data.plays.length;
      const avgScore = data.plays.reduce((sum, p) => sum + p.score, 0) / data.plays.length;
      const bestAccuracy = Math.max(...data.plays.map((p) => p.accuracy));
      const bestScore = Math.max(...data.plays.map((p) => p.score));

      stats.push({
        mod,
        gamesPlayed: data.plays.length,
        wins: data.wins,
        losses: data.losses,
        winRate: data.wins / data.plays.length,
        avgAccuracy,
        avgScore,
        bestAccuracy,
        bestScore,
      });
    });

    return stats.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }, [playerPlays]);

  
  const mapStats = useMemo(() => {
    const mapMap = new Map<string, {
      beatmapTitle: string;
      difficulty: string;
      starRating: number;
      plays: PerformanceRecord[];
    }>();

    playerPlays.forEach((play) => {
      
      const mapKey = `${play.beatmapTitle}|${play.difficulty}`;
      const existing = mapMap.get(mapKey) || {
        beatmapTitle: play.beatmapTitle,
        difficulty: play.difficulty,
        starRating: play.starRating,
        plays: [],
      };
      
      existing.plays.push(play);
      mapMap.set(mapKey, existing);
    });

    const stats: MapPlayRecord[] = [];
    let idCounter = 0;
    mapMap.forEach((data) => {
      const avgAccuracy = data.plays.reduce((sum, p) => sum + p.accuracy, 0) / data.plays.length;
      const bestAccuracy = Math.max(...data.plays.map((p) => p.accuracy));
      const bestScore = Math.max(...data.plays.map((p) => p.score));
      const lastPlayed = data.plays[0].timestamp;

      stats.push({
        beatmapId: idCounter++,
        beatmapTitle: data.beatmapTitle,
        difficulty: data.difficulty,
        starRating: data.starRating,
        timesPlayed: data.plays.length,
        bestAccuracy,
        bestScore,
        avgAccuracy,
        lastPlayed,
        plays: data.plays,
      });
    });

    return stats.sort((a, b) => b.timesPlayed - a.timesPlayed);
  }, [playerPlays]);

  
  const overallStats = useMemo(() => {
    const totalGames = playerPlays.length;
    const totalWins = playerPlays.filter((p) => p.position === 1).length;
    const totalLosses = totalGames - totalWins;
    const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    
    const avgAccuracy = totalGames > 0
      ? playerPlays.reduce((sum, p) => sum + p.accuracy, 0) / totalGames
      : 0;
    
    const avgScore = totalGames > 0
      ? playerPlays.reduce((sum, p) => sum + p.score, 0) / totalGames
      : 0;

    const bestAccuracy = totalGames > 0
      ? Math.max(...playerPlays.map((p) => p.accuracy))
      : 0;

    const bestScore = totalGames > 0
      ? Math.max(...playerPlays.map((p) => p.score))
      : 0;

    const avgPosition = totalGames > 0
      ? playerPlays.reduce((sum, p) => sum + p.position, 0) / totalGames
      : 0;

    const topPositions = {
      first: totalWins,
      second: playerPlays.filter((p) => p.position === 2).length,
      third: playerPlays.filter((p) => p.position === 3).length,
    };

    return {
      totalGames,
      totalWins,
      totalLosses,
      winRate,
      avgAccuracy,
      avgScore,
      bestAccuracy,
      bestScore,
      avgPosition,
      topPositions,
    };
  }, [playerPlays]);

  
  const bestPerformances = useMemo(() => {
    return [...playerPlays]
      .map(play => ({
        ...play,
        
        
        performanceScore: (play.accuracy / 100) * (Math.min(play.starRating, 11) / 11) * 100
      }))
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10);
  }, [playerPlays]);

  
  const accuracyDistribution = useMemo(() => {
    const ranges = [
      { label: '95-100%', min: 95, max: 100, count: 0, color: 'bg-green-500' },
      { label: '90-95%', min: 90, max: 95, count: 0, color: 'bg-cyan-500' },
      { label: '85-90%', min: 85, max: 90, count: 0, color: 'bg-blue-500' },
      { label: '80-85%', min: 80, max: 85, count: 0, color: 'bg-yellow-500' },
      { label: '<80%', min: 0, max: 80, count: 0, color: 'bg-red-500' },
    ];

    playerPlays.forEach((play) => {
      const range = ranges.find((r) => play.accuracy >= r.min && play.accuracy < r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [playerPlays]);

  
  const performanceByStarRating = useMemo(() => {
    const ranges = [
      { label: '0-5★', min: 0, max: 5, plays: [] as PerformanceRecord[] },
      { label: '5-7★', min: 5, max: 7, plays: [] as PerformanceRecord[] },
      { label: '7-9★', min: 7, max: 9, plays: [] as PerformanceRecord[] },
      { label: '9-11★', min: 9, max: 11, plays: [] as PerformanceRecord[] },
      { label: '11-12★', min: 11, max: 12, plays: [] as PerformanceRecord[] },
      { label: '12-13★', min: 12, max: 13, plays: [] as PerformanceRecord[] },
      { label: '13-14★', min: 13, max: 14, plays: [] as PerformanceRecord[] },
      { label: '14-15★', min: 14, max: 15, plays: [] as PerformanceRecord[] },
      { label: '15+★', min: 15, max: 999, plays: [] as PerformanceRecord[] },
    ];

    playerPlays.forEach((play) => {
      
      let adjustedSR = play.starRating;
      if (play.mods && play.mods.length > 0) {
        let multiplier = 1.0;
        if (play.mods.includes('HR')) multiplier *= 1.10;
        if (play.mods.includes('DT') || play.mods.includes('NC')) multiplier *= 1.50;
        if (play.mods.includes('HT')) multiplier *= 0.70;
        if (play.mods.includes('EZ')) multiplier *= 0.50;
        if (play.mods.includes('FL')) multiplier *= 1.12;
        adjustedSR = play.starRating * multiplier;
      }
      
      const range = ranges.find((r) => adjustedSR >= r.min && adjustedSR < r.max);
      if (range) range.plays.push(play);
    });

    return ranges.map((range) => {
      const avgAccuracy = range.plays.length > 0
        ? range.plays.reduce((sum, p) => sum + p.accuracy, 0) / range.plays.length
        : 0;
      
      const wins = range.plays.filter((p) => p.position === 1).length;
      const winRate = range.plays.length > 0 ? (wins / range.plays.length) * 100 : 0;

      return {
        label: range.label,
        count: range.plays.length,
        avgAccuracy,
        winRate,
      };
    }).filter((r) => r.count > 0);
  }, [playerPlays]);

  
  const skillCurveData = useMemo(() => {
    const srBuckets = new Map<number, { accuracies: number[]; mods: Map<string, number[]> }>();
    
    playerPlays.forEach((play) => {
      
      let adjustedSR = play.starRating;
      
      if (play.mods && play.mods.length > 0) {
        const mods = play.mods;
        let multiplier = 1.0;
        
        
        if (mods.includes('HR')) multiplier *= 1.10;
        if (mods.includes('DT') || mods.includes('NC')) multiplier *= 1.50;
        if (mods.includes('HT')) multiplier *= 0.70;
        if (mods.includes('EZ')) multiplier *= 0.50;
        if (mods.includes('FL')) multiplier *= 1.12;
        
        adjustedSR = play.starRating * multiplier;
      }
      
      const srBucket = Math.floor(adjustedSR);
      const existing = srBuckets.get(srBucket) || {
        accuracies: [] as number[],
        mods: new Map<string, number[]>(),
      };
      
      existing.accuracies.push(play.accuracy);
      
      const modKey = play.mods.length > 0 ? play.mods.join('+') : 'NoMod';
      const modAccuracies = existing.mods.get(modKey) || [];
      modAccuracies.push(play.accuracy);
      existing.mods.set(modKey, modAccuracies);
      
      srBuckets.set(srBucket, existing);
    });

    const curvePoints = Array.from(srBuckets.entries())
      .map(([sr, data]) => ({
        starRating: sr,
        avgAccuracy: data.accuracies.reduce((sum, acc) => sum + acc, 0) / data.accuracies.length,
        count: data.accuracies.length,
        modBreakdown: Array.from(data.mods.entries()).map(([mod, accs]) => ({
          mod,
          avgAccuracy: accs.reduce((sum, acc) => sum + acc, 0) / accs.length,
          count: accs.length,
        })),
      }))
      .sort((a, b) => a.starRating - b.starRating);

    
    const buckets = curvePoints.map((point) => ({
      label: `${point.starRating.toFixed(1)}-${(point.starRating + 0.9).toFixed(1)}`,
      avgAccuracy: point.avgAccuracy,
      count: point.count,
      modBreakdown: Object.fromEntries(
        point.modBreakdown.map((m) => [m.mod, m.avgAccuracy])
      ),
    }));

    
    let skillCeiling = 0;
    let skillThreshold = 0;
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const current = curvePoints[i];
      const next = curvePoints[i + 1];
      
      
      if (current.avgAccuracy > 90 && skillThreshold === 0) {
        skillThreshold = current.starRating;
      }
      
      
      const drop = current.avgAccuracy - next.avgAccuracy;
      if (drop > 10 && skillCeiling === 0) {
        skillCeiling = current.starRating;
      }
    }

    return {
      curvePoints,
      buckets,
      skillCeiling,
      skillThreshold,
    };
  }, [playerPlays]);

  if (!player) {
    return (
      <div className="glass rounded-xl p-6">
        <button onClick={onBack} className="text-cyan-300 hover:text-cyan-200 mb-4">
          ← Back
        </button>
        <p className="text-zinc-400">Player not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div className="glass rounded-xl p-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200 mb-4"
        >
          <FiArrowLeft size={16} />
          Back to Players
        </button>
        
        <div className="flex items-center gap-4">
          <img
            src={player.avatarUrl || `https://a.ppy.sh/${playerId}`}
            alt={player.username}
            className="w-20 h-20 rounded-full border-2 border-cyan-500/50"
          />
          <div>
            <h2 className="text-2xl font-bold text-white">{player.username}</h2>
            <p className="text-zinc-400">Deep Performance Analysis</p>
          </div>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <FiBarChart2 className="text-cyan-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Games</p>
              <p className="text-2xl font-bold text-white">{overallStats.totalGames}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <FiAward className="text-green-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Win Rate</p>
              <p className="text-2xl font-bold text-white">{overallStats.winRate.toFixed(1)}%</p>
              <p className="text-xs text-zinc-500">{overallStats.totalWins}W / {overallStats.totalLosses}L</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <FiTarget className="text-purple-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Avg Accuracy</p>
              <p className="text-2xl font-bold text-white">{overallStats.avgAccuracy.toFixed(2)}%</p>
              <p className="text-xs text-zinc-500">Best: {overallStats.bestAccuracy.toFixed(2)}%</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <FiTrendingUp className="text-yellow-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Avg Position</p>
              <p className="text-2xl font-bold text-white">#{overallStats.avgPosition.toFixed(1)}</p>
              <p className="text-xs text-zinc-500">🥇{overallStats.topPositions.first} 🥈{overallStats.topPositions.second} 🥉{overallStats.topPositions.third}</p>
            </div>
          </div>
        </div>
      </div>

      
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Accuracy Distribution</h3>
        <div className="space-y-3">
          {accuracyDistribution.map((range) => {
            const percentage = overallStats.totalGames > 0
              ? (range.count / overallStats.totalGames) * 100
              : 0;
            
            return (
              <div key={range.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{range.label}</span>
                  <span className="text-white font-medium">{range.count} games ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${range.color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      
      <div className="glass rounded-xl p-6 relative z-0">
        <h3 className="text-lg font-bold text-white mb-2">Skill Curve: Accuracy vs Star Rating (Mod-Adjusted)</h3>
        <p className="text-sm text-zinc-500 mb-6">
          Performance consistency across difficulty levels (with mod multipliers) • 
          <span className="text-yellow-400 ml-2">Skill Ceiling: {skillCurveData.skillCeiling.toFixed(1)}★</span> • 
          <span className="text-red-400 ml-2">Skill Threshold: {skillCurveData.skillThreshold.toFixed(1)}★</span>
        </p>

        
        <div className="relative h-64 bg-black/20 rounded-lg p-4 mb-4">
          <svg viewBox="0 0 800 300" className="w-full h-full" style={{ overflow: 'visible' }}>
            <defs>
              <clipPath id="chart-area">
                <rect x="50" y="50" width="730" height="200" />
              </clipPath>
            </defs>

            
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="50"
                y1={250 - y * 2}
                x2="780"
                y2={250 - y * 2}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}
            
            
            {[0, 25, 50, 75, 100].map((val) => (
              <text
                key={val}
                x="35"
                y={255 - val * 2}
                className="fill-zinc-500 text-xs"
                textAnchor="end"
              >
                {val}%
              </text>
            ))}

            
            {skillCurveData.buckets.map((bucket, i) => {
              const numBuckets = skillCurveData.buckets.length;
              const spacing = numBuckets > 0 ? 730 / Math.max(numBuckets - 1, 1) : 120;
              const x = numBuckets === 1 ? 415 : 50 + i * spacing;
              return (
                <text
                  key={i}
                  x={x}
                  y="275"
                  className="fill-zinc-500 text-xs"
                  textAnchor="middle"
                >
                  {bucket.label}
                </text>
              );
            })}

            <g clipPath="url(#chart-area)">
              
              {skillCurveData.buckets.length > 1 && (
                <polyline
                  points={skillCurveData.buckets.map((bucket, i) => {
                    const numBuckets = skillCurveData.buckets.length;
                    const spacing = 730 / Math.max(numBuckets - 1, 1);
                    const x = 50 + i * spacing;
                    const y = Math.max(50, Math.min(250, 250 - bucket.avgAccuracy * 2));
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="rgb(103, 232, 249)"
                  strokeWidth="3"
                />
              )}
            </g>

            
            {skillCurveData.buckets.map((bucket, i) => {
              const numBuckets = skillCurveData.buckets.length;
              const spacing = numBuckets > 1 ? 730 / (numBuckets - 1) : 0;
              const x = numBuckets === 1 ? 415 : 50 + i * spacing;
              const y = Math.max(50, Math.min(250, 250 - bucket.avgAccuracy * 2));
              
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="rgb(103, 232, 249)"
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer hover:r-7 transition-all"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(103, 232, 249, 0.5))' }}
                  >
                    <title>{`${bucket.label}: ${bucket.avgAccuracy.toFixed(2)}% (${bucket.count} plays)`}</title>
                  </circle>
                  <circle
                    cx={x}
                    cy={y}
                    r="15"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.nextElementSibling as SVGGElement;
                      if (tooltip) tooltip.style.display = 'block';
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.nextElementSibling as SVGGElement;
                      if (tooltip) tooltip.style.display = 'none';
                    }}
                  />
                  <g style={{ display: 'none', pointerEvents: 'none' }}>
                    <rect
                      x={x - 60}
                      y={y - 45}
                      width="120"
                      height="35"
                      fill="rgba(0, 0, 0, 0.9)"
                      stroke="rgb(103, 232, 249)"
                      strokeWidth="1"
                      rx="4"
                    />
                    <text
                      x={x}
                      y={y - 28}
                      className="fill-white text-xs font-bold"
                      textAnchor="middle"
                    >
                      {bucket.label}
                    </text>
                    <text
                      x={x}
                      y={y - 15}
                      className="fill-cyan-300 text-xs"
                      textAnchor="middle"
                    >
                      {bucket.avgAccuracy.toFixed(2)}%
                    </text>
                  </g>
                </g>
              );
            })}

            
            {skillCurveData.skillCeiling > 0 && (() => {
              const numBuckets = skillCurveData.buckets.length;
              const spacing = numBuckets > 1 ? 730 / (numBuckets - 1) : 0;
              const bucketIndex = skillCurveData.buckets.findIndex(b => 
                parseFloat(b.label.split('-')[0]) <= skillCurveData.skillCeiling &&
                parseFloat(b.label.split('-')[1] || '10') >= skillCurveData.skillCeiling
              );
              const x = numBuckets === 1 ? 415 : 50 + bucketIndex * spacing;
              return bucketIndex >= 0 ? (
                <line
                  x1={x}
                  y1="50"
                  x2={x}
                  y2="250"
                  stroke="rgb(250, 204, 21)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              ) : null;
            })()}

            
            {skillCurveData.skillThreshold > 0 && (() => {
              const numBuckets = skillCurveData.buckets.length;
              const spacing = numBuckets > 1 ? 730 / (numBuckets - 1) : 0;
              const bucketIndex = skillCurveData.buckets.findIndex(b => 
                parseFloat(b.label.split('-')[0]) <= skillCurveData.skillThreshold &&
                parseFloat(b.label.split('-')[1] || '10') >= skillCurveData.skillThreshold
              );
              const x = numBuckets === 1 ? 415 : 50 + bucketIndex * spacing;
              return bucketIndex >= 0 ? (
                <line
                  x1={x}
                  y1="50"
                  x2={x}
                  y2="250"
                  stroke="rgb(248, 113, 113)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              ) : null;
            })()}
          </svg>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {skillCurveData.buckets.map((bucket) => (
            <div key={bucket.label} className="p-4 bg-white/[0.02] border border-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold">{bucket.label}★</span>
                <span className="text-zinc-500 text-sm">{bucket.count} games</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Avg Accuracy:</span>
                  <span className="text-cyan-300 font-semibold">{bucket.avgAccuracy.toFixed(2)}%</span>
                </div>
                {Object.entries(bucket.modBreakdown).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-xs text-zinc-500 uppercase mb-1">By Mod:</p>
                    {Object.entries(bucket.modBreakdown).map(([mod, acc]) => (
                      <div key={mod} className="flex justify-between text-xs">
                        <span className="text-purple-400">{mod}:</span>
                        <span className="text-white">{(acc as number).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        
        <div className="mt-4 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg">
          <h4 className="text-sm font-bold text-cyan-400 mb-2">📊 Skill Analysis</h4>
          <div className="space-y-1 text-sm text-zinc-300">
            <p>
              <span className="text-yellow-400 font-semibold">Skill Ceiling ({skillCurveData.skillCeiling.toFixed(1)}★):</span> 
              <span className="text-zinc-400 ml-2">Peak performance level - highest consistent accuracy</span>
            </p>
            <p>
              <span className="text-red-400 font-semibold">Skill Threshold ({skillCurveData.skillThreshold.toFixed(1)}★):</span> 
              <span className="text-zinc-400 ml-2">Performance drop-off point - significant accuracy decline</span>
            </p>
          </div>
        </div>
      </div>

      
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Performance by Star Rating (Mod-Adjusted)</h3>
        <p className="text-sm text-zinc-500 mb-2">Performance breakdown using approximate mod multipliers</p>
        <p className="text-xs text-zinc-600 mb-4">Note: Uses estimated multipliers (DT≈1.5x, HR≈1.1x, FL≈1.12x, HT≈0.7x, EZ≈0.5x). Actual API values may vary.</p>
        
        
        <div className="mb-6 bg-black/20 rounded-lg p-4">
          <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide">Play Distribution & Performance</p>
          <div className="space-y-3">
            {performanceByStarRating.map((range) => {
              const totalPlays = performanceByStarRating.reduce((sum, r) => sum + r.count, 0);
              const playPercent = (range.count / totalPlays) * 100;
              const accuracyColor = range.avgAccuracy >= 95 ? 'from-green-500 to-emerald-600' : 
                                   range.avgAccuracy >= 90 ? 'from-cyan-500 to-blue-600' :
                                   range.avgAccuracy >= 85 ? 'from-yellow-500 to-orange-500' :
                                   'from-red-500 to-red-700';
              
              return (
                <div key={range.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-semibold w-16">{range.label}</span>
                    <span className="text-zinc-400">{range.count} plays ({playPercent.toFixed(1)}%)</span>
                    <span className="text-cyan-300 font-semibold">{range.avgAccuracy.toFixed(1)}%</span>
                    <span className={`font-semibold ${range.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {range.winRate.toFixed(0)}% WR
                    </span>
                  </div>
                  <div className="h-6 bg-white/5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full bg-gradient-to-r ${accuracyColor} transition-all duration-500`}
                      style={{ width: `${playPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {performanceByStarRating.map((range) => (
            <div key={range.label} className="p-4 bg-white/[0.02] border border-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold">{range.label}</span>
                <span className="text-zinc-500 text-sm">{range.count} games</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Avg Accuracy</p>
                  <p className="text-cyan-300 font-semibold text-lg">{range.avgAccuracy.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Win Rate</p>
                  <p className={`font-semibold text-lg ${range.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {range.winRate.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${range.avgAccuracy}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Mod Performance</h3>
        
        
        <div className="mb-6 bg-black/20 rounded-lg p-4">
          <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide">Usage & Performance Overview</p>
          <div className="space-y-3">
            {modStats.map((stat) => {
              const totalPlays = playerPlays.length;
              const usagePercent = (stat.gamesPlayed / totalPlays) * 100;
              const performanceColor = stat.avgAccuracy >= 95 ? 'bg-green-500' : stat.avgAccuracy >= 90 ? 'bg-cyan-500' : stat.avgAccuracy >= 85 ? 'bg-yellow-500' : 'bg-red-500';
              
              return (
                <div key={stat.mod} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-400 font-semibold uppercase w-20">{stat.mod}</span>
                    <span className="text-zinc-400">{stat.gamesPlayed} plays ({usagePercent.toFixed(1)}%)</span>
                    <span className={`font-semibold ${stat.avgAccuracy >= 95 ? 'text-green-400' : stat.avgAccuracy >= 90 ? 'text-cyan-400' : stat.avgAccuracy >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {stat.avgAccuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full ${performanceColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <span className="text-white text-[10px] font-bold min-w-[45px] text-right">
                      {(stat.winRate * 100).toFixed(0)}% WR
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-zinc-500 uppercase">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>95%+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-cyan-500 rounded"></div>
              <span>90-95%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>85-90%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>&lt;85%</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-3 px-4 text-left">Mod</th>
                <th className="py-3 px-4 text-right">Games</th>
                <th className="py-3 px-4 text-right">Win Rate</th>
                <th className="py-3 px-4 text-right">Avg Accuracy</th>
                <th className="py-3 px-4 text-right">Best Accuracy</th>
                <th className="py-3 px-4 text-right">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {modStats.map((stat) => (
                <tr key={stat.mod} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4 text-purple-400 font-semibold uppercase">{stat.mod}</td>
                  <td className="py-3 px-4 text-right text-white">{stat.gamesPlayed}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-semibold ${stat.winRate >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                      {(stat.winRate * 100).toFixed(1)}%
                    </span>
                    <span className="text-zinc-500 text-xs ml-2">({stat.wins}W/{stat.losses}L)</span>
                  </td>
                  <td className="py-3 px-4 text-right text-cyan-300">{stat.avgAccuracy.toFixed(2)}%</td>
                  <td className="py-3 px-4 text-right text-white">{stat.bestAccuracy.toFixed(2)}%</td>
                  <td className="py-3 px-4 text-right text-zinc-300">{stat.avgScore.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Most Played Maps</h3>
        <div className="space-y-2">
          {mapStats.slice(0, 10).map((map, idx) => {
            const isExpanded = expandedMaps.has(map.beatmapId);
            
            return (
              <div key={map.beatmapId} className="bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => {
                    const newExpanded = new Set(expandedMaps);
                    if (isExpanded) {
                      newExpanded.delete(map.beatmapId);
                    } else {
                      newExpanded.add(map.beatmapId);
                    }
                    setExpandedMaps(newExpanded);
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-zinc-500 font-bold w-6">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium truncate">{map.beatmapTitle}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-2">
                        {map.difficulty} • <StarRatingDisplay starRating={map.starRating} />
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-white font-semibold">{map.timesPlayed}x</p>
                      <p className="text-xs text-zinc-500">played</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-300 font-semibold">{map.bestAccuracy.toFixed(2)}%</p>
                      <p className="text-xs text-zinc-500">best</p>
                    </div>
                    {isExpanded ? <FiChevronUp className="text-zinc-500" /> : <FiChevronDown className="text-zinc-500" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 bg-black/20 max-h-60 overflow-y-auto">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">All Plays ({map.plays.length})</p>
                    <div className="overflow-x-auto">
                    <div className="space-y-2 min-w-[360px]">
                    {map.plays.map((play, playIdx) => {
                      
                      let modAdjustedSR = play.starRating;
                      if (play.mods && play.mods.length > 0) {
                        let multiplier = 1.0;
                        if (play.mods.includes('HR')) multiplier *= 1.10;
                        if (play.mods.includes('DT') || play.mods.includes('NC')) multiplier *= 1.50;
                        if (play.mods.includes('HT')) multiplier *= 0.70;
                        if (play.mods.includes('EZ')) multiplier *= 0.50;
                        if (play.mods.includes('FL')) multiplier *= 1.12;
                        modAdjustedSR = play.starRating * multiplier;
                      }
                      
                      return (
                        <div key={playIdx} className="flex items-center justify-between p-2 bg-white/5 rounded text-xs whitespace-nowrap">
                          <div className="flex items-center gap-2 mr-4">
                            <span className="text-zinc-600 font-mono">#{playIdx + 1}</span>
                            <div className="flex items-center gap-2">
                              {play.mods.length > 0 ? (
                                <span className="text-purple-400 font-semibold uppercase">{play.mods.join('+')}</span>
                              ) : (
                                <span className="text-zinc-600">NoMod</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-cyan-300 font-semibold">{play.accuracy.toFixed(2)}%</p>
                              <p className="text-zinc-600 text-[10px]">accuracy</p>
                            </div>
                            <div className="text-right">
                              <StarRatingDisplay starRating={modAdjustedSR} />
                              <p className="text-zinc-600 text-[10px]">mod-adjusted</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white">{play.score.toLocaleString()}</p>
                              <p className="text-zinc-600 text-[10px]">score</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Top 10 Best Performances</h3>
        <p className="text-sm text-zinc-500 mb-4">
          Ranked by performance score: accuracy weighted by star rating difficulty (mod-adjusted)
        </p>
        <div className="space-y-2">
          {bestPerformances.map((perf, idx) => {
            
            let modAdjustedSR = perf.starRating;
            if (perf.mods && perf.mods.length > 0) {
              let multiplier = 1.0;
              if (perf.mods.includes('HR')) multiplier *= 1.10;
              if (perf.mods.includes('DT') || perf.mods.includes('NC')) multiplier *= 1.50;
              if (perf.mods.includes('HT')) multiplier *= 0.70;
              if (perf.mods.includes('EZ')) multiplier *= 0.50;
              if (perf.mods.includes('FL')) multiplier *= 1.12;
              modAdjustedSR = perf.starRating * multiplier;
            }
            
            return (
              <div key={`${perf.matchId}-${perf.timestamp}`} className="p-4 bg-white/[0.02] border border-white/5 rounded-lg">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0" style={{minWidth: '160px'}}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                      idx === 1 ? 'bg-gray-400/30 text-gray-300' :
                      idx === 2 ? 'bg-orange-600/30 text-orange-400' :
                      'bg-white/10 text-zinc-400'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{perf.beatmapTitle}</p>
                      <p className="text-xs flex items-center gap-1.5">
                        <span className="text-zinc-500">{perf.difficulty}</span>
                        <span className="text-zinc-500">•</span>
                        {perf.mods.length > 0 ? (
                          <>
                            <StarRatingDisplay starRating={perf.starRating} className="text-zinc-500" />
                            <span className="text-zinc-500">→</span>
                            <StarRatingDisplay starRating={modAdjustedSR} className="font-semibold" />
                          </>
                        ) : (
                          <StarRatingDisplay starRating={perf.starRating} />
                        )}
                      </p>
                      <p className="text-xs text-zinc-600 mt-1">{perf.matchName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-shrink-0 flex-wrap">
                    <div className="text-right">
                      <p className="text-purple-400 font-bold text-lg">{perf.performanceScore.toFixed(1)}</p>
                      <p className="text-xs text-zinc-500">perf score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-300 font-bold text-lg">{perf.accuracy.toFixed(2)}%</p>
                      <p className="text-xs text-zinc-500">{perf.score.toLocaleString()} pts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">#{perf.position}</p>
                      <p className="text-xs text-zinc-500">of {perf.totalPlayers}</p>
                    </div>
                    {perf.mods.length > 0 && (
                      <div className="text-xs text-purple-400 font-semibold uppercase flex-shrink-0">
                        {perf.mods.join('+')}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  {format(new Date(perf.timestamp), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlayerDeepAnalysis;
