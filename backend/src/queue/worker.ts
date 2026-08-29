import { prisma } from '../db';
import { config } from '../config';
import { EmailService } from '../services/email';
import { ElasticsearchService } from '../services/elasticsearch';
import { SlackService } from '../services/slack';

let isRunning = false;

/**
 * Starts the PostgreSQL-backed scheduler loop (Daemon).
 */
export function startDatabaseScheduler() {
  if (isRunning) return;
  isRunning = true;
  console.log('🚀 DB Scheduler Daemon started (No Redis dependency)');
  tick();
}

/**
 * Daemon polling loop tick.
 */
async function tick() {
  try {
    await processScheduledEmails();
  } catch (error) {
    console.error('[DB Daemon] Error in scheduler cycle:', error);
  }
  // Check the database every 1 second
  setTimeout(tick, 1000);
}

/**
 * Fetches and processes emails that are due for delivery.
 */
async function processScheduledEmails() {
  const concurrency = config.workerConcurrency || 5;

  // 1. Query PostgreSQL for emails whose scheduled time has passed
  const emails = await prisma.email.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: concurrency,
  });

  if (emails.length === 0) return;

  // Process selected emails concurrently up to workerConcurrency limit
  await Promise.all(emails.map((email) => sendEmailWithLock(email.id)));
}

/**
 * Processes an individual email. Enforces concurrency locking via status updates.
 */
async function sendEmailWithLock(emailId: string) {
  try {
    // 2. Concurrency Lock: Transition state atomically from SCHEDULED to SENDING
    const updateResult = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: 'SCHEDULED',
      },
      data: {
        status: 'SENDING',
      },
    });

    // If no row was updated, it means another daemon thread picked it up already
    if (updateResult.count === 0) return;

    // Load full email details
    const email = await prisma.email.findUnique({ where: { id: emailId } });
    if (!email) return;

    // 3. Idempotency check (failsafe)
    if (email.sentAt) {
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'SENT' },
      });
      return;
    }

    const limit = email.hourlyLimit || config.maxEmailsPerHour;
    const now = Date.now();
    const oneHourAgo = new Date(now - 3600000);

    // 4. Rate Limiting Check: Count emails sent by this sender in the last 1 hour
    const sentCount = await prisma.email.count({
      where: {
        sender: email.sender,
        status: 'SENT',
        sentAt: { gte: oneHourAgo },
      },
    });

    if (sentCount >= limit) {
      console.warn(`[Scheduler] Hourly limit reached for ${email.sender} (${sentCount}/${limit}). Rescheduling.`);
      
      const nextHourStart = new Date(Math.floor(now / 3600000) * 3600000 + 3600000);
      const delayMs = nextHourStart.getTime() - now;

      // Update email status in DB
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SCHEDULED',
          scheduledAt: nextHourStart,
        },
      });

      // Index rescheduled status in Elasticsearch
      await ElasticsearchService.indexEmail({
        id: updatedEmail.id,
        userId: updatedEmail.userId,
        sender: updatedEmail.sender,
        recipient: updatedEmail.recipient,
        subject: updatedEmail.subject,
        body: updatedEmail.body,
        status: updatedEmail.status,
        scheduledAt: updatedEmail.scheduledAt,
        sentAt: updatedEmail.sentAt,
        createdAt: updatedEmail.createdAt,
      });

      // Trigger Slack alert
      await SlackService.sendRateLimitNotification({
        userId: email.userId,
        sender: email.sender,
        limit,
        delaySeconds: Math.ceil(delayMs / 1000),
      });

      return;
    }

    // 5. Apply delay spacing (throttling spacing)
    const delaySpacingMs = email.minDelay ? (email.minDelay * 1000) : config.emailDelayMs;
    if (delaySpacingMs > 0) {
      console.log(`[Scheduler] Email ${emailId} applying spacing delay of ${delaySpacingMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delaySpacingMs));
    }

    // 6. Send Email using Ethereal SMTP service
    console.log(`[Scheduler] Sending email ${emailId} from ${email.sender} to ${email.recipient}`);
    const sendResult = await EmailService.sendEmail({
      sender: email.sender,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
    });

    const sentAt = new Date();
    
    // 7. Update status to SENT
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt,
        errorMsg: sendResult.previewUrl ? `Preview URL: ${sendResult.previewUrl}` : null,
      },
    });

    console.log(`[Scheduler] Email ${emailId} delivered successfully. Preview: ${sendResult.previewUrl}`);

    // 8. Index updated status in Elasticsearch
    await ElasticsearchService.indexEmail({
      id: updatedEmail.id,
      userId: updatedEmail.userId,
      sender: updatedEmail.sender,
      recipient: updatedEmail.recipient,
      subject: updatedEmail.subject,
      body: updatedEmail.body,
      status: updatedEmail.status,
      scheduledAt: updatedEmail.scheduledAt,
      sentAt: updatedEmail.sentAt,
      createdAt: updatedEmail.createdAt,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler] Delivery failure for email ${emailId}:`, errorMsg);

    // Update status to FAILED
    try {
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          errorMsg,
        },
      });

      await ElasticsearchService.indexEmail({
        id: updatedEmail.id,
        userId: updatedEmail.userId,
        sender: updatedEmail.sender,
        recipient: updatedEmail.recipient,
        subject: updatedEmail.subject,
        body: updatedEmail.body,
        status: updatedEmail.status,
        scheduledAt: updatedEmail.scheduledAt,
        sentAt: updatedEmail.sentAt,
        createdAt: updatedEmail.createdAt,
      });
    } catch (dbErr) {
      console.error('[Scheduler] Failed to write error state to DB:', dbErr);
    }
  }
}
