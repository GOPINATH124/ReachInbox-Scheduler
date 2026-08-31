import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Slack, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api, BACKEND_URL } from '../services/api';

export const SlackWidget: React.FC = () => {
  const { user, disconnectSlack } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual Webhook Form States
  const [showManual, setShowManual] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [teamName, setTeamName] = useState('');

  const handleConnect = () => {
    const token = localStorage.getItem('token') || '';
    // Redirect with user JWT so the backend callback knows who connected
    window.location.href = `${BACKEND_URL}/api/slack/connect?token=${token}`;
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await disconnectSlack();
      setShowManual(false);
      setWebhookUrl('');
    } catch (err) {
      setError('Failed to disconnect Slack. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) {
      setError('Webhook URL is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/slack/connect-manual', {
        webhookUrl,
        channelName: channelName || '#general',
        teamName: teamName || 'Local Workspace',
      });
      window.location.reload(); // Refresh to reload profile settings
    } catch (err) {
      setError('Failed to connect Slack. Please verify the Webhook URL.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="glass p-5 rounded-2xl border-white/5 transition-all duration-200 space-y-4 text-left">
      <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">

        {/* Left Side: Status Info */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10">
            <Slack className={`h-6 w-6 ${user.slackConnected ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              Slack Notifications
              {user.slackConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-semibold">
                  <AlertTriangle className="h-2.5 w-2.5" /> Disconnected
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
              {user.slackConnected
                ? `Alerting alerts to channel ${user.slackChannel} in workspace '${user.slackTeam}'.`
                : 'Connect your Slack workspace automatically or manually using an Incoming Webhook.'}
            </p>
          </div>
        </div>

        {/* Right Side: Action Trigger */}
        <div className="flex items-center gap-2">
          {user.slackConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 transition-all duration-150 flex items-center gap-1.5"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Disconnect
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowManual(!showManual)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 transition-all duration-150"
              >
                {showManual ? 'Cancel' : 'Manual Setup'}
              </button>

              <button
                onClick={handleConnect}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg border border-indigo-500/45 text-white transition-all duration-150 flex items-center gap-1.5"
              >
                Connect Slack (OAuth)
              </button>
            </>
          )}
        </div>

      </div>

      {/* Connection Form */}
      {showManual && !user.slackConnected && (
        <form onSubmit={handleManualSubmit} className="pt-4 border-t border-white/5 space-y-3 max-w-xl">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Enter Slack Incoming Webhook URL</h4>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Incoming Webhook URL</label>
            <input
              type="url"
              required
              placeholder="https://hooks.slack.com/services/your/webhook/url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full text-xs bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />

          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Channel Name (Optional)</label>
              <input
                type="text"
                placeholder="#alerts"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full text-xs bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Workspace Name (Optional)</label>
              <input
                type="text"
                placeholder="My Workspace"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full text-xs bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-md active:scale-[0.98]"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Webhook Connection
          </button>
        </form>
      )}

      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
    </div>
  );
};
export default SlackWidget;
