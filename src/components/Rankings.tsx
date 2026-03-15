import { useMemo, useState } from 'react';
import {
  FiTrendingUp, FiAward, FiInfo, FiChevronDown, FiChevronUp,
  FiDownload, FiExternalLink, FiUser, FiEyeOff,
} from 'react-icons/fi';
import { useMatchContext } from '../context/MatchContext';
import {
  runAlgorithm,
  ALGORITHM_META,
  type RankingAlgorithm,
} from '../utils/ranking';

type SortOrder = 'asc' | 'desc';

const ALGORITHMS: RankingAlgorithm[] = ['glicko-z', 'performance', 'wilson', 'elo', 'bayesian'];

const Rankings = () => {
  const { matches, settings, updateSettings, censorName } = useMatchContext();
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  const selectedAlgorithm = (settings.rankingAlgorithm as RankingAlgorithm) ?? 'glicko-z';
  const meta = ALGORITHM_META[selectedAlgorithm];

  const rawRankings = useMemo(() => runAlgorithm(selectedAlgorithm, matches), [selectedAlgorithm, matches]);

  const sortedRankings = useMemo(() => {
    const copy = [...rawRankings];
    copy.sort((a, b) => sortOrder === 'desc' ? b.score - a.score : a.score - b.score);
    return copy;
  }, [rawRankings, sortOrder]);

  const exportToJSON = () => {
    const data = sortedRankings.map((p, i) => ({
      rank: i + 1,
      userId: settings.privacyMode ? `#${i + 1}` : p.userId,
      username: censorName(p.username, p.userId),
      score: p.score,
      scoreDisplay: p.scoreDisplay,
      games: p.games,
      algorithm: selectedAlgorithm,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rankings-${selectedAlgorithm}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number): string => {
    if (selectedAlgorithm === 'glicko-z') {
      if (score >= 3000) return 'text-yellow-400';
      if (score >= 2000) return 'text-purple-400';
      if (score >= 1000) return 'text-cyan-400';
      if (score >= 0) return 'text-green-400';
      return 'text-red-400';
    }
    if (selectedAlgorithm === 'performance' || selectedAlgorithm === 'bayesian') {
      if (score >= 1.5) return 'text-yellow-400';
      if (score >= 0.8) return 'text-cyan-400';
      if (score >= 0) return 'text-green-400';
      return 'text-red-400';
    }
    if (selectedAlgorithm === 'wilson') {
      if (score >= 0.7) return 'text-yellow-400';
      if (score >= 0.5) return 'text-cyan-400';
      return 'text-green-400';
    }
    if (selectedAlgorithm === 'elo') {
      if (score >= 1700) return 'text-yellow-400';
      if (score >= 1600) return 'text-cyan-400';
      if (score >= 1400) return 'text-green-400';
      return 'text-red-400';
    }
    return 'text-white';
  };

  return (
    <div className="space-y-6">

      
      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-yellow-500/40 to-orange-500/40 flex items-center justify-center text-yellow-200">
              <FiAward size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white flex flex-wrap items-center gap-2">
                Rankings (Beta)
                {settings.privacyMode && (
                  <span className="flex items-center gap-1 text-xs font-normal text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-500/30">
                    <FiEyeOff size={11} /> Privacy On
                  </span>
                )}
              </h2>
              <p className="text-sm text-zinc-400">Advanced skill-based player rankings — choose your algorithm below</p>
            </div>
          </div>
          <button
            onClick={exportToJSON}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 hover:border-cyan-500/50 rounded-lg text-cyan-300 transition-all flex-shrink-0 whitespace-nowrap"
          >
            <FiDownload size={18} />
            <span className="font-medium">Export JSON</span>
          </button>
        </div>

        
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Ranking Algorithm</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {ALGORITHMS.map((algo) => {
              const m = ALGORITHM_META[algo];
              const isActive = selectedAlgorithm === algo;
              return (
                <button
                  key={algo}
                  onClick={() => { updateSettings({ rankingAlgorithm: algo }); setExpandedPlayer(null); }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'border-cyan-500/60 bg-cyan-500/15 text-white'
                      : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <p className={`text-xs font-bold mb-1 ${isActive ? 'text-cyan-300' : 'text-zinc-300'}`}>{m.label}</p>
                  <p className="text-[11px] text-zinc-500 leading-tight line-clamp-2">{m.desc.split('.')[0]}.</p>
                </button>
              );
            })}
          </div>
        </div>

        
        <div className="flex items-start gap-2 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg mt-4">
          <FiInfo size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-zinc-300">
            <p className="font-semibold text-cyan-300 mb-1">{meta.label}</p>
            <p>{meta.desc}</p>
          </div>
        </div>
      </div>

      
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiTrendingUp size={18} className="text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Leaderboard</h3>
            <span className="text-xs text-zinc-500 ml-2">{sortedRankings.length} players</span>
          </div>
          <button
            onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-cyan-400 transition-colors"
          >
            {meta.scoreName}
            {sortOrder === 'desc' ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide w-16">Rank</th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Player</th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{meta.scoreName}</th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Games</th>
                {(selectedAlgorithm === 'glicko-z' || selectedAlgorithm === 'bayesian') && (
                  <th className="text-left p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    {selectedAlgorithm === 'glicko-z' ? 'RD (±)' : 'σ'}
                  </th>
                )}
                <th className="text-center p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((player, index) => {
                const isExpanded = expandedPlayer === player.userId;
                const displayName = censorName(player.username, player.userId);

                return (
                  <>
                    <tr
                      key={player.userId}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-3">
                        {index < 3 ? (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-300' :
                            index === 1 ? 'bg-gray-400/20 text-gray-300' :
                            'bg-orange-600/20 text-orange-400'
                          }`}>{index + 1}</div>
                        ) : (
                          <span className="text-zinc-500 font-medium text-sm">#{index + 1}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {settings.privacyMode ? (
                          <div className="flex items-center gap-2 text-zinc-300">
                            <span className="w-8 h-8 rounded-full bg-zinc-700/60 flex items-center justify-center flex-shrink-0">
                              <FiUser size={14} className="text-zinc-400" />
                            </span>
                            <span className="font-medium">{displayName}</span>
                          </div>
                        ) : (
                          <a
                            href={`https://osu.ppy.sh/users/${player.userId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white font-medium hover:text-cyan-400 transition-colors flex items-center gap-1"
                          >
                            {displayName}
                            <FiExternalLink size={12} className="text-zinc-500" />
                          </a>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`text-lg font-bold ${getScoreColor(player.score)}`}>{player.scoreDisplay}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-zinc-400">{player.games}</span>
                      </td>
                      {(selectedAlgorithm === 'glicko-z' || selectedAlgorithm === 'bayesian') && (
                        <td className="p-3">
                          <span className={`text-sm ${
                            selectedAlgorithm === 'glicko-z'
                              ? ((player.uncertainty ?? 999) < 50 ? 'text-green-400' : (player.uncertainty ?? 999) < 100 ? 'text-yellow-400' : 'text-red-400')
                              : 'text-zinc-400'
                          }`}>
                            {selectedAlgorithm === 'glicko-z'
                              ? `±${Math.round(player.uncertainty ?? 0)}`
                              : (player.uncertainty ?? 0).toFixed(2)}
                          </span>
                        </td>
                      )}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!settings.privacyMode && (
                            <a
                              href={`#player/${player.userId}`}
                              className="px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs transition-all flex items-center gap-1"
                            >
                              <FiUser size={12} />
                              Profile
                            </a>
                          )}
                          <button
                            onClick={() => setExpandedPlayer(isExpanded ? null : player.userId)}
                            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-cyan-400 text-xs transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && player.details && (
                      <tr className="border-b border-white/5 bg-white/[0.03]">
                        <td colSpan={6} className="p-4">
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(player.details).map(([key, val]) => (
                              <div key={key} className="p-3 rounded-lg border border-white/10 bg-white/[0.02] min-w-[100px]">
                                <p className="text-xs font-semibold text-zinc-400 uppercase">{key}</p>
                                <p className="text-base font-bold text-white mt-1">{String(val)}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedRankings.length === 0 && (
          <div className="p-8 text-center text-zinc-500">
            <p>No ranking data available. Import some matches to see rankings!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rankings;
