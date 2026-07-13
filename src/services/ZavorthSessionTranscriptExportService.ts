/**
 * Human session transcript export (MD / HTML / prompt-only).
 * Separate from trajectory export (training jsonl/sharegpt/alpaca).
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_SESSION_TRANSCRIPT_EXPORT_CONTRACT_VERSION,
  type ZavorthSessionTranscriptExportFormat,
  type ZavorthSessionTranscriptExportInput,
  type ZavorthSessionTranscriptExportSnapshot,
  type ZavorthSessionTranscriptExportStatus,
  type ZavorthSessionTranscriptMessage,
} from '../contracts/runtime/ZavorthSessionTranscriptExportContract.js';
import {
  GatewaySessionLedgerService,
  type GatewaySessionTranscriptEntry,
} from './GatewaySessionLedgerService.js';
import { redactSensitiveText } from '../security/SensitiveDataGuard.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  ledger?: Pick<GatewaySessionLedgerService, 'readTranscriptSync' | 'readSnapshotSync'>;
  writeFileSync?: typeof fs.writeFileSync;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthSessionTranscriptExportService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly ledger: Pick<GatewaySessionLedgerService, 'readTranscriptSync' | 'readSnapshotSync'>;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.ledger = runtime.ledger || new GatewaySessionLedgerService();
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public export(input: ZavorthSessionTranscriptExportInput = {}): ZavorthSessionTranscriptExportSnapshot {
    const format = normalizeFormat(input.format);
    const redact = input.redact !== false;
    const includeSystem = input.includeSystem === true;
    const sessionId = clean(input.sessionId);
    const title = clean(input.title) || (sessionId ? `session-${sessionId.slice(0, 12)}` : 'session-export');
    const messages = this.resolveMessages(input, includeSystem).map((message) => ({
      ...message,
      content: redact ? redactSensitiveText(message.content) : message.content,
    }));

    if (messages.length === 0) {
      return this.snapshot({
        status: 'empty',
        format,
        sessionId,
        title,
        exportPath: null,
        messages,
        body: '',
        redact,
      });
    }

    const body = format === 'html'
      ? renderHtml(title, messages, sessionId)
      : format === 'prompt'
        ? renderPromptOnly(messages)
        : renderMarkdown(title, messages, sessionId);

    const exportPathRaw = clean(input.exportPath);
    const hasWrite = Boolean(exportPathRaw);
    const hasApproval = Boolean(clean(input.approvalId));

    if (hasWrite && !hasApproval) {
      return this.snapshot({
        status: 'approval-required',
        format,
        sessionId,
        title,
        exportPath: null,
        messages,
        body,
        redact,
      });
    }

    let exportPath: string | null = null;
    let status: ZavorthSessionTranscriptExportStatus = 'preview';
    if (hasWrite && hasApproval && exportPathRaw) {
      exportPath = this.resolveExportPath(exportPathRaw, format);
      if (!exportPath) {
        return this.snapshot({
          status: 'blocked',
          format,
          sessionId,
          title,
          exportPath: null,
          messages,
          body,
          redact,
        });
      }
      const dir = path.dirname(exportPath);
      if (!this.existsSync(dir)) {
        this.mkdirSync(dir, { recursive: true });
      }
      this.writeFileSync(exportPath, body, 'utf8');
      status = 'exported';
    }

    return this.snapshot({
      status,
      format,
      sessionId,
      title,
      exportPath,
      messages,
      body,
      redact,
    });
  }

  private resolveMessages(
    input: ZavorthSessionTranscriptExportInput,
    includeSystem: boolean,
  ): ZavorthSessionTranscriptMessage[] {
    if (Array.isArray(input.messages) && input.messages.length > 0) {
      return input.messages
        .map(normalizeMessage)
        .filter((message): message is ZavorthSessionTranscriptMessage => Boolean(message))
        .filter((message) => includeSystem || message.role !== 'system');
    }

    const sessionId = clean(input.sessionId);
    const chatId = clean(input.chatId) || sessionId;
    const platform = clean(input.platform) || 'web';
    if (!chatId && !sessionId) return [];

    const entries = this.ledger.readTranscriptSync({
      sessionId,
      chatId: chatId || sessionId,
      platform,
    });
    return entries
      .map((entry) => fromLedgerEntry(entry))
      .filter((message): message is ZavorthSessionTranscriptMessage => Boolean(message))
      .filter((message) => includeSystem || message.role !== 'system');
  }

  private resolveExportPath(exportPath: string, format: ZavorthSessionTranscriptExportFormat): string | null {
    const resolved = path.resolve(this.projectRoot, exportPath);
    const root = this.projectRoot.endsWith(path.sep) ? this.projectRoot : `${this.projectRoot}${path.sep}`;
    if (resolved !== this.projectRoot && !resolved.startsWith(root)) {
      return null;
    }
    if (path.extname(resolved)) return resolved;
    const ext = format === 'html' ? '.html' : format === 'prompt' ? '.txt' : '.md';
    return `${resolved}${ext}`;
  }

  private snapshot(input: {
    status: ZavorthSessionTranscriptExportStatus;
    format: ZavorthSessionTranscriptExportFormat;
    sessionId: string | null;
    title: string | null;
    exportPath: string | null;
    messages: ZavorthSessionTranscriptMessage[];
    body: string;
    redact: boolean;
  }): ZavorthSessionTranscriptExportSnapshot {
    const preview = input.body.slice(0, 1200);
    return {
      contractVersion: ZAVORTH_SESSION_TRANSCRIPT_EXPORT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthSessionTranscriptExportService',
      status: input.status,
      format: input.format,
      sessionId: input.sessionId,
      title: input.title,
      exportPath: input.exportPath,
      messageCount: input.messages.length,
      bodyPreview: preview,
      body: input.body,
      safety: {
        redactDefaultOn: true,
        secretsRedacted: input.redact,
        requiresApprovalForWrite: true,
        exportPathConfinedToProject: true,
      },
      commands: {
        preview: `zavorth session export${input.sessionId ? ` --session ${input.sessionId}` : ''} --format ${input.format}`,
        apply: `zavorth session export${input.sessionId ? ` --session ${input.sessionId}` : ''} --format ${input.format} --export-path <path> --approval-id <id>`,
      },
    };
  }
}

function normalizeFormat(value: unknown): ZavorthSessionTranscriptExportFormat {
  const normalized = String(value || 'markdown').trim().toLowerCase();
  if (normalized === 'html' || normalized === 'htm') return 'html';
  if (normalized === 'prompt' || normalized === 'prompt-only' || normalized === 'prompts') return 'prompt';
  return 'markdown';
}

function normalizeMessage(value: unknown): ZavorthSessionTranscriptMessage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const roleRaw = String(record.role || '').trim().toLowerCase();
  const role = roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : 'user';
  const content = String(record.content ?? '').trim();
  if (!content) return null;
  return {
    role,
    content,
    createdAt: clean(record.createdAt),
    surface: clean(record.surface),
  };
}

function fromLedgerEntry(entry: GatewaySessionTranscriptEntry): ZavorthSessionTranscriptMessage | null {
  const content = String(entry.content || '').trim();
  if (!content) return null;
  const role = entry.role === 'assistant' || entry.role === 'system' ? entry.role : 'user';
  return {
    role,
    content,
    createdAt: entry.createdAt || null,
    surface: entry.surface || null,
  };
}

function renderMarkdown(
  title: string,
  messages: ZavorthSessionTranscriptMessage[],
  sessionId: string | null,
): string {
  const lines = [
    `# ${title}`,
    '',
    sessionId ? `- session: \`${sessionId}\`` : null,
    `- exported: ${new Date().toISOString()}`,
    `- messages: ${messages.length}`,
    '',
    '---',
    '',
  ].filter((line) => line !== null) as string[];

  for (const message of messages) {
    lines.push(`### ${message.role}${message.createdAt ? ` · ${message.createdAt}` : ''}`);
    lines.push('');
    lines.push(message.content);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

function renderPromptOnly(messages: ZavorthSessionTranscriptMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n')
    .trim() + '\n';
}

function renderHtml(
  title: string,
  messages: ZavorthSessionTranscriptMessage[],
  sessionId: string | null,
): string {
  const items = messages.map((message, index) => {
    const id = `m${index + 1}`;
    return [
      `<section id="${id}" class="msg msg-${escapeHtml(message.role)}">`,
      `<header><strong>${escapeHtml(message.role)}</strong>${message.createdAt ? ` <time>${escapeHtml(message.createdAt)}</time>` : ''}</header>`,
      `<pre>${escapeHtml(message.content)}</pre>`,
      '</section>',
    ].join('\n');
  }).join('\n');

  const nav = messages.map((message, index) => {
    const id = `m${index + 1}`;
    return `<li><a href="#${id}">${index + 1}. ${escapeHtml(message.role)}</a></li>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    aside { border-right: 1px solid #4444; padding: 1rem; position: sticky; top: 0; height: 100vh; overflow: auto; }
    main { padding: 1.25rem; }
    .msg { margin-bottom: 1.25rem; padding: 0.75rem 1rem; border: 1px solid #4444; border-radius: 8px; }
    .msg-user { border-left: 4px solid #3b82f6; }
    .msg-assistant { border-left: 4px solid #22c55e; }
    .msg-system { border-left: 4px solid #a855f7; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0.5rem 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92rem; }
    time { opacity: 0.7; font-size: 0.85rem; }
    ul { padding-left: 1.1rem; }
  </style>
</head>
<body>
  <aside>
    <h1>${escapeHtml(title)}</h1>
    ${sessionId ? `<p>session: <code>${escapeHtml(sessionId)}</code></p>` : ''}
    <p>${messages.length} message(s)</p>
    <nav><ul>${nav}</ul></nav>
  </aside>
  <main>
    ${items}
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
