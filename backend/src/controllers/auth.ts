import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  /**
   * Redirects user to Google OAuth2 consent screen.
   */
  static redirectToGoogle(req: Request, res: Response) {
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });

    res.redirect(`${googleAuthUrl}?${params.toString()}`);
  }

  /**
   * Handles Google OAuth2 redirect callback.
   */
  static async handleGoogleCallback(req: Request, res: Response) {
    const { code, error } = req.query;

    if (error) {
      console.error('Google OAuth callback error:', error);
      return res.redirect(`${config.frontendUrl}/login?error=${error}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/login?error=no_code`);
    }

    try {
      // 1. Exchange code for access & id tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: 'authorization_code',
      });

      const { access_token } = tokenResponse.data;

      // 2. Fetch user profile from Google UserInfo endpoint
      const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { sub: googleId, email, name, picture: avatar } = userResponse.data;

      if (!email) {
        return res.redirect(`${config.frontendUrl}/login?error=email_not_provided`);
      }

      // 3. Upsert user in the PostgreSQL Database
      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar, googleId },
        create: { googleId, email, name, avatar },
      });

      // 4. Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      // 5. Set JWT token in cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // 6. Redirect to frontend with token in query params (for local storage fallback)
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
    } catch (err: any) {
      console.error('Error during Google authentication callback:', err.response?.data || err.message);
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }

  /**
   * Retrieves profile details of the authenticated user.
   */
  static async getMe(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          slackConnection: {
            select: {
              channelName: true,
              teamName: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackConnected: !!user.slackConnection,
          slackChannel: user.slackConnection?.channelName,
          slackTeam: user.slackConnection?.teamName,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve profile' });
    }
  }

  /**
   * Logs out the user by clearing the JWT token cookie.
   */
  static logout(req: Request, res: Response) {
    res.clearCookie('token');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  /**
   * Developer login bypass to authenticate locally without Google Client credentials.
   */
  static async devLogin(req: Request, res: Response) {
    try {
      const email = 'dev@reachinbox.ai';
      const name = 'Developer Admin';
      const googleId = 'dev-mock-id';
      const avatar = 'https://lh3.googleusercontent.com/a/default-user=s96-c';

      // Upsert the developer user in the SQLite Database
      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar, googleId },
        create: { googleId, email, name, avatar },
      });

      // Generate local JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect to the frontend callback redirect page
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
    } catch (err: any) {
      console.error('Error during Developer mock login:', err.message);
      res.redirect(`${config.frontendUrl}/login?error=dev_login_failed`);
    }
  }
}

