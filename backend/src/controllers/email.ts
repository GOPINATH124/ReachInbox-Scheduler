import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { scheduleEmailJob } from '../queue';
import { ElasticsearchService } from '../services/elasticsearch';

/**
 * Extracts unique, valid email addresses from text (CSV / plain text content).
 */
function extractEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  if (!matches) return [];
  // Deduplicate emails
  return Array.from(new Set(matches.map((email: string) => email.toLowerCase().trim())));
}

export class EmailController {
  /**
   * Schedules a batch of emails.
   * Can accept recipients in req.body or a file upload.
   */
  static async scheduleEmails(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const {
        sender,
        subject,
        body,
        startTime,
        delay = 2,          // delay between sends in seconds
        hourlyLimit = 200,   // max sends per hour
      } = req.body;

      let recipients: string[] = [];

      // 1. Check for CSV / Text File upload
      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        recipients = extractEmailsFromText(fileContent);
      } else if (req.body.recipients) {
        // Accept array of emails or comma-separated string
        if (Array.isArray(req.body.recipients)) {
          recipients = req.body.recipients;
        } else if (typeof req.body.recipients === 'string') {
          recipients = extractEmailsFromText(req.body.recipients);
        }
      }

      if (!sender || !subject || !body || !startTime) {
        return res.status(400).json({
          message: 'Missing required fields: sender, subject, body, and startTime must be provided.',
        });
      }

      if (recipients.length === 0) {
        return res.status(400).json({
          message: 'No valid recipient email addresses detected.',
        });
      }

      const parsedStartTime = new Date(startTime);
      if (isNaN(parsedStartTime.getTime())) {
        return res.status(400).json({ message: 'Invalid start time provided.' });
      }

      const delaySeconds = parseInt(delay, 10);
      const limitPerHour = parseInt(hourlyLimit, 10);

      const batchStartTimeMs = parsedStartTime.getTime();
      const minDelayMs = delaySeconds * 1000;
      
      const createdEmails = [];

      console.log(`Scheduling ${recipients.length} emails. Limit: ${limitPerHour}/hr, Delay: ${delaySeconds}s`);

      // 2. Pre-calculate the schedule dates for each email
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        // Hour Block
        const hourBlock = Math.floor(i / limitPerHour);
        // Delay offset within the hour block
        const offsetWithinHour = (i % limitPerHour) * minDelayMs;
        
        const scheduledTime = new Date(batchStartTimeMs + hourBlock * 3600000 + offsetWithinHour);

        // Store Email record in DB with temporary status PENDING to prevent early worker picking
        const dbEmail = await prisma.email.create({
          data: {
            userId: req.user.id,
            sender,
            recipient,
            subject,
            body,
            status: 'PENDING',
            scheduledAt: scheduledTime,
            hourlyLimit: limitPerHour,
            minDelay: delaySeconds,
          },
        });

        // 3. Queue BullMQ Job with correct delay
        const delayMs = scheduledTime.getTime() - Date.now();
        const job = await scheduleEmailJob(dbEmail.id, delayMs);

        // Update database with final status and jobId
        const finalEmail = await prisma.email.update({
          where: { id: dbEmail.id },
          data: {
            status: 'SCHEDULED',
            jobId: job.id,
          },
        });

        // 4. Index in Elasticsearch
        await ElasticsearchService.indexEmail({
          id: finalEmail.id,
          userId: finalEmail.userId,
          sender: finalEmail.sender,
          recipient: finalEmail.recipient,
          subject: finalEmail.subject,
          body: finalEmail.body,
          status: finalEmail.status,
          scheduledAt: finalEmail.scheduledAt,
          sentAt: finalEmail.sentAt,
          createdAt: finalEmail.createdAt,
        });

