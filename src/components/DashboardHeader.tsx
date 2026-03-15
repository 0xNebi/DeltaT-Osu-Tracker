import { useEffect, useRef, useState, useMemo } from 'react';
import { FiBell, FiSearch, FiRefreshCw, FiGithub, FiX, FiZap, FiMenu, FiDownload, FiCheck } from 'react-icons/fi';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';
import { format, formatDistanceToNow } from 'date-fns';
import CustomDropdown from './CustomDropdown';
import { parseMatchId } from '../utils/matchParser';

const GITHUB_URL = 'https://github.com/0xNebi';
const GITHUB_USERNAME = '0xNebi';
const OWNER_AVATAR = `https://avatars.githubusercontent.com/0xNebi?size=80`;

interface DashboardHeaderProps {
  onMenuToggle?: () => void;
}

const DashboardHeader = ({ onMenuToggle }: DashboardHeaderProps) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [matchInput, setMatchInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const { matches, selectedMatch, selectMatch, refreshMatch, isLoading, players, maps, importMatch, recentGames, settings, censorName, censorMatchName } = useMatchContext();

  useEffect(() => {
    anime({
      targets: headerRef.current,
      opacity: [0, 1],
      translateY: [-20, 0],
      duration: 800,
      easing: 'easeOutCubic',
    });
  }, []);

  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { players: [], maps: [], matches: [] };

    const query = searchQuery.toLowerCase();
    const filteredPlayers = players.filter(p => 
      p.username.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredMaps = maps.filter(m => 
      m.title.toLowerCase().includes(query) ||
      (m.artist?.toLowerCase().includes(query))
    ).slice(0, 5);

    
    const filteredMatches = matches.filter(m => 
      m.name.toLowerCase().includes(query)
    ).slice(0, 5);

    return { players: filteredPlayers, maps: filteredMaps, matches: filteredMatches };
  }, [searchQuery, players, maps, matches]);

  const hasResults = searchResults.players.length > 0 || 
                     searchResults.maps.length > 0 || 
                     searchResults.matches.length > 0;

  const handleImportMatch = async () => {
    setInputError(null);
    const parsed = parseMatchId(matchInput);
    
    if (!parsed) {
      setInputError('Enter a valid osu! match link or numeric ID.');
      return;
    }
    
    await importMatch(matchInput);
    setMatchInput('');
    setIsModalOpen(false);
  };

  return (
    <>
      <header
        ref={headerRef}
        className="glass border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl"
      >
      <div className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">

          {/* Hamburger — mobile only, now lives inside the header */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-cyan-400 transition-all flex-shrink-0"
              aria-label="Toggle menu"
            >
              <FiMenu size={20} />
            </button>
          )}

          
          <div className="flex-1 min-w-0 max-w-xl" ref={searchRef}>
            <div className="relative group">
              <FiSearch className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-cyan-400 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all"
              />
              
              
              {searchFocused && searchQuery && (
                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-96 overflow-y-auto">
                  {!hasResults && (
                    <div className="px-4 py-3 text-sm text-zinc-500">No results found</div>
                  )}
                  
                  {searchResults.players.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs uppercase tracking-wider text-zinc-500 bg-white/5">Players</div>
                      {searchResults.players.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => {
                            window.location.hash = `#player/${player.id}`;
                            setSearchQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                          {censorName(player.username, player.id)}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {searchResults.maps.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs uppercase tracking-wider text-zinc-500 bg-white/5 border-t border-white/10">Maps</div>
                      {searchResults.maps.map((map) => (
                        <button
                          key={map.id}
                          onClick={() => {
                            window.location.hash = `#maps`;
                            setSearchQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                        >
                          <div className="text-white">{map.title}</div>
                          <div className="text-xs text-zinc-500">{map.artist}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {searchResults.matches.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs uppercase tracking-wider text-zinc-500 bg-white/5 border-t border-white/10">Matches</div>
                      {searchResults.matches.map((match) => (
                        <button
                          key={match.id}
                          onClick={() => {
                            selectMatch(match.id);
                            window.location.hash = `#match-history`;
                            setSearchQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                          {censorMatchName(match.name, match.id)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 flex-shrink-0">
            
            <div className="hidden lg:flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wide text-zinc-500 mb-0.5">Active Match</span>
              <div className="flex items-center gap-2">
                <CustomDropdown
                  value={String(selectedMatch?.id ?? '')}
                  onChange={(value) => {
                    const matchId = Number(value);
                    if (Number.isFinite(matchId)) {
                      selectMatch(matchId);
                    }
                  }}
                  options={matches.map((match) => ({
                    value: String(match.id),
                    label: censorMatchName(match.name, match.id),
                  }))}
                  isOpen={dropdownOpen}
                  setIsOpen={setDropdownOpen}
                  placeholder="Select match"
                  className="w-56"
                />
                <button
                  className="flex-shrink-0 p-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
                  onClick={() => selectedMatch && refreshMatch(selectedMatch.id)}
                  disabled={!selectedMatch || isLoading}
                  title="Refresh match data"
                >
                  <FiRefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              {selectedMatch?.startTime && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {format(new Date(selectedMatch.startTime), 'PPpp')}
                </p>
              )}
            </div>

            <div className="w-px h-10 bg-white/10 hidden lg:block" />

            <button
              onClick={() => setIsModalOpen(true)}
              className="p-2 sm:p-3 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-cyan-400 transition-all text-sm font-medium flex items-center gap-1.5"
              title="Import Match"
            >
              <FiDownload size={16} className="flex-shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Import Match</span>
            </button>

            
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative hidden sm:flex p-2 sm:p-3 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-cyan-400 transition-all flex-shrink-0"
              title="Recent activity"
            >
              <FiBell size={18} />
              {recentGames.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-cyan-500 rounded-full" />
              )}
            </button>

            <div className="flex items-center gap-3 pl-3 border-l border-white/10">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:block p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-cyan-400 transition-all"
                title="GitHub"
              >
                <FiGithub size={20} />
              </a>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white">
                  {settings.privacyMode ? 'Hidden' : GITHUB_USERNAME}
                </p>
                <p className="text-xs text-zinc-500">DELTAT</p>
              </div>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-cyan-500/60 transition-all"
                title={GITHUB_USERNAME}
              >
                <img
                  src={OWNER_AVATAR}
                  alt={GITHUB_USERNAME}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.classList.add('bg-gradient-to-r', 'from-cyan-500', 'to-blue-600', 'flex', 'items-center', 'justify-center');
                      parent.innerHTML = `<span class="text-white font-bold text-sm">${GITHUB_USERNAME.slice(0,2).toUpperCase()}</span>`;
                    }
                  }}
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>

    
    {isNotifOpen && (
      <div
        className="fixed inset-0 z-50 flex justify-end"
        onClick={() => setIsNotifOpen(false)}
      >
        <div
          className="w-full max-w-sm h-full glass border-l border-white/10 flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-semibold">
              <FiZap size={16} className="text-cyan-400" />
              Recent Activity
            </div>
            <button
              onClick={() => setIsNotifOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
            >
              <FiX size={18} />
            </button>
          </div>

          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {recentGames.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center mt-8">No games recorded yet.</p>
            ) : (
              recentGames.slice(0, 50).map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    selectMatch(game.matchId);
                    setIsNotifOpen(false);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/40 hover:bg-white/5 transition-all space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white leading-snug line-clamp-1">
                      {game.beatmapTitle}
                      {game.difficulty ? (
                        <span className="ml-1 text-xs text-zinc-500">[{game.difficulty}]</span>
                      ) : null}
                    </p>
                    {game.mods && game.mods.length > 0 && (
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                        {game.mods.join('')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    🏆 <span className="text-cyan-300">{settings.privacyMode ? 'Player' : game.topPlayer}</span>
                    {' · '}
                    {(game.topAccuracy * 100).toFixed(2)}%
                    {' · '}
                    {game.topScore.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-zinc-600 truncate">
                    {settings.privacyMode ? 'Room' : game.matchName}
                    {game.startTime ? ` · ${formatDistanceToNow(new Date(game.startTime), { addSuffix: true })}` : ''}
                  </p>
                </button>
              ))
            )}
          </div>

          
          <div className="px-5 py-3 border-t border-white/10 text-xs text-zinc-500 text-center">
            {recentGames.length} game{recentGames.length !== 1 ? 's' : ''} tracked across {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>
    )}

    
    {isModalOpen && (
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={() => setIsModalOpen(false)}
      >
        <div 
          className="glass rounded-xl p-6 w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-medium text-white mb-4">Import Match</h3>
          <div className="space-y-4">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="text"
                placeholder="https://osu.ppy.sh/community/matches/123456789"
                value={matchInput}
                onChange={(e) => setMatchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matchInput.trim()) {
                    handleImportMatch();
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all"
              />
            </div>
            {inputError && <p className="text-xs text-red-400">{inputError}</p>}
            <button 
              onClick={handleImportMatch}
              disabled={!matchInput.trim()}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiCheck size={20} />
              Import Match
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default DashboardHeader;
