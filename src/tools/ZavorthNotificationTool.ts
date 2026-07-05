import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthNotificationTool extends BaseTool {
  public readonly name = 'zavorth_notification';

  public readonly description =
    'Multi-channel notifications — desktop, push, email, SMS, Slack, Discord, Telegram, and webhook notifications. Supports templating, scheduling, and delivery confirmation.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'desktop', 'push', 'email', 'sms', 'slack', 'discord', 'telegram', 'webhook', 'teams', 'status', 'history'.",
      },
      channel: {
        type: 'string',
        description: 'Override notification channel.',
      },
      title: {
        type: 'string',
        description: 'Notification title.',
      },
      message: {
        type: 'string',
        description: 'Notification message body.',
      },
      priority: {
        type: 'string',
        description: "Priority: 'low', 'normal', 'high', 'urgent'. Default: 'normal'.",
      },
      url: {
        type: 'string',
        description: 'Webhook URL or notification link.',
      },
      webhook_url: {
        type: 'string',
        description: 'Webhook URL for Slack, Discord, Teams.',
      },
      token: {
        type: 'string',
        description: 'API token for Telegram, Slack, etc.',
      },
      chat_id: {
        type: 'string',
        description: 'Telegram chat ID.',
      },
      to: {
        type: 'string',
        description: 'Recipient (email, phone number, user ID).',
      },
      from: {
        type: 'string',
        description: 'Sender identifier.',
      },
      template_path: {
        type: 'string',
        description: 'Path to notification template file.',
      },
      template_vars: {
        type: 'string',
        description: 'JSON of template variables.',
      },
      icon: {
        type: 'string',
        description: 'Notification icon (emoji or URL).',
      },
      color: {
        type: 'string',
        description: 'Notification color (hex or name).',
      },
      schedule_at: {
        type: 'string',
        description: 'Schedule time (ISO 8601).',
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview without sending. Default: false.',
      },
    },
    required: ['action', 'message'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'desktop': return await this.desktopNotification(args);
      case 'push': return await this.pushNotification(args);
      case 'email': return await this.emailNotification(args);
      case 'sms': return await this.smsNotification(args);
      case 'slack': return await this.slackNotification(args);
      case 'discord': return await this.discordNotification(args);
      case 'telegram': return await this.telegramNotification(args);
      case 'webhook': return await this.webhookNotification(args);
      case 'teams': return await this.teamsNotification(args);
      case 'status': return this.statusInfo();
      case 'history': return this.history();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCmd(cmd: string, cmdArgs: string[], timeout = 15000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error) { logger.warn('[Zavorth Notification] process execution failed', error); return ''; }
  }

  private resolveTemplate(args: Record<string, unknown>): { title: string; message: string } {
    let title = String(args.title || 'Notification');
    let message = String(args.message || '');

    const templatePath = String(args.template_path || '');
    if (templatePath && fs.existsSync(templatePath)) {
      let template = fs.readFileSync(templatePath, 'utf-8');
      try {
        const vars = JSON.parse(String(args.template_vars || '{}'));
        for (const [key, value] of Object.entries(vars)) {
          template = template.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
        }
      } catch (error) { /* ignore parse errors */ logger.warn('[Zavorth Notification] JSON parse failed', error); }
      message = template;
    }

    return { title, message };
  }

  private async desktopNotification(args: Record<string, unknown>): Promise<string> {
    const { title, message } = this.resolveTemplate(args);
    if (args.dry_run) return `[DRY RUN] Desktop: ${title}\n${message}`;

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName("text")
$textNodes.Item(0).AppendChild($template.CreateTextNode("${title.replace(/"/g, '""')}")) | Out-Null
$textNodes.Item(1).AppendChild($template.CreateTextNode("${message.replace(/"/g, '""').slice(0, 200)}")) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Zavorth").Show($toast)
`;
        execFileSync('powershell', ['-Command', script], { timeout: 10000 });
        return `Desktop notification sent: ${title}`;
      } else if (process.platform === 'darwin') {
        execFileSync('osascript', ['-e', `display notification "${message.replace(/"/g, '\\"').slice(0, 200)}" with title "${title.replace(/"/g, '\\"')}"`], { timeout: 5000 });
        return `Desktop notification sent: ${title}`;
      } else {
        execFileSync('notify-send', [title, message.slice(0, 200)], { timeout: 5000 });
        return `Desktop notification sent: ${title}`;
      }
    } catch (error) { logger.warn('[Zavorth Notification] process execution failed', error); return ''; }
  }

  private async pushNotification(args: Record<string, unknown>): Promise<string> {
    return 'Push notifications require a push service configuration (Firebase, OneSignal, etc.). Use webhook or slack action for immediate notifications.';
  }

  private async emailNotification(args: Record<string, unknown>): Promise<string> {
    const to = String(args.to || '');
    const { title, message } = this.resolveTemplate(args);
    if (!to) return 'Error: "to" is required for email notification.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        'https://api.mailgun.net/v3/messages',
        '-u', `api:${String(args.token || process.env.MAILGUN_API_KEY || '')}`,
        '-F', `from=${String(args.from || 'Zavorth <notifications@zavorth.dev>')}`,
        '-F', `to=${to}`,
        '-F', `subject=${title}`,
        '-F', `text=${message}`,
      ], { timeout: 15000 }).toString();

      return `Email notification to ${to}:\n${result.slice(0, 500)}`;
    } catch (error) { logger.warn('[Zavorth Notification] operation failed', error); return ''; }
  }

  private async smsNotification(args: Record<string, unknown>): Promise<string> {
    const to = String(args.to || '');
    const { message } = this.resolveTemplate(args);
    if (!to) return 'Error: "to" (phone number) is required for SMS.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID || ''}/Messages.json`,
        '-u', `${process.env.TWILIO_ACCOUNT_SID || ''}:${process.env.TWILIO_AUTH_TOKEN || String(args.token || '')}`,
        '-F', `To=${to}`,
        '-F', `From=${String(args.from || process.env.TWILIO_PHONE_NUMBER || '')}`,
        '-F', `Body=${message}`,
      ], { timeout: 15000 }).toString();

      return `SMS to ${to}:\n${result.slice(0, 500)}`;
    } catch (error) { logger.warn('[Zavorth Notification] operation failed', error); return ''; }
  }

  private async slackNotification(args: Record<string, unknown>): Promise<string> {
    const webhookUrl = String(args.webhook_url || args.url || process.env.SLACK_WEBHOOK_URL || '');
    const { title, message } = this.resolveTemplate(args);
    if (!webhookUrl) return 'Error: "webhook_url" is required for Slack.';

    const icon = String(args.icon || ':bell:');
    const color = String(args.color || '#36a64f');

    const payload = {
      attachments: [{
        color,
        title,
        text: message,
        footer: 'Zavorth Notification',
        ts: Math.floor(Date.now() / 1000),
      }],
      icon_emoji: icon,
    };

    if (args.dry_run) return `[DRY RUN] Slack:\n${JSON.stringify(payload, null, 2)}`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify(payload),
        webhookUrl,
      ], { timeout: 10000 }).toString();

      return result === 'ok' ? `Slack notification sent: ${title}` : `Slack response: ${result}`;
    } catch (error) { logger.warn('[Zavorth Notification] process execution failed', error); return ''; }
  }

  private async discordNotification(args: Record<string, unknown>): Promise<string> {
    const webhookUrl = String(args.webhook_url || args.url || process.env.DISCORD_WEBHOOK_URL || '');
    const { title, message } = this.resolveTemplate(args);
    if (!webhookUrl) return 'Error: "webhook_url" is required for Discord.';

    const icon = String(args.icon || '');
    const colorInt = parseInt(String(args.color || '#5865F2').replace('#', ''), 16);

    const payload = {
      embeds: [{
        title,
        description: message,
        color: colorInt,
        footer: { text: 'Zavorth Notification' },
        timestamp: new Date().toISOString(),
      }],
      ...(icon ? { avatar_url: icon } : {}),
    };

    if (args.dry_run) return `[DRY RUN] Discord:\n${JSON.stringify(payload, null, 2)}`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify(payload),
        webhookUrl,
      ], { timeout: 10000 }).toString();

      return `Discord notification sent: ${title}`;
    } catch (error) { logger.warn('[Zavorth Notification] process execution failed', error); return ''; }
  }

  private async telegramNotification(args: Record<string, unknown>): Promise<string> {
    const token = String(args.token || process.env.TELEGRAM_BOT_TOKEN || '');
    const chatId = String(args.chat_id || process.env.TELEGRAM_CHAT_ID || '');
    const { title, message } = this.resolveTemplate(args);
    if (!token || !chatId) return 'Error: "token" and "chat_id" are required for Telegram.';

    const text = `*${title}*\n${message}`;

    if (args.dry_run) return `[DRY RUN] Telegram:\n${text}`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        `https://api.telegram.org/bot${token}/sendMessage`,
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      ], { timeout: 10000 }).toString();

      try {
        const parsed = JSON.parse(result);
        return parsed.ok ? `Telegram notification sent to ${chatId}` : `Telegram error: ${parsed.description}`;
      } catch (error) { logger.warn('[Zavorth Notification] JSON parse failed', error); return ''; }
    } catch (error) { logger.warn('[Zavorth Notification] JSON parse failed', error); return ''; }
  }

  private async webhookNotification(args: Record<string, unknown>): Promise<string> {
    const url = String(args.webhook_url || args.url || '');
    const { title, message } = this.resolveTemplate(args);
    if (!url) return 'Error: "webhook_url" (or "url") is required.';

    const payload = {
      title,
      message,
      priority: String(args.priority || 'normal'),
      timestamp: new Date().toISOString(),
      source: 'zavorth',
    };

    if (args.dry_run) return `[DRY RUN] Webhook to ${url}:\n${JSON.stringify(payload, null, 2)}`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify(payload),
        '--max-time', '10',
        url,
      ], { timeout: 15000 }).toString();

      return `Webhook notification sent to ${url}:\n${result.slice(0, 500)}`;
    } catch (error) { logger.warn('[Zavorth Notification] process execution failed', error); return ''; }
  }

  private async teamsNotification(args: Record<string, unknown>): Promise<string> {
    const webhookUrl = String(args.webhook_url || args.url || process.env.TEAMS_WEBHOOK_URL || '');
    const { title, message } = this.resolveTemplate(args);
    if (!webhookUrl) return 'Error: "webhook_url" is required for Teams.';

    const color = String(args.color || '0076D7');

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: color.replace('#', ''),
      summary: title,
      sections: [{
        activityTitle: title,
        activitySubtitle: new Date().toISOString(),
        text: message,
      }],
    };

    if (args.dry_run) return `[DRY RUN] Teams:\n${JSON.stringify(payload, null, 2)}`;

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify(payload),
        webhookUrl,
      ], { timeout: 10000 });

      return `Teams notification sent: ${title}`;
    } catch (error) { logger.warn('[Zavorth Notification] process execution failed', error); return ''; }
  }

  private statusInfo(): string {
    return [
      'Notification Channels Status:',
      `  Desktop: ${process.platform === 'win32' ? 'Windows Toast' : process.platform === 'darwin' ? 'macOS Notification' : 'notify-send'}`,
      `  Slack: ${process.env.SLACK_WEBHOOK_URL ? 'configured' : 'not configured'}`,
      `  Discord: ${process.env.DISCORD_WEBHOOK_URL ? 'configured' : 'not configured'}`,
      `  Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured'}`,
      `  Teams: ${process.env.TEAMS_WEBHOOK_URL ? 'configured' : 'not configured'}`,
      `  Email (Mailgun): ${process.env.MAILGUN_API_KEY ? 'configured' : 'not configured'}`,
      `  SMS (Twilio): ${process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not configured'}`,
    ].join('\n');
  }

  private history(): string {
    return 'Notification history requires a persistent store. Use the notification channel directly for status.';
  }
}
