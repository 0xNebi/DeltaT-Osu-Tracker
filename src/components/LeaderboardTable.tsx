import { useEffect, useMemo, useRef, useState } from 'react';
import { FiAward, FiTarget } from 'react-icons/fi';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import type { LeaderboardEntry } from '../types/osu';
import PlayerAvatarLink from './PlayerAvatarLink';
import { buildRatings, calculateComposite } from '../utils/ranking';

const TABS: Array<{ id: 'accuracy' | 'wins' | 'score' | 'rpr'; label: string; description: string }> = [
  {
    id: 'accuracy',
    label: 'Accuracy',
    description: 'Highest average accuracy across tracked games.',
  },
  {
    id: 'wins',
    label: 'Win Streak',
    description: 'Players with the most recorded game wins.',
  },
  {
    id: 'score',
    label: 'Score',
    description: 'Highest average scores across all games.',
  },
  {
    id: 'rpr',
    label: 'RPR',
    description: 'Top players by Relax Performance Rating (RPR).',
  },
];

const formatPercent = (value: number, fractionDigits = 2) => `${value.toFixed(fractionDigits)}%`;
const formatRate = (value: number) => `${(value * 100).toFixed(1)}%`;

const getRatingTier = (rating: number) => {
  if (rating >= 3000) return { label: 'Legend', color: 'text-yellow-400' };
  if (rating >= 2000) return { label: 'Master', color: 'text-purple-400' };
  if (rating >= 1000) return { label: 'Advanced', color: 'text-cyan-400' };
  if (rating >= 0) return { label: 'Intermediate', color: 'text-green-400' };
  return { label: 'Beginner', color: 'text-red-400' };
};

const LeaderboardTable = () => {
  const { leaderboards, matches, players } = useMatchContext();
  const [activeTab, setActiveTab] = useState<'accuracy' | 'wins' | 'score' | 'rpr'>('accuracy');
  const tableRef = useRef<HTMLDivElement>(null);

  
  const playerRatings = useMemo(() => {
    const ratings = buildRatings(matches);
    const ratingMap = new Map<number, { rating: number; username: string }>();
    ratings.forEach((state) => {
      const composite = calculateComposite(state);
      ratingMap.set(state.userId, { rating: composite, username: state.username });
    });
    return ratingMap;
  }, [matches]);

  const entries = useMemo(() => {
    if (activeTab === 'rpr') {
      
      const rprEntries: LeaderboardEntry[] = Array.from(playerRatings.entries())
        .map(([userId, data]) => {
          const player = players.find(p => p.id === userId);
          return {
            playerId: userId,
            username: data.username,
            countryCode: player?.countryCode ?? null,
            avatarUrl: player?.avatarUrl ?? null,
            gamesPlayed: player?.gamesPlayed ?? 0,
            wins: player?.wins ?? 0,
            losses: player?.losses ?? 0,
            winRate: player?.winRate ?? 0,
            averageAccuracy: player?.averageAccuracy ?? 0,
            bestAccuracy: player?.bestAccuracy ?? 0,
            averageScore: player?.averageScore ?? 0,
            bestScore: player?.bestScore ?? 0,
            rpr: data.rating,
          };
        })
        .sort((a, b) => ((b as any).rpr ?? 0) - ((a as any).rpr ?? 0))
        .slice(0, 15);
      return rprEntries;
    }
    
    const list = leaderboards[activeTab] ?? [];
    return list.slice(0, 15);
  }, [leaderboards, activeTab, playerRatings, players]);

  useEffect(() => {
    if (!tableRef.current) {
      return;
    }

    anime({
      targets: tableRef.current.querySelectorAll('tbody tr'),
      translateY: [12, 0],
      opacity: [0, 1],
      duration: 400,
      delay: anime.stagger(45),
      easing: 'easeOutCubic',
    });
  }, [entries, activeTab]);

  const renderRow = (entry: LeaderboardEntry, index: number) => {
    const rpr = (entry as any).rpr as number | undefined;
    const tier = rpr !== undefined ? getRatingTier(rpr) : null;
    
    return (
      <tr key={entry.playerId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
        <td className="px-4 py-3 text-sm text-zinc-500 font-medium">#{index + 1}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <PlayerAvatarLink
              userId={entry.playerId}
              username={entry.username}
              avatarUrl={entry.avatarUrl}
              size="md"
              className="shrink-0"
            />
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              {entry.gamesPlayed} games · {entry.wins} wins
            </p>
          </div>
        </td>
        {activeTab === 'rpr' && rpr !== undefined && tier ? (
          <>
            <td className="px-4 py-3">
              <p className={`text-sm font-bold ${tier.color}`}>{rpr.toFixed(0)}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{tier.label}</p>
            </td>
            <td className="px-4 py-3">
              <p className="text-sm text-cyan-300 font-medium">{formatPercent(entry.averageAccuracy)}</p>
            </td>
            <td className="px-4 py-3 text-sm text-zinc-400 font-medium">{formatRate(entry.winRate)}</td>
          </>
        ) : (
          <>
            <td className="px-4 py-3">
              <p className="text-sm text-cyan-300 font-medium">{formatPercent(entry.averageAccuracy)}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Best {formatPercent(entry.bestAccuracy)}</p>
            </td>
            <td className="px-4 py-3">
              <p className="text-sm text-zinc-300 font-medium">{entry.bestScore.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg {Math.round(entry.averageScore).toLocaleString()}</p>
            </td>
            <td className="px-4 py-3 text-sm text-zinc-400 font-medium">{formatRate(entry.winRate)}</td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FiAward className="text-amber-400" />
            osu! Leaderboards
          </h3>
          <p className="text-sm text-zinc-500">Identify top performers across your tracked lobbies.</p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
                activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50' : 'text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <FiTarget size={14} className="text-cyan-300" />
        {TABS.find((tab) => tab.id === activeTab)?.description}
      </p>

      <div ref={tableRef} className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full min-w-[640px]">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-white/10">
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Player</th>
              {activeTab === 'rpr' ? (
                <>
                  <th className="px-4 py-3 font-medium">RPR Rating</th>
                  <th className="px-4 py-3 font-medium">Accuracy</th>
                  <th className="px-4 py-3 font-medium">Win Rate</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 font-medium">Accuracy</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Win Rate</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                  Import matches to build out your first leaderboard.
                </td>
              </tr>
            )}
            {entries.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardTable;
