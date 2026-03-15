import { useMemo, useState, useEffect } from 'react';
import { FiArrowLeft, FiTrendingUp, FiTarget, FiAward, FiClock, FiSearch } from 'react-icons/fi';
import { format } from 'date-fns';
import { useMatchContext } from '../context/MatchContext';
import type { AggregatedPlayer, OsuScore } from '../types/osu';
import PlayerAvatarLink from './PlayerAvatarLink';
import { StarRatingDisplay } from '../utils/starRating';
import { fetchModAdjustedStarRating } from '../services/osuApi';
import { buildRatings, calculateComposite, processGame, type PlayerRatingState } from '../utils/ranking';

interface PlayerDetailsProps {
  playerId: number;
  onBack: () => void;
}

interface PlayerGameRecord {
  matchId: number;
  matchName: string;
  matchUrl?: string;
  gameId: number;
  beatmapId: number;
  beatmapTitle: string;
  beatmapDifficulty?: string | null;
  beatmapStarRating?: number | null;
  score: number;
  accuracy: number;
  combo: number;
  rank: string;
  mods: string[];
  passed: boolean;
  playedAt: string | null;
  rprBefore?: number;
  rprAfter?: number;
  rprDelta?: number;
}

const PlayerDetails = ({ playerId, onBack }: PlayerDetailsProps) => {
  const { matches, playerLookup } = useMatchContext();
  const [sortBy, setSortBy] = useState<'date' | 'accuracy' | 'score' | 'starRating' | 'starRatingWithMods'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [modStarRatings, setModStarRatings] = useState<Map<string, number>>(new Map());
  const [loadingModSRs, setLoadingModSRs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const player: AggregatedPlayer | undefined = playerLookup[playerId];

  
  const { gameRecordsWithRPR, currentRPR } = useMemo(() => {
    const playerRatings = buildRatings(matches);
    const playerState = playerRatings.get(playerId);
    const finalRPR = playerState ? Math.round(calculateComposite(playerState)) : 1500;

    
    const gameRecordsMap = new Map<number, PlayerGameRecord>();
    const tempPlayerMap = new Map<number, PlayerRatingState>();
    
    
    const sortedMatches = [...matches].sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB;
    });

    for (const match of sortedMatches) {
      
      for (const p of match.players) {
        if (!tempPlayerMap.has(p.id)) {
          tempPlayerMap.set(p.id, {
            userId: p.id,
            username: p.username,
            rating: 1500,
            RD: 350,
            games: 0,
            perModRatings: {},
            modCounts: {},
          });
        }
      }

      const sortedGames = [...match.games].sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
      });

      for (const game of sortedGames) {
        const playerScore = game.scores?.find((s: OsuScore) => s.userId === playerId);
        if (playerScore && game.beatmap?.id) {
          const rprBefore = tempPlayerMap.has(playerId)
            ? Math.round(calculateComposite(tempPlayerMap.get(playerId)!))
            : 1500;

          
          processGame(game, tempPlayerMap);

          const rprAfter = tempPlayerMap.has(playerId)
            ? Math.round(calculateComposite(tempPlayerMap.get(playerId)!))
            : 1500;

          const record: PlayerGameRecord = {
            matchId: match.id,
            matchName: match.name,
            matchUrl: match.url,
            gameId: game.id,
            beatmapId: game.beatmap.id,
            beatmapTitle: game.beatmap?.title ?? 'Unknown',
            beatmapDifficulty: game.beatmap?.difficulty,
            beatmapStarRating: game.beatmap?.starRating,
            score: playerScore.score ?? 0,
            accuracy: playerScore.accuracy ?? 0,
            combo: playerScore.maxCombo ?? 0,
            rank: playerScore.rank ?? '-',
            mods: playerScore.mods ?? [],
            passed: playerScore.passed ?? false,
            playedAt: playerScore.createdAt ?? game.startTime ?? game.endTime ?? null,
            rprBefore,
            rprAfter,
            rprDelta: rprAfter - rprBefore,
          };

          gameRecordsMap.set(game.id, record);
        }
      }
    }

    return {
      gameRecordsWithRPR: Array.from(gameRecordsMap.values()),
      currentRPR: finalRPR,
    };
  }, [matches, playerId]);

  const gameRecords = gameRecordsWithRPR;

  const sortedRecords = useMemo(() => {
    let filtered = [...gameRecords];
    
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => 
        record.beatmapTitle.toLowerCase().includes(query) ||
        record.beatmapDifficulty?.toLowerCase().includes(query) ||
        record.matchName.toLowerCase().includes(query) ||
        record.mods.some(mod => mod.toLowerCase().includes(query))
      );
    }
    
    
    if (sortBy === 'date') {
      filtered.sort((a, b) => {
        const dateA = a.playedAt ? new Date(a.playedAt).getTime() : 0;
        const dateB = b.playedAt ? new Date(b.playedAt).getTime() : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    } else if (sortBy === 'accuracy') {
      filtered.sort((a, b) => {
        return sortOrder === 'desc' ? b.accuracy - a.accuracy : a.accuracy - b.accuracy;
      });
    } else if (sortBy === 'score') {
      filtered.sort((a, b) => {
        return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
      });
    } else if (sortBy === 'starRating') {
      filtered.sort((a, b) => {
        const srA = a.beatmapStarRating ?? 0;
        const srB = b.beatmapStarRating ?? 0;
        return sortOrder === 'desc' ? srB - srA : srA - srB;
      });
    } else if (sortBy === 'starRatingWithMods') {
      
      filtered.sort((a, b) => {
        const aKey = a.mods && a.mods.length > 0 
          ? `${a.beatmapId}:${a.mods.sort().join(',')}` 
          : null;
        const bKey = b.mods && b.mods.length > 0 
          ? `${b.beatmapId}:${b.mods.sort().join(',')}` 
          : null;
        
        const srA = aKey ? (modStarRatings.get(aKey) ?? a.beatmapStarRating ?? 0) : (a.beatmapStarRating ?? 0);
        const srB = bKey ? (modStarRatings.get(bKey) ?? b.beatmapStarRating ?? 0) : (b.beatmapStarRating ?? 0);
        
        return sortOrder === 'desc' ? srB - srA : srA - srB;
      });
    }
    
    return filtered;
  }, [gameRecords, sortBy, sortOrder, modStarRatings, searchQuery]);

  if (!player) {
    return (
      <div className="glass rounded-xl p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-4"
        >
          <FiArrowLeft size={18} />
          Back to Players
        </button>
        <p className="text-zinc-400">Player not found</p>
      </div>
    );
  }

  const matchesPlayed = new Set(gameRecords.map((r) => r.matchId)).size;
  const mapsPlayed = new Set(gameRecords.map((r) => r.beatmapTitle)).size;
  const avgAcc = gameRecords.length > 0 
    ? (gameRecords.reduce((sum, r) => sum + r.accuracy, 0) / gameRecords.length)
    : 0;

  
  const handleSortClick = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  
  useEffect(() => {
    if (sortBy !== 'starRatingWithMods') return;
    
    const loadModStarRatings = async () => {
      setLoadingModSRs(true);
      const newModSRs = new Map<string, number>();
      
      
      const uniqueCombos = new Set<string>();
      gameRecords.forEach(record => {
        if (record.mods && record.mods.length > 0) {
          const key = `${record.beatmapId}:${record.mods.sort().join(',')}`;
          uniqueCombos.add(key);
        }
      });
      
      
      const promises = Array.from(uniqueCombos).map(async (key) => {
        const [beatmapIdStr, modsStr] = key.split(':');
        const beatmapId = parseInt(beatmapIdStr);
        const mods = modsStr.split(',');
        
        try {
          const sr = await fetchModAdjustedStarRating(beatmapId, mods);
          if (sr !== null) {
            newModSRs.set(key, sr);
          }
        } catch (err) {
          console.error(`Failed to fetch SR for ${key}:`, err);
        }
      });
      
      await Promise.all(promises);
      setModStarRatings(newModSRs);
      setLoadingModSRs(false);
    };
    
    loadModStarRatings();
  }, [sortBy, gameRecords]);

  
  const ModStarRating = ({ beatmapId, mods, baseStarRating }: { beatmapId: number; mods: string[]; baseStarRating?: number | null }) => {
    const [modStarRating, setModStarRating] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!mods || mods.length === 0) {
        setModStarRating(null);
        return;
      }

      setLoading(true);
      fetchModAdjustedStarRating(beatmapId, mods)
        .then(rating => {
          setModStarRating(rating);
        })
        .catch(err => {
          console.error('Failed to fetch mod-adjusted star rating:', err);
          setModStarRating(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }, [beatmapId, mods]);

    if (loading) {
      return <span className="text-xs text-zinc-500">Loading SR...</span>;
    }

    
    if (mods && mods.length > 0 && modStarRating !== null) {
      return (
        <div className="flex items-center gap-1.5">
          <StarRatingDisplay starRating={baseStarRating} className="text-xs text-zinc-500" />
          <span className="text-zinc-500 text-xs">→</span>
          <StarRatingDisplay starRating={modStarRating} className="text-xs font-semibold" />
        </div>
      );
    }

    
    return <StarRatingDisplay starRating={baseStarRating} className="text-xs" />;
  };

  return (
    <div className="space-y-6">
      
      <div className="glass rounded-xl p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-6"
        >
          <FiArrowLeft size={18} />
          Back to Players
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <PlayerAvatarLink
              userId={player.id}
              username={player.username}
              avatarUrl={player.avatarUrl}
              size="lg"
            />
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Matches</p>
              <p className="text-2xl font-bold text-white">{matchesPlayed}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Maps Played</p>
              <p className="text-2xl font-bold text-white">{mapsPlayed}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Avg Accuracy</p>
              <p className="text-2xl font-bold text-cyan-400">{avgAcc.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">RPR Rating</p>
              <p className={`text-2xl font-bold ${
                currentRPR >= 3000 ? 'text-yellow-400' :
                currentRPR >= 2000 ? 'text-purple-400' :
                currentRPR >= 1000 ? 'text-cyan-400' :
                currentRPR >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>{currentRPR}</p>
            </div>
          </div>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <FiTrendingUp className="text-white" size={20} />
            </div>
            <p className="text-sm font-medium text-zinc-400">Performance</p>
          </div>
          <p className="text-2xl font-bold text-white mb-1">{player.wins}W / {player.losses}L</p>
          <p className="text-xs text-zinc-500">{player.gamesPlayed} games played</p>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <FiTarget className="text-white" size={20} />
            </div>
            <p className="text-sm font-medium text-zinc-400">Best Accuracy</p>
          </div>
          <p className="text-2xl font-bold text-white mb-1">{player.bestAccuracy.toFixed(2)}%</p>
          <p className="text-xs text-zinc-500">Personal best</p>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <FiAward className="text-white" size={20} />
            </div>
            <p className="text-sm font-medium text-zinc-400">Best Score</p>
          </div>
          <p className="text-2xl font-bold text-white mb-1">{player.bestScore.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Highest score</p>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <FiTarget className="text-white" size={20} />
            </div>
            <p className="text-sm font-medium text-zinc-400">Win Rate</p>
          </div>
          <p className="text-2xl font-bold text-white mb-1">{(player.winRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-zinc-500">{player.wins}W / {player.losses}L</p>
        </div>
      </div>

      
      <div className="glass rounded-xl p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Play History</h3>
              <p className="text-sm text-zinc-500">{sortedRecords.length} games {searchQuery ? 'found' : 'recorded'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSortClick('date')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === 'date'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:border-white/20'
                }`}
              >
                Recent {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSortClick('accuracy')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === 'accuracy'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:border-white/20'
                }`}
              >
                Accuracy {sortBy === 'accuracy' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSortClick('score')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === 'score'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:border-white/20'
                }`}
              >
                Score {sortBy === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSortClick('starRating')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === 'starRating'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:border-white/20'
                }`}
                title="Sort by base star rating"
              >
                ★ Base {sortBy === 'starRating' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSortClick('starRatingWithMods')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === 'starRatingWithMods'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:border-white/20'
                }`}
                title="Sort by mod-adjusted star rating (accurate)"
                disabled={loadingModSRs}
              >
                ★ w/ Mods {loadingModSRs && '⏳'} {sortBy === 'starRatingWithMods' && !loadingModSRs && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>
          
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by beatmap title, difficulty, match name, or mods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-cyan-500/40 focus:bg-white/10 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {sortedRecords.length === 0 && (
            <p className="text-center text-zinc-500 py-8">
              {searchQuery ? 'No games found matching your search' : 'No games recorded'}
            </p>
          )}
          {sortedRecords.map((record, index) => (
            <div
              key={`${record.gameId}-${index}`}
              className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-semibold mb-1">{record.beatmapTitle}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    {record.beatmapDifficulty && <span>{record.beatmapDifficulty}</span>}
                    <ModStarRating 
                      beatmapId={record.beatmapId}
                      mods={record.mods}
                      baseStarRating={record.beatmapStarRating}
                    />
                    <span>·</span>
                    <span>{record.matchName}</span>
                    {record.playedAt && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <FiClock size={12} />
                          {format(new Date(record.playedAt), 'MMM d, yyyy h:mm a')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 mb-1">Score</p>
                    <p className="text-lg font-bold text-white">{record.score.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 mb-1">Accuracy</p>
                    <p className="text-lg font-bold text-cyan-400">{record.accuracy.toFixed(2)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 mb-1">Combo</p>
                    <p className="text-lg font-bold text-purple-400">{record.combo}x</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 mb-1">Rank</p>
                    <p className="text-lg font-bold text-amber-400">{record.rank}</p>
                  </div>
                  {record.rprDelta !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-zinc-500 mb-1">RPR</p>
                      <p className={`text-lg font-bold ${
                        record.rprDelta > 0 ? 'text-green-400' :
                        record.rprDelta < 0 ? 'text-red-400' : 'text-zinc-400'
                      }`}>
                        {record.rprDelta > 0 ? '+' : ''}{record.rprDelta}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {record.mods.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Mods: <span className="text-cyan-400">{record.mods.join(' + ')}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlayerDetails;
