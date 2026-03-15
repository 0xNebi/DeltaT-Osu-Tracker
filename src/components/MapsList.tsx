import { useEffect, useMemo, useRef, useState } from 'react';
import { FiFilter, FiMusic, FiSearch, FiExternalLink, FiPlay, FiPause } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import type { AggregatedMap, OsuMatch, OsuScore } from '../types/osu';
import PlayerAvatarLink from './PlayerAvatarLink';
import { StarRatingDisplay } from '../utils/starRating';
import { audioPlayer } from '../services/audioPlayer';
import { fetchModAdjustedStarRating } from '../services/osuApi';
import CustomDropdown from './CustomDropdown';
import { calculateComposite, processGame, type PlayerRatingState } from '../utils/ranking';

const sortMaps = (maps: AggregatedMap[], sortBy: string) => {
  switch (sortBy) {
    case 'plays':
      return [...maps].sort((a, b) => b.totalPlays - a.totalPlays);
    case 'accuracy':
      return [...maps].sort((a, b) => b.averageAccuracy - a.averageAccuracy);
    case 'recent':
    default:
      return [...maps].sort((a, b) => {
        const dateA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
        const dateB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
        return dateB - dateA;
      });
  }
};

interface MapMatchDetail {
  matchId: number;
  matchName: string;
  matchUrl?: string;
  startTime?: string | null;
  players: OsuMatch['players'];
  games: Array<{
    id: number;
    startTime?: string | null;
    scores: OsuScore[];
  }>;
}

