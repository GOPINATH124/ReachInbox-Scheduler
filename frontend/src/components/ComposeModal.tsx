import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { X, Upload, Calendar, Clock, Gauge, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delay, setDelay] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  // File parsing states
  const [fileName, setFileName] = useState<string | null>(null);
  const [recipientsCount, setRecipientsCount] = useState<number | null>(null);
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Regex to match unique email addresses in file
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    if (!matches) return [];
    return Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const emails = extractEmails(text);
        if (emails.length === 0) {
          setFileError('No valid email addresses found in the selected file.');
          setRecipientsCount(null);
          setRecipientsList([]);
        } else {
          setRecipientsCount(emails.length);
          setRecipientsList(emails);
        }
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      if (fileInputRef.current) {
        // Create DataTransfer object to assign to input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
        // Trigger manual change handler
        const event = { target: fileInputRef.current } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileChange(event);
      }
    } else {
      setFileError('Invalid file type. Please upload a CSV or plain text file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (recipientsList.length === 0) {
      setSubmitError('Please upload a leads file or enter recipient email addresses.');
      return;
    }

    setLoading(true);

    try {
      // Send scheduling payload
      const response = await api.post('/api/emails/schedule', {
        sender,
        subject,
        body,
        startTime,
        delay,
        hourlyLimit,
        recipients: recipientsList,
      });

      if (response.data.success) {
        // Trigger celebration confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#3b82f6', '#10b981'],
        });

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Scheduling error:', err);
      setSubmitError(err.response?.data?.message || 'Failed to schedule campaign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="glass max-w-2xl w-full rounded-3xl border-white/10 overflow-hidden shadow-2xl flex flex-col my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/60">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Compose New Campaign</h2>
            <p className="text-xs text-slate-400 mt-0.5">Define your sender constraints and schedule leads</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)]">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sender Identity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Sender Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. Sales Team <sales@company.com>"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Campaign Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Campaign Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Scaling outreach with AI workflows"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Email Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Email Content</label>
            <textarea
              required
              rows={4}
              placeholder="Hi there, I noticed you are scaling your lead acquisition team..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans resize-none"
            />
          </div>

          {/* Drag & Drop File Upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Upload Lead List (CSV / Plaintext)</label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.txt"
                className="hidden"
              />
              {fileName ? (
                <div className="flex flex-col items-center text-center">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
                    <FileText className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">{fileName}</span>
                  {recipientsCount !== null && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> {recipientsCount} valid emails detected
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <Upload className="h-8 w-8 text-slate-500 mb-2" />
                  <span className="text-sm font-semibold">Drop CSV file here, or click to upload</span>
                  <span className="text-xs text-slate-500 mt-1">Accepts comma or newline separated email lists</span>
                </div>
              )}
            </div>
            {fileError && <p className="text-xs text-rose-400 mt-1">{fileError}</p>}
          </div>

          {/* Scheduler Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Start Time
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Delay */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-400" /> Delay spacing (s)
              </label>
              <input
                type="number"
                min="0"
                required
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Hourly Limit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 text-indigo-400" /> Hourly Send Limit
              </label>
              <input
                type="number"
                min="1"
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Errors and Submit */}
          <div className="pt-4 border-t border-white/5 space-y-4">
            {submitError && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
                {submitError}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="text-xs font-bold px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 hover:shadow-lg text-white hover:-translate-y-[1px] transition-all duration-150 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Schedule Campaign
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
export default ComposeModal;