        createdEmails.push(finalEmail);
      }

      res.status(200).json({
        success: true,
        message: `Successfully scheduled ${recipients.length} emails starting at ${parsedStartTime.toISOString()}.`,
        count: recipients.length,
      });
    } catch (err: any) {
      console.error('Email scheduling failed:', err);
      res.status(500).json({ message: 'Failed to schedule emails. ' + err.message });
    }
  }

  /**
   * Retrieves list of scheduled emails (PENDING, SCHEDULED, SENDING, RATE_LIMITED).
   */
  static async getScheduledEmails(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const emails = await prisma.email.findMany({
        where: {
          userId: req.user.id,
          status: {
            in: ['PENDING', 'SCHEDULED', 'SENDING', 'RATE_LIMITED'],
          },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      res.status(200).json({ emails });
    } catch (err) {
      res.status(500).json({ message: 'Failed to retrieve scheduled emails.' });
    }
  }

  /**
   * Retrieves list of sent/failed emails (SENT, FAILED).
   */
  static async getSentEmails(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const emails = await prisma.email.findMany({
        where: {
          userId: req.user.id,
          status: {
            in: ['SENT', 'FAILED'],
          },
        },
        orderBy: { sentAt: 'desc' },
      });

      res.status(200).json({ emails });
    } catch (err) {
      res.status(500).json({ message: 'Failed to retrieve sent emails.' });
    }
  }

  /**
   * Searches scheduled and sent emails.
   * Utilizes Elasticsearch index, with Prisma fallback.
   */
  static async searchEmails(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { q = '', status } = req.query;
    const queryStr = String(q);

    try {
      // 1. Try Searching in Elasticsearch
      const searchResult = await ElasticsearchService.searchEmails({
        userId: req.user.id,
        query: queryStr,
        status: status ? String(status) : undefined,
        limit: 100,
      });

      if (searchResult.ids.length > 0) {
        // Fetch ordered emails from DB using Elasticsearch results
        const emails = await prisma.email.findMany({
          where: {
            id: { in: searchResult.ids },
          },
        });
        
        // Maintain the ordering returned by Elasticsearch
        const idMap = new Map(emails.map((e: any) => [e.id, e]));
        const orderedEmails = searchResult.ids
          .map((id: string) => idMap.get(id))
          .filter(Boolean);

        return res.status(200).json({ emails: orderedEmails, source: 'elasticsearch' });
      }

      // 2. Database Fallback (if Elasticsearch fails, returns 0 hits, or is offline)
      console.log('[Search] Elasticsearch returned 0 hits or is offline. Falling back to DB search.');
      
      const mustFilters: any = { userId: req.user.id };

      if (status) {
        mustFilters.status = status;
      }

      if (queryStr.trim() !== '') {
        mustFilters.OR = [
          { subject: { contains: queryStr, mode: 'insensitive' } },
          { body: { contains: queryStr, mode: 'insensitive' } },
          { recipient: { contains: queryStr, mode: 'insensitive' } },
          { sender: { contains: queryStr, mode: 'insensitive' } },
        ];
      }

      const emails = await prisma.email.findMany({
        where: mustFilters,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.status(200).json({ emails, source: 'database_fallback' });
    } catch (err) {
      console.error('Search request failed:', err);
      res.status(500).json({ message: 'Search operation failed.' });
    }
  }

  /**
   * Retrieves dashboard analytics statistics.
   */
  static async getStats(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const counts = await prisma.email.groupBy({
        by: ['status'],
        where: { userId: req.user.id },
        _count: {
          id: true,
        },
      });

      const stats = {
        scheduled: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        rateLimited: 0,
        total: 0,
      };

      counts.forEach((item: any) => {
        const count = item._count.id;
        stats.total += count;
        switch (item.status) {
          case 'SCHEDULED':
          case 'PENDING':
            stats.scheduled += count;
            break;
          case 'SENDING':
            stats.sending += count;
            break;
          case 'SENT':
            stats.sent += count;
            break;
          case 'FAILED':
            stats.failed += count;
            break;
          case 'RATE_LIMITED':
            stats.rateLimited += count;
            break;
        }
      });

      res.status(200).json({ stats });
    } catch (err) {
      res.status(500).json({ message: 'Failed to compute stats.' });
    }
  }
}
