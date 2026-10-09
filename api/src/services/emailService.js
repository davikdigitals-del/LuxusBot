import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const encodeMimeHeader = (value) => {
  const text = String(value ?? '');
  if (/[\r\n]/.test(text)) throw new Error('Email header contains an invalid line break');
  return /^[\x20-\x7e]*$/.test(text)
    ? text
    : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
};

const formatMailbox = (mailbox) => {
  if (typeof mailbox === 'string') {
    if (/[\r\n]/.test(mailbox)) throw new Error('Email address contains an invalid line break');
    return mailbox;
  }
  if (!mailbox || typeof mailbox.address !== 'string') {
    throw new Error('Invalid email address');
  }
  const address = formatMailbox(mailbox.address);
  if (!mailbox.name) return address;
  return `${encodeMimeHeader(mailbox.name)} <${address}>`;
};

const wrapBase64 = (value) => String(value).match(/.{1,76}/g)?.join('\r\n') || '';

const buildMimeMessage = ({ from, to, subject, html, text, replyTo }) => {
  const boundary = `luxusbot_${crypto.randomUUID()}`;
  const lines = [
    `From: ${formatMailbox(from)}`,
    `To: ${formatMailbox(to)}`,
    `Subject: ${encodeMimeHeader(subject)}`,
  ];
  if (replyTo) lines.push(`Reply-To: ${formatMailbox(replyTo)}`);
  lines.push(
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(text || '', 'utf8').toString('base64')),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(html || '', 'utf8').toString('base64')),
    `--${boundary}--`,
    '',
  );
  return lines.join('\r\n');
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

class EmailService {
  constructor({ email = config.email, appUrl = config.appUrl, fetchImpl = globalThis.fetch } = {}) {
    this.email = email;
    this.fetch = fetchImpl;
    this.gmailAccessToken = null;
    this.gmailAccessTokenExpiresAt = 0;
    this.transporter = nodemailer.createTransport({
      host: email?.host || 'smtp.gmail.com',
      port: email?.port || 587,
      secure: email?.port === 465,
      auth: {
        user: email?.user,
        pass: email?.password
      }
    });

    this.from = email?.from || email?.user || config.company?.email || 'noreply@example.com';
    this.appUrl = appUrl || 'http://localhost:3000';
  }

  isConfigured() {
    if (!this.email?.user) return false;
    if (this.email.provider === 'gmail-api') {
      return Boolean(
        this.email.googleClientId &&
        this.email.googleClientSecret &&
        this.email.googleRefreshToken
      );
    }
    return Boolean(this.email.password);
  }

  async getGmailAccessToken() {
    if (this.gmailAccessToken && this.gmailAccessTokenExpiresAt > Date.now() + 60_000) {
      return this.gmailAccessToken;
    }

    const response = await this.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.email.googleClientId,
        client_secret: this.email.googleClientSecret,
        refresh_token: this.email.googleRefreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) {
      const reason = result.error_description || result.error || `HTTP ${response.status}`;
      throw new Error(`Gmail API token refresh failed: ${reason}`);
    }

