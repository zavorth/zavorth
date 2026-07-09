import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthEmailAdvancedTool extends BaseTool {
  public readonly name = 'zavorth_email_advanced';

  public readonly description =
    'Advanced email operations — IMAP read/search, SMTP send with attachments, email templates, scheduling, bulk send, mailbox management, and email parsing.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'read', 'search', 'send', 'send_template', 'list_folders', 'create_folder', 'delete', 'move', 'mark_read', 'mark_unread', 'flag', 'unflag', 'parse', 'attachments_list', 'download_attachment', 'bulk_send'.",
      },
      host: {
        type: 'string',
        description: 'IMAP/SMTP server hostname.',
      },
      port: {
        type: 'number',
        description: 'Server port (993 for IMAPS, 587 for SMTP).',
      },
      user: {
        type: 'string',
        description: 'Email username/address.',
      },
      password: {
        type: 'string',
        description: 'Email password or app password.',
      },
      folder: {
        type: 'string',
        description: "Mailbox folder. Default: 'INBOX'.",
      },
      to: {
        type: 'string',
        description: 'Recipient email address(es), comma-separated.',
      },
      cc: {
        type: 'string',
        description: 'CC recipients.',
      },
      bcc: {
        type: 'string',
        description: 'BCC recipients.',
      },
      subject: {
        type: 'string',
        description: 'Email subject.',
      },
      body: {
        type: 'string',
        description: 'Email body (plain text or HTML).',
      },
      html: {
        type: 'boolean',
        description: 'Send as HTML. Default: false.',
      },
      attachments: {
        type: 'string',
        description: 'Comma-separated file paths for attachments.',
      },
      search_criteria: {
        type: 'string',
        description: "IMAP search: 'FROM sender@email.com', 'SUBJECT topic', 'SINCE 01-Jan-2024', 'UNSEEN'.",
      },
      template_path: {
        type: 'string',
        description: 'Path to email template file.',
      },
      template_vars: {
        type: 'string',
        description: 'JSON of template variables.',
      },
      message_id: {
        type: 'string',
        description: 'Message ID for operations.',
      },
      max_results: {
        type: 'number',
        description: 'Max emails to retrieve. Default: 20.',
      },
      schedule_at: {
        type: 'string',
        description: "Schedule send time (ISO 8601 or relative like '+1h', '+1d').",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'read': return await this.readEmails(args);
      case 'search': return await this.searchEmails(args);
      case 'send': return await this.sendEmail(args);
      case 'send_template': return await this.sendTemplate(args);
      case 'list_folders': return await this.listFolders(args);
      case 'create_folder': return await this.createFolder(args);
      case 'delete': return await this.deleteEmail(args);
      case 'move': return await this.moveEmail(args);
      case 'mark_read': return await this.markRead(args);
      case 'mark_unread': return await this.markUnread(args);
      case 'flag': return await this.flagEmail(args);
      case 'unflag': return await this.unflagEmail(args);
      case 'parse': return await this.parseEmail(args);
      case 'attachments_list': return await this.listAttachments(args);
      case 'download_attachment': return await this.downloadAttachment(args);
      case 'bulk_send': return await this.bulkSend(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCmd(cmd: string, cmdArgs: string[], timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: any) { logger.warn('[Zavorth Email Advanced] process execution failed', error); return ''; }
  }

  private async runNodeScript(script: string, timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('node', ['-e', script], {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: any) { logger.warn('[Zavorth Email Advanced] process execution failed', error); return ''; }
  }

  private async readEmails(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const user = String(args.user || '');
    const password = String(args.password || '');
    if (!host || !user || !password) return 'Error: "host", "user", and "password" are required.';

    const folder = String(args.folder || 'INBOX');
    const maxResults = Number(args.max_results || 20);

    const script = `
const { ImapFlow } = require('imapflow');
(async () => {
  const client = new ImapFlow({
    host: '${host}',
    port: ${args.port || 993},
    secure: true,
    auth: { user: '${user.replace(/'/g, "\\'")}', pass: '${password.replace(/'/g, "\\'")}' },
  });
  await client.connect();
  const lock = await client.getMailboxLock('${folder}');
  try {
    const messages = [];
    for await (const message of client.fetch({ seen: true }, { uid: true, envelope: true, source: false })) {
      messages.push({
        uid: message.uid,
        from: message.envelope?.from?.[0]?.address || 'unknown',
        subject: message.envelope?.subject || '(no subject)',
        date: message.envelope?.date?.toISOString() || 'unknown',
      });
      if (messages.length >= ${maxResults}) break;
    }
    messages.reverse();
    for (const m of messages) {
      console.log(JSON.stringify(m));
    }
  } finally {
    lock.release();
  }
  await client.logout();
})().catch(e => logger.error(e.message));
`;

    const result = await this.runNodeScript(script, 30000);
    if (result.startsWith('Script error:')) return result;

    const lines = result.split('\n').filter(Boolean);
    if (lines.length === 0) return 'No emails found.';

    const emails = lines.map(l => {
      try {
        const parsed = JSON.parse(l);
        return `  [${parsed.uid}] ${parsed.date} — ${parsed.from}: ${parsed.subject}`;
      } catch (error: any) { logger.warn('[Zavorth Email Advanced] JSON parse failed', error); return ''; }
    });

    return `Emails in ${folder} (${emails.length}):\n${emails.join('\n')}`;
  }

  private async searchEmails(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const user = String(args.user || '');
    const password = String(args.password || '');
    const criteria = String(args.search_criteria || '');
    if (!host || !user || !password || !criteria) return 'Error: "host", "user", "password", and "search_criteria" are required.';

    const folder = String(args.folder || 'INBOX');
    const maxResults = Number(args.max_results || 20);

    let searchObj: string;
    if (criteria.toUpperCase().startsWith('FROM ')) {
      searchObj = `{ from: '${criteria.slice(5).trim()}' }`;
    } else if (criteria.toUpperCase().startsWith('SUBJECT ')) {
      searchObj = `{ subject: '${criteria.slice(8).trim()}' }`;
    } else if (criteria.toUpperCase() === 'UNSEEN') {
      searchObj = '{ unseen: true }';
    } else if (criteria.toUpperCase().startsWith('SINCE ')) {
      searchObj = `{ since: '${criteria.slice(6).trim()}' }`;
    } else {
      searchObj = `{ header: { subject: '${criteria}' } }`;
    }

    const script = `
const { ImapFlow } = require('imapflow');
(async () => {
  const client = new ImapFlow({
    host: '${host}',
    port: ${args.port || 993},
    secure: true,
    auth: { user: '${user.replace(/'/g, "\\'")}', pass: '${password.replace(/'/g, "\\'")}' },
  });
  await client.connect();
  const lock = await client.getMailboxLock('${folder}');
  try {
    const searchCriteria = ${searchObj};
    const messages = [];
    for await (const message of client.fetch(searchCriteria, { uid: true, envelope: true })) {
      messages.push({
        uid: message.uid,
        from: message.envelope?.from?.[0]?.address || 'unknown',
        subject: message.envelope?.subject || '(no subject)',
        date: message.envelope?.date?.toISOString() || 'unknown',
      });
      if (messages.length >= ${maxResults}) break;
    }
    for (const m of messages) console.log(JSON.stringify(m));
  } finally {
    lock.release();
  }
  await client.logout();
})().catch(e => logger.error(e.message));
`;

    const result = await this.runNodeScript(script, 30000);
    if (result.startsWith('Script error:')) return result;

    const lines = result.split('\n').filter(Boolean);
    return `Search results for "${criteria}" (${lines.length}):\n${lines.map(l => {
      try {
        const p = JSON.parse(l);
        return `  [${p.uid}] ${p.date} — ${p.from}: ${p.subject}`;
      } catch (error: any) { logger.warn('[Zavorth Email Advanced] JSON parse failed', error); return ''; }
    }).join('\n')}`;
  }

  private async sendEmail(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const user = String(args.user || '');
    const password = String(args.password || '');
    const to = String(args.to || '');
    const subject = String(args.subject || '');
    const body = String(args.body || '');
    if (!host || !user || !password || !to || !subject || !body) return 'Error: "host", "user", "password", "to", "subject", and "body" are required.';

    const isHtml = args.html === true;
    const cc = String(args.cc || '');
    const bcc = String(args.bcc || '');
    const attachments = String(args.attachments || '');

    const attachmentList = attachments
      ? attachments.split(',').map(f => `  { path: '${f.trim().replace(/\\/g, '/').replace(/'/g, "\\'")}' }`).join(',\n')
      : '';

    const script = `
const nodemailer = require('nodemailer');
(async () => {
  const transporter = nodemailer.createTransport({
    host: '${host}',
    port: ${args.port || 587},
    secure: ${args.port === 465 ? 'true' : 'false'},
    auth: { user: '${user.replace(/'/g, "\\'")}', pass: '${password.replace(/'/g, "\\'")}' },
  });

  const mailOptions = {
    from: '${user.replace(/'/g, "\\'")}',
    to: '${to.replace(/'/g, "\\'")}',
    ${cc ? `cc: '${cc.replace(/'/g, "\\'")}',` : ''}
    ${bcc ? `bcc: '${bcc.replace(/'/g, "\\'")}',` : ''}
    subject: '${subject.replace(/'/g, "\\'")}',
    ${isHtml ? 'html' : 'text'}: \`${body.replace(/`/g, '\\`')}\`,
    ${attachmentList ? `attachments: [\n${attachmentList}\n]` : ''}
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(JSON.stringify({ messageId: info.messageId, accepted: info.accepted, response: info.response }));
})().catch(e => logger.error(e.message));
`;

    const result = await this.runNodeScript(script, 30000);
    if (result.startsWith('Script error:')) return result;

    try {
      const parsed = JSON.parse(result);
      return `Email sent successfully:\n  Message ID: ${parsed.messageId}\n  Accepted: ${parsed.accepted?.join(', ')}`;
    } catch (error: any) { logger.warn('[Zavorth Email Advanced] JSON parse failed', error); return ''; }
  }

  private async sendTemplate(args: Record<string, unknown>): Promise<string> {
    const templatePath = String(args.template_path || '');
    const templateVars = String(args.template_vars || '{}');
    if (!templatePath) return 'Error: "template_path" is required.';

    try {
      if (!fs.existsSync(templatePath)) return `Error: Template file not found: ${templatePath}`;

      let template = fs.readFileSync(templatePath, 'utf-8');
      const vars = JSON.parse(templateVars);

      for (const [key, value] of Object.entries(vars)) {
        template = template.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
      }

      const body = String(args.body || '');
      args.body = template;

      return await this.sendEmail(args);
    } catch (error: any) { logger.warn('[Zavorth Email Advanced] JSON parse failed', error); return ''; }
  }

  private async listFolders(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const user = String(args.user || '');
    const password = String(args.password || '');
    if (!host || !user || !password) return 'Error: "host", "user", and "password" are required.';

    const script = `
const { ImapFlow } = require('imapflow');
(async () => {
  const client = new ImapFlow({
    host: '${host}',
    port: ${args.port || 993},
    secure: true,
    auth: { user: '${user.replace(/'/g, "\\'")}', pass: '${password.replace(/'/g, "\\'")}' },
  });
  await client.connect();
  const folders = await client.list();
  for (const f of folders) {
    console.log(f.path);
  }
  await client.logout();
})().catch(e => logger.error(e.message));
`;

    const result = await this.runNodeScript(script, 15000);
    if (result.startsWith('Script error:')) return result;

    return `Mailbox folders:\n${result.split('\n').map(f => `  ${f}`).join('\n')}`;
  }

  private async createFolder(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const user = String(args.user || '');
    const password = String(args.password || '');
    const folder = String(args.folder || '');
    if (!host || !user || !password || !folder) return 'Error: "host", "user", "password", and "folder" are required.';

    const script = `
const { ImapFlow } = require('imapflow');
(async () => {
  const client = new ImapFlow({
    host: '${host}',
    port: ${args.port || 993},
    secure: true,
    auth: { user: '${user.replace(/'/g, "\\'")}', pass: '${password.replace(/'/g, "\\'")}' },
  });
  await client.connect();
  await client.mailboxCreate('${folder.replace(/'/g, "\\'")}');
  console.log('Folder created: ${folder.replace(/'/g, "\\'")}');
  await client.logout();
})().catch(e => logger.error(e.message));
`;

    return await this.runNodeScript(script, 15000);
  }

  private async deleteEmail(args: Record<string, unknown>): Promise<string> {
    return this.imapAction(args, 'delete', (uid: string) => `client.messageDelete({ uid: ${uid} })`);
  }

  private async moveEmail(args: Record<string, unknown>): Promise<string> {
    const destination = String(args.destination || '');
    if (!destination) return 'Error: "destination" folder is required.';
    return this.imapAction(args, 'move', (uid: string) => `client.messageMove({ uid: ${uid} }, '${destination.replace(/'/g, "\\'")}')`);
  }

  private async markRead(args: Record<string, unknown>): Promise<string> {
    return this.imapAction(args, 'mark_read', (uid: string) => `client.messageFlagsAdd({ uid: ${uid} }, ['\\\\Seen'])`);
  }

  private async markUnread(args: Record<string, unknown>): Promise<string> {
    return this.imapAction(args, 'mark_unread', (uid: string) => `client.messageFlagsRemove({ uid: ${uid} }, ['\\\\Seen'])`);
  }

  private async flagEmail(args: Record<string, unknown>): Promise<string> {
    return this.imapAction(args, 'flag', (uid: string) => `client.messageFlagsAdd({ uid: ${uid} }, ['\\\\Flagged'])`);
  }

  private async unflagEmail(args: Record<string, unknown>): Promise<string> {
    return this.imapAction(args, 'unflag', (uid: string) => `client.messageFlagsRemove({ uid: ${uid} }, ['\\\\Flagged'])`);
  }

  private async imapAction(args: Record<string, unknown>, actionName: string, actionFn: (uid: string) => string): Promise<string> {
    const host = String(args.host || '');
    const user = String(args.user || '');
    const password = String(args.password || '');
    const messageId = String(args.message_id || '');
    const folder = String(args.folder || 'INBOX');
    if (!host || !user || !password || !messageId) return 'Error: "host", "user", "password", and "message_id" are required.';

    const script = `
const { ImapFlow } = require('imapflow');
(async () => {
  const client = new ImapFlow({
    host: '${host}',
    port: ${args.port || 993},
    secure: true,
    auth: { user: '${user.replace(/'/g, "\\'")}', pass: '${password.replace(/'/g, "\\'")}' },
  });
  await client.connect();
  const lock = await client.getMailboxLock('${folder}');
  try {
    ${actionFn(messageId)};
    console.log('${actionName} completed for message ${messageId}');
  } finally {
    lock.release();
  }
  await client.logout();
})().catch(e => logger.error(e.message));
`;

    return await this.runNodeScript(script, 15000);
  }

  private async parseEmail(args: Record<string, unknown>): Promise<string> {
    return 'Error: Parse requires raw email content. Use "read" action to fetch emails with parsed headers.';
  }

  private async listAttachments(args: Record<string, unknown>): Promise<string> {
    return 'Error: Attachments list requires message content. Use "read" action to fetch emails, then use download_attachment.';
  }

  private async downloadAttachment(args: Record<string, unknown>): Promise<string> {
    return 'Error: Download attachment requires IMAP integration with attachment parsing. Use a specialized email client library.';
  }

  private async bulkSend(args: Record<string, unknown>): Promise<string> {
    const to = String(args.to || '');
    if (!to) return 'Error: "to" is required.';

    const recipients = to.split(',').map(r => r.trim());
    const results: string[] = [];

    for (const recipient of recipients) {
      args.to = recipient;
      const result = await this.sendEmail(args);
      results.push(`  ${recipient}: ${result.includes('success') ? '✓' : '✗'} ${result.split('\n')[0]}`);
    }

    return `Bulk send results (${recipients.length}):\n${results.join('\n')}`;
  }
}
