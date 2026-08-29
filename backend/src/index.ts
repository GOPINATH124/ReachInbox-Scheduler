  import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { config } from './config';
import { prisma } from './db';
import { EmailService } from './services/email';
import { ElasticsearchService } from './services/elasticsearch';

// Start the custom Scheduler Daemon
import { startDatabaseScheduler } from './queue/worker';

import authRoutes from './routes/auth';
import emailRoutes from './routes/email';
import slackRoutes from './routes/slack';

const app = reportApp();

function reportApp() {
  const appInstance = express();
  return appInstance;
}

// Initialize Services on Startup
async function initServices() {
  console.log('Initializing scheduler backend services...');
  
  // 1. SMTP Email Test Account Initialization
  try {
    await EmailService.init();
  } catch (err) {
    console.error('Nodemailer SMTP service fail-safe: could not initialize Ethereal test account:', err);
  }

  // 2. Elasticsearch Mappings and Index Initialization
  try {
    await ElasticsearchService.init();
  } catch (err) {
    console.error('Elasticsearch indexing service fail-safe: indexing features will be offline.');
  }

  // 3. Start the DB scheduler daemon
  try {
    startDatabaseScheduler();
  } catch (err) {
    console.error('DB scheduler daemon failed to start:', err);
  }

  // 4. Diagnostic Timezone / DB Check
  try {
    const emails = await prisma.email.findMany({ take: 5 });
    console.log('====================================');
    console.log('=== DIAGNOSTIC TIMEZONE INSPECT ===');
    console.log('Local Server Time:', new Date().toLocaleString());
    console.log('UTC Server Time:', new Date().toISOString());
    emails.forEach((e) => {
      console.log(`- Email ${e.recipient} (Status: ${e.status})`);
      console.log(`  scheduledAt (UTC):   ${new Date(e.scheduledAt).toISOString()}`);
      console.log(`  scheduledAt (Local): ${new Date(e.scheduledAt).toLocaleString()}`);
    });
    console.log('====================================');
  } catch (err) {
    console.error('Diagnostic query failed:', err);
  }
}


initServices();

