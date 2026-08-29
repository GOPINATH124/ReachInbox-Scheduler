import nodemailer from 'nodemailer';
import { config } from '../config';

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static etherealAccount: { user: string; pass: string } | null = null;

  /**
   * Initializes Nodemailer SMTP transporter.
   * Uses SMTP credentials from environment variables if present, 
   * otherwise creates a dynamic Ethereal test account.
   */
  static async init(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    let host = config.smtp.host;
    let port = config.smtp.port;
    let user = config.smtp.user;
    let pass = config.smtp.pass;

    if (!user || !pass) {
      console.log('No SMTP credentials found in config. Generating Ethereal SMTP test credentials...');
      try {
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        host = 'smtp.ethereal.email';
        port = 587;
        this.etherealAccount = { user, pass };
        console.log(`Generated Ethereal SMTP User: ${user}`);
      } catch (err) {
        console.error('Failed to create Ethereal SMTP test account:', err);
        throw err;
      }
    } else {
      this.etherealAccount = { user, pass };
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    console.log(`Nodemailer SMTP Transporter initialized successfully at ${host}:${port}`);
    return this.transporter;
  }

  /**
   * Sends an email via SMTP.
   * Returns metadata including Ethereal preview link.
   */
  static async sendEmail(params: {
    sender: string;
    recipient: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | false }> {
    const transporter = await this.init();
    
    // SMTP providers require the 'from' envelope address to match the authenticated user
    const authenticatedUser = this.etherealAccount ? this.etherealAccount.user : config.smtp.user;
    const fromAddress = `"${params.sender}" <${authenticatedUser}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.recipient,
      subject: params.subject,
      text: params.body,
      html: params.body.replace(/\n/g, '<br/>'),
      headers: {
        'X-ReachInbox-Sender': params.sender // Tracing header
      }
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}
export default EmailService;
