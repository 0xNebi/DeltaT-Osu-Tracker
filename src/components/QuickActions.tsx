import { useEffect, useRef, useState } from 'react';
import {
  FiDownload,
  FiUpload,
  FiRefreshCw,
  FiTrash2,
  FiExternalLink,
  FiSearch,
} from 'react-icons/fi';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import { parseMatchId } from '../utils/matchParser';

interface QuickActionsProps {
  condensed?: boolean;
  showExportOnly?: boolean;
  showDataControlsOnly?: boolean;
}

const QuickActions = ({ condensed = false, showExportOnly = false, showDataControlsOnly = false }: QuickActionsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [matchInput, setMatchInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const {
    importMatch,
    refreshMatch,
    selectedMatch,
    matches,
    exportData,
    clearData,
    isLoading,
  } = useMatchContext();

  useEffect(() => {
    anime({
      targets: containerRef.current?.querySelectorAll('.quick-action'),
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 500,
      delay: anime.stagger(70),
      easing: 'easeOutCubic',
    });
  }, []);

  const handleImport = async () => {
    console.log('[QuickActions] 🚀 Import button clicked');
    console.log('[QuickActions] Input value:', matchInput);
    
    setInputError(null);
    const parsed = parseMatchId(matchInput);
    
    console.log('[QuickActions] Parsed ID:', parsed);
    
    if (!parsed) {
      console.error('[QuickActions] ❌ Invalid input format');
      setInputError('Enter a valid osu! match link or numeric ID.');
      return;
    }
    
    console.log('[QuickActions] ✅ Valid match ID, calling importMatch...');
    await importMatch(matchInput);
    
    console.log('[QuickActions] ✅ Import completed, clearing input');
    setMatchInput('');
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `osu-match-tracker-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const matchCount = matches.length;

  const shouldRenderInput = !showExportOnly && !showDataControlsOnly;
  const shouldRenderPrimaryActions = !showExportOnly && !showDataControlsOnly;
  const shouldRenderExport = !showDataControlsOnly;

  const cards: Array<{
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    accent: string;
    action: () => void;
    disabled?: boolean;
  }> = [];

  if (shouldRenderPrimaryActions) {
    cards.push(
      {
        id: 'refresh',
        title: 'Refresh Latest Match',
        description: selectedMatch ? selectedMatch.name : 'Select a match to refresh',
        icon: FiRefreshCw,
        accent: 'from-cyan-500 to-blue-500',
        action: () => {
          if (selectedMatch) {
            refreshMatch(selectedMatch.id);
          }
        },
        disabled: !selectedMatch || isLoading,
      },
      {
        id: 'clear',
        title: 'Clear Tracked Data',
        description: 'Remove all stored matches from this device',
        icon: FiTrash2,
        accent: 'from-red-500 to-pink-500',
        action: () => clearData(),
        disabled: matchCount === 0,
      },
      {
        id: 'view-last',
        title: 'Open osu! Lobby',
        description: selectedMatch?.url ?? 'Opens latest match in osu! web',
        icon: FiExternalLink,
        accent: 'from-purple-500 to-indigo-500',
        action: () => {
          if (selectedMatch?.url) {
            window.open(selectedMatch.url, '_blank');
          }
        },
        disabled: !selectedMatch?.url,
      },
    );
  }

  if (shouldRenderExport) {
    cards.push({
      id: 'export',
      title: 'Export Match Archive',
      description: `${matchCount} matches stored locally`,
      icon: FiDownload,
      accent: 'from-amber-500 to-orange-500',
      action: handleExport,
      disabled: matchCount === 0,
    });
  }

  if (!showExportOnly && !showDataControlsOnly) {
    cards.push({
      id: 'import',
      title: 'Import from JSON',
      description: 'Paste exported archive to restore matches',
      icon: FiUpload,
      accent: 'from-emerald-500 to-green-500',
      action: () => setInputError('Bulk import coming soon'),
      disabled: true,
    });
  }

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      {!condensed && (
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Tracker Controls</h3>
          <p className="text-sm text-zinc-500">
            Manage match imports, data exports, and quick maintenance tasks.
          </p>
        </div>
      )}

      {shouldRenderInput && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-300">Add match by link or ID</label>
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              value={matchInput}
              onChange={(event) => setMatchInput(event.target.value)}
              type="text"
              placeholder="https://osu.ppy.sh/community/matches/123456789"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-11 pr-36 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 transition-all"
            />
            <button
              onClick={handleImport}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-60"
              disabled={!matchInput.trim()}
            >
              Import
            </button>
          </div>
          {inputError && <p className="text-xs text-red-400">{inputError}</p>}
        </div>
      )}

      <div ref={containerRef} className={`grid ${condensed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={card.action}
            disabled={card.disabled}
            className="quick-action group relative overflow-hidden p-4 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />

            <div className="relative flex items-start gap-3">
              <div className={`w-11 h-11 bg-gradient-to-br ${card.accent} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                <card.icon size={22} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-medium mb-1 group-hover:text-cyan-300 transition-colors">
                  {card.title}
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{card.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
