import { asErrorLike } from '../utils/errorLike';
﻿import fs from 'fs';
import http from 'http';
import path from 'path';
import type { Duplex } from 'stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { config } from '../config/index.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { logger } from '../logger.js';

export type ZavorthGatewayStatus = {
  enabled: boolean;
  ready: boolean;
  running: boolean;
  pid: number | null;
  host: string;
  port: number;
  baseUrl: string;
  upstreamBaseUrl: string;
  localOnly: boolean;
  overlayFile: string | null;
  checkedAt: string;
  message: string;
};

type GatewayOverlay = {
  headers?: Record<string, string>;
};

interface GatewayWebSocketMessage {
  id?: string;
  type?: string;
  body?: Record<string, unknown>;
}

interface GatewayError extends Error {
  code?: string;
}

export class ZavorthGatewayService {
  private static server: http.Server | null = null;
  private static wss: WebSocketServer | null = null;
  private static startedAt: string | null = null;
  private server: http.Server | null = null;

  public async start(): Promise<ZavorthGatewayStatus> {
    if (!config.zavorthAIGatewayGatewayEnabled) {
      const status = this.buildStatus(false, false, 'Gateway proprio do AIGateway desativado.');
      this.writeStatus(status);
      return status;
    }

    if (ZavorthGatewayService.server) {
      this.server = ZavorthGatewayService.server;
      const status = await this.readLiveStatus('Gateway proprio do AIGateway ja estava ativo.');
      this.writeStatus(status);
      return status;
    }

    const server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    server.on('upgrade', (req, socket, head) => {
      if (!this.handleWebSocketUpgrade(req, socket, head)) {
        socket.destroy();
      }
    });
    this.server = server;

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.zavorthAIGatewayGatewayPort, config.zavorthAIGatewayGatewayHost, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
    } catch (error: unknown) {server.removeAllListeners();
      this.server = null;
      if (error?.code === 'EADDRINUSE' && await this.isGatewayHealthy()) {
        const status = this.buildExternalGatewayStatus('Gateway proprio do AIGateway ja estava ativo em outro processo.');
        this.writeStatus(status);
        return status;
      }
      throw error;
    }

