import axios from 'axios';
import { prisma } from '../db';

export class SlackService {
  /**
   * Sends a rate limit notification to the user's connected Slack workspace.
   */
  static async sendRateLimitNotification(params: {
    userId: string;
    sender: string;
    limit: number;
    delaySeconds: number;
  }): Promise<boolean> {
    try {
      const slackConn = await prisma.slackConnection.findUnique({
        where: { userId: params.userId },
      });

      if (!slackConn || !slackConn.webhookUrl) {
        console.log(`[Slack] No Slack connection found for user ${params.userId}. Skipping notification.`);
        return false;
      }

      const messageText = `⚠️ *Rate Limit Alert (ReachInbox)*\n` +
                          `• *Sender:* \`${params.sender}\`\n` +
                          `• *Reason:* Hourly rate limit of *${params.limit} emails/hour* has been reached.\n` +
                          `• *Action:* Outstanding emails have been automatically rescheduled to the next hour window (delayed by ${Math.ceil(params.delaySeconds / 60)} minutes).\n` +
                          `• *Status:* Queue integrity preserved. No duplicate emails will be sent.`;

      await axios.post(slackConn.webhookUrl, {
        text: messageText,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: messageText,
            },
          },
        ],
      });

      console.log(`[Slack] Rate limit alert successfully sent to Slack for user ${params.userId}`);
      return true;
    } catch (error) {
      console.error(`[Slack] Failed to send notification for user ${params.userId}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }
}
export default SlackService;
