import { useEffect, useMemo, useRef, useState } from 'react';
import { FiUserCheck, FiSave } from 'react-icons/fi';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import type { AggregatedPlayer } from '../types/osu';
import PlayerAvatarLink from './PlayerAvatarLink';
import CustomDropdown from './CustomDropdown';

const formatPercent = (value: number, digits = 2) => `${value.toFixed(digits)}%`;
const formatRate = (value: number) => `${(value * 100).toFixed(1)}%`;

const PersonalStats = () => {
  const { players, personalUserId, setPersonalUserId } = useMatchContext();
  const [selectedId, setSelectedId] = useState<number | ''>(personalUserId ?? '');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const playerMap = useMemo(() => {
    const map = new Map<number, AggregatedPlayer>();
    players.forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const selectedPlayer = typeof selectedId === 'number' ? playerMap.get(selectedId) ?? null : null;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    anime({
      targets: containerRef.current.querySelectorAll('.stat-card'),
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 400,
      delay: anime.stagger(70),
      easing: 'easeOutCubic',
    });
  }, [selectedId]);

  const handleSave = () => {
    if (selectedId === '') {
      setPersonalUserId(null);
      return;
    }
    setPersonalUserId(Number(selectedId));
  };

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FiUserCheck className="text-cyan-300" />
            Personal Performance
          </h3>
          <p className="text-sm text-zinc-500">
            Pick your osu! profile to track wins, accuracy, and best scores across imported matches.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <CustomDropdown
            value={selectedId === '' ? '' : String(selectedId)}
            onChange={(value) => {
              setSelectedId(value ? Number(value) : '');
            }}
            options={[
              { value: '', label: 'Select player' },
              ...players.map((player) => ({
                value: String(player.id),
                label: player.username,
              })),
            ]}
            isOpen={dropdownOpen}
            setIsOpen={setDropdownOpen}
            placeholder="Select player"
            className="w-full md:min-w-[200px]"
          />
          <button
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium hover:from-cyan-600 hover:to-blue-600 transition-colors"
          >
            <FiSave size={14} />
            Save
          </button>
        </div>
      </div>

      {selectedPlayer ? (
        <div className="space-y-4">
          <PlayerAvatarLink
            userId={selectedPlayer.id}
            username={selectedPlayer.username}
            avatarUrl={selectedPlayer.avatarUrl}
            size="md"
            nameClassName="text-xl"
          />
          <div ref={containerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card border border-white/10 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase">Matches Played</p>
              <p className="text-2xl font-semibold text-white">{selectedPlayer.matchesPlayed}</p>
              <p className="text-xs text-zinc-500 mt-1">Across {selectedPlayer.gamesPlayed} games</p>
            </div>
            <div className="stat-card border border-white/10 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase">Average Accuracy</p>
              <p className="text-2xl font-semibold text-cyan-300">{formatPercent(selectedPlayer.averageAccuracy)}</p>
              <p className="text-xs text-zinc-500 mt-1">Best {formatPercent(selectedPlayer.bestAccuracy)}</p>
            </div>
            <div className="stat-card border border-white/10 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase">Win Rate</p>
              <p className="text-2xl font-semibold text-white">{formatRate(selectedPlayer.winRate)}</p>
              <p className="text-xs text-zinc-500 mt-1">{selectedPlayer.wins} wins · {selectedPlayer.losses} losses</p>
            </div>
            <div className="stat-card border border-white/10 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase">Best Score</p>
              <p className="text-2xl font-semibold text-white">{selectedPlayer.bestScore.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-1">Average {Math.round(selectedPlayer.averageScore).toLocaleString()}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-zinc-500">
          Choose yourself or a teammate to populate this section with personalized metrics.
        </div>
      )}
    </div>
  );
};

export default PersonalStats;