    this.gmailAccessToken = result.access_token;
    this.gmailAccessTokenExpiresAt = Date.now() + (Number(result.expires_in) || 3600) * 1000;
    return this.gmailAccessToken;
  }

  async sendViaGmailApi(mailOptions) {
    const accessToken = await this.getGmailAccessToken();
    const raw = Buffer.from(buildMimeMessage(mailOptions), 'utf8').toString('base64url');
    const response = await this.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (!response.ok) {
      const reason = result.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gmail API send failed: ${reason}`);
    }
    return result;
  }

  renderBrandedEmail({ preheader, title, body, button, footerNote }) {
    const buttonHtml = button
      ? `<tr><td align="left" style="padding:26px 0 8px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#285b43;border:1px solid #285b43;border-radius:6px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:13px 22px;text-decoration:none">${escapeHtml(button.label)}</a></td></tr><tr><td style="padding:10px 0 0;color:#69716c;font-family:Arial,sans-serif;font-size:12px;line-height:19px">Button not working? Copy this link into your browser:<br><a href="${escapeHtml(button.url)}" style="color:#285b43;word-break:break-all">${escapeHtml(button.url)}</a></td></tr>`
      : '';

    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f3ef">
    <tr><td align="center" style="padding:34px 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px">
        <tr><td style="background:#18251e;border-radius:10px 10px 0 0;padding:23px 30px">
          <a href="${escapeHtml(this.appUrl.replace(/\/+$/, ''))}" style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:23px;letter-spacing:.2px;text-decoration:none">Luxus Bot</a>
          <span style="display:block;margin-top:7px;color:#c9d9cc;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">WhatsApp support, thoughtfully handled</span>
        </td></tr>
        <tr><td style="height:4px;background:#c5a15b;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;padding:34px 30px 36px">
          <h1 style="margin:0 0 16px;color:#18251e;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;line-height:1.25">${escapeHtml(title)}</h1>
          <div style="color:#4e5852;font-family:Arial,sans-serif;font-size:15px;line-height:1.75">${body}</div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:6px">${buttonHtml}</table>
          ${footerNote ? `<p style="margin:26px 0 0;border-top:1px solid #e8e7e1;padding-top:17px;color:#778079;font-family:Arial,sans-serif;font-size:12px;line-height:1.65">${footerNote}</p>` : ''}
        </td></tr>
        <tr><td style="padding:19px 20px;text-align:center;color:#778079;font-family:Arial,sans-serif;font-size:11px;line-height:1.7">
          <strong style="color:#46534a">Luxus Bot</strong><br>Helpful WhatsApp conversations, with your team in reach.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  /**
   * Send email
   */
  async sendEmail(to, subject, html, text, options = {}) {
    try {
      if (!this.isConfigured()) {
        throw new Error(
          this.email?.provider === 'gmail-api'
            ? 'Gmail API email service is not configured; set EMAIL_SMTP_USER, GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, and GMAIL_API_REFRESH_TOKEN'
            : 'SMTP email service is not configured; set EMAIL_SMTP_USER and EMAIL_SMTP_PASSWORD'
        );
      }

      const mailOptions = {
        from: this.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        ...options,
      };

      const info = this.email.provider === 'gmail-api'
        ? await this.sendViaGmailApi(mailOptions)
        : await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${subject}`);
      
      return info;
    } catch (error) {
      logger.error(`Email send error: ${error.message}`);
      throw error;
    }
  }

  async sendContactFormEmail({ name, email, topic, message }) {
    if (!this.isConfigured()) {
      throw new Error('Email service is not configured');
    }

    const recipient = 'davikdigitals@gmail.com';
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeTopic = escapeHtml(topic);
    const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
    const subject = `Luxus Bot contact | ${topic}`;
    const html = this.renderBrandedEmail({
      preheader: `New ${topic.toLowerCase()} message from ${name}.`,
      title: 'New contact request',
      body: `<p style="margin:0 0 10px"><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p><p style="margin:0 0 10px"><strong>Topic:</strong> ${safeTopic}</p><p style="margin:0"><strong>Message:</strong><br>${safeMessage}</p>`,
      footerNote: 'Reply directly to this email to respond to the sender.',
    });
    const text = `New contact request\n\nFrom: ${name} <${email}>\nTopic: ${topic}\n\n${message}`;

    return this.sendEmail(recipient, subject, html, text, { replyTo: { name, address: email } });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, token) {
    const verifyUrl = `${this.appUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = 'Luxus Bot | Verify your email';
    const html = this.renderBrandedEmail({
      preheader: 'Verify your email to get started with Luxus Bot.',
      title: 'Welcome to Luxus Bot',
      body: '<p style="margin:0">Thanks for creating an account. Verify your email address to get started.</p>',
      button: { label: 'Verify email address', url: verifyUrl },
      footerNote: 'This verification link expires in 24 hours. If you did not create this account, you can ignore this email.',
    });
    return this.sendEmail(email, subject, html, `Verify your email to get started: ${verifyUrl}\n\nThis link expires in 24 hours.`);
  }

  /**
   * Sent right after the first successful payment: link to set a password and sign in.
   */
  async sendAccountReadyEmail(email, firstName, businessName, token) {
    const setUrl = `${this.appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}&welcome=1`;
    const subject = 'Luxus Bot | Your workspace is ready';
    const html = this.renderBrandedEmail({
      preheader: 'Your payment was received. Set your password to access your workspace.',
      title: `Welcome, ${escapeHtml(firstName)}!`,
      body: `<p style="margin:0">Your payment was received and <strong>${escapeHtml(businessName)}</strong> is ready. Set a password to sign in and connect your WhatsApp.</p>`,
      button: { label: 'Set my password', url: setUrl },
      footerNote: 'This link is valid for 7 days. If it expires, request a new link from the sign-in page.',
    });
    return this.sendEmail(email, subject, html, `Your workspace ${businessName} is ready. Set your password: ${setUrl}\n\nThis link expires in 7 days.`);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token) {
    if (!this.isConfigured()) {
      throw new Error('Email service is not configured');
    }
    const resetUrl = `${this.appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    
    const subject = 'Luxus Bot | Password reset request';
    const html = this.renderBrandedEmail({
      preheader: 'Use this secure link to reset your Luxus Bot password.',
      title: 'Reset your password',
      body: '<p style="margin:0">We received a request to reset your password. Use the button below to choose a new one.</p>',
      button: { label: 'Reset password', url: resetUrl },
      footerNote: 'This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.',
    });
    const text = `You requested to reset your password. Open this link to create a new password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;
    return this.sendEmail(email, subject, html, text);
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitation(email, { businessName, inviterName, role, department, inviteToken }) {
    if (!this.isConfigured()) {
      throw new Error('Email service is not configured');
    }
    const inviteUrl = `${this.appUrl.replace(/\/+$/, '')}/accept-invitation?token=${encodeURIComponent(inviteToken)}`;
    const safeBusinessName = escapeHtml(businessName);
    const safeInviterName = escapeHtml(inviterName);
    const safeRole = escapeHtml(role);
    const safeDepartment = department ? ` in the <strong>${escapeHtml(department)}</strong> department` : '';
    const subject = `Luxus Bot | Invitation to join ${businessName}`;
    const html = this.renderBrandedEmail({
      preheader: `${inviterName} invited you to join ${businessName} on Luxus Bot.`,
      title: 'You’re invited',
      body: `<p style="margin:0">${safeInviterName} invited you to join <strong>${safeBusinessName}</strong> as a <strong>${safeRole}</strong>${safeDepartment}.</p><p style="margin:14px 0 0">Accept the invitation to join the workspace and collaborate with the team.</p>`,
      button: { label: 'Accept invitation', url: inviteUrl },
      footerNote: 'This invitation link expires in 7 days. If you already have a Luxus Bot account, sign in with the invited email address.',
    });
    const text = `${inviterName} invited you to join ${businessName} as ${role}${department ? ` in ${department}` : ''}.\n\nAccept the invitation: ${inviteUrl}\n\nThis link expires in 7 days.`;
    return this.sendEmail(email, subject, html, text);
  }

  /**
   * Send welcome email after onboarding
   */
  async sendWelcomeEmail(email, firstName, businessName) {
    const dashboardUrl = `${this.appUrl.replace(/\/+$/, '')}/dashboard`;
    const subject = 'Luxus Bot | Welcome to your workspace';
    const html = this.renderBrandedEmail({
      preheader: `Your WhatsApp assistant for ${businessName} is ready.`,
      title: `Welcome, ${escapeHtml(firstName)}!`,
      body: `<p style="margin:0">Your WhatsApp assistant for <strong>${escapeHtml(businessName)}</strong> is ready. Start by connecting WhatsApp, adding your business knowledge, and inviting your team.</p>`,
      button: { label: 'Go to your dashboard', url: dashboardUrl },
      footerNote: 'Need help? Visit our website or contact the Luxus Bot support team.',
    });
    return this.sendEmail(email, subject, html, `Your WhatsApp assistant for ${businessName} is ready. Open your dashboard: ${dashboardUrl}`);
  }

  /**
   * Send usage alert email
   */
  async sendUsageAlert(email, businessName, usageType, percentage) {
    const billingUrl = `${this.appUrl.replace(/\/+$/, '')}/dashboard/billing`;
    const subject = `Luxus Bot | ${usageType} usage alert`;
    const html = this.renderBrandedEmail({
      preheader: `${usageType} usage has reached ${percentage}% for ${businessName}.`,
      title: 'Usage update',
      body: `<p style="margin:0"><strong>${escapeHtml(businessName)}</strong> has used <strong>${escapeHtml(percentage)}%</strong> of its ${escapeHtml(usageType)} allowance. Review your plan to help avoid interruptions.</p>`,
      button: { label: 'Review your plan', url: billingUrl },
      footerNote: 'This is an automated account notification from Luxus Bot.',
    });
    return this.sendEmail(email, subject, html, `${businessName} has reached ${percentage}% of its ${usageType} allowance. Review your plan: ${billingUrl}`);
  }
}

export { EmailService, buildMimeMessage };
export default new EmailService();
