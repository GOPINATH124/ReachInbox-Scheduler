import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

export class SlackController {
  /**
   * Redirects user to Slack OAuth2 consent screen.
   * Signs the userId inside a short-lived state JWT.
   */
  static connectSlack(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // Create a secure state token carrying the userId to link Slack upon callback
      const state = jwt.sign({ userId: req.user.id }, config.jwtSecret, {
        expiresIn: '15m',
      });

      const slackAuthUrl = 'https://slack.com/oauth/v2/authorize';
      const params = new URLSearchParams({
        client_id: config.slack.clientId,
        scope: 'incoming-webhook',
        redirect_uri: config.slack.redirectUri,
        state: state,
      });

      res.redirect(`${slackAuthUrl}?${params.toString()}`);
    } catch (err) {
      console.error('Slack connect redirection failed:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Handles Slack OAuth2 redirect callback.
   * Exchanged authorization code for Access Token and Webhook URL.
   */
  static async handleSlackCallback(req: Request, res: Response) {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Slack OAuth callback error:', error);
      return res.redirect(`${config.frontendUrl}/dashboard?slack_error=${error}`);
    }

    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      return res.redirect(`${config.frontendUrl}/dashboard?slack_error=invalid_callback`);
    }

    try {
      // 1. Verify state token and retrieve userId
      const decoded = jwt.verify(state, config.jwtSecret) as { userId: string };
      const userId = decoded.userId;

      // 2. Exchange authorization code for webhook details
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
          redirect_uri: config.slack.redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;

      if (!data.ok) {
        console.error('Slack API error exchanging token:', data.error);
        return res.redirect(`${config.frontendUrl}/dashboard?slack_error=exchange_failed`);
      }

      const accessToken = data.access_token;
      const webhookUrl = data.incoming_webhook?.url;
      const channelName = data.incoming_webhook?.channel;
      const teamName = data.team?.name;

      if (!webhookUrl) {
        console.error('Slack connection did not provide incoming_webhook URL');
        return res.redirect(`${config.frontendUrl}/dashboard?slack_error=missing_webhook`);
      }

      // 3. Store connection details in DB
      await prisma.slackConnection.upsert({
        where: { userId },
        update: {
          accessToken,
          webhookUrl,
          channelName,
          teamName,
        },
        create: {
          userId,
          accessToken,
          webhookUrl,
          channelName,
          teamName,
        },
      });

      console.log(`Slack workspace '${teamName}' connected for user ${userId} on channel ${channelName}`);
      res.redirect(`${config.frontendUrl}/dashboard?slack=success`);
    } catch (err: any) {
      console.error('Error during Slack callback integration:', err.message);
      res.redirect(`${config.frontendUrl}/dashboard?slack_error=integration_failed`);
    }
  }

  /**
   * Disconnects the user's Slack workspace.
   */
  static async disconnectSlack(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      await prisma.slackConnection.delete({
        where: { userId: req.user.id },
      });

      res.status(200).json({ success: true, message: 'Slack disconnected successfully' });
    } catch (err) {
      console.error('Slack disconnect failed:', err);
      res.status(500).json({ message: 'Failed to disconnect Slack connection' });
    }
  }

  /**
   * Connects Slack manually using an Incoming Webhook URL.
   */
  static async connectSlackManual(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { webhookUrl, channelName, teamName } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ message: 'webhookUrl is required' });
    }

    try {
      const connection = await prisma.slackConnection.upsert({
        where: { userId: req.user.id },
        update: {
          accessToken: 'manual-webhook-token',
          webhookUrl,
          channelName: channelName || '#general',
          teamName: teamName || 'Local Workspace',
        },
        create: {
          userId: req.user.id,
          accessToken: 'manual-webhook-token',
          webhookUrl,
          channelName: channelName || '#general',
          teamName: teamName || 'Local Workspace',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Slack Webhook connected successfully',
        connection,
      });
    } catch (err: any) {
      console.error('Slack manual connection failed:', err);
      res.status(500).json({ message: 'Failed to connect Slack manually' });
    }
  }
}
export default SlackController;