    ZavorthGatewayService.server = server;
    ZavorthGatewayService.startedAt = new Date().toISOString();
    const status = await this.readLiveStatus('Gateway proprio do AIGateway ativo.');
    this.writeStatus(status);
    return status;
  }

  public async stop(): Promise<void> {
    const server = this.server || ZavorthGatewayService.server;
    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    });

    this.server = null;
    ZavorthGatewayService.server = null;
    ZavorthGatewayService.wss?.clients.forEach((client) => {
      try {
        client.close();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn("[auto-fix] Empty catch block", err); }
    });
    ZavorthGatewayService.wss?.close();
    ZavorthGatewayService.wss = null;
    ZavorthGatewayService.startedAt = null;
    const status = this.buildStatus(false, false, 'Gateway proprio do AIGateway encerrado.');
    this.writeStatus(status);
  }

  public readStatus(): ZavorthGatewayStatus {
    return this.readPersistedStatus();
  }

  public readPersistedStatus(): ZavorthGatewayStatus {
    const fallback = this.buildStatus(false, false, config.zavorthAIGatewayGatewayEnabled
      ? 'AIGateway own gateway has not started in this session yet.'
      : 'AIGateway own gateway disabled.');

    try {
      if (!fs.existsSync(config.AIGatewayGatewayStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewayGatewayStatusFile, 'utf8')) as Partial<ZavorthGatewayStatus>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error: unknown) {logger.warn('[Zavorth A I way] JSON parse failed', error); return fallback; }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestUrl = new URL(req.url || '/', `${config.zavorthAIGatewayGatewayBaseUrl}/`);
    const normalizedPath = requestUrl.pathname.replace(/\/+$/, '') || '/';

    // The configured gateway base URL includes `/v1`, so internal probes end up
    // hitting `/v1/health`. Accept both shapes to avoid false-negative restarts.
    if (normalizedPath === '/health' || normalizedPath === '/v1/health') {
      const ready = await this.isUpstreamHealthy();
      this.writeJson(res, ready
        ? { ok: true, ready: true, upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl }
        : { ok: false, ready: false, upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl }, ready ? 200 : 503);
      const status = this.buildStatus(true, ready, ready ? 'AIGateway own gateway is healthy.' : 'AIGateway own gateway has no healthy upstream.');
      this.writeStatus(status);
      return;
    }

    if (!requestUrl.pathname.startsWith('/v1/')) {
      this.writeJson(res, { ok: false, error: 'Invalid route for the Zavorth AIGateway gateway.' }, 404);
      return;
    }

    try {
      const upstreamUrl = new URL(requestUrl.pathname.replace(/^\/v1/, '') + requestUrl.search, `${config.AIGatewayUpstreamBaseUrl}/`);
      const requestBody = await this.readRawBody(req);
      const headers = new Headers();
      const overlay = this.readOverlay();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) {
          continue;
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => headers.append(key, entry));
          continue;
        }
        headers.set(key, value);
      }
      headers.set('x-zavorth-AIGateway', 'gateway');
      if (overlay.headers) {
        for (const [key, value] of Object.entries(overlay.headers)) {
          headers.set(key, value);
        }
      }
      headers.delete('host');
      headers.delete('content-length');
      const response = await safeFetch(upstreamUrl, {
        method: req.method || 'GET',
        headers,
        body: requestBody.length > 0 ? new Uint8Array(requestBody) : undefined,
      }, {
        serviceName: 'Zavorth AI Gateway upstream proxy',
        allowLoopback: true,
      });
      const bodyBuffer = Buffer.from(await response.arrayBuffer());
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('x-zavorth-AIGateway', 'gateway');
      responseHeaders.delete('content-length');

      const headerObject: Record<string, string> = {};
      responseHeaders.forEach((value, key) => {
        headerObject[key] = value;
      });

      res.writeHead(response.status, headerObject);
      res.end(bodyBuffer);
      const status = this.buildStatus(true, response.ok || response.status < 500, 'AIGateway own gateway responded to upstream.');
      this.writeStatus(status);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const status = this.buildStatus(true, false, `Failed to forward request to AIGateway upstream: ${errorMessage}`);
      this.writeStatus(status);
      this.writeJson(res, { ok: false, error: status.message }, 502);
    }
  }

  private handleWebSocketUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const origin = req.headers.host || `${config.zavorthAIGatewayGatewayHost}:${config.zavorthAIGatewayGatewayPort}`;
    const url = new URL(req.url || '/', `ws://${origin}`);
    if (url.pathname !== '/v1/ws') {
      return false;
    }
    if (String(config.zavorthAIGatewayGatewayHost || '').trim() !== '0.0.0.0' && !isLoopbackHost(req.socket.remoteAddress)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }
    if (!ZavorthGatewayService.wss) {
      ZavorthGatewayService.wss = new WebSocketServer({ noServer: true });
    }
    ZavorthGatewayService.wss.handleUpgrade(req, socket, head, (ws) => {
      this.initializeGatewayWebSocket(ws, url);
    });
    return true;
  }

  private initializeGatewayWebSocket(ws: WebSocket, url: URL): void {
    this.sendWebSocketJson(ws, {
      type: 'zavorth.gateway.ready',
      gateway: 'zavorth-native',
      path: url.pathname,
      upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl,
      createdAt: new Date().toISOString(),
    });
    ws.on('message', (raw) => {
      void this.handleGatewayWebSocketMessage(ws, raw);
    });
  }

  private async handleGatewayWebSocketMessage(ws: WebSocket, raw: RawData): Promise<void> {
    let message: GatewayWebSocketMessage;
    try {
      message = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : raw.toString());
    } catch (error: unknown) {this.sendWebSocketJson(ws, { type: 'error', error: 'Expected JSON message.' });
      return;
    }
    const id = typeof message?.id === 'string' ? message.id : null;
    const type = String(message?.type || '').trim();
    if (type === 'ping') {
      this.sendWebSocketJson(ws, { id, type: 'pong', at: new Date().toISOString() });
      return;
    }
    if (type === 'status') {
      this.sendWebSocketJson(ws, { id, type: 'status', status: this.readPersistedStatus() });
      return;
    }
    if (type !== 'chat.completions') {
      this.sendWebSocketJson(ws, { id, type: 'error', error: `Unsupported WebSocket message type: ${type || 'missing'}` });
      return;
    }
    try {
      const response = await safeFetch(this.joinUrl(config.AIGatewayUpstreamBaseUrl, 'chat/completions'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-zavorth-AIGateway': 'gateway-ws',
        },
        body: JSON.stringify(message.body || {}),
      }, {
        serviceName: 'Zavorth AI Gateway WebSocket chat completions',
        allowLoopback: true,
      });
      const body = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
      this.sendWebSocketJson(ws, {
        id,
        type: 'chat.completions.result',
        status: response.status,
        ok: response.ok,
        body,
      });
    } catch (error: unknown) {
      this.sendWebSocketJson(ws, {
        id,
        type: 'chat.completions.error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private sendWebSocketJson(ws: WebSocket, payload: unknown): void {
    if (ws.readyState !== 1) {
      return;
    }
    ws.send(JSON.stringify(payload));
  }

  private async readLiveStatus(message: string): Promise<ZavorthGatewayStatus> {
    const ready = await this.isGatewayHealthy();
    return this.buildStatus(true, ready, ready ? message : 'AIGateway own gateway started, but has not passed health yet.');
  }

  private async isGatewayHealthy(): Promise<boolean> {
    try {
      const response = await safeFetch(this.joinUrl(config.zavorthAIGatewayGatewayBaseUrl, 'health'), { method: 'GET' }, {
        serviceName: 'Zavorth AI Gateway healthcheck',
        allowLoopback: true,
      });
      return response.ok;
    } catch (error: unknown) {logger.warn('[Zavorth A I way] network request failed', error); return false; }
  }

  private async isUpstreamHealthy(): Promise<boolean> {
    try {
      const overlay = this.readOverlay();
      const headers = new Headers();
      if (overlay.headers) {
        for (const [key, value] of Object.entries(overlay.headers)) {
          headers.set(key, value);
        }
      }
      const response = await safeFetch(this.joinUrl(config.AIGatewayUpstreamBaseUrl, 'models'), {
        method: 'GET',
        headers,
      }, {
        serviceName: 'Zavorth AI Gateway upstream healthcheck',
        allowLoopback: true,
      });
      return response.status > 0 && response.status < 500;
    } catch (error: unknown) {logger.warn('[Zavorth A I way] network request failed', error); return false; }
  }

  private readOverlay(): GatewayOverlay {
    try {
      if (!fs.existsSync(config.AIGatewayOverlayFile)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(config.AIGatewayOverlayFile, 'utf8')) as GatewayOverlay;
    } catch (error: unknown) {logger.warn('[Zavorth A I way] JSON parse failed', error); return {}; }
  }

  private buildStatus(running: boolean, ready: boolean, message: string): ZavorthGatewayStatus {
    return {
      enabled: config.zavorthAIGatewayGatewayEnabled,
      ready,
      running,
      pid: running ? process.pid : null,
      host: config.zavorthAIGatewayGatewayHost,
      port: config.zavorthAIGatewayGatewayPort,
      baseUrl: config.zavorthAIGatewayGatewayBaseUrl,
      upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl,
      localOnly: String(config.zavorthAIGatewayGatewayHost || '').trim() !== '0.0.0.0',
      overlayFile: path.resolve(config.AIGatewayOverlayFile),
      checkedAt: new Date().toISOString(),
      message,
    };
  }

  private buildExternalGatewayStatus(message: string): ZavorthGatewayStatus {
    return {
      ...this.buildStatus(true, true, message),
      pid: null,
    };
  }

  private writeStatus(status: ZavorthGatewayStatus): void {
    fs.mkdirSync(path.dirname(config.AIGatewayGatewayStatusFile), { recursive: true });
    fs.writeFileSync(config.AIGatewayGatewayStatusFile, JSON.stringify(status, null, 2), 'utf8');
  }

  private writeJson(res: http.ServerResponse, body: unknown, statusCode: number): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  private async readRawBody(req: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private joinUrl(baseUrl: string, segment: string): string {
    const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(segment.replace(/^\/+/, ''), normalized).toString();
  }
}

function isLoopbackHost(address: string | undefined): boolean {
  const value = String(address || '').trim();
  return !value || value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}
