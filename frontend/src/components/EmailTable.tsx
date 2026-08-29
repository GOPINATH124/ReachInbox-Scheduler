import React from 'react';
import { ExternalLink, Info, Loader2, Inbox, MailOpen } from 'lucide-react';

interface Email {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  scheduledAt: string;
  sentAt?: string | null;
  errorMsg?: string | null;
}

interface EmailTableProps {
  emails: Email[];
  loading: boolean;
  type: 'scheduled' | 'sent';
}

export const EmailTable: React.FC<EmailTableProps> = ({ emails, loading, type }) => {
  const getStatusBadge = (status: Email['status']) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Failed
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Rate Limited
          </span>
        );
      case 'SENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
            Sending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Scheduled
          </span>
        );
    }
  };

  // Helper to extract Ethereal preview link from errorMsg
  const getEtherealLink = (msg: string | null | undefined): string | null => {
    if (!msg) return null;
    const match = msg.match(/https:\/\/ethereal\.email\/message\/[a-zA-Z0-9]+/);
    return match ? match[0] : null;
  };

  if (loading) {
    return (
      <div className="glass min-h-[300px] rounded-2xl border-white/5 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading email campaigns...</p>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass min-h-[350px] rounded-2xl border-white/5 flex flex-col items-center justify-center text-center p-8">
        <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center mb-4">
          <Inbox className="h-8 w-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-200">No emails found</h3>
        <p className="text-sm text-slate-400 max-w-sm mt-1">
          {type === 'scheduled'
            ? 'Start by composing and scheduling a new campaign or upload a lead list!'
            : 'Sent emails, delivery success, and logs will appear here once processed.'}
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border-white/5 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/40">
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Recipient</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Sender</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Subject</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {type === 'scheduled' ? 'Scheduled Send Time' : 'Sent Time'}
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {emails.map((email) => {
              const previewLink = getEtherealLink(email.errorMsg);
              const dateStr = type === 'scheduled' ? email.scheduledAt : (email.sentAt || email.scheduledAt);
              const formattedDate = new Date(dateStr).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <tr key={email.id} className="hover:bg-white/[0.02] transition-colors duration-150 group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-white">{email.recipient}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-300">{email.sender}</div>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-sm font-medium text-slate-200 truncate">{email.subject}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{email.body}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-300 font-mono">{formattedDate}</div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(email.status)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {previewLink ? (
                        <a
                          href={previewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-xs font-semibold border border-indigo-500/20 transition-all duration-150"
                        >
                          <MailOpen className="h-3.5 w-3.5" />
                          View Email
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : email.errorMsg && !previewLink ? (
                        <div className="relative group/tooltip">
                          <button className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20">
                            <Info className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg text-left shadow-xl hidden group-hover/tooltip:block z-20">
                            <h4 className="text-xs font-bold text-rose-400 mb-1">Delivery Log</h4>
                            <p className="text-[10px] text-slate-300 font-mono break-words leading-relaxed">
                              {email.errorMsg}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No logs available</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default EmailTable;
