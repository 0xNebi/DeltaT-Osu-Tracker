import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.tsx';
import DashboardHeader from './components/DashboardHeader.tsx';
import StatsGrid from './components/StatsGrid.tsx';
import AnalyticsCharts from './components/AnalyticsCharts.tsx';
import MatchHistory from './components/ActivityFeed.tsx';
import QuickActions from './components/QuickActions.tsx';
import ProjectsTable from './components/ProjectsTable.tsx';
import LeaderboardTable from './components/LeaderboardTable.tsx';
import PlayerComparison from './components/PlayerComparison.tsx';
import PersonalStats from './components/PersonalStats.tsx';
import PlayersGrid from './components/PlayersGrid.tsx';
import MapsList from './components/MapsList.tsx';
import TerminalBackground from './components/TerminalBackground.tsx';
import RankingSettings from './components/RankingSettings.tsx';
import Rankings from './components/Rankings.tsx';
import PlayerDetails from './components/PlayerDetails.tsx';
import PlayerDeepAnalysis from './components/PlayerDeepAnalysis.tsx';
import { useMatchContext } from './context/MatchContext';
import './index.css';

const DEFAULT_SECTION = 'overview';

const SECTION_KEYS = [
  'overview',
  'leaderboard',
  'rankings',
  'statistics',
  'history',
  'games',
  'players',
  'maps',
  'deep-analysis',
  'settings',
] as const;

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(DEFAULT_SECTION);
  const [playerDetailsId, setPlayerDetailsId] = useState<number | null>(null);
  const [deepAnalysisPlayerId, setDeepAnalysisPlayerId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const { error, dismissError, isLoading } = useMatchContext();

  const validSections = useMemo(() => new Set<string>(SECTION_KEYS), []);

  // Auto-open sidebar on desktop resize; auto-close when shrinking to mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsLoaded(true);

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || DEFAULT_SECTION;
      
      
      if (hash.startsWith('player/')) {
        const playerId = parseInt(hash.split('/')[1], 10);
        if (!isNaN(playerId)) {
          setPlayerDetailsId(playerId);
          setActiveSection('player-details');
          return;
        }
      }
      
      
      if (hash.startsWith('deep-analysis/')) {
        const playerId = parseInt(hash.split('/')[1], 10);
        if (!isNaN(playerId)) {
          setDeepAnalysisPlayerId(playerId);
          setActiveSection('deep-analysis');
          return;
        }
      }
      
      setPlayerDetailsId(null);
      setDeepAnalysisPlayerId(null);
      setActiveSection(validSections.has(hash) ? hash : DEFAULT_SECTION);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [validSections]);

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <>
            <StatsGrid />
            <AnalyticsCharts />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProjectsTable />
                <MatchHistory compact />
              </div>
              <div className="space-y-6">
                <QuickActions />
              </div>
            </div>
          </>
        );

      case 'leaderboard':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="space-y-6 xl:col-span-2">
              <PersonalStats />
              <LeaderboardTable />
            </div>
            <div className="space-y-6">
              <PlayerComparison />
            </div>
          </div>
        );

      case 'rankings':
        return <Rankings />;

      case 'statistics':
        return (
          <div className="space-y-6">
            <div className="glass rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Match Statistics</h2>
              <p className="text-zinc-400 mb-6">
                Trends across all tracked matches including accuracy, player participation, and mod usage.
              </p>
            </div>
            <AnalyticsCharts />
            <StatsGrid />
            <MatchHistory compact />
          </div>
        );

      case 'history':
        return <MatchHistory />;

      case 'games':
        return (
          <div className="space-y-6">
            <QuickActions condensed />
            <ProjectsTable />
          </div>
        );

      case 'players':
        return <PlayersGrid />;

      case 'player-details':
        return playerDetailsId ? (
          <PlayerDetails
            playerId={playerDetailsId}
            onBack={() => {
              window.location.hash = '#players';
            }}
          />
        ) : (
          <div className="glass rounded-xl p-6">
            <p className="text-zinc-400">Player not found</p>
          </div>
        );

      case 'maps':
        return <MapsList />;

      case 'deep-analysis':
        return deepAnalysisPlayerId ? (
          <PlayerDeepAnalysis
            playerId={deepAnalysisPlayerId}
            onBack={() => {
              window.location.hash = '#players';
            }}
          />
        ) : (
          <div className="glass rounded-xl p-6">
            <p className="text-zinc-400">Please select a player for deep analysis</p>
            <button
              onClick={() => { window.location.hash = '#players'; }}
              className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg hover:bg-cyan-500/30"
            >
              Go to Players
            </button>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="glass rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Tracker Settings</h2>
              <p className="text-zinc-400 mb-6">
                Configure API access, personal preferences, and manage stored data.
              </p>
              <QuickActions showExportOnly />
            </div>
            <RankingSettings />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white">osu! API Configuration</h3>
                <p className="text-sm text-zinc-400">
                  Set <code className="text-cyan-300 break-all">VITE_OSU_CLIENT_ID</code> and{' '}
                  <code className="text-cyan-300 break-all">VITE_OSU_CLIENT_SECRET</code> in your <code className="break-all">.env</code> file.
                </p>
                <p className="text-sm text-zinc-500">
                  Matches are fetched directly from the osu! API using OAuth2 client credentials flow.
                </p>
              </div>
              <div className="glass rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white">Data Management</h3>
                <QuickActions showDataControlsOnly />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="glass rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-2xl font-bold text-white mb-2">Section Under Construction</h2>
            <p className="text-zinc-400">This section is coming soon!</p>
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen overflow-x-hidden transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <div className="fixed inset-0 -z-10">
        <TerminalBackground />
      </div>

      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />

      <div className={`${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} min-h-screen overflow-x-hidden transition-all duration-300`}>
        <DashboardHeader onMenuToggle={() => setSidebarOpen(o => !o)} />

        <main className="p-6 space-y-6 relative">
          {renderContent()}

          {isLoading && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
              <div className="glass rounded-xl px-6 py-4 text-white font-medium">Refreshing match data…</div>
            </div>
          )}

          {error && (
            <div className="fixed bottom-6 right-6 z-50">
              <div className="glass rounded-xl px-5 py-4 text-sm text-red-300 border border-red-500/40 max-w-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white mb-1">Match Import Error</p>
                    <p className="text-zinc-300 leading-relaxed">{error}</p>
                  </div>
                  <button
                    onClick={dismissError}
                    className="text-xs uppercase tracking-wide text-cyan-300 hover:text-cyan-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
