
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import net from 'net';
import tls from 'tls';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

interface EmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export class EmailTool extends BaseTool {
  public readonly name = 'send_email';

  public readonly description =
    'Envia emails atraves de SMTP configurado.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Destinatario(s) do email (separados por virgula).',
      },
      subject: {
        type: 'string',
        description: 'Assunto do email.',
      },
      body: {
        type: 'string',
        description: 'Corpo do email.',
      },
      cc: {
        type: 'string',
        description: 'Copia (CC) separados por virgula.',
      },
      bcc: {
        type: 'string',
        description: 'Copia oculta (BCC) separados por virgula.',
      },
      html: {
        type: 'boolean',
        description: 'Se true, o corpo e interpretado como HTML. Default: false.',
      },
      attachments: {
        type: 'string',
        description: 'JSON array de anexos: [{filename, path}].',
      },
    },
    required: ['to', 'subject', 'body'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const normalizeInput = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.map((v) => String(v || '')).join(', ');
      if (val === null || val === undefined) return '';
      return String(val);
    };

    const to = normalizeInput(args.to);
    const subject = normalizeInput(args.subject);
    const body = normalizeInput(args.body);
    const rawCc = normalizeInput(args.cc);
    const rawBcc = normalizeInput(args.bcc);

    if (!to) return 'Error: the "to" parameter is required.';
    if (!subject) return 'Error: the "subject" parameter is required.';
    if (!body) return 'Error: the "body" parameter is required.';

    // SMTP Header Injection Protection (reject CRLF in headers)
    const headerSafeRegex = /[\r\n]/;
    if (headerSafeRegex.test(subject)) {
      return 'Error: subject contains invalid characters (newline).';
    }
    if (headerSafeRegex.test(to)) {
      return 'Error: recipients contain invalid characters (newline).';
    }
    if (headerSafeRegex.test(rawCc)) {
      return 'Error: CC contains invalid characters (newline).';
    }
    if (headerSafeRegex.test(rawBcc)) {
      return 'Error: BCC contains invalid characters (newline).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = to.split(',').map((e) => e.trim()).filter(Boolean);
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        return `Error: invalid email "${recipient}".`;
      }
    }

    if (recipients.length === 0) {
      return 'Error: at least one recipient is required.';
    }

    const config = this.loadConfig();
    if (!config) {
      return 'Error: SMTP configuration not found. Configure ZAVORTH_SMTP_HOST, ZAVORTH_SMTP_PORT, ZAVORTH_SMTP_USER, ZAVORTH_SMTP_PASS.';
    }
    if (process.env.ZAVORTH_SMTP_ALLOW_LIVE_SEND !== 'true') {
      return 'Error: live email send is disabled. Set ZAVORTH_SMTP_ALLOW_LIVE_SEND=true after reviewing SMTP, recipients, and approval.';
    }

    const isHtml = args.html === true;
    const cc = rawCc.split(',').map((e) => e.trim()).filter(Boolean);
    const bcc = rawBcc.split(',').map((e) => e.trim()).filter(Boolean);

    // Validate CC and BCC email addresses
    for (const ccAddr of cc) {
      if (!emailRegex.test(ccAddr)) {
        return `Error: invalid CC email "${ccAddr}".`;
      }
    }
    for (const bccAddr of bcc) {
      if (!emailRegex.test(bccAddr)) {
        return `Error: invalid BCC email "${bccAddr}".`;
      }
    }

    let attachments: { filename: string; path: string }[] = [];
    if (typeof args.attachments === 'string') {
      try {
        attachments = JSON.parse(args.attachments);
      } catch (error: unknown) {logger.warn('[Email] JSON parse failed', error); return 'Error: JSON de attachments is invalid.'; }
    }

    try {
      const result = await this.sendViaSmtp(config, {
        to: recipients,
        subject,
        body,
        html: isHtml,
        cc,
        bcc,
        attachments,
      });

      if (!result.success) {
        return `Failed to send email: ${result.error}`;
      }

      const lines: string[] = [];
      lines.push('Email sent successfully.');
      lines.push(`  - Message ID: ${result.message_id}`);
      lines.push(`  - To: ${recipients.join(', ')}`);
      if (cc.length > 0) lines.push(`  - CC: ${cc.join(', ')}`);
      if (bcc.length > 0) lines.push(`  - BCC: ${bcc.join(', ')}`);
      lines.push(`  - Subject: ${subject}`);
      lines.push(`  - Format: ${isHtml ? 'HTML' : 'Text'}`);
      if (attachments.length > 0) lines.push(`  - Attachments: ${attachments.length}`);
      lines.push(`  - SMTP: ${config.host}:${config.port}`);

      return lines.join('\n');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Email] operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Failed to send email: ${message}`;
  }
  }

  private loadConfig(): EmailConfig | null {
    const host = process.env.ZAVORTH_SMTP_HOST;
    const port = process.env.ZAVORTH_SMTP_PORT;
    const user = process.env.ZAVORTH_SMTP_USER;
    const pass = process.env.ZAVORTH_SMTP_PASS;

    if (!host || !user || !pass) return null;

    return {
      host,
      port: safeParseInt(port, 587),
      secure: process.env.ZAVORTH_SMTP_SECURE === 'true',
      user,
      pass,
      from: process.env.ZAVORTH_SMTP_FROM || user,
    };
  }

  private async sendViaSmtp(
    config: EmailConfig,
    email: {
      to: string[];
      subject: string;
      body: string;
      html: boolean;
      cc: string[];
      bcc: string[];
      attachments: { filename: string; path: string }[];
    },
  ): Promise<EmailResult> {
    if (email.attachments.length > 0) {
      return { success: false, error: 'Attachments are not yet supported by the native SMTP transport.' };
    }
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@zavorth.local`;
    const headers = [
      `Message-ID: <${messageId}>`,
      `From: ${config.from}`,
      `To: ${email.to.join(', ')}`,
      ...(email.cc.length ? [`Cc: ${email.cc.join(', ')}`] : []),
      `Subject: ${this.encodeHeader(email.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: ${email.html ? 'text/html' : 'text/plain'}; charset=utf-8`,
    ];
    const recipients = [...email.to, ...email.cc, ...email.bcc];
    const data = `${headers.join('\r\n')}\r\n\r\n${email.body}\r\n`;

    await this.smtpTransaction(config, recipients, data);
    return {
      success: true,
      message_id: messageId,
      details: {
        from: config.from,
        to: email.to,
        subject: email.subject,
        smtp: `${config.host}:${config.port}`,
      },
    };
  }

  private encodeHeader(value: string): string {
    return /^[\x00-\x7F]*$/u.test(value)
      ? value
      : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
  }

  private async smtpTransaction(config: EmailConfig, recipients: string[], data: string): Promise<void> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const connected = config.secure
        ? tls.connect({ host: config.host, port: config.port, servername: config.host }, () => resolve(connected))
        : net.connect({ host: config.host, port: config.port }, () => resolve(connected));
      connected.once('error', reject);
    });

    try {
      await this.expectSmtp(socket, 220);
      await this.command(socket, `EHLO zavorth.local`, 250);
      if (!config.secure && process.env.ZAVORTH_SMTP_STARTTLS === 'true') {
        await this.command(socket, 'STARTTLS', 220);
        throw new Error('STARTTLS requer transporte TLS reaberto; use ZAVORTH_SMTP_SECURE=true ou SMTP relay seguro.');
      }
      await this.command(socket, 'AUTH LOGIN', 334);
      await this.command(socket, Buffer.from(config.user, 'utf8').toString('base64'), 334);
      await this.command(socket, Buffer.from(config.pass, 'utf8').toString('base64'), 235);
      await this.command(socket, `MAIL FROM:<${config.from}>`, 250);
      for (const recipient of recipients) {
        await this.command(socket, `RCPT TO:<${recipient}>`, [250, 251]);
      }
      await this.command(socket, 'DATA', 354);
      await this.command(socket, `${data.replace(/\r?\n\./gu, '\r\n..')}\r\n.`, 250);
      await this.command(socket, 'QUIT', 221);
    } finally {
      socket.destroy();
    }
  }

  private async command(socket: net.Socket, command: string, expected: number | number[]): Promise<string> {
    socket.write(`${command}\r\n`);
    return this.expectSmtp(socket, expected);
  }

  private async expectSmtp(socket: net.Socket, expected: number | number[]): Promise<string> {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];
    const response = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('SMTP timeout while waiting for response.'));
      }, 15000);
      const chunks: Buffer[] = [];
      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        const text = Buffer.concat(chunks).toString('utf8');
        const lines = text.split(/\r?\n/u).filter(Boolean);
        const last = lines[lines.length - 1] || '';
        if (/^\d{3}\s/u.test(last)) {
          cleanup();
          resolve(text);
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('data', onData);
        socket.off('error', onError);
      };
      socket.on('data', onData);
      socket.once('error', onError);
    });
    const code = Number(response.slice(0, 3));
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP retornou ${code}: ${response.trim().slice(0, 240)}`);
    }
    return response;
  }
}
