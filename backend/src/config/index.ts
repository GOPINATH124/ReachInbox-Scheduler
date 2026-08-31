import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const cleanStr = (val?: string, fallback = ''): string => {
  if (!val) return fallback;
  return val.replace(/^["']|["']$/g, '').trim();
};

export const config = {
  port: cleanStr(process.env.PORT, '5000'),
  databaseUrl: cleanStr(process.env.DATABASE_URL, 'file:./dev.db'),
  redisUrl: cleanStr(process.env.REDIS_URL, 'redis://localhost:6379'),
  elasticsearchUrl: cleanStr(process.env.ELASTICSEARCH_URL, 'http://localhost:9200'),
  jwtSecret: cleanStr(process.env.JWT_SECRET, 'super-secret-reachinbox-key'),
  frontendUrl: cleanStr(process.env.FRONTEND_URL, 'http://localhost:5173'),
  google: {
    clientId: cleanStr(process.env.GOOGLE_CLIENT_ID, ''),
    clientSecret: cleanStr(process.env.GOOGLE_CLIENT_SECRET, ''),
    redirectUri: cleanStr(process.env.GOOGLE_REDIRECT_URI, 'http://localhost:5000/api/auth/google/callback'),
  },
  slack: {
    clientId: cleanStr(process.env.SLACK_CLIENT_ID, ''),
    clientSecret: cleanStr(process.env.SLACK_CLIENT_SECRET, ''),
    redirectUri: cleanStr(process.env.SLACK_REDIRECT_URI, 'http://localhost:5000/api/slack/callback'),
  },
  smtp: {
    host: cleanStr(process.env.SMTP_HOST, 'smtp.ethereal.email'),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: cleanStr(process.env.SMTP_USER, ''),
    pass: cleanStr(process.env.SMTP_PASSWORD, ''),
    from: cleanStr(process.env.SMTP_FROM, 'no-reply@reachinbox.ai'),
  },
  maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '100', 10),
  emailDelayMs: parseInt(process.env.EMAIL_DELAY_MS || '2000', 10),
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
};


