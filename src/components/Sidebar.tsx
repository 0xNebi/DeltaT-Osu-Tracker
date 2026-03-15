import { useEffect, useState } from 'react';
import {
  FiHome,
  FiBarChart2,
  FiUsers,
  FiSettings,
  FiActivity,
  FiAward,
  FiGrid,
  FiMap,
  FiTrendingUp,
  FiGithub,
} from 'react-icons/fi';
import MediaPlayer from './MediaPlayer';
import { useMatchContext } from '../context/MatchContext';

const GITHUB_URL = 'https://github.com/0xNebi';
const GITHUB_USERNAME = '0xNebi';
const DASHBOARD_NAME = 'DELTAT';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const [activeItem, setActiveItem] = useState('overview');
  const { settings, personalUserId, players } = useMatchContext();

  const personalPlayer = personalUserId ? players.find(p => p.id === personalUserId) : null;
  const ownerAvatarUrl = personalUserId ? `https://a.ppy.sh/${personalUserId}` : null;

  const menuItems = [
    { name: 'Match Overview', icon: FiHome, href: '#overview', key: 'overview' },
    { name: 'Leaderboards', icon: FiAward, href: '#leaderboard', key: 'leaderboard' },
    { name: 'Rankings (Beta)', icon: FiTrendingUp, href: '#rankings', key: 'rankings' },
    { name: 'Match Statistics', icon: FiBarChart2, href: '#statistics', key: 'statistics' },
    { name: 'Match History', icon: FiActivity, href: '#history', key: 'history' },
    { name: 'Games & Rounds', icon: FiGrid, href: '#games', key: 'games' },
    { name: 'Players', icon: FiUsers, href: '#players', key: 'players' },
    { name: 'Maps', icon: FiMap, href: '#maps', key: 'maps' },
    { name: 'Tracker Settings', icon: FiSettings, href: '#settings', key: 'settings' },
  ];

  useEffect(() => {
    const handleHashChange = () => {
  const hash = window.location.hash.slice(1) || 'overview';
      setActiveItem(hash);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      
      <aside
        className={`fixed top-0 left-0 h-screen glass border-r border-white/10 z-50 transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-0 lg:w-20'
        } overflow-hidden`}
      >
        <div className="flex flex-col h-full p-4">
          
          <div className="mb-8 mt-2">
            <a href="#overview" className="flex items-center gap-3 group">
              
              <div className="w-10 h-10 flex-shrink-0 relative">
                <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="dtGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  
                  <polygon points="20,4 37,34 3,34" fill="url(#dtGrad)" opacity="0.2" />
                  
                  <polygon points="20,10 32,31 8,31" fill="none" stroke="url(#dtGrad)" strokeWidth="2.2" />
                  
                  <circle cx="20" cy="24" r="2.2" fill="#06b6d4" />
                </svg>
              </div>
              {isOpen && (
                <div className="overflow-hidden">
                  <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 truncate">
                    {DASHBOARD_NAME}
                  </h1>
                  <p className="text-xs text-zinc-500 tracking-wide">multiplayer tracker</p>
                </div>
              )}
            </a>
          </div>

          
          <nav className="flex-1 space-y-2">
            {menuItems.map((item, index) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => {
                  setActiveItem(item.key);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative ${
                  activeItem === item.key
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400'
                    : 'text-zinc-400 hover:text-cyan-400 hover:bg-white/5'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {activeItem === item.key && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r" />
                )}
                <item.icon size={20} />
                {isOpen && <span className="font-medium">{item.name}</span>}
                
                
                {!isOpen && (
                  <div className="absolute left-full ml-6 px-3 py-2 bg-zinc-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10">
                    {item.name}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 w-2 h-2 bg-zinc-900 rotate-45 border-l border-b border-white/10" />
                  </div>
                )}
              </a>
            ))}
          </nav>

          
          <MediaPlayer isCollapsed={!isOpen} />

          
          <div className={`border-t border-white/10 pt-4 ${isOpen ? '' : 'text-center'}`}>
            <div className="flex items-center gap-3 px-2">
              
              {ownerAvatarUrl && !settings.privacyMode ? (
                <img
                  src={ownerAvatarUrl}
                  alt={GITHUB_USERNAME}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0 hover:scale-110 transition-transform"
                  title={GITHUB_USERNAME}
                >
                  <FiGithub size={18} />
                </a>
              )}
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {settings.privacyMode ? 'Hidden' : (personalPlayer?.username ?? GITHUB_USERNAME)}
                  </p>
                  {!settings.privacyMode && (
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 truncate block transition-colors"
                    >
                      github/{GITHUB_USERNAME}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default Sidebar;
