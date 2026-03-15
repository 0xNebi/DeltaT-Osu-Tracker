import { useEffect, useRef } from 'react';
import { FiUsers, FiTarget, FiActivity, FiAward } from 'react-icons/fi';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';

interface StatCardProps {
  title: string;
  value: string;
  caption: string;
  icon: React.ElementType;
  color: string;
  index: number;
}

const StatCard = ({ title, value, caption, icon: Icon, color, index }: StatCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anime({
      targets: cardRef.current,
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 800,
      delay: index * 100,
      easing: 'easeOutCubic',
    });
  }, [index]);

  return (
    <div
      ref={cardRef}
      className="glass glass-hover rounded-xl p-6 relative overflow-hidden group"
    >
      
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-10 blur-3xl group-hover:opacity-20 transition-opacity duration-500`}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-12 h-12 ${color} bg-opacity-20 rounded-lg flex items-center justify-center`}
          >
            <Icon size={24} className={color.replace('bg-', 'text-')} />
          </div>
        </div>

        <h3 className="text-zinc-400 text-sm mb-1">{title}</h3>
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-xs text-zinc-500 mt-2">{caption}</p>
      </div>
    </div>
  );
};

const StatsGrid = () => {
  const { globalStats } = useMatchContext();

  const numberFormatter = useRef(new Intl.NumberFormat('en-US')).current;
  const percentFormatter = useRef(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })).current;

  const stats: StatCardProps[] = [
    {
      title: 'Tracked Matches',
      value: numberFormatter.format(globalStats.totalMatches),
      caption: `${numberFormatter.format(globalStats.totalGames)} games recorded`,
      icon: FiActivity,
      color: 'bg-cyan-500',
      index: 0,
    },
    {
      title: 'Unique Players',
      value: numberFormatter.format(globalStats.uniquePlayers),
      caption: `${numberFormatter.format(globalStats.totalScores)} total scores`,
      icon: FiUsers,
      color: 'bg-blue-500',
      index: 1,
    },
    {
      title: 'Average Accuracy',
      value: `${percentFormatter.format(globalStats.averageAccuracy)}%`,
      caption: `Best accuracy ${percentFormatter.format(globalStats.bestAccuracy)}%`,
      icon: FiTarget,
      color: 'bg-purple-500',
      index: 2,
    },
    {
      title: 'Top Score',
      value: numberFormatter.format(globalStats.bestScore),
      caption: `Average score ${numberFormatter.format(Math.round(globalStats.averageScore))}`,
      icon: FiAward,
      color: 'bg-emerald-500',
      index: 3,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <StatCard key={stat.title} {...stat} index={index} />
      ))}
    </div>
  );
};

export default StatsGrid;
