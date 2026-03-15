import { useEffect, useMemo, useRef, useState } from 'react';
import { FiClock, FiChevronDown, FiExternalLink, FiTarget } from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import PlayerAvatarLink from './PlayerAvatarLink';
import { StarRatingDisplay } from '../utils/starRating';
import { fetchModAdjustedStarRating } from '../services/osuApi';
import { processGame, calculateComposite } from '../utils/ranking';
import type { PlayerRatingState } from '../utils/ranking';

interface MatchHistoryProps {
  compact?: boolean;
}

const ActivityFeed = ({ compact = false }: MatchHistoryProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { matchSummaries, matches, selectMatch, playerLookup, settings, censorName, censorMatchName, censorMatchId } = useMatchContext();
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  
  const rprDeltas = useMemo(() => {
    const deltas = new Map<number, Map<number, { before: number; after: number; delta: number }>>();
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
        if (!game.scores || game.scores.length === 0) continue;

        const gameDeltas = new Map<number, { before: number; after: number; delta: number }>();

        
        for (const score of game.scores) {
          const before = tempPlayerMap.has(score.userId)
            ? Math.round(calculateComposite(tempPlayerMap.get(score.userId)!))
            : 1500;
          gameDeltas.set(score.userId, { before, after: before, delta: 0 });
        }

        
        processGame(game, tempPlayerMap);

        
        for (const score of game.scores) {
          const after = tempPlayerMap.has(score.userId)
            ? Math.round(calculateComposite(tempPlayerMap.get(score.userId)!))
            : 1500;
          const playerDelta = gameDeltas.get(score.userId)!;
          playerDelta.after = after;
          playerDelta.delta = after - playerDelta.before;
        }

        deltas.set(game.id, gameDeltas);
      }
    }

    return deltas;
  }, [matches]);

  
  const getRankColor = (rank: string) => {
    switch (rank?.toUpperCase()) {
      case 'SS':
      case 'XH':
      case 'X':
        return 'from-orange-500/30 to-orange-600/30 border-orange-500/50 text-orange-400';
      case 'S':
      case 'SH':
        return 'from-yellow-500/30 to-yellow-600/30 border-yellow-500/50 text-yellow-400';
      case 'A':
        return 'from-green-500/30 to-green-600/30 border-green-500/50 text-green-400';
      case 'B':
        return 'from-blue-500/30 to-blue-600/30 border-blue-500/50 text-blue-400';
      case 'C':
        return 'from-pink-500/30 to-pink-600/30 border-pink-500/50 text-pink-400';
      case 'D':
        return 'from-red-500/30 to-red-600/30 border-red-500/50 text-red-400';
      default:
        return 'from-zinc-500/30 to-zinc-600/30 border-zinc-500/50 text-zinc-400';
    }
  };

  
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
      return (
        <div className="text-right min-w-[60px]">
          <span className="text-xs text-zinc-500">Loading...</span>
        </div>
      );
    }

    
    if (mods && mods.length > 0 && modStarRating !== null) {
      return (
        <div className="text-right min-w-[60px]">
          <div className="flex items-center justify-end gap-1">
            <StarRatingDisplay 
              starRating={baseStarRating} 
              className="text-xs text-zinc-500"
              showIcon={true}
            />
            <span className="text-zinc-500 text-xs">→</span>
            <StarRatingDisplay 
              starRating={modStarRating} 
              className="font-semibold text-xs"
              showIcon={true}
            />
          </div>
        </div>
      );
    }

    
    return (
      <div className="text-right min-w-[60px]">
        <StarRatingDisplay 
          starRating={baseStarRating} 
          className="font-semibold text-xs"
          showIcon={true}
        />
        {mods && mods.length > 0 && <p className="text-zinc-600 text-[9px]">no mod data</p>}
      </div>
    );
  };

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    anime({
      targets: listRef.current.querySelectorAll('.history-item'),
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 500,
      delay: anime.stagger(80),
      easing: 'easeOutCubic',
    });
  }, [matchSummaries.length, compact]);

  const entries = useMemo(() => {
    return matchSummaries;
  }, [matchSummaries]);

  const matchLookup = useMemo(() => {
    const map = new Map<number, typeof matches[number]>();
    matches.forEach((match) => map.set(match.id, match));
    return map;
  }, [matches]);

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Match History</h3>
          <p className="text-sm text-zinc-500">
            {compact ? 'Latest tracked lobbies at a glance.' : 'Browse every recorded lobby with map highlights and top scores.'}
          </p>
        </div>
        {!compact && (
          <button
            className="text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to top
          </button>
        )}
      </div>

      <div ref={listRef} className={`space-y-4 ${compact ? 'max-h-[500px] overflow-y-auto pr-2' : ''}`}>
        {entries.length === 0 && (
          <div className="history-item rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            No matches imported yet. Paste an osu! match link to populate your history.
          </div>
        )}

        {entries.map((summary) => {
          const match = matchLookup.get(summary.id);
          const playedDate = summary.startTime || summary.endTime;
          const since = playedDate ? formatDistanceToNow(new Date(playedDate), { addSuffix: true }) : 'Unknown time';
          const expanded = !compact && expandedMatch === summary.id;
          const winnerProfile = summary.winnerId
            ? playerLookup[summary.winnerId] ?? match?.players.find((player) => player.id === summary.winnerId)
            : undefined;

          return (
            <div key={summary.id} className="history-item border border-white/10 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left min-w-0"
                onClick={() => {
                  if (compact) {
                    selectMatch(summary.id);
                    window.open(summary.url ?? `https://osu.ppy.sh/community/matches/${summary.id}`, '_blank');
                    return;
                  }
                  setExpandedMatch((prev) => (prev === summary.id ? null : summary.id));
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-400 uppercase tracking-wide">Match {censorMatchId(summary.id)}</p>
                  <h4 className="text-lg font-semibold text-white truncate" title={settings.privacyMode ? undefined : summary.name}>
                    {censorMatchName(summary.name, summary.id)}
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <FiClock size={12} />
                      {playedDate ? `${format(new Date(playedDate), 'MMM d, yyyy')} • ${since}` : 'Date unknown'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FiTarget size={12} />
                      {summary.games} games · {summary.players} players · Avg {summary.averageAccuracy.toFixed(2)}%
                    </span>
                    {summary.winner && (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-zinc-500 uppercase text-[10px] tracking-wide">Winner</span>
                        {summary.winnerId && winnerProfile ? (
                          <PlayerAvatarLink
                            userId={summary.winnerId}
                            username={winnerProfile.username}
                            avatarUrl={winnerProfile.avatarUrl}
                            size="sm"
                            nameClassName="text-xs"
                          />
                        ) : (
                          <span className="text-cyan-300">
                            {summary.winnerId
                              ? censorName(summary.winner, summary.winnerId)
                              : (settings.privacyMode ? 'Winner' : summary.winner)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-sm ${compact ? 'text-cyan-300' : 'text-zinc-400'}`}>
                  {compact ? 'Open match' : expanded ? 'Hide details' : 'Show details'}
                  {!compact && (
                    <FiChevronDown
                      size={18}
                      className={`transition-transform ${expanded ? 'rotate-180 text-cyan-300' : ''}`}
                    />
                  )}
                </div>
              </button>

              {!compact && expanded && match && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-black/30 border-t border-white/5">
                  {match.games.map((game) => {
                    const gameLabel = game.beatmap?.title ?? 'Unknown beatmap';
                    const beatmapUrl = game.beatmap?.id 
                      ? `https://osu.ppy.sh/beatmapsets/${game.beatmap.beatmapsetId}#osu/${game.beatmap.id}`
                      : null;
                    
                    
                    const sortedScores = [...(game.scores || [])].sort((a, b) => {
                      if (settings.useAccuracyForWins) {
                        return (b.accuracy ?? 0) - (a.accuracy ?? 0);
                      }
                      return (b.score ?? 0) - (a.score ?? 0);
                    });

                    return (
                      <div key={game.id} className="rounded-lg border border-white/5 overflow-hidden">
                        
                        {game.beatmap?.coverUrl && (
                          <div 
                            className="relative h-24 bg-cover bg-center"
                            style={{ backgroundImage: `url(${game.beatmap.coverUrl})` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <button
                                onClick={() => beatmapUrl && window.open(beatmapUrl, '_blank')}
                                className="text-left hover:text-cyan-300 transition-colors group"
                                disabled={!beatmapUrl}
                              >
                                <p className="text-sm font-semibold text-white leading-tight group-hover:underline">
                                  {gameLabel}
                                </p>
                                {game.beatmap?.difficulty && (
                                  <p className="text-xs text-zinc-300 flex items-center gap-2">
                                    {game.beatmap.difficulty}
                                    {game.beatmap.starRating && (
                                      <span className="text-yellow-400">★ {game.beatmap.starRating.toFixed(2)}</span>
                                    )}
                                  </p>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        
                        <div className="p-4 bg-white/[0.02] space-y-2">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                            Players & Scores {settings.useAccuracyForWins && '(Sorted by Accuracy)'}
                          </p>
                          <div className="overflow-x-auto -mx-4 px-4">
                            <div className="space-y-2 sm:min-w-[480px]">
                          {sortedScores.map((score, idx) => {
                            const player = playerLookup[score.userId];
                            const rankColors = getRankColor(score.rank || '');
                            const gameRPR = rprDeltas.get(game.id);
                            const playerRPR = gameRPR?.get(score.userId);
                            
                            return (
                              <div 
                                key={`${game.id}-${score.userId}-${idx}`}
                                className="flex items-center justify-between gap-3 p-2 rounded bg-black/20 border border-white/5 whitespace-nowrap"
                              >
                                <div className="flex items-center gap-3 min-w-0" style={{minWidth: '120px', maxWidth: '160px'}}>
                                  <span className="text-zinc-500 font-bold text-sm w-6 text-center flex-shrink-0">
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0 overflow-hidden">
                                    <PlayerAvatarLink
                                      userId={score.userId}
                                      username={player?.username ?? score.username}
                                      avatarUrl={player?.avatarUrl}
                                      size="sm"
                                      nameClassName="text-sm"
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3 sm:gap-4 text-xs">
                                  
                                  {game.beatmap?.id && (
                                    <ModStarRating
                                      beatmapId={game.beatmap.id}
                                      mods={score.mods || []}
                                      baseStarRating={game.beatmap.starRating}
                                    />
                                  )}
                                  
                                  
                                  <div className="hidden sm:block text-right">
                                    <p className="text-white font-semibold">{score.score.toLocaleString()}</p>
                                    <p className="text-zinc-500">pts</p>
                                  </div>
                                  
                                  
                                  <div className="hidden sm:block text-right">
                                    <p className="text-cyan-300 font-semibold">{score.accuracy.toFixed(2)}%</p>
                                    <p className="text-zinc-500">acc</p>
                                  </div>
                                  
                                  
                                  {playerRPR && (
                                    <div className="hidden sm:block text-right">
                                      <p className={`font-semibold ${
                                        playerRPR.delta > 0 ? 'text-green-400' : 
                                        playerRPR.delta < 0 ? 'text-red-400' : 
                                        'text-zinc-500'
                                      }`}>
                                        {playerRPR.delta > 0 ? '+' : ''}{playerRPR.delta}
                                      </p>
                                      <p className="text-zinc-500">rpr</p>
                                    </div>
                                  )}
                                  
                                  
                                  {score.maxCombo && (
                                    <div className="hidden sm:block text-right">
                                      <p className="text-white font-semibold">{score.maxCombo}x</p>
                                      <p className="text-zinc-500">combo</p>
                                    </div>
                                  )}
                                  
                                  
                                  {score.rank && (
                                    <div className={`flex items-center justify-center w-8 h-8 rounded bg-gradient-to-br border ${rankColors}`}>
                                      <span className="font-bold text-xs">{score.rank}</span>
                                    </div>
                                  )}
                                  
                                  
                                  <div className="hidden sm:block min-w-[80px] text-right">
                                    {score.mods?.length ? (
                                      <p className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">
                                        {score.mods.join('+')}
                                      </p>
                                    ) : (
                                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                                        NM
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => selectMatch(match.id)}
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                    >
                      Focus this match in dashboard
                    </button>
                    <button
                      onClick={() => window.open(summary.url ?? `https://osu.ppy.sh/community/matches/${summary.id}`, '_blank')}
                      className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-cyan-200"
                    >
                      View on osu!
                      <FiExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
