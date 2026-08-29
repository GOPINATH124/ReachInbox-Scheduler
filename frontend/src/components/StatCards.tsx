import React from 'react';
import { Calendar, CheckCircle2, XCircle, ShieldAlert, Mail } from 'lucide-react';

interface Stats {
  scheduled: number;
  sending: number;
  sent: number;
  failed: number;
  rateLimited: number;
  total: number;
}

interface StatCardsProps {
  stats: Stats;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Scheduled',
      value: stats.scheduled + stats.sending,
      icon: <Calendar className="h-5 w-5 text-indigo-400" />,
      bg: 'from-indigo-500/10 to-transparent',
      border: 'border-indigo-500/20',
      textColor: 'text-indigo-400',
    },
    {
      label: 'Sent Successfully',
      value: stats.sent,
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      bg: 'from-emerald-500/10 to-transparent',
      border: 'border-emerald-500/20',
      textColor: 'text-emerald-400',
    },
    {
      label: 'Rate Limited (Delayed)',
      value: stats.rateLimited,
      icon: <ShieldAlert className="h-5 w-5 text-amber-400" />,
      bg: 'from-amber-500/10 to-transparent',
      border: 'border-amber-500/20',
      textColor: 'text-amber-400',
    },
    {
      label: 'Failed Sends',
      value: stats.failed,
      icon: <XCircle className="h-5 w-5 text-rose-400" />,
      bg: 'from-rose-500/10 to-transparent',
      border: 'border-rose-500/20',
      textColor: 'text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`glass p-5 rounded-2xl border ${card.border} bg-gradient-to-br ${card.bg} flex items-center justify-between shadow-lg hover:scale-[1.01] transition-all duration-200`}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {card.label}
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">{card.value}</h2>
          </div>
          <div className={`h-10 w-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center`}>
            {card.icon}
          </div>
        </div>
      ))}
    </div>
  );
};
export default StatCards;
