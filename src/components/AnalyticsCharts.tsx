import { useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { TooltipProps } from 'recharts';
import anime from '../utils/anime';
import { useMatchContext } from '../context/MatchContext';

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 border border-white/20">
        <p className="text-white font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AnalyticsCharts = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { accuracyTimeline, modUsage } = useMatchContext();

  const timelineData = accuracyTimeline.map((point) => ({
    name: point.label,
    accuracy: Number(point.accuracy.toFixed(2)),
    players: point.uniquePlayers,
  }));

  const modUsageData = modUsage.map((item) => ({
    name: item.mod,
    count: item.count,
  }));

  useEffect(() => {
    anime({
      targets: containerRef.current?.children,
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 800,
      delay: anime.stagger(100),
      easing: 'easeOutCubic',
    });
  }, []);

  return (
    <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap items-start xl:items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white mb-1">Accuracy Trend</h3>
            <p className="text-sm text-zinc-500">Average accuracy and player participation across recent matches</p>
          </div>
          <div className="flex gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyan-500 rounded-full flex-shrink-0" />
              <span className="text-xs text-zinc-400">Accuracy %</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full flex-shrink-0" />
              <span className="text-xs text-zinc-400">Players</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timelineData.length ? timelineData : [{ name: 'No data', accuracy: 0, players: 0 }] }>
            <defs>
              <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" stroke="#71717a" />
            <YAxis stroke="#71717a" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="accuracy" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorAccuracy)" />
            <Area type="monotone" dataKey="players" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorPlayers)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white mb-1">Mod Usage</h3>
            <p className="text-sm text-zinc-500">Most frequently used mods across tracked scores</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={modUsageData.length ? modUsageData : [{ name: 'None', count: 0 }] }>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" stroke="#71717a" />
            <YAxis stroke="#71717a" allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
