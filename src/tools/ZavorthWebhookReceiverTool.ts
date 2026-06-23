import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthWebhookReceiverTool extends BaseTool {
  public readonly name = 'zavorth_webhook_receiver';

  public readonly description =
    'Webhook receiver — create HTTP endpoints that capture and log incoming webhooks for testing and integration.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'start', 'stop', 'list', 'log', 'clear'.",
      },
      webhook_id: {
        type: 'string',
        description: 'Webhook ID (for stop/log/clear).',
      },
      path: {
        type: 'string',
        description: "URL path for the webhook (e.g., '/my-hook').",
      },
      port: {
        type: 'number',
        description: 'Port to listen on. Default: 9876.',
      },
      method: {
        type: 'string',
        description: "HTTP method to accept: 'POST', 'GET', 'PUT', 'ANY'. Default: 'POST'.",
      },
      response_status: {
        type: 'number',
        description: 'HTTP status code to respond with. Default: 200.',
      },
      response_body: {
        type: 'string',
        description: 'Response body to return.',
      },
      max_requests: {
        type: 'number',
        description: 'Max requests to log. Default: 100.',
      },
      forward_url: {
        type: 'string',
        description: 'URL to forward captured requests to.',
      },
    },
    required: ['action'],
  };

  private webhooks: Map<string, { id: string; port: number; path: string; method: string; server: unknown | null; log: Array<{ timestamp: string; method: string; headers: Record<string, string>; body: string; ip: string }>; created_at: string }> = new Map();

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'start': return await this.startWebhook(args);
      case 'stop': return this.stopWebhook(args);
      case 'list': return this.listWebhooks();
      case 'log': return this.webhookLog(args);
      case 'clear': return this.clearWebhook(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async startWebhook(args: Record<string, unknown>): Promise<string> {
    const webhookPath = String(args.path || '/webhook');
    const port = typeof args.port === 'number' ? args.port : 9876;
    const method = String(args.method || 'POST').toUpperCase();
    const maxRequests = typeof args.max_requests === 'number' ? args.max_requests : 100;

    const id = `hook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      const http = await import('http');

      const server = http.createServer((req, res) => {
        if (req.url !== webhookPath || (method !== 'ANY' && req.method !== method)) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const wh = this.webhooks.get(id);
          if (wh) {
            wh.log.push({
              timestamp: new Date().toISOString(),
              method: req.method || 'unknown',
              headers: req.headers as Record<string, string>,
              body: body.slice(0, 10000),
              ip: req.socket.remoteAddress || 'unknown',
            });
            if (wh.log.length > maxRequests) wh.log.shift();
          }

          const statusCode = typeof args.response_status === 'number' ? args.response_status : 200;
          const responseBody = String(args.response_body || '{"status":"ok"}');
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(responseBody);
        });
      });

      server.listen(port, () => {
        console.log(`[Webhook] ${id} listening on :${port}${webhookPath}`);
      });

      this.webhooks.set(id, {
        id, port, path: webhookPath, method, server, log: [], created_at: new Date().toISOString(),
      });

      return `Webhook receiver started:\n  ID: ${id}\n  URL: http://localhost:${port}${webhookPath}\n  Method: ${method}\n  Max requests: ${maxRequests}`;
    } catch (error: unknown) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private stopWebhook(args: Record<string, unknown>): string {
    const webhookId = String(args.webhook_id || '');
    if (!webhookId) return 'Error: "webhook_id" is required.';

    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return `Error: webhook "${webhookId}" not found.`;

    if (webhook.server && typeof webhook.server === 'object' && 'close' in webhook.server) {
      (webhook.server as { close: () => void }).close();
    }
    this.webhooks.delete(webhookId);

    return `Webhook "${webhookId}" stopped. ${webhook.log.length} requests captured.`;
  }

  private listWebhooks(): string {
    if (this.webhooks.size === 0) return 'No active webhook receivers.';

    const lines: string[] = ['Webhook Receivers:'];
    for (const [, w] of this.webhooks) {
      lines.push(`  ${w.id}: http://localhost:${w.port}${w.path} (${w.method}) requests:${w.log.length}`);
    }
    return lines.join('\n');
  }

  private webhookLog(args: Record<string, unknown>): string {
    const webhookId = String(args.webhook_id || '');
    if (!webhookId) return 'Error: "webhook_id" is required.';

    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return `Error: webhook "${webhookId}" not found.`;

    if (webhook.log.length === 0) return 'No requests captured yet.';

    const lines: string[] = [`Request log for "${webhookId}" (${webhook.log.length} requests):`];
    for (const entry of webhook.log.slice(-10)) {
      lines.push(`  [${entry.timestamp}] ${entry.method} from ${entry.ip}`);
      if (entry.body) lines.push(`    Body: ${entry.body.slice(0, 200)}`);
    }
    return lines.join('\n');
  }

  private clearWebhook(args: Record<string, unknown>): string {
    const webhookId = String(args.webhook_id || '');
    if (!webhookId) return 'Error: "webhook_id" is required.';

    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return `Error: webhook "${webhookId}" not found.`;

    const count = webhook.log.length;
    webhook.log = [];
    return `Cleared ${count} requests from webhook "${webhookId}".`;
  }
}
