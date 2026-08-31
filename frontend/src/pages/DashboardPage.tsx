import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SlackWidget } from '../components/SlackWidget';
import { 
  Slack, Clock, Send, Star, Archive, Trash2, 
  ChevronDown, Search, Plus, ArrowLeft, 
  Paperclip, LogOut, Loader2,
  Undo2, Redo2, Type, Bold, Italic, Underline, AlignLeft,
  ChevronUp, ListOrdered, List, Quote, Image, Link, Strikethrough,
  Upload
} from 'lucide-react';


interface EmailRecord {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  errorMsg: string | null;
  minDelay: number;
  hourlyLimit: number;
}

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  
  // Navigation & Tab States
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View states: 'list' | 'read' | 'compose'
  const [viewMode, setViewMode] = useState<'list' | 'read' | 'compose'>('list');
  
  // Data States
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ scheduled: 0, sent: 0 });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);

  // Compose Campaign Form States
  const [composeFrom, setComposeFrom] = useState('maribel15@ethereal.email');




  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualToInput, setManualToInput] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeDelay, setComposeDelay] = useState(0);
  const [composeLimit, setComposeLimit] = useState(0);
  
  // Send Later Dropdown States
  const [showSendLater, setShowSendLater] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  
  const sendLaterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sendLaterRef.current && !sendLaterRef.current.contains(e.target as Node)) {
        setShowSendLater(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch emails data
  const fetchEmails = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      let res;
      if (searchQuery.trim() !== '') {
        res = await api.get('/api/emails/search', {
          params: {
            q: searchQuery,
            status: activeTab === 'scheduled' ? undefined : 'SENT',
          },
        });
        
        if (activeTab === 'scheduled') {
          const scheduledStatuses = ['PENDING', 'SCHEDULED', 'SENDING', 'RATE_LIMITED'];
          const filtered = res.data.emails.filter((e: any) => scheduledStatuses.includes(e.status));
          setEmails(filtered);
        } else {
          setEmails(res.data.emails);
        }
      } else {
        res = await api.get(activeTab === 'scheduled' ? '/api/emails/scheduled' : '/api/emails/sent');
        setEmails(res.data.emails);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeTab, searchQuery]);

  // Fetch total scheduled & sent counts
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/emails/stats');
      const statsData = res.data.stats;
      setStats({
        scheduled: statsData.scheduled + statsData.sending + statsData.rateLimited,
        sent: statsData.sent,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Sync background updates every 5 seconds
  useEffect(() => {
    fetchEmails(true);
    fetchStats();
  }, [activeTab, searchQuery, fetchEmails, fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmails(false);
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchEmails, fetchStats]);

  // Trigger file list upload click
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Handle CSV/TXT parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = text.match(emailRegex) || [];
      const uniqMatches = Array.from(new Set(matches.map(m => m.toLowerCase().trim())));
      if (uniqMatches.length > 0) {
        setRecipients(uniqMatches);
      } else {
        alert('No valid email addresses found in the file.');
      }
    };
    reader.readAsText(file);
  };

  // Handle compose campaign submit
  const handleScheduleCampaign = async (finalStartTime: Date) => {
    // If no recipients, parse manualToInput
    let finalRecipients = [...recipients];
    const rawInput = manualToInput.trim();
    if (rawInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput)) {
      finalRecipients.push(rawInput.toLowerCase());
    }

    if (finalRecipients.length === 0) {
      alert('Please specify at least one recipient email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/emails/schedule', {
        sender: composeFrom,
        recipients: finalRecipients,
        subject: composeSubject,
        body: composeBody,
        startTime: finalStartTime.toISOString(),
        delay: composeDelay || 2,
        hourlyLimit: composeLimit || 200,
      });

      // Reset form states
      setRecipients([]);
      setManualToInput('');
      setComposeSubject('');
      setComposeBody('');
      setComposeDelay(0);
      setComposeLimit(0);
      setScheduledDate('');
      setScheduledTime('');
      setIsScheduled(false);
      setShowSendLater(false);
      
      // Return to List View
      setViewMode('list');
      setActiveTab('scheduled');
      fetchEmails(true);
    } catch (err: any) {
      alert('Failed to schedule campaign: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Preset Date Time Selectors
  const handlePresetSelect = (preset: 'tomorrow' | 'tomorrow_10am' | 'tomorrow_11am' | 'tomorrow_3pm') => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Tomorrow

    if (preset === 'tomorrow_10am') {
      date.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow_11am') {
      date.setHours(11, 0, 0, 0);
    } else if (preset === 'tomorrow_3pm') {
      date.setHours(15, 0, 0, 0);
    }

    setIsScheduled(true);
    handleScheduleCampaign(date);
  };

  // Custom picker submit
  const handleCustomSchedule = () => {
    if (!scheduledDate || !scheduledTime) {
      alert('Please select both date and time');
      return;
    }
    const finalDate = new Date(`${scheduledDate}T${scheduledTime}`);
    if (isNaN(finalDate.getTime())) {
      alert('Invalid date or time selected');
      return;
    }
    setIsScheduled(true);
    handleScheduleCampaign(finalDate);
  };

  const handleSendImmediately = () => {
    handleScheduleCampaign(new Date()); // Sends immediately (start time = now)
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] text-slate-700 overflow-hidden font-sans">
      
      {/* 1. LEFT SIDEBAR PANEL */}
      <div className="w-[280px] bg-white border-r border-slate-200/80 flex flex-col justify-between h-full flex-shrink-0 z-20">
        
        <div className="flex flex-col space-y-5">
          {/* User Profile Header */}
          {user && (
            <div className="relative border-b border-slate-100 p-4 flex items-center justify-between">
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                <img 
                  src={user.avatar || 'https://lh3.googleusercontent.com/a/default-user=s96-c'} 
                  className="h-10 w-10 rounded-full object-cover border border-slate-100" 
                  alt="Avatar"
                />
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-800">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">{user.email}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>

              {/* Profile Dropdown */}
              {showProfileDropdown && (
                <div className="absolute top-16 left-4 w-[240px] bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-30">
                  <button 
                    onClick={() => { setShowSlackModal(true); setShowProfileDropdown(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl transition-colors"
                  >
                    <Slack className="h-4 w-4 text-indigo-500" /> Slack Settings
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-xl transition-colors border-t border-slate-100"
                  >
                    <LogOut className="h-4 w-4" /> Logout Session
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Compose Button */}
          <div className="px-4">
            <button
              onClick={() => setViewMode('compose')}
              className="w-full py-3 px-4 rounded-xl border border-[#00a854] hover:bg-[#00a854]/5 text-[#00a854] font-bold text-sm tracking-wide transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Compose
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-2 space-y-1">
            <button
              onClick={() => { setViewMode('list'); setActiveTab('scheduled'); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'scheduled' && viewMode === 'list'
                  ? 'bg-[#eaf8ee] text-[#00a854]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className={`h-4.5 w-4.5 ${activeTab === 'scheduled' && viewMode === 'list' ? 'text-[#00a854]' : 'text-slate-400'}`} />
                Scheduled
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'scheduled' && viewMode === 'list' ? 'bg-[#00a854]/15 text-[#00a854]' : 'bg-slate-100 text-slate-500'}`}>
                {stats.scheduled}
              </span>
            </button>

            <button
              onClick={() => { setViewMode('list'); setActiveTab('sent'); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sent' && viewMode === 'list'
                  ? 'bg-[#eaf8ee] text-[#00a854]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Send className={`h-4.5 w-4.5 ${activeTab === 'sent' && viewMode === 'list' ? 'text-[#00a854]' : 'text-slate-400'}`} />
                Sent
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'sent' && viewMode === 'list' ? 'bg-[#00a854]/15 text-[#00a854]' : 'bg-slate-100 text-slate-500'}`}>
                {stats.sent}
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer Banner */}
        <div className="p-4 border-t border-slate-100 text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ReachInbox Scheduler</span>
        </div>

      </div>

      {/* 2. RIGHT PANEL CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        
        {/* TAB 1: LIST MODE */}
        {viewMode === 'list' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Search Top Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="relative w-full max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search subject, body, recipients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-transparent rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-slate-100 focus:border-slate-300 transition-all font-medium"
                />
              </div>
            </div>

            {/* List View Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#00a854]" />
                  <span className="text-xs text-slate-400 font-semibold mt-2">Loading logs...</span>
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                  <Clock className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">No emails found in this category.</p>
                </div>
              ) : (
                emails.map((email) => {
                  let badgeColor = 'bg-slate-100 text-slate-600';
                  let statusText = email.status;

                  if (email.status === 'SENT') {
                    badgeColor = 'bg-slate-100 text-slate-600';
                    statusText = 'Sent';
                  } else if (email.status === 'SCHEDULED' || email.status === 'PENDING') {
                    badgeColor = 'bg-[#fff3e0] text-[#ff9800]';
                    statusText = new Date(email.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  } else if (email.status === 'RATE_LIMITED') {
                    badgeColor = 'bg-amber-100 text-amber-600';
                    statusText = 'Rate Limited';
                  } else if (email.status === 'FAILED') {
                    badgeColor = 'bg-rose-100 text-rose-600';
                    statusText = 'Failed';
                  }

                  return (
                    <div
                      key={email.id}
                      onClick={() => { setSelectedEmail(email); setViewMode('read'); }}
                      className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex flex-col gap-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-slate-800">To: {email.recipient}</span>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
                          {activeTab === 'scheduled' 
                            ? `${new Date(email.scheduledAt).toLocaleDateString([], { weekday: 'short' })} ${statusText}` 
                            : 'Sent'
                          }
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-600 truncate">{email.subject}</div>
                      <div className="text-xs text-slate-400 truncate max-w-2xl">{email.body}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DETAILED READ MODE */}
        {viewMode === 'read' && selectedEmail && (
          <div className="flex flex-col h-full overflow-hidden bg-white">
            
            {/* Read Top Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4.5 w-4.5" /> Back to list
              </button>

              <div className="flex items-center gap-3 text-slate-400">
                <Star className="h-4.5 w-4.5 hover:text-amber-500 cursor-pointer transition-colors" />
                <Archive className="h-4.5 w-4.5 hover:text-slate-600 cursor-pointer transition-colors" />
                <Trash2 className="h-4.5 w-4.5 hover:text-rose-500 cursor-pointer transition-colors" />
              </div>
            </div>

            {/* Read Email Content */}
            <div className="flex-1 p-8 overflow-y-auto space-y-6">
              
              {/* Subject Title */}
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">{selectedEmail.subject}</h1>
              </div>

              {/* Sender Details */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                  {selectedEmail.sender[0]?.toUpperCase()}
                </div>
                <div className="text-left flex-1">
                  <div className="text-xs font-bold text-slate-800">{selectedEmail.sender}</div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">to {selectedEmail.recipient}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {selectedEmail.sentAt 
                      ? new Date(selectedEmail.sentAt).toLocaleString() 
                      : `Scheduled: ${new Date(selectedEmail.scheduledAt).toLocaleString()}`
                    }
                  </span>
                </div>
              </div>

              {/* Highlight Banner (Mock Exclusive Offer template) */}
              <div className="bg-[#fffde7] border border-[#f0f4c3] rounded-2xl p-4 flex items-center gap-2.5">
                <span className="text-sm">⚡</span>
                <p className="text-xs font-bold text-[#827717] leading-normal">
                  Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment ⚡
                </p>
              </div>

              {/* Body */}
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line space-y-4">
                {selectedEmail.body}
              </div>

              {/* Preview/Error Status Log */}
              <div className="pt-6 border-t border-slate-100">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-800">Delivery Log:</span>{' '}
                    {selectedEmail.errorMsg ? (
                      selectedEmail.errorMsg.includes('http') ? (
                        <span>
                          {selectedEmail.errorMsg.split('http')[0]}
                          <a 
                            href={'http' + selectedEmail.errorMsg.split('http')[1]} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 hover:text-indigo-500 underline font-semibold break-all"
                          >
                            {'http' + selectedEmail.errorMsg.split('http')[1]}
                          </a>
                        </span>
                      ) : (
                        selectedEmail.errorMsg
                      )
                    ) : (
                      <span className="text-emerald-700 font-semibold">
                        Delivered successfully via SMTP ({selectedEmail.sender})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedEmail.errorMsg && selectedEmail.errorMsg.includes('http') ? (
                      <a 
                        href={'http' + selectedEmail.errorMsg.split('http')[1]} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                      >
                        View Live Ethereal Preview
                      </a>
                    ) : (
                      <a 
                        href="https://ethereal.email/messages" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                      >
                        Open Ethereal Mailbox
                      </a>
                    )}
                  </div>
                </div>
              </div>


            </div>
          </div>
        )}

        {/* TAB 3: COMPOSE NEW EMAIL PANEL */}
        {viewMode === 'compose' && (
          <div className="flex flex-col h-full overflow-hidden bg-white">
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv,.txt" 
              className="hidden" 
            />

            {/* Compose Top Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4.5 w-4.5" /> Compose New Email
              </button>

              <div className="flex items-center gap-4">
                {/* Paperclip & Schedule Clock icons */}
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Paperclip className="h-4.5 w-4.5 hover:text-slate-600 cursor-pointer" />
                  
                  {/* Send Later Calendar dropdown */}
                  <div className="relative" ref={sendLaterRef}>
                    <Clock 
                      onClick={() => setShowSendLater(!showSendLater)}
                      className="h-4.5 w-4.5 hover:text-slate-600 cursor-pointer" 
                    />

                    {/* Send Later Overlay Menu */}
                    {showSendLater && (
                      <div className="absolute right-0 top-10 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-40 space-y-4 text-left">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Send Later</h4>
                        
                        {/* Presets List */}
                        <div className="space-y-1 border-b border-slate-100 pb-3">
                          <button 
                            onClick={() => handlePresetSelect('tomorrow')}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-medium rounded-lg"
                          >
                            Tomorrow
                          </button>
                          <button 
                            onClick={() => handlePresetSelect('tomorrow_10am')}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-medium rounded-lg"
                          >
                            Tomorrow, 10:00 AM
                          </button>
                          <button 
                            onClick={() => handlePresetSelect('tomorrow_11am')}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-medium rounded-lg"
                          >
                            Tomorrow, 11:00 AM
                          </button>
                          <button 
                            onClick={() => handlePresetSelect('tomorrow_3pm')}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-medium rounded-lg"
                          >
                            Tomorrow, 3:00 PM
                          </button>
                        </div>

                        {/* Custom Picker */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Date & Time</label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-[#f8fafc] text-slate-800"
                          />
                          <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-[#f8fafc] text-slate-800"
                          />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                          <button 
                            onClick={() => { setShowSendLater(false); setIsScheduled(false); }}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleCustomSchedule}
                            className="px-4 py-1.5 text-xs font-bold bg-[#00a854] hover:bg-[#008f47] text-white rounded-lg shadow-sm"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Button toggling text based on date selection */}
                <button
                  onClick={isScheduled ? handleCustomSchedule : handleSendImmediately}
                  className="px-5 py-2.5 border border-[#00a854] text-[#00a854] hover:bg-[#00a854]/5 font-bold text-xs rounded-xl transition-all active:scale-[0.98]"
                >
                  {isScheduled ? 'Send Later' : 'Send'}
                </button>
              </div>
            </div>

            {/* Compose Editor Form Fields */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto text-left">
              
              {/* From Dropdown */}
              <div className="flex items-center gap-4 text-xs">
                <span className="w-32 font-semibold text-slate-400">From</span>
                <select
                  value={composeFrom}
                  onChange={(e) => setComposeFrom(e.target.value)}
                  className="bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-slate-300"
                >
                  <option value="maribel15@ethereal.email">maribel15@ethereal.email</option>
                  <option value="gr702597@gmail.com">gr702597@gmail.com</option>
                  <option value={user?.email || 'dev@reachinbox.ai'}>{user?.email || 'dev@reachinbox.ai'}</option>
                  <option value="newsletter@reachinbox.ai">newsletter@reachinbox.ai</option>
                  <option value="no-reply@reachinbox.ai">no-reply@reachinbox.ai</option>
                </select>




              </div>

              {/* To input field with Upload List trigger */}
              <div className="flex items-start gap-4 text-xs">
                <span className="w-32 font-semibold text-slate-400 mt-2">To</span>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="w-full flex items-center justify-between border-b border-slate-200 pb-2">
                    
                    {/* Recipient Chips Section */}
                    <div className="flex-1 flex items-center flex-wrap gap-2">
                      {recipients.length === 0 ? (
                        <input
                          type="text"
                          placeholder="recipient@example.com"
                          value={manualToInput}
                          onChange={(e) => {
                            setManualToInput(e.target.value);
                            if (e.target.value.endsWith(',') || e.target.value.endsWith(' ')) {
                              const email = e.target.value.replace(/[, ]/g, '').trim();
                              if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                setRecipients([...recipients, email.toLowerCase()]);
                                setManualToInput('');
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              const email = manualToInput.trim();
                              if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                setRecipients([...recipients, email.toLowerCase()]);
                                setManualToInput('');
                              }
                            }
                          }}
                          onBlur={() => {
                            const email = manualToInput.trim();
                            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                              setRecipients([...recipients, email.toLowerCase()]);
                              setManualToInput('');
                            }
                          }}
                          className="w-full outline-none text-xs text-slate-800 py-1 placeholder-slate-300 bg-transparent"
                        />
                      ) : (
                        <>
                          {recipients.slice(0, 3).map((r, i) => (
                            <span 
                              key={i} 
                              className="inline-flex items-center px-3 py-1 rounded-full bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] text-xs font-semibold"
                            >
                              {r}
                            </span>
                          ))}
                          {recipients.length > 3 && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] text-xs font-semibold">
                              +{recipients.length - 3}
                            </span>
                          )}
                          <input
                            type="text"
                            value={manualToInput}
                            onChange={(e) => {
                              setManualToInput(e.target.value);
                              if (e.target.value.endsWith(',') || e.target.value.endsWith(' ')) {
                                const email = e.target.value.replace(/[, ]/g, '').trim();
                                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                  setRecipients([...recipients, email.toLowerCase()]);
                                  setManualToInput('');
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                const email = manualToInput.trim();
                                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                  setRecipients([...recipients, email.toLowerCase()]);
                                  setManualToInput('');
                                }
                              }
                            }}
                            className="flex-1 min-w-[80px] outline-none text-xs text-slate-800 py-1 bg-transparent"
                          />
                        </>
                      )}
                    </div>


                    {/* Upload List Action trigger */}
                    <button
                      type="button"
                      onClick={triggerFileUpload}
                      className="flex items-center gap-1 text-[#00a854] hover:text-[#008f47] font-bold text-xs transition-colors shrink-0 pl-4"
                    >
                      <Upload className="h-4 w-4" /> Upload List
                    </button>

                  </div>
                </div>
              </div>

              {/* Subject input field */}
              <div className="flex items-center gap-4 text-xs">
                <span className="w-32 font-semibold text-slate-400">Subject</span>
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="flex-1 bg-white border-b border-slate-200 px-1 py-2 text-slate-800 outline-none focus:border-b-[#00a854] placeholder-slate-300"
                />
              </div>

              {/* Campaign Spacing and Concurrency Limit settings (styled exactly as Figma border blocks) */}
              <div className="flex items-center gap-8 text-xs pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-400">Delay between 2 emails</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="00"
                    value={composeDelay || ''}
                    onChange={(e) => setComposeDelay(parseInt(e.target.value) || 0)}
                    className="w-16 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-center text-slate-800 outline-none focus:border-slate-300"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-400">Hourly Limit</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="00"
                    value={composeLimit || ''}
                    onChange={(e) => setComposeLimit(parseInt(e.target.value) || 0)}
                    className="w-16 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-center text-slate-800 outline-none focus:border-slate-300"
                  />
                </div>
              </div>

              {/* Text Area Content */}
              <div className="flex flex-col flex-1 h-[250px] relative border border-slate-200/80 rounded-2xl p-4 bg-[#fafafa]">
                <textarea
                  placeholder="Type Your Reply..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full flex-1 bg-transparent text-sm text-slate-700 outline-none resize-none placeholder-slate-300 leading-relaxed pb-12"
                />

                {/* Replicating the typography toolbar from Figma */}
                <div className="absolute bottom-3 left-3 right-3 bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between flex-wrap gap-2 text-slate-400">
                  <div className="flex items-center gap-3">
                    <Undo2 className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <Redo2 className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <span className="w-px h-4 bg-slate-200" />
                    <Type className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <span className="w-px h-4 bg-slate-200" />
                    <Bold className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <Italic className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <Underline className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <span className="w-px h-4 bg-slate-200" />
                    <AlignLeft className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <ChevronUp className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <span className="w-px h-4 bg-slate-200" />
                    <ListOrdered className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <List className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <span className="w-px h-4 bg-slate-200" />
                    <Quote className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <Image className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <Link className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                    <span className="w-px h-4 bg-slate-200" />
                    <Strikethrough className="h-4 w-4 hover:text-slate-600 cursor-pointer" />
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>

      {/* 3. SLACK CONFIGURATION MODAL OVERLAY */}
      {showSlackModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0a0b0d] rounded-3xl border border-white/10 shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowSlackModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-sm"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Slack Webhook Configurations</h3>
            <SlackWidget />
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardPage;
