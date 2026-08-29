import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ExternalLink, Activity, Mail } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="glass px-6 py-4 rounded-3xl border-white/5 flex items-center justify-between shadow-lg">
      
      {/* Brand logo / title */}
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <Mail className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide font-sans">ReachInbox.ai</h1>
          <span className="text-[10px] font-semibold text-indigo-400 tracking-wider uppercase">Job Scheduler</span>
        </div>
      </div>

      {/* Action Center / User Profile */}
      <div className="flex items-center gap-4">
        
        {/* BullMQ Dashboard Shortcut */}
        <a
          href="http://localhost:5000/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-semibold text-indigo-300 transition-colors"
        >
          <Activity className="h-3.5 w-3.5" />
          Queue Board
          <ExternalLink className="h-3 w-3" />
        </a>

        {/* Separator line */}
        <div className="h-6 w-px bg-white/10 hidden sm:block" />

        {/* User Card */}
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full border border-white/10 shadow-md" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {user.name.charAt(0)}
            </div>
          )}
          <div className="hidden md:block text-left">
            <h4 className="text-xs font-bold text-white leading-tight">{user.name}</h4>
            <span className="text-[10px] text-slate-400 font-mono leading-none">{user.email}</span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/35 text-slate-400 hover:text-rose-400 transition-all duration-150"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>

      </div>

    </header>
  );
};
export default Header;
