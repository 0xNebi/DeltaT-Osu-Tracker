import { useEffect, useMemo, useRef, useState } from 'react';
import { FiExternalLink, FiMusic, FiSearch, FiPlay, FiPause } from 'react-icons/fi';
import { format } from 'date-fns';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import PlayerAvatarLink from './PlayerAvatarLink';
import { audioPlayer } from '../services/audioPlayer';

interface ProjectsTableProps {
  limit?: number;
}

const formatMods = (mods?: string[]) => {
  if (!mods || mods.length === 0) {
    return 'No Mods';
  }
  return mods.join(' + ');
};

const ProjectsTable = ({ limit }: ProjectsTableProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const { recentGames, playerLookup, censorMatchName, censorMatchId, settings } = useMatchContext();
  const [query, setQuery] = useState('');
  const [playingBeatmapsetId, setPlayingBeatmapsetId] = useState<number | null>(null);

  
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe((isPlaying, beatmapsetId) => {
      setPlayingBeatmapsetId(isPlaying ? beatmapsetId : null);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!tableRef.current) {
      return;
    }
    anime({
      targets: tableRef.current.querySelectorAll('tbody tr'),
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 450,
      delay: anime.stagger(50),
      easing: 'easeOutCubic',
    });
  }, [recentGames.length, query]);

  const handlePlayPause = (beatmapsetId: number | undefined) => {
    if (!beatmapsetId) return;
    audioPlayer.toggle(beatmapsetId);
  };

  const filteredGames = useMemo(() => {
    if (!query.trim()) {
      return recentGames;
    }

    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    return recentGames.filter((game) => {
      const haystack = [
        game.beatmapTitle,
        game.difficulty ?? '',
        game.topPlayer,
        game.matchName,
        formatMods(game.mods ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return keywords.every((keyword) => haystack.includes(keyword));
    });
  }, [recentGames, query]);

  const visibleGames = useMemo(() => {
    if (typeof limit === 'number') {
      return filteredGames.slice(0, limit);
    }
    return filteredGames;
  }, [filteredGames, limit]);

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Games &amp; Rounds</h3>
          <p className="text-sm text-zinc-500">
            Beatmaps played across tracked matches with top performers and mods.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search beatmaps, players, or mods"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 transition-all"
            type="search"
          />
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto max-h-[calc(100vh-16rem)] overflow-y-auto">
        <table className="w-full min-w-[680px]">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10">
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-3 px-4 font-medium">Beatmap</th>
              <th className="py-3 px-4 font-medium">Match</th>
              <th className="py-3 px-4 font-medium">Top Player</th>
              <th className="py-3 px-4 font-medium">Accuracy</th>
              <th className="py-3 px-4 font-medium">Top Score</th>
              <th className="py-3 px-4 font-medium">Mods</th>
              <th className="py-3 px-4 font-medium">Played</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {visibleGames.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 px-4 text-center text-sm text-zinc-500">
                  No games match your search yet. Import additional matches to grow the archive.
                </td>
              </tr>
            )}
            {visibleGames.map((game) => {
              const playedAt = game.startTime ? format(new Date(game.startTime), 'MMM d, yyyy') : 'Unknown';
              const beatmapUrl = game.beatmapId && game.beatmapsetId
                ? `https://osu.ppy.sh/beatmapsets/${game.beatmapsetId}#osu/${game.beatmapId}`
                : null;
              const isPlaying = playingBeatmapsetId === game.beatmapsetId;
              
              return (
                <tr key={`${game.matchId}-${game.id}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => handlePlayPause(game.beatmapsetId)}
                        disabled={!game.beatmapsetId}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                          game.beatmapsetId
                            ? isPlaying
                              ? 'bg-cyan-500/30 text-cyan-200 hover:bg-cyan-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                            : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                        }`}
                        title={
                          !game.beatmapsetId
                            ? 'Preview not available'
                            : isPlaying
                            ? 'Pause preview'
                            : 'Play preview'
                        }
                      >
                        {isPlaying ? <FiPause size={16} /> : game.beatmapsetId ? <FiPlay size={16} /> : <FiMusic size={16} />}
                      </button>
                      <div className="min-w-0">
                        {beatmapUrl ? (
                          <a
                            href={beatmapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-white font-medium leading-tight hover:text-cyan-300 transition-colors block truncate max-w-[240px]"
                            title={game.beatmapTitle}
                          >
                            {game.beatmapTitle}
                          </a>
                        ) : (
                          <p className="text-white font-medium leading-tight truncate max-w-[240px]" title={game.beatmapTitle}>
                            {game.beatmapTitle}
                          </p>
                        )}
                        {game.difficulty && <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[240px]" title={game.difficulty}>{game.difficulty}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-white/90 font-medium truncate max-w-[180px]" title={settings.privacyMode ? undefined : game.matchName}>
                      {censorMatchName(game.matchName, game.matchId)}
                    </p>
                    <p className="text-xs text-zinc-500">Match {censorMatchId(game.matchId)}</p>
                  </td>
                  <td className="py-4 px-4">
                    {game.topPlayerId ? (
                      <PlayerAvatarLink
                        userId={game.topPlayerId}
                        username={playerLookup[game.topPlayerId]?.username ?? game.topPlayer}
                        avatarUrl={playerLookup[game.topPlayerId]?.avatarUrl}
                        size="sm"
                        nameClassName="text-sm"
                      />
                    ) : (
                      <p className="text-sm text-zinc-500">{settings.privacyMode ? 'Player' : game.topPlayer}</p>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-cyan-300 font-medium">{game.topAccuracy.toFixed(2)}%</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-zinc-300 font-medium">{game.topScore.toLocaleString()}</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide">{formatMods(game.mods)}</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-xs text-zinc-400">{playedAt}</p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                      onClick={() => window.open(`https://osu.ppy.sh/community/matches/${game.matchId}`, '_blank')}
                    >
                      View
                      <FiExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectsTable;