// Middlewares
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Custom database-backed Queue Monitoring Dashboard
app.get('/admin/queues', async (_req, res) => {
  try {
    // 1. Fetch aggregate status counts
    const statusCounts = await prisma.email.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const stats = {
      PENDING: 0,
      SCHEDULED: 0,
      SENDING: 0,
      SENT: 0,
      FAILED: 0,
      RATE_LIMITED: 0,
    };

    statusCounts.forEach((item) => {
      const status = item.status as keyof typeof stats;
      if (status in stats) {
        stats[status] = item._count.id;
      }
    });

    // 2. Fetch the latest 50 emails
    const recentEmails = await prisma.email.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // 3. Build a beautiful dark mode HTML dashboard
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Database Queue Board | ReachInbox</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            background: radial-gradient(circle at top right, #171c26 0%, #0a0b0d 100%);
            font-family: 'Outfit', sans-serif;
          }
          .glass {
            background: rgba(25, 29, 38, 0.65);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
        </style>
      </head>
      <body class="text-slate-200 min-h-screen p-6 sm:p-10">
        <div class="max-w-7xl mx-auto space-y-8">
          
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-extrabold text-white tracking-wide bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">Database Queue Board</h1>
              <p class="text-sm text-slate-400 mt-1">Real-time status updates of active job schedulers (No Redis dependency)</p>
            </div>
            <button onclick="window.location.reload()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-all shadow-md">
              Refresh Daemon
            </button>
          </div>

          <!-- Cards Grid -->
          <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div class="glass p-5 rounded-2xl border-indigo-500/10">
              <div class="text-xs font-semibold text-slate-400 uppercase">Waiting (Pending)</div>
              <div class="text-3xl font-bold text-white mt-1">${stats.PENDING}</div>
            </div>
            <div class="glass p-5 rounded-2xl border-blue-500/10">
              <div class="text-xs font-semibold text-slate-400 uppercase">Delayed (Scheduled)</div>
              <div class="text-3xl font-bold text-blue-400 mt-1">${stats.SCHEDULED}</div>
            </div>
            <div class="glass p-5 rounded-2xl border-cyan-500/10 animate-pulse">
              <div class="text-xs font-semibold text-slate-400 uppercase">Active (Sending)</div>
              <div class="text-3xl font-bold text-cyan-400 mt-1">${stats.SENDING}</div>
            </div>
            <div class="glass p-5 rounded-2xl border-emerald-500/10">
              <div class="text-xs font-semibold text-slate-400 uppercase">Completed (Sent)</div>
              <div class="text-3xl font-bold text-emerald-400 mt-1">${stats.SENT}</div>
            </div>
            <div class="glass p-5 rounded-2xl border-rose-500/10">
              <div class="text-xs font-semibold text-slate-400 uppercase">Failed</div>
              <div class="text-3xl font-bold text-rose-400 mt-1">${stats.FAILED}</div>
            </div>
            <div class="glass p-5 rounded-2xl border-amber-500/10">
              <div class="text-xs font-semibold text-slate-400 uppercase">Rate Limited</div>
              <div class="text-3xl font-bold text-amber-400 mt-1">${stats.RATE_LIMITED}</div>
            </div>
          </div>

          <!-- Table Section -->
          <div class="glass rounded-3xl border-white/5 overflow-hidden shadow-2xl">
            <div class="px-6 py-4 border-b border-white/5 bg-slate-900/60">
              <h2 class="text-lg font-bold text-white">Active Queue Registry (Last 50 Jobs)</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase">
                    <th class="px-6 py-4">Recipient</th>
                    <th class="px-6 py-4">Sender</th>
                    <th class="px-6 py-4">Subject</th>
                    <th class="px-6 py-4">Run Time</th>
                    <th class="px-6 py-4">Status</th>
                    <th class="px-6 py-4">Logs / Error Details</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5 text-sm">
                  ${
                    recentEmails.length === 0
                      ? `<tr><td colspan="6" class="px-6 py-10 text-center text-slate-500 italic">No job logs in database yet.</td></tr>`
                      : recentEmails
                          .map((email) => {
                            let badge = '';
                            if (email.status === 'SENT') {
                              badge = `<span class="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">SENT</span>`;
                            } else if (email.status === 'FAILED') {
                              badge = `<span class="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold">FAILED</span>`;
                            } else if (email.status === 'SENDING') {
                              badge = `<span class="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold animate-pulse">SENDING</span>`;
                            } else if (email.status === 'RATE_LIMITED') {
                              badge = `<span class="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold">RATE LIMITED</span>`;
                            } else {
                              badge = `<span class="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold">SCHEDULED</span>`;
                            }

                            const errorText = email.errorMsg 
                              ? `<span class="text-rose-400" title="${email.errorMsg.replace(/"/g, '&quot;')}">${email.errorMsg}</span>`
                              : `<span class="text-slate-500">-</span>`;

                            return `
                              <tr class="hover:bg-white/[0.02] transition-colors">
                                <td class="px-6 py-4 font-semibold text-white">${email.recipient}</td>
                                <td class="px-6 py-4 text-xs">${email.sender}</td>
                                <td class="px-6 py-4 truncate max-w-xs font-medium text-slate-300">${email.subject}</td>
                                <td class="px-6 py-4 text-xs font-mono">${new Date(email.scheduledAt).toLocaleString()}</td>
                                <td class="px-6 py-4">${badge}</td>
                                <td class="px-6 py-4 text-xs font-mono max-w-sm truncate">${errorText}</td>
                              </tr>
                            `;
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </div>


        </div>
      </body>
      </html>
    `;

    res.status(200).send(html);
  } catch (error) {
    res.status(500).send(`Failed to query database queue statistics: ${error}`);
  }
});

// Application API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error]:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// Start Express Server
app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`🚀 Server running on port: ${config.port}`);
  console.log(`📊 DB Queue Board URL: http://localhost:${config.port}/admin/queues`);
  console.log(`===============================================`);
});

export default app;
