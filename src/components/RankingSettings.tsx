import { FiSliders, FiTarget, FiFilter, FiTrash2, FiAlertTriangle, FiEyeOff } from 'react-icons/fi';
import { useMatchContext } from '../context/MatchContext';
import { useState } from 'react';

const Toggle = ({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <label htmlFor={id} className="flex items-start gap-4 p-4 border border-white/10 rounded-xl hover:border-cyan-500/40 transition-colors cursor-pointer">
    <div className="pt-1">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        id={id}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
          value ? 'bg-cyan-500/70' : 'bg-white/10'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
    <div>
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  </label>
);

const RankingSettings = () => {
  const { settings, updateSettings, storedMatches, removeMatch, clearData } = useMatchContext();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleDeleteMatch = (matchId: number) => {
    if (confirmDelete === matchId) {
      removeMatch(matchId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(matchId);
      
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  return (
    <div className="space-y-6">

    
    <div className="glass rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/40 to-pink-500/40 flex items-center justify-center text-violet-200">
          <FiEyeOff size={18} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Privacy / Streamer Mode</h3>
          <p className="text-sm text-zinc-500">
            Hides all personally identifiable information across the entire dashboard — great for screen‑sharing or publishing.
          </p>
        </div>
      </div>

      <Toggle
        id="setting-privacy-mode"
        label="Enable Privacy Mode"
        description="Replaces all player names with 'Player #N', hides avatars, and censors match/room names. Map titles are unaffected. Applies dashboard-wide instantly."
        value={settings.privacyMode}
        onChange={(next) => updateSettings({ privacyMode: next })}
      />

      {settings.privacyMode && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-300">
          <p className="font-semibold mb-1">🔒 Privacy Mode is ON</p>
          <p>Player names and avatars are anonymized. Match names are replaced with Room numbers. Disable to restore real data.</p>
        </div>
      )}
    </div>

    
    <div className="glass rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-cyan-200">
          <FiSliders size={18} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Ranking Preferences</h3>
          <p className="text-sm text-zinc-500">
            Tune how wins are awarded when aggregating RX lobbies and decide whether non-RX scores affect leaderboards.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Toggle
          id="setting-accuracy-wins"
          label="Use accuracy as the win condition"
          description="When enabled, players with the highest accuracy per map are considered winners instead of the highest score. Ideal for RX rooms where score scaling differs."
          value={settings.useAccuracyForWins}
          onChange={(next) => updateSettings({ useAccuracyForWins: next })}
        />
        <Toggle
          id="setting-exclude-nonrx"
          label="Exclude non-RX scores from win/loss tracking"
          description="Only players using the RX mod will receive wins or losses. Other players are still displayed, but their scores do not influence the win rankings."
          value={settings.excludeNonRxWins}
          onChange={(next) => updateSettings({ excludeNonRxWins: next })}
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs text-zinc-500 space-y-2">
        <p className="flex items-center gap-2 text-zinc-400 font-semibold uppercase tracking-wide text-[11px]">
          <FiTarget size={12} /> Tips
        </p>
        <p>
          Accuracy-based wins pair well with RX-exclusive lobbies, ensuring leaderboard standings reflect precision over traditional score.
        </p>
        <p className="flex items-center gap-2 text-zinc-400 font-semibold uppercase tracking-wide text-[11px]">
          <FiFilter size={12} /> Note
        </p>
        <p>
          Disabling the non-RX filter restores osu! score-based rankings, allowing mixed mod rooms to compare results fairly.
        </p>
      </div>

      
      <div className="pt-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/40 to-orange-500/40 flex items-center justify-center text-red-200">
            <FiTrash2 size={18} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Match Management</h3>
            <p className="text-sm text-zinc-500">
              Remove individual matches or clear all data
            </p>
          </div>
        </div>

        {storedMatches.length > 0 ? (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-semibold">Imported Matches ({storedMatches.length})</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {storedMatches.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border border-white/10 rounded-lg bg-white/[0.02] hover:border-red-500/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{settings.privacyMode ? `Room #${storedMatches.indexOf(entry) + 1}` : entry.match.name}</p>
                    <p className="text-xs text-zinc-500">
                      ID: {settings.privacyMode ? `#${storedMatches.indexOf(entry) + 1}` : entry.id} • {entry.match.games.length} games • 
                      {entry.match.startTime ? new Date(entry.match.startTime).toLocaleDateString() : 'No date'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMatch(entry.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      confirmDelete === entry.id
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-white/5 text-zinc-400 hover:bg-red-500/20 hover:text-red-300'
                    }`}
                  >
                    {confirmDelete === entry.id ? 'Confirm Delete' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mb-4">No matches imported yet.</p>
        )}

        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to delete ALL match data? This cannot be undone.')) {
              clearData();
            }
          }}
          className="w-full px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          <FiAlertTriangle size={16} />
          Clear All Match Data
        </button>
      </div>
    </div>
    </div>
  );
};

export default RankingSettings;
