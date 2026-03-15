import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiStar, FiTarget, FiAward, FiTrendingUp } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import type { AggregatedPlayer } from '../types/osu';
import PlayerAvatarLink from './PlayerAvatarLink';
import { buildRatings, calculateComposite } from '../utils/ranking';
import CustomDropdown from './CustomDropdown';

const sortPlayers = (
  players: AggregatedPlayer[], 
  sortBy: string, 
  playerRatings: Map<number, number>
) => {
  switch (sortBy) {
    case 'wins':
      return [...players].sort((a, b) => b.wins - a.wins);
    case 'recent':
      return [...players].sort((a, b) => {
        const dateA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
        const dateB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
        return dateB - dateA;
      });
    case 'rpr':
      return [...players].sort((a, b) => {
        const rprA = playerRatings.get(a.id) ?? 1500;
        const rprB = playerRatings.get(b.id) ?? 1500;
        return rprB - rprA;
      });
    case 'accuracy':
    default:
      return [...players].sort((a, b) => b.averageAccuracy - a.averageAccuracy);
  }
};

const PlayersGrid = () => {
  const { players, matches } = useMatchContext();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('accuracy');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  
  const playerRatings = useMemo(() => {
    const ratingsMap = buildRatings(matches);
    const ratingsById = new Map<number, number>();
    ratingsMap.forEach((ratingState, userId) => {
      ratingsById.set(userId, Math.round(calculateComposite(ratingState)));
    });
    return ratingsById;
  }, [matches]);

  const filteredPlayers = useMemo(() => {
    const normalized = query.toLowerCase();
    const source = sortPlayers(players, sortBy, playerRatings);
    if (!normalized) {
      return source;
    }
    return source.filter((player) => player.username.toLowerCase().includes(normalized));
  }, [players, query, sortBy, playerRatings]);

  useEffect(() => {
    if (!gridRef.current) {
      return;
    }
    anime({
      targets: gridRef.current.querySelectorAll('.player-card'),
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 450,
      delay: anime.stagger(60),
      easing: 'easeOutCubic',
    });
  }, [filteredPlayers]);

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Players</h3>
          <p className="text-sm text-zinc-500">
            All players that appeared in tracked matches with accuracy, win rate, and recent activity.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 transition-all"
            />
          </div>
          <CustomDropdown
            value={sortBy}
            onChange={(value) => setSortBy(value)}
            options={[
              { value: 'accuracy', label: 'Top accuracy' },
              { value: 'rpr', label: 'Top RPR' },
              { value: 'wins', label: 'Most wins' },
              { value: 'recent', label: 'Recently active' },
            ]}
            isOpen={dropdownOpen}
            setIsOpen={setDropdownOpen}
            placeholder="Sort by..."
          />
        </div>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredPlayers.length === 0 && (
          <div className="player-card border border-dashed border-white/15 rounded-xl p-6 text-sm text-zinc-500">
            No players match your search yet. Import additional matches to populate this roster.
          </div>
        )}

        {filteredPlayers.map((player) => {
          const lastPlayed = player.lastPlayedAt
            ? formatDistanceToNow(new Date(player.lastPlayedAt), { addSuffix: true })
            : 'No plays recorded';

          const topMods = Object.entries(player.modsUsed)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([mod]) => mod)
            .join(', ');

          const rpr = playerRatings.get(player.id) ?? 1500;
          const getRPRColor = (rating: number): string => {
            if (rating >= 3000) return 'text-yellow-400';
            if (rating >= 2000) return 'text-purple-400';
            if (rating >= 1000) return 'text-cyan-400';
            if (rating >= 0) return 'text-green-400';
            return 'text-red-400';
          };

          return (
            <div key={player.id} className="player-card border border-white/10 rounded-xl p-5 bg-white/[0.02] space-y-4">
              <div className="flex items-center justify-between gap-4">
                <PlayerAvatarLink
                  userId={player.id}
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  size="md"
                  nameClassName="text-lg"
                />
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 text-right">
                  {player.matchesPlayed} matches · {player.gamesPlayed} games
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <FiStar className="text-cyan-300" size={15} />
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Accuracy</p>
                    <p className="text-white font-semibold">{player.averageAccuracy.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FiTarget className="text-amber-300" size={15} />
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Win Rate</p>
                    <p className="text-white font-semibold">{(player.winRate * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <FiTrendingUp className="text-purple-400" size={15} />
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">RPR Rating</p>
                    <p className={`font-bold text-lg ${getRPRColor(rpr)}`}>{rpr}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-500 uppercase tracking-wider">
                Last played {lastPlayed}
              </div>

              <div className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                <FiAward size={12} className="inline-block mr-1 text-cyan-300" />
                Mods: {topMods || 'No Mods'}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    window.location.hash = `#player/${player.id}`;
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
                >
                  View Details
                </button>
                <button
                  onClick={() => {
                    window.location.hash = `#deep-analysis/${player.id}`;
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
                >
                  Deep Analysis
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayersGrid;
