/**
 * Local OAuth Callback Server.
 * Spawns an ephemeral loopback HTTP server to safely receive OAuth2 authorization codes
 * with strict CSRF state validation and automatic server teardown.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { URL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { logger } from '../../logger.js';

export interface OAuthCallbackResult {
  code: string;
  state: string;
  rawParams: Record<string, string>;
}

export interface LocalOAuthServerInstance {
  port: number;
  redirectUri: string;
  state: string;
  waitForCallback: () => Promise<OAuthCallbackResult>;
  stop: () => Promise<void>;
}

export interface LocalOAuthCallbackServerOptions {
  host?: string;
  preferredPort?: number;
  timeoutMs?: number;
  callbackPath?: string;
}

export class LocalOAuthCallbackServer {
  private readonly host: string;
  private readonly preferredPort?: number;
  private readonly defaultTimeoutMs: number;
  private readonly callbackPath: string;

  constructor(options: LocalOAuthCallbackServerOptions = {}) {
    this.host = options.host || '127.0.0.1';
    this.preferredPort = options.preferredPort;
    this.defaultTimeoutMs = options.timeoutMs || 120000; // 2 minutes
    this.callbackPath = options.callbackPath || '/oauth/callback';
  }

  /**
   * Generates a cryptographically strong random state string for CSRF mitigation.
   */
  public generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Starts the ephemeral loopback server and returns server handles.
   */
  public async start(options?: {
    customState?: string;
    timeoutMs?: number;
  }): Promise<LocalOAuthServerInstance> {
    const state = options?.customState || this.generateState();
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;

    let server: http.Server | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let resolveCallback: ((result: OAuthCallbackResult) => void) | null = null;
    let rejectCallback: ((err: Error) => void) | null = null;

    const callbackPromise = new Promise<OAuthCallbackResult>((resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    });

    const closeServer = async (): Promise<void> => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }

      if (server) {
        const currentServer = server;
        server = null;
        if (typeof (currentServer as { closeAllConnections?: () => void }).closeAllConnections === 'function') {
          (currentServer as { closeAllConnections: () => void }).closeAllConnections();
        }
        await new Promise<void>((resolve) => {
          currentServer.close(() => resolve());
        });
      }
    };

    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${this.host}`);

      if (parsedUrl.pathname !== this.callbackPath && parsedUrl.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const params: Record<string, string> = {};
      for (const [k, v] of parsedUrl.searchParams.entries()) {
        params[k] = v;
      }

      // 1. Strict CSRF verification FIRST: incoming state must match expected state
      if (!params.state || params.state !== state) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderErrorHtml('Invalid state parameter. CSRF protection blocked this request.'));

        void closeServer().finally(() => {
          rejectCallback?.(new Error('OAuth state mismatch: Possible CSRF attack detected.'));
        });
        return;
      }

      // 2. Check for OAuth provider errors (e.g. user cancelled)
      if (params.error) {
        const errorDesc = params.error_description || params.error;
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderErrorHtml(errorDesc));

        void closeServer().finally(() => {
          rejectCallback?.(new Error(`OAuth Provider Error: ${errorDesc}`));
        });
        return;
      }

      // Authorization code validation
      if (!params.code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderErrorHtml('No authorization code was provided in the callback.'));

        void closeServer().finally(() => {
          rejectCallback?.(new Error('Missing authorization code in callback query parameters.'));
        });
        return;
      }

      // Successful authorization
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.renderSuccessHtml());

      const result: OAuthCallbackResult = {
        code: params.code,
        state: params.state,
        rawParams: params,
      };

      // Tear down server immediately after successful exchange
      void closeServer().finally(() => {
        resolveCallback?.(result);
      });
    });

    const targetPort = this.preferredPort !== undefined ? this.preferredPort : 0;

    await new Promise<void>((resolve, reject) => {
      if (!server) return reject(new Error('Server instance is missing.'));

      server.once('error', (err: Error) => {
        reject(err);
      });

      server.listen(targetPort, this.host, () => {
        resolve();
      });
    });

    const address = server.address() as AddressInfo;
    const port = address.port;
    const redirectUri = `http://${this.host}:${port}${this.callbackPath}`;

    // Auto-close timeout guard
    timeoutTimer = setTimeout(() => {
      logger.warn(`[LocalOAuthCallbackServer] OAuth callback timed out after ${timeoutMs}ms on port ${port}.`);
      void closeServer().finally(() => {
        rejectCallback?.(new Error(`OAuth authorization timed out after ${timeoutMs / 1000} seconds.`));
      });
    }, timeoutMs);
    timeoutTimer.unref();

    return {
      port,
      redirectUri,
      state,
      waitForCallback: () => callbackPromise,
      stop: closeServer,
    };
  }

  private renderSuccessHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zavorth - Authorization Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      padding: 2.5rem;
      border-radius: 1rem;
      border: 1px solid #334155;
      text-align: center;
      max-width: 420px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 3.5rem;
      color: #10b981;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      color: #f1f5f9;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .countdown {
      font-weight: 600;
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10004;</div>
    <h1>Authorization Successful</h1>
    <p>Zavorth has completed the secure handshake. You can safely close this window.</p>
    <p>Closing automatically in <span id="time" class="countdown">3</span>s...</p>
  </div>
  <script>
    let remaining = 3;
    const timeEl = document.getElementById('time');
    const timer = setInterval(() => {
      remaining--;
      if (timeEl) timeEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(timer);
        window.close();
      }
    }, 1000);
  </script>
</body>
</html>`;
  }

  private escapeHtml(input: string): string {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private renderErrorHtml(message: string): string {
    const safeMessage = this.escapeHtml(message);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zavorth - Authorization Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      padding: 2.5rem;
      border-radius: 1rem;
      border: 1px solid #ef4444;
      text-align: center;
      max-width: 420px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 3.5rem;
      color: #ef4444;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      color: #f1f5f9;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10008;</div>
    <h1>Authorization Failed</h1>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;
  }
}
