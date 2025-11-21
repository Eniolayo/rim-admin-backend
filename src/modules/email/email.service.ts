import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailConfig } from '../../config/email.config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const emailConfig = this.configService.get<EmailConfig>('email');

    if (!emailConfig || !emailConfig.pass) {
      this.logger.warn(
        'Email configuration not found or incomplete. Email service will not work.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(
          `Email transporter verification failed: ${error.message}`,
        );
      } else {
        this.logger.log('Email transporter is ready');
      }
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      if (!this.transporter) {
        const emailConfig = this.configService.get<EmailConfig>('email');
        if (!emailConfig || !emailConfig.pass) {
          this.logger.error('Email service not properly configured');
          throw new Error('Email service not properly configured');
        }
        // Try to initialize transporter if it wasn't initialized
        this.transporter = nodemailer.createTransport({
          host: emailConfig.host,
          port: emailConfig.port,
          auth: {
            user: emailConfig.user,
            pass: emailConfig.pass,
          },
        });
      }

      const emailConfig = this.configService.get<EmailConfig>('email');
      if (!emailConfig) {
        this.logger.error('Email configuration not found');
        throw new Error('Email configuration not found');
      }

      const mailOptions = {
        from: `"${emailConfig.fromName}" <${emailConfig.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${options.to}. MessageId: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendAdminInvitationEmail(
    email: string,
    inviteToken: string,
    roleName: string,
    invitedByName: string,
    expiresAt: Date,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationLink = `${frontendUrl}/admin/setup/${inviteToken}`;
    const expirationDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Invitation - RIM</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Admin Invitation</h2>
            <p>Hello,</p>
            <p>You have been invited by <strong>${invitedByName}</strong> to join the RIM Admin Portal as a <strong>${roleName}</strong>.</p>
            <p>To accept this invitation and set up your account, please click the link below:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Accept Invitation
              </a>
            </p>
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${invitationLink}" style="color: #3498db; word-break: break-all;">${invitationLink}</a>
            </p>
            <p style="font-size: 14px; color: #e74c3c; margin-top: 30px;">
              <strong>Important:</strong> This invitation will expire on ${expirationDate}. Please accept it before then.
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you did not expect this invitation, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated message from RIM Admin Portal. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Admin Invitation

Hello,

You have been invited by ${invitedByName} to join the RIM Admin Portal as a ${roleName}.

To accept this invitation and set up your account, please visit:
${invitationLink}

Important: This invitation will expire on ${expirationDate}. Please accept it before then.

If you did not expect this invitation, please ignore this email.

This is an automated message from RIM Admin Portal. Please do not reply to this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Admin Invitation - RIM',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;
    const expirationDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset=\"utf-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
          <title>Password Reset - RIM</title>
        </head>
        <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">
          <div style=\"background-color: #f4f4f4; padding: 20px; border-radius: 5px;\">
            <h2 style=\"color: #2c3e50; margin-top: 0;\">Password Reset</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password for your RIM Admin account.</p>
            <p>To proceed, click the button below to set a new password:</p>
            <p style=\"text-align: center; margin: 30px 0;\">
              <a href=\"${resetLink}\"
                 style=\"background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;\">
                Reset Password
              </a>
            </p>
            <p style=\"font-size: 14px; color: #666;\">
              Or copy and paste this link into your browser:<br>
              <a href=\"${resetLink}\" style=\"color: #3498db; word-break: break-all;\">${resetLink}</a>
            </p>
            <p style=\"font-size: 14px; color: #e74c3c; margin-top: 30px;\">
              <strong>Important:</strong> This password reset link will expire on ${expirationDate}.
            </p>
            <p style=\"font-size: 14px; color: #666; margin-top: 30px;\">
              If you did not request a password reset, you can safely ignore this email.
            </p>
            <hr style=\"border: none; border-top: 1px solid #eee; margin: 30px 0;\">
            <p style=\"font-size: 12px; color: #999; text-align: center;\">
              This is an automated message from RIM Admin Portal. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Reset

Hello,

We received a request to reset the password for your RIM Admin account.

To proceed, visit:
${resetLink}

Important: This password reset link will expire on ${expirationDate}.

If you did not request a password reset, you can safely ignore this email.

This is an automated message from RIM Admin Portal. Please do not reply to this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset - RIM',
      html,
      text,
    });
  }
}