const MapsList = () => {
  const { maps, matches, playerLookup, selectMatch } = useMatchContext();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [expandedMapId, setExpandedMapId] = useState<number | null>(null);
  const [playingBeatmapsetId, setPlayingBeatmapsetId] = useState<number | null>(null);
  const [hoveredMapId, setHoveredMapId] = useState<number | null>(null);

  
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe((isPlaying, beatmapsetId) => {
      setPlayingBeatmapsetId(isPlaying ? beatmapsetId : null);
    });
    return () => unsubscribe();
  }, []);

  const handlePlayPause = (beatmapsetId: number | undefined) => {
    if (!beatmapsetId) return;
    audioPlayer.toggle(beatmapsetId);
  };

  const filteredMaps = useMemo(() => {
    const sorted = sortMaps(maps, sortBy);
    if (!query.trim()) {
      return sorted;
    }
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    return sorted.filter((map) => {
      const haystack = [map.title, map.artist ?? '', map.difficulty ?? ''].join(' ').toLowerCase();
      return keywords.every((keyword) => haystack.includes(keyword));
    });
  }, [maps, query, sortBy]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    const ANIMATE_LIMIT = 24;
    const allRows = listRef.current.querySelectorAll<HTMLElement>('.map-row');

    
    allRows.forEach((el, i) => {
      if (i >= ANIMATE_LIMIT) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    });

    const subset = Array.from(allRows).slice(0, ANIMATE_LIMIT);
    if (subset.length === 0) return;

    anime({
      targets: subset,
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 300,
      delay: anime.stagger(25),
      easing: 'easeOutCubic',
    });
  }, [filteredMaps]);

  const mapDetailsLookup = useMemo(() => {
    const store = new Map<number, MapMatchDetail[]>();

    matches.forEach((match) => {
      match.games.forEach((game) => {
        const beatmapId = game.beatmap?.id;
        if (!beatmapId) {
          return;
        }

        
        if (!game.scores || game.scores.length === 0) {
          return;
        }

        const existing = store.get(beatmapId) ?? [];
        let matchEntry = existing.find((entry) => entry.matchId === match.id);
        if (!matchEntry) {
          matchEntry = {
            matchId: match.id,
            matchName: match.name,
            matchUrl: match.url,
            startTime: match.startTime ?? match.endTime ?? null,
            players: match.players,
            games: [],
          };
          existing.push(matchEntry);
          store.set(beatmapId, existing);
        }

        matchEntry.games.push({
          id: game.id,
          startTime: game.startTime ?? game.endTime ?? match.startTime ?? match.endTime ?? null,
          scores: [...(game.scores ?? [])],
        });
      });
    });

    return store;
  }, [matches]);

  
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

  const getBeatmapLink = (map: AggregatedMap) => {
    if (!map.beatmapsetId) {
      return null;
    }
    return `https://osu.ppy.sh/beatmapsets/${map.beatmapsetId}#osu/${map.id}`;
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
      return <span className="text-xs text-zinc-500">Loading...</span>;
    }

    if (!mods || mods.length === 0 || modStarRating === null) {
      return <StarRatingDisplay starRating={baseStarRating} className="text-xs" />;
    }

    return (
      <div className="flex items-center gap-1.5">
        <StarRatingDisplay starRating={baseStarRating} className="text-xs text-zinc-500" />
        <span className="text-zinc-500 text-xs">→</span>
        <StarRatingDisplay starRating={modStarRating} className="text-xs font-semibold" />
      </div>
    );
  };

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Maps Library</h3>
          <p className="text-sm text-zinc-500">
            Every beatmap played in imported matches with accuracy, plays, and last appearance.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search maps"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
            <FiFilter size={14} />
            <CustomDropdown
              value={sortBy}
              onChange={(value) => setSortBy(value)}
              options={[
                { value: 'recent', label: 'Recently played' },
                { value: 'plays', label: 'Most played' },
                { value: 'accuracy', label: 'Highest accuracy' },
              ]}
              isOpen={dropdownOpen}
              setIsOpen={setDropdownOpen}
              placeholder="Filter by..."
            />
          </div>
        </div>
      </div>

      <div ref={listRef} className="space-y-3">
        {filteredMaps.length === 0 && (
          <div className="map-row border border-dashed border-white/15 rounded-xl p-6 text-sm text-zinc-500">
            No maps available yet. Import an osu! match to start building your library.
          </div>
        )}

        {filteredMaps.map((map) => {
          const lastPlayed = map.lastPlayedAt
            ? formatDistanceToNow(new Date(map.lastPlayedAt), { addSuffix: true })
            : 'Unknown';
          const beatmapLink = getBeatmapLink(map);
          const isExpanded = expandedMapId === map.id;
          const details = mapDetailsLookup.get(map.id) ?? [];

          return (
            <div key={map.id} className="map-row border border-white/10 rounded-xl p-4 bg-white/[0.02]">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {map.coverUrl ? (
                    <div 
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group"
                      onMouseEnter={() => setHoveredMapId(map.id)}
                      onMouseLeave={() => setHoveredMapId(null)}
                    >
                      <img
                        src={map.coverUrl}
                        alt={`${map.title} cover`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      
                      <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${hoveredMapId === map.id || playingBeatmapsetId === map.beatmapsetId ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                          onClick={() => handlePlayPause(map.beatmapsetId)}
                          className="text-white hover:text-cyan-300 transition-colors p-2"
                          title={playingBeatmapsetId === map.beatmapsetId ? 'Pause preview' : 'Play preview'}
                        >
                          {playingBeatmapsetId === map.beatmapsetId ? (
                            <FiPause size={24} />
                          ) : (
                            <FiPlay size={24} />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-cyan-200 border border-white/10">
                      <FiMusic size={20} />
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    {beatmapLink ? (
                      <a
                        href={beatmapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white font-semibold leading-tight truncate hover:text-cyan-300 transition-colors block"
                        title={map.title}
                      >
                        {map.title}
                      </a>
                    ) : (
                      <h4 className="text-white font-semibold leading-tight truncate" title={map.title}>
                        {map.title}
                      </h4>
                    )}
                    <p className="text-xs text-zinc-500 uppercase tracking-wider truncate">
                      {map.artist ?? 'Unknown artist'} · {map.difficulty ?? 'No difficulty name'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-500">
                      <StarRatingDisplay starRating={map.starRating} className="font-semibold" />
                      <span>Total Plays: {map.totalPlays}</span>
                      <span>Last played {lastPlayed}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {beatmapLink && (
                    <a
                      href={beatmapLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300 hover:text-cyan-200"
                    >
                      View Beatmap
                      <FiExternalLink size={12} />
                    </a>
                  )}
                  <button
                    onClick={() => setExpandedMapId((prev) => (prev === map.id ? null : map.id))}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-lg border border-white/15 hover:border-cyan-400/60 hover:text-cyan-200 transition-colors"
                  >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4 bg-black/30 border border-white/5 rounded-lg p-4">
                  {details.length === 0 && (
                    <p className="text-sm text-zinc-500">No recorded plays found for this map.</p>
                  )}

                  {details.map((detail) => {
                    const matchDate = detail.startTime
                      ? formatDistanceToNow(new Date(detail.startTime), { addSuffix: true })
                      : 'Unknown date';
                    const matchLink = detail.matchUrl ?? `https://osu.ppy.sh/community/matches/${detail.matchId}`;

                    return (
                      <div key={detail.matchId} className="space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <a
                              href={matchLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-white hover:text-cyan-200"
                            >
                              {detail.matchName}
                            </a>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">
                              Match #{detail.matchId} · {matchDate}
                            </p>
                          </div>
                          <button
                            onClick={() => selectMatch(detail.matchId)}
                            className="text-xs uppercase tracking-wide text-cyan-300 hover:text-cyan-200"
                          >
                            Focus match
                          </button>
                        </div>

                        {detail.games.map((game) => {
                          const sortedScores = [...game.scores].sort(
                            (a, b) => (b.score ?? 0) - (a.score ?? 0),
                          );
                          const gameDate = game.startTime
                            ? formatDistanceToNow(new Date(game.startTime), { addSuffix: true })
                            : 'Unknown time';

                          return (
                            <div key={game.id} className="bg-white/[0.02] border border-white/10 rounded-lg">
                              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
                                <p className="text-sm text-white font-medium">Game #{game.id}</p>
                                <p className="text-xs uppercase tracking-wider text-zinc-500">{gameDate}</p>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px] text-sm">
                                  <thead>
                                    <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-white/10">
                                      <th className="px-4 py-3">Player</th>
                                      <th className="px-4 py-3">Score</th>
                                      <th className="px-4 py-3">Accuracy</th>
                                      <th className="px-4 py-3">RPR</th>
                                      <th className="px-4 py-3">Star Rating</th>
                                      <th className="px-4 py-3">Max Combo</th>
                                      <th className="px-4 py-3">Rank</th>
                                      <th className="px-4 py-3">Mods</th>
                                      <th className="px-4 py-3">Hits</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedScores.map((score) => {
                                      const playerProfile =
                                        playerLookup[score.userId] ??
                                        detail.players.find((player) => player.id === score.userId);
                                      const stats = score.statistics ?? {};
                                      const hits = `${stats.count_300 ?? 0}/${stats.count_100 ?? 0}/${stats.count_miss ?? 0}`;
                                      const mods = score.mods ?? [];
                                      
                                      
                                      const gameRPR = rprDeltas.get(game.id);
                                      const playerRPR = gameRPR?.get(score.userId);
                                      const rprDelta = playerRPR?.delta ?? 0;
                                      
                                      return (
                                        <tr key={score.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                          <td className="px-4 py-3">
                                            <PlayerAvatarLink
                                              userId={score.userId}
                                              username={playerProfile?.username ?? score.username}
                                              avatarUrl={playerProfile?.avatarUrl}
                                              size="sm"
                                              nameClassName="text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-3 text-zinc-200 font-medium">{(score.score ?? 0).toLocaleString()}</td>
                                          <td className="px-4 py-3 text-cyan-300 font-medium">{(score.accuracy ?? 0).toFixed(2)}%</td>
                                          <td className="px-4 py-3">
                                            <span className={`font-bold ${
                                              rprDelta > 0 ? 'text-green-400' :
                                              rprDelta < 0 ? 'text-red-400' : 'text-zinc-400'
                                            }`}>
                                              {rprDelta > 0 ? '+' : ''}{rprDelta}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <ModStarRating 
                                              beatmapId={map.id} 
                                              mods={mods}
                                              baseStarRating={map.starRating}
                                            />
                                          </td>
                                          <td className="px-4 py-3 text-zinc-200">{score.maxCombo ?? 0}x</td>
                                          <td className="px-4 py-3 text-zinc-200">{score.rank ?? score.grade ?? '—'}</td>
                                          <td className="px-4 py-3 text-zinc-400 uppercase text-xs">{(mods.length ? mods.join(' + ') : 'No Mods')}</td>
                                          <td className="px-4 py-3 text-zinc-400 text-xs">300/100/Miss: {hits}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapsList;
