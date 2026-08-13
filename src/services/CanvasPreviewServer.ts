import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type {
  CanvasAttemptSnapshot,
  CanvasFileSnapshot,
  CanvasPreviewDiagnostics,
  CanvasSessionSnapshot,
} from '../contracts/ExecutionEngineContract';
import { CanvasEgressGuardService } from './CanvasEgressGuardService';

type PreviewRecord = {
  session: CanvasSessionSnapshot;
  updatedAt: number;
};

export type CanvasPreviewServerOptions = {
  ttlMs?: number;
  maxSessions?: number;
  now?: () => number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mimeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html' || extension === '.htm') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js' || extension === '.mjs') return 'text/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  return 'text/plain; charset=utf-8';
}

export class CanvasPreviewServer {
  private server: http.Server | null = null;
  private baseUrl: string | null = null;
  private readonly sessions = new Map<string, PreviewRecord>();
  private readonly ttlMs: number;
  private readonly maxSessions: number;
  private readonly now: () => number;

  public constructor(
    private readonly egressGuard = new CanvasEgressGuardService(),
    options: CanvasPreviewServerOptions = {},
  ) {
    this.ttlMs = Math.max(5_000, options.ttlMs ?? 30 * 60_000);
    this.maxSessions = Math.max(1, options.maxSessions ?? 20);
    this.now = options.now ?? (() => Date.now());
  }

  public async registerSession(snapshot: CanvasSessionSnapshot): Promise<string | null> {
    await this.ensureStarted();
    this.pruneExpired();
    this.sessions.set(snapshot.sessionId, {
      session: snapshot,
      updatedAt: this.now(),
    });
    this.enforceSessionLimit();
    return this.getAttemptUrl(snapshot.sessionId, snapshot.activeAttemptId);
  }

  public getAttemptUrl(sessionId: string, attemptId: string | null): string | null {
    if (!this.baseUrl || !attemptId) return null;
    return `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/attempt/${encodeURIComponent(attemptId)}/`;
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    this.baseUrl = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  public getDiagnostics(): CanvasPreviewDiagnostics {
    this.pruneExpired();
    return {
      running: Boolean(this.server && this.baseUrl),
      baseUrl: this.baseUrl,
      sessionCount: this.sessions.size,
      ttlMs: this.ttlMs,
      maxSessions: this.maxSessions,
    };
  }

  private async ensureStarted(): Promise<void> {
    if (this.server && this.baseUrl) return;
    this.server = http.createServer((request, response) => this.handle(request, response));
    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(0, '127.0.0.1', () => resolve());
    });
    const address = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${address.port}`;
  }

  private handle(request: http.IncomingMessage, response: http.ServerResponse): void {
    this.pruneExpired();
    const rawUrl = request.url || '/';
    const url = new URL(rawUrl, this.baseUrl || 'http://127.0.0.1');
    const match = /^\/session\/([^/]+)\/attempt\/([^/]+)\/?(.*)$/.exec(url.pathname);
    if (!match) {
      this.respond(response, 404, 'text/plain; charset=utf-8', 'Z-Canvas preview route not found.');
      return;
    }

    const sessionId = decodeURIComponent(match[1]);
    const attemptId = decodeURIComponent(match[2]);
    const assetPath = decodeURIComponent(match[3] || '');
    const session = this.sessions.get(sessionId)?.session;
    const attempt = session?.attempts.find((candidate) => candidate.id === attemptId);
    if (!session || !attempt) {
      this.respond(response, 404, 'text/plain; charset=utf-8', 'Canvas attempt not found.');
      return;
    }

    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', [
      "default-src 'self' data: blob:",
      "connect-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-src 'none'",
      "frame-ancestors 'self' http://127.0.0.1:* http://localhost:*",
    ].join('; '));

    if (!assetPath) {
      this.respond(response, 200, 'text/html; charset=utf-8', this.renderAttemptHtml(sessionId, attempt));
      return;
    }

    const file = this.findSafeFile(attempt.files, assetPath);
    if (!file) {
      this.respond(response, 404, 'text/plain; charset=utf-8', 'Canvas asset not found.');
      return;
    }
    this.respond(response, 200, mimeFor(file.path), file.content);
  }

  private findSafeFile(files: CanvasFileSnapshot[], requested: string): CanvasFileSnapshot | null {
    const normalized = requested.replace(/^\/+/, '').replace(/\\/g, '/');
    if (normalized.includes('..')) return null;
    return files.find((file) => file.path.replace(/\\/g, '/') === normalized) ?? null;
  }

  private renderAttemptHtml(sessionId: string, attempt: CanvasAttemptSnapshot): string {
    const index = attempt.files.find((file) => /(^|\/)index\.html?$/i.test(file.path));
    if (index) {
      const guard = `<script>${this.egressGuard.guardScript(sessionId)}</script>`;
      return /<head(\s[^>]*)?>/i.test(index.content)
        ? index.content.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${guard}`)
        : `${guard}${index.content}`;
    }

    const fileList = attempt.files.map((file) => `<li><code>${escapeHtml(file.path)}</code></li>`).join('');
    const logs = attempt.logs.map((log) => `<li>${escapeHtml(log)}</li>`).join('');
    return `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <script>${this.egressGuard.guardScript(sessionId)}</script>
          <style>
            body{margin:0;font:15px system-ui;background:#07140f;color:#eef8f2;padding:32px}
            code{color:#00e88f} .card{border:1px solid rgba(0,232,143,.18);border-radius:16px;padding:20px;background:rgba(255,255,255,.04)}
          </style>
        </head>
        <body>
          <div class="card">
            <p>Z-Canvas sandbox preview</p>
            <h1>${escapeHtml(attempt.summary)}</h1>
            <h2>Files</h2><ul>${fileList || '<li>No files yet</li>'}</ul>
            <h2>Logs</h2><ul>${logs || '<li>No logs yet</li>'}</ul>
          </div>
        </body>
      </html>`;
  }

  private respond(response: http.ServerResponse, statusCode: number, contentType: string, body: string): void {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.end(body);
  }

  private pruneExpired(): void {
    const threshold = this.now() - this.ttlMs;
    for (const [sessionId, record] of this.sessions.entries()) {
      if (record.updatedAt < threshold) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private enforceSessionLimit(): void {
    if (this.sessions.size <= this.maxSessions) return;
    const oldest = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    for (const [sessionId] of oldest.slice(0, this.sessions.size - this.maxSessions)) {
      this.sessions.delete(sessionId);
    }
  }
}
