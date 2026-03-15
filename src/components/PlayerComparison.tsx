import { useEffect, useMemo, useRef, useState } from 'react';
import { FiTrendingUp, FiUsers, FiChevronDown } from 'react-icons/fi';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import type { AggregatedPlayer } from '../types/osu';
import PlayerAvatarLink from './PlayerAvatarLink';
import { buildRatings, calculateComposite } from '../utils/ranking';

const formatPercent = (value: number, fractionDigits = 2) => `${value.toFixed(fractionDigits)}%`;
const formatRate = (value: number) => `${(value * 100).toFixed(1)}%`;

const getRatingTier = (rating: number) => {
  if (rating >= 3000) return { label: 'Legend', color: 'text-yellow-400' };
  if (rating >= 2000) return { label: 'Master', color: 'text-purple-400' };
  if (rating >= 1000) return { label: 'Advanced', color: 'text-cyan-400' };
  if (rating >= 0) return { label: 'Intermediate', color: 'text-green-400' };
  return { label: 'Beginner', color: 'text-red-400' };
};

interface CustomDropdownProps {
  label: string;
  selectedId: number | null;
  onChange: (id: number | null) => void;
  players: AggregatedPlayer[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CustomDropdown = ({ label, selectedId, onChange, players, isOpen, setIsOpen }: CustomDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedPlayer = players.find((p) => p.id === selectedId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <label className="text-xs uppercase tracking-wide text-zinc-500 mb-2 block">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/60 hover:bg-white/10 transition-colors flex items-center justify-between"
      >
        <span>{selectedPlayer ? selectedPlayer.username : 'Select player'}</span>
        <FiChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          <button
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 transition-colors"
          >
            Select player
          </button>
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => {
                onChange(player.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                selectedId === player.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-white'
              }`}
            >
              {player.username}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PlayerComparison = () => {
  const { players, matches } = useMatchContext();
  const [playerAId, setPlayerAId] = useState<number | null>(() => players[0]?.id ?? null);
  const [playerBId, setPlayerBId] = useState<number | null>(() => players[1]?.id ?? null);
  const [dropdownAOpen, setDropdownAOpen] = useState(false);
  const [dropdownBOpen, setDropdownBOpen] = useState(false);
  const [showDirectDetails, setShowDirectDetails] = useState(false);
  const [showIndirectDetails, setShowIndirectDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  
  const playerRatings = useMemo(() => {
    const ratings = buildRatings(matches);
    const ratingMap = new Map<number, number>();
    ratings.forEach((state) => {
      const composite = calculateComposite(state);
      ratingMap.set(state.userId, composite);
    });
    return ratingMap;
  }, [matches]);

  const playerMap = useMemo(() => {
    const map = new Map<number, AggregatedPlayer>();
    players.forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const playerA = playerAId != null ? playerMap.get(playerAId) ?? null : null;
  const playerB = playerBId != null ? playerMap.get(playerBId) ?? null : null;

  
  const headToHeadStats = useMemo(() => {
    if (!playerAId || !playerBId || !playerA || !playerB) {
      return null;
    }

    let playerAWins = 0;
    let playerBWins = 0;
    let totalDirectGames = 0;
    let playerAIndirectWins = 0;
    let playerBIndirectWins = 0;
    let totalIndirectGames = 0;

    type DirectGame = {
      beatmapTitle: string;
      beatmapDifficulty: string;
      matchName: string;
      playerAScore: number;
      playerBScore: number;
      playerAAccuracy: number;
      playerBAccuracy: number;
      mods: string[];
      winner: 'A' | 'B' | 'tie';
    };

    type IndirectGame = {
      beatmapTitle: string;
      beatmapDifficulty: string;
      playerAMatchName: string;
      playerBMatchName: string;
      playerAScore: number;
      playerBScore: number;
      playerAAccuracy: number;
      playerBAccuracy: number;
      mods: string[];
      winner: 'A' | 'B' | 'tie';
    };

    const directGames: DirectGame[] = [];
    const indirectGames: IndirectGame[] = [];

    
    const normalizeMods = (mods: string[]) => {
      return mods.map(m => m === 'NC' ? 'DT' : m).sort().join(',');
    };

    
    matches.forEach((match) => {
      match.games.forEach((game) => {
        const aScore = game.scores?.find((s) => s.userId === playerAId);
        const bScore = game.scores?.find((s) => s.userId === playerBId);

        
        if (aScore && bScore) {
          totalDirectGames++;
          const aValue = aScore.score ?? 0;
          const bValue = bScore.score ?? 0;
          let winner: 'A' | 'B' | 'tie' = 'tie';

          if (aValue > bValue) {
            playerAWins++;
            winner = 'A';
          } else if (bValue > aValue) {
            playerBWins++;
            winner = 'B';
          }

          directGames.push({
            beatmapTitle: game.beatmap?.title ?? 'Unknown',
            beatmapDifficulty: game.beatmap?.difficulty ?? '',
            matchName: match.name,
            playerAScore: aValue,
            playerBScore: bValue,
            playerAAccuracy: aScore.accuracy ?? 0,
            playerBAccuracy: bScore.accuracy ?? 0,
            mods: aScore.mods ?? [],
            winner,
          });
        }
      });
    });

    
    const playerAScores = new Map<string, { score: number; accuracy: number; beatmapTitle: string; beatmapDifficulty: string; mods: string[]; matchName: string }>();
    const playerBScores = new Map<string, { score: number; accuracy: number; beatmapTitle: string; beatmapDifficulty: string; mods: string[]; matchName: string }>();

    matches.forEach((match) => {
      match.games.forEach((game) => {
        const beatmapId = game.beatmap?.id;
        if (!beatmapId) return;

        const aScore = game.scores?.find((s) => s.userId === playerAId);
        const bScore = game.scores?.find((s) => s.userId === playerBId);

        
        if (aScore && bScore) return;

        if (aScore) {
          const key = `${beatmapId}:${normalizeMods(aScore.mods ?? [])}`;
          const current = playerAScores.get(key);
          if (!current || (aScore.score ?? 0) > current.score) {
            playerAScores.set(key, {
              score: aScore.score ?? 0,
              accuracy: aScore.accuracy ?? 0,
              beatmapTitle: game.beatmap?.title ?? 'Unknown',
              beatmapDifficulty: game.beatmap?.difficulty ?? '',
              mods: aScore.mods ?? [],
              matchName: match.name,
            });
          }
        }

        if (bScore) {
          const key = `${beatmapId}:${normalizeMods(bScore.mods ?? [])}`;
          const current = playerBScores.get(key);
          if (!current || (bScore.score ?? 0) > current.score) {
            playerBScores.set(key, {
              score: bScore.score ?? 0,
              accuracy: bScore.accuracy ?? 0,
              beatmapTitle: game.beatmap?.title ?? 'Unknown',
              beatmapDifficulty: game.beatmap?.difficulty ?? '',
              mods: bScore.mods ?? [],
              matchName: match.name,
            });
          }
        }
      });
    });

    
    playerAScores.forEach((aData, key) => {
      const bData = playerBScores.get(key);
      if (bData) {
        totalIndirectGames++;
        let winner: 'A' | 'B' | 'tie' = 'tie';

        if (aData.score > bData.score) {
          playerAIndirectWins++;
          winner = 'A';
        } else if (bData.score > aData.score) {
          playerBIndirectWins++;
          winner = 'B';
        }

        indirectGames.push({
          beatmapTitle: aData.beatmapTitle,
          beatmapDifficulty: aData.beatmapDifficulty,
          playerAMatchName: aData.matchName,
          playerBMatchName: bData.matchName,
          playerAScore: aData.score,
          playerBScore: bData.score,
          playerAAccuracy: aData.accuracy,
          playerBAccuracy: bData.accuracy,
          mods: aData.mods,
          winner,
        });
      }
    });

    return {
      totalDirectGames,
      playerAWins,
      playerBWins,
      directTies: totalDirectGames - playerAWins - playerBWins,
      totalIndirectGames,
      playerAIndirectWins,
      playerBIndirectWins,
      indirectTies: totalIndirectGames - playerAIndirectWins - playerBIndirectWins,
      directGames,
      indirectGames,
    };
  }, [playerAId, playerBId, playerA, playerB, matches]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    anime({
      targets: containerRef.current.querySelectorAll('.comparison-card'),
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 450,
      delay: anime.stagger(90),
      easing: 'easeOutCubic',
    });
  }, [playerAId, playerBId]);

  const handleSwap = () => {
    setPlayerAId(playerBId);
    setPlayerBId(playerAId);
  };

  const renderPlayerDetails = (player: AggregatedPlayer | null, label: string) => {
    if (!player) {
      return (
        <div className="comparison-card glass rounded-xl p-4 text-center text-sm text-zinc-500 border border-dashed border-white/20">
          Select a player to compare.
        </div>
      );
    }

    const rpr = playerRatings.get(player.id) ?? 0;
    const tier = getRatingTier(rpr);

    return (
      <div className="comparison-card glass rounded-xl p-5 space-y-4 border border-white/10">
        <div className="flex items-center gap-3">
          <PlayerAvatarLink
            userId={player.id}
            username={player.username}
            avatarUrl={player.avatarUrl}
            size="lg"
            className="shrink-0"
            nameClassName="text-xl"
          />
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              {player.matchesPlayed} matches · {player.gamesPlayed} games
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500 uppercase">RPR Rating</p>
            <p className={`font-bold ${tier.color}`}>{rpr.toFixed(0)}</p>
            <p className="text-[10px] text-zinc-600 uppercase">{tier.label}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Win Rate</p>
            <p className="text-white font-semibold">{formatRate(player.winRate)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Avg Accuracy</p>
            <p className="text-white font-semibold">{formatPercent(player.averageAccuracy)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Best Accuracy</p>
            <p className="text-white font-semibold">{formatPercent(player.bestAccuracy)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Avg Score</p>
            <p className="text-white font-semibold">{player.averageScore.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Best Score</p>
            <p className="text-white font-semibold">{player.bestScore.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Total Wins</p>
            <p className="text-white font-semibold">{player.wins}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase">Games Played</p>
            <p className="text-white font-semibold">{player.gamesPlayed}</p>
          </div>
        </div>

        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          Top Mods:{' '}
          {Object.keys(player.modsUsed).length === 0
            ? 'None'
            : Object.entries(player.modsUsed)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([mod, count]) => `${mod} (${count})`)
                .join(', ')}
        </div>
      </div>
    );
  };

  const availablePlayers = useMemo(() => players.slice(0, 50), [players]);

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FiTrendingUp className="text-cyan-300 flex-shrink-0" />
            Head-to-Head Comparison
          </h3>
          <p className="text-sm text-zinc-500">
            Select any two players to evaluate accuracy, scores, and win rates side by side.
          </p>
        </div>
        <button
          onClick={handleSwap}
          className="text-xs uppercase tracking-wide text-cyan-300 hover:text-cyan-200 flex-shrink-0 whitespace-nowrap"
        >
          Swap players
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CustomDropdown
          label="Player A"
          selectedId={playerAId}
          onChange={setPlayerAId}
          players={availablePlayers}
          isOpen={dropdownAOpen}
          setIsOpen={setDropdownAOpen}
        />
        <CustomDropdown
          label="Player B"
          selectedId={playerBId}
          onChange={setPlayerBId}
          players={availablePlayers}
          isOpen={dropdownBOpen}
          setIsOpen={setDropdownBOpen}
        />
      </div>

      {headToHeadStats && (headToHeadStats.totalDirectGames > 0 || headToHeadStats.totalIndirectGames > 0) && (
        <div className="glass rounded-xl p-5 border border-cyan-500/20 space-y-4">
          <h4 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">Head-to-Head Record</h4>
          
          {headToHeadStats.totalDirectGames > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Direct Matches (Same Game)</p>
                <button
                  onClick={() => setShowDirectDetails(!showDirectDetails)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 uppercase tracking-wide"
                >
                  {showDirectDetails ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{headToHeadStats.playerAWins}</p>
                  <p className="text-xs text-zinc-500 uppercase">{playerA?.username}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-400">{headToHeadStats.directTies}</p>
                  <p className="text-xs text-zinc-500 uppercase">Ties</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{headToHeadStats.playerBWins}</p>
                  <p className="text-xs text-zinc-500 uppercase">{playerB?.username}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500 text-center mt-2">
                {headToHeadStats.totalDirectGames} direct matchup{headToHeadStats.totalDirectGames !== 1 ? 's' : ''}
              </p>

              {showDirectDetails && headToHeadStats.directGames.length > 0 && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {headToHeadStats.directGames.map((game, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-3 text-xs">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="text-white font-semibold">{game.beatmapTitle}</p>
                          <p className="text-zinc-500">{game.beatmapDifficulty}</p>
                          <p className="text-zinc-600 text-[10px] mt-1">Match: {game.matchName}</p>
                        </div>
                        {game.mods.length > 0 && (
                          <span className="text-cyan-400 font-mono">{game.mods.join(', ')}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={game.winner === 'A' ? 'text-green-400' : 'text-zinc-400'}>
                          <p className="font-semibold">{playerA?.username}</p>
                          <p>{game.playerAScore.toLocaleString()} · {game.playerAAccuracy.toFixed(2)}%</p>
                        </div>
                        <div className={game.winner === 'B' ? 'text-green-400' : 'text-zinc-400'}>
                          <p className="font-semibold">{playerB?.username}</p>
                          <p>{game.playerBScore.toLocaleString()} · {game.playerBAccuracy.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {headToHeadStats.totalIndirectGames > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Indirect Comparison (Same Map+Mods)</p>
                <button
                  onClick={() => setShowIndirectDetails(!showIndirectDetails)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 uppercase tracking-wide"
                >
                  {showIndirectDetails ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-cyan-300">{headToHeadStats.playerAIndirectWins}</p>
                  <p className="text-xs text-zinc-500 uppercase">{playerA?.username}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-400">{headToHeadStats.indirectTies}</p>
                  <p className="text-xs text-zinc-500 uppercase">Ties</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-300">{headToHeadStats.playerBIndirectWins}</p>
                  <p className="text-xs text-zinc-500 uppercase">{playerB?.username}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500 text-center mt-2">
                {headToHeadStats.totalIndirectGames} comparable score{headToHeadStats.totalIndirectGames !== 1 ? 's' : ''} (NC=DT)
              </p>

              {showIndirectDetails && headToHeadStats.indirectGames.length > 0 && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {headToHeadStats.indirectGames.map((game, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-3 text-xs">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="text-white font-semibold">{game.beatmapTitle}</p>
                          <p className="text-zinc-500">{game.beatmapDifficulty}</p>
                        </div>
                        {game.mods.length > 0 && (
                          <span className="text-cyan-400 font-mono">{game.mods.join(', ')}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={game.winner === 'A' ? 'text-cyan-300' : 'text-zinc-400'}>
                          <p className="font-semibold">{playerA?.username}</p>
                          <p>{game.playerAScore.toLocaleString()} · {game.playerAAccuracy.toFixed(2)}%</p>
                          <p className="text-zinc-600 text-[10px] mt-1">{game.playerAMatchName}</p>
                        </div>
                        <div className={game.winner === 'B' ? 'text-cyan-300' : 'text-zinc-400'}>
                          <p className="font-semibold">{playerB?.username}</p>
                          <p>{game.playerBScore.toLocaleString()} · {game.playerBAccuracy.toFixed(2)}%</p>
                          <p className="text-zinc-600 text-[10px] mt-1">{game.playerBMatchName}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPlayerDetails(playerA, 'Player A')}
        {renderPlayerDetails(playerB, 'Player B')}
      </div>

      <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-2">
        <FiUsers size={14} className="text-cyan-300" />
        Only players with at least one recorded score appear in this list.
      </p>
    </div>
  );
};

export default PlayerComparison;
