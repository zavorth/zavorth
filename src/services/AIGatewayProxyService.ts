import { asErrorLike } from '../utils/errorLike';
import fs from 'fs';
import http from 'http';
import path from 'path';
import type { Duplex } from 'stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { safeFetch } from '../security/SafeFetchService.js';

export type AIGatewayProxyStatus = {
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

type GoogleStudioPart = {
  text?: string;
};

type GoogleStudioContent = {
  role?: string;
  parts?: GoogleStudioPart[];
};

interface GatewayWebSocketMessage {
  id?: string;
  type?: string;
  body?: Record<string, unknown>;
}

interface OpenAiChatMessage {
  role?: string;
  content?: unknown;
}

interface GoogleAiStudioChatPayload {
  model?: string;
  messages?: OpenAiChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface GoogleAiStudioError {
  message?: string;
  type?: string;
}

interface GoogleAiStudioResponseBody {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  responseId?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: GoogleAiStudioError;
  message?: string;
}

export class AIGatewayProxyService {
  private static server: http.Server | null = null;
  private static wss: WebSocketServer | null = null;
  private static startedAt: string | null = null;
  private static startPromise: Promise<AIGatewayProxyStatus> | null = null;
  private server: http.Server | null = null;

  public async start(): Promise<AIGatewayProxyStatus> {
    if (!config.zavorthAIGatewayGatewayEnabled) {
      const status = this.buildStatus(false, false, 'AIGateway local gateway is disabled.');
      this.writeStatus(status);
      return status;
    }

    if (AIGatewayProxyService.server) {
      this.server = AIGatewayProxyService.server;
      const status = await this.readLiveStatus('AIGateway local gateway was already active.');
      this.writeStatus(status);
      return status;
    }

    // Prevent concurrent start attempts
    if (AIGatewayProxyService.startPromise) {
      return AIGatewayProxyService.startPromise;
    }

    AIGatewayProxyService.startPromise = this.doStart();
    const result = await AIGatewayProxyService.startPromise;
    AIGatewayProxyService.startPromise = null;
    return result;
  }

  private async doStart(): Promise<AIGatewayProxyStatus> {
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
      const errObj = error && typeof error === 'object' ? error as { code?: string } : {};
      if (errObj.code === 'EADDRINUSE' && await this.isGatewayHealthy()) {
        const status = this.buildExternalGatewayStatus('AIGateway local gateway was already active in another process.');
        this.writeStatus(status);
        return status;
      }
      throw error;
    }

    AIGatewayProxyService.server = server;
    AIGatewayProxyService.startedAt = new Date().toISOString();
    const status = await this.readLiveStatus('AIGateway local gateway is active.');
    this.writeStatus(status);
    return status;
  }

  public async stop(): Promise<void> {
    const server = this.server || AIGatewayProxyService.server;
    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    });

    this.server = null;
    AIGatewayProxyService.server = null;
    AIGatewayProxyService.wss?.clients.forEach((client) => {
      try {
        client.close();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('Failed to close WebSocket client during gateway shutdown.', { err });
      }
    });
    AIGatewayProxyService.wss?.close();
    AIGatewayProxyService.wss = null;
    AIGatewayProxyService.startedAt = null;
    const status = this.buildStatus(false, false, 'AIGateway local gateway stopped.');
    this.writeStatus(status);
  }

  public readStatus(): AIGatewayProxyStatus {
    return this.readPersistedStatus();
  }

  public readPersistedStatus(): AIGatewayProxyStatus {
    const fallback = this.buildStatus(false, false, config.zavorthAIGatewayGatewayEnabled ? 'AIGateway local gateway has not started in this session yet.'
      : 'AIGateway local gateway is disabled.');

    try {
      if (!fs.existsSync(config.AIGatewayGatewayStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewayGatewayStatusFile, 'utf8')) as Partial<AIGatewayProxyStatus>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('Failed to read persisted gateway status; using fallback.', { err });
      return fallback;
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestUrl = new URL(req.url || '/', `${config.zavorthAIGatewayGatewayBaseUrl}/`);
    const normalizedPath = requestUrl.pathname.replace(/\/+$/, '') || '/';

    // The configured gateway base URL includes `/v1`, so internal probes end up
    // hitting `/v1/health`. Accept both shapes to avoid false-denytive restarts.
    if (normalizedPath === '/health' || normalizedPath === '/v1/health') {
      const ready = await this.isUpstreamHealthy();
      this.writeJson(res, ready
        ? { ok: true, ready: true, upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl }
        : { ok: false, ready: false, upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl }, ready ? 200 : 503);
      const status = this.buildStatus(true, ready, ready ? 'AIGateway local gateway is healthy.' : 'AIGateway local gateway has no healthy upstream.');
      this.writeStatus(status);
      return;
    }

    if (!requestUrl.pathname.startsWith('/v1/')) {
      this.writeJson(res, { ok: false, error: 'Invalid route for the Zavorth AIGateway gateway.' }, 404);
      return;
    }

    try {
      const requestBody = await this.readRawBody(req);
      if (this.isGoogleAiStudioUpstream() && normalizedPath === '/v1/models') {
        await this.handleGoogleAiStudioModels(res);
        return;
      }

      if (this.isGoogleAiStudioUpstream() && normalizedPath === '/v1/chat/completions') {
        await this.handleGoogleAiStudioChatCompletions(req, res, requestBody);
        return;
      }

      const upstreamUrl = new URL(
        requestUrl.pathname.replace(/^\/v1\/?/, '').replace(/^\/+/, '') + requestUrl.search,
        `${config.AIGatewayUpstreamBaseUrl.replace(/\/+$/, '')}/`,
      );
      const headers = new Headers();
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
      this.applyUpstreamHeaders(headers);
      headers.delete('host');
      headers.delete('content-length');
      const response = await safeFetch(upstreamUrl, {
        method: req.method || 'GET',
        headers,
        body: requestBody.length > 0 ? new Uint8Array(requestBody) : undefined,
      }, {
        serviceName: 'AI Gateway proxy upstream',
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
      const status = this.buildStatus(true, response.ok, 'AIGateway local gateway forwarded the upstream response.');
      this.writeStatus(status);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
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
    if (!AIGatewayProxyService.wss) {
      AIGatewayProxyService.wss = new WebSocketServer({ noServer: true });
    }
    AIGatewayProxyService.wss.handleUpgrade(req, socket, head, (ws) => {
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('Received WebSocket message is not valid JSON.', { err });
      this.sendWebSocketJson(ws, { type: 'error', error: 'Expected JSON message.' });
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
      const response = await safeFetch(this.joinUrl(config.zavorthAIGatewayGatewayBaseUrl, 'chat/completions'), {
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
      const err = asErrorLike(error);
      this.sendWebSocketJson(ws, {
        id,
        type: 'chat.completions.error',
        error: error instanceof Error ? err.message : String(error),
      });
    }
  }

  private sendWebSocketJson(ws: WebSocket, payload: unknown): void {
    if (ws.readyState !== 1) {
      return;
    }
    ws.send(JSON.stringify(payload));
  }

  private async readLiveStatus(message: string): Promise<AIGatewayProxyStatus> {
    const ready = await this.isGatewayHealthy();
    return this.buildStatus(true, ready, ready ? message : 'AIGateway local gateway started but has not passed health checks yet.');
  }

  private async isGatewayHealthy(): Promise<boolean> {
    try {
      const response = await safeFetch(this.joinUrl(config.zavorthAIGatewayGatewayBaseUrl, 'health'), { method: 'GET' }, {
        serviceName: 'AI Gateway proxy self healthcheck',
        allowLoopback: true,
      });
      return response.ok;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('local gateway healthcheck failed.', { err });
      return false;
    }
  }

  private async isUpstreamHealthy(): Promise<boolean> {
    try {
      const headers = new Headers();
      this.applyUpstreamHeaders(headers);
      const response = await safeFetch(this.resolveUpstreamHealthUrl(), {
        method: 'GET',
        headers,
      }, {
        serviceName: 'AI Gateway proxy upstream healthcheck',
        allowLoopback: true,
      });
      return response.ok;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('Healthcheck do upstream failed.', { err });
      return false;
    }
  }

  private async handleGoogleAiStudioModels(res: http.ServerResponse): Promise<void> {
    const headers = new Headers();
    this.applyUpstreamHeaders(headers);
    const response = await safeFetch(this.resolveUpstreamHealthUrl(), {
      method: 'GET',
      headers,
    }, {
      serviceName: 'AI Gateway Google AI Studio models',
      allowLoopback: true,
    });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      this.writeJson(res, body || { error: { message: `Upstream returned HTTP ${response.status}` } }, response.status);
      return;
    }

    const upstreamModels = Array.isArray(body?.models) ? body.models as Array<Record<string, unknown>> : [];
    const data = upstreamModels.map((model) => {
      const rawName = String(model.name || '').replace(/^models\//, '');
      return {
        id: `google-ai-studio/${rawName || config.geminiModel}`,
        object: 'model',
        created: 0,
        owned_by: 'google-ai-studio',
      };
    });
    if (data.length === 0) {
      data.push({
        id: this.resolveGoogleAiStudioModel(config.AIGatewayModel),
        object: 'model',
        created: 0,
        owned_by: 'google-ai-studio',
      });
    }
    this.writeJson(res, { object: 'list', data }, 200);
    const status = this.buildStatus(true, true, 'AIGateway local gateway is healthy through Google AI Studio.');
    this.writeStatus(status);
  }

  private async handleGoogleAiStudioChatCompletions(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    requestBody: Buffer,
  ): Promise<void> {
    const payload = JSON.parse(requestBody.toString('utf8') || '{}') as GoogleAiStudioChatPayload;
    const model = this.resolveGoogleAiStudioModel(payload.model);
    const upstreamUrl = this.joinUrl(
      config.AIGatewayUpstreamBaseUrl,
      `v1/models/${encodeURIComponent(model.replace(/^google-ai-studio\//, ''))}:generateContent`,
    );
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    const requestPayload = JSON.stringify(this.toGoogleAiStudioGenerateContentPayload(payload));
    const keyCandidates = this.resolveGoogleAiStudioApiKeys();
    let response: Response | null = null;
    let body: GoogleAiStudioResponseBody | null = null;
    let lastStatus = 0;
    let lastMessage = '';
    for (let attempt = 0; attempt < keyCandidates.length; attempt += 1) {
      const attemptHeaders = new Headers(headers);
      this.applyUpstreamHeaders(attemptHeaders, keyCandidates[attempt]);
      response = await safeFetch(upstreamUrl, {
        method: 'POST',
        headers: attemptHeaders,
        body: requestPayload,
      }, {
        serviceName: 'AI Gateway Google AI Studio chat completions',
        allowLoopback: true,
      });
      body = await response.json().catch(() => null) as GoogleAiStudioResponseBody | null;
      if (response.ok) {
        break;
      }
      lastStatus = response.status;
      lastMessage = body?.error?.message || body?.message || `Upstream returned HTTP ${response.status}`;
      if (!isRetryableGoogleAiStudioStatus(response.status) || attempt === keyCandidates.length - 1) {
        break;
      }
    }
    if (!response) {
      this.writeJson(res, { error: { message: 'No Google AI Studio request was attempted.', type: 'upstream_error' } }, 502);
      return;
    }
    if (!response.ok) {
      this.writeJson(res, {
        error: {
          message: lastMessage || body?.error?.message || body?.message || `Upstream returned HTTP ${lastStatus || response.status}`,
          type: 'upstream_error',
        },
      }, response.status);
      const status = this.buildStatus(true, false, 'AIGateway local gateway received an error from Google AI Studio.');
      this.writeStatus(status);
      return;
    }

    this.writeJson(res, this.toOpenAiChatCompletion(body, model), 200);
    const status = this.buildStatus(true, true, 'AIGateway local gateway responded through Google AI Studio.');
    this.writeStatus(status);
  }

  private toGoogleAiStudioGenerateContentPayload(payload: GoogleAiStudioChatPayload): Record<string, unknown> {
    const systemParts: GoogleStudioPart[] = [];
    const contents: GoogleStudioContent[] = [];
    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    for (const message of messages) {
      const role = String(message?.role || '').toLowerCase();
      const text = this.stringifyOpenAiContent(message?.content);
      if (!text) {
        continue;
      }
      if (role === 'system') {
        systemParts.push({ text });
        continue;
      }
      contents.push({
        role: role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }

    const next: Record<string, unknown> = {
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: '' }] }],
    };
    if (systemParts.length > 0) {
      next.system_instruction = { parts: systemParts };
    }
    if (typeof payload.temperature === 'number' || typeof payload.max_tokens === 'number') {
      next.generationConfig = {
        ...(typeof payload.temperature === 'number' ? { temperature: payload.temperature } : {}),
        ...(typeof payload.max_tokens === 'number' ? { maxOutputTokens: payload.max_tokens } : {}),
      };
    }
    return next;
  }

  private toOpenAiChatCompletion(body: GoogleAiStudioResponseBody | null, model: string): Record<string, unknown> {
    const candidate = body?.candidates?.[0] || {};
    const content = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts.map((part: GoogleStudioPart) => part?.text || '').join('')
      : '';
    return {
      id: body?.responseId || `chatcmpl-zavorth-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: String(candidate?.finishReason || 'stop').toLowerCase(),
        },
      ],
      usage: {
        prompt_tokens: body?.usageMetadata?.promptTokenCount || 0,
        completion_tokens: body?.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: body?.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  private stringifyOpenAiContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (!Array.isArray(content)) {
      return content == null ? '' : String(content);
    }
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return String(part.text || '');
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  private resolveGoogleAiStudioModel(rawModel: unknown): string {
    const configured = String(rawModel || '').trim();
    if (configured.startsWith('google-ai-studio/')) {
      return configured;
    }
    if (configured && configured.startsWith('gemini-')) {
      return `google-ai-studio/${configured}`;
    }
    return `google-ai-studio/${config.geminiModel || 'gemini-2.5-flash'}`;
  }

  private resolveUpstreamHealthUrl(): string {
    if (this.isGoogleAiStudioUpstream()) {
      return this.joinUrl(config.AIGatewayUpstreamBaseUrl, 'v1/models...pageSize=1');
    }
    return this.joinUrl(config.AIGatewayUpstreamBaseUrl, 'models');
  }

  private applyUpstreamHeaders(headers: Headers, googleAiStudioApiKey?: string | null): void {
    const overlay = this.readOverlay();
    if (overlay.headers) {
      for (const [key, value] of Object.entries(overlay.headers)) {
        headers.set(key, value);
      }
    }
    const apiKey = String(googleAiStudioApiKey || config.geminiApiKey || '').trim();
    if (this.isGoogleAiStudioUpstream() && apiKey) {
      headers.set('x-goog-api-key', apiKey);
    }
  }

  private resolveGoogleAiStudioApiKeys(): string[] {
    const keys = Array.isArray(config.geminiApiKeys) && config.geminiApiKeys.length > 0
      ? config.geminiApiKeys
      : [config.geminiApiKey].filter(Boolean);
    return Array.from(new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)));
  }

  private isGoogleAiStudioUpstream(): boolean {
    return /\/google-ai-studio\/?$/i.test(config.AIGatewayUpstreamBaseUrl);
  }

  private readOverlay(): GatewayOverlay {
    try {
      if (!fs.existsSync(config.AIGatewayOverlayFile)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(config.AIGatewayOverlayFile, 'utf8')) as GatewayOverlay;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('Failed to read gateway overlay; using default configuration.', { err });
      return {};
    }
  }

  private buildStatus(running: boolean, ready: boolean, message: string): AIGatewayProxyStatus {
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

  private buildExternalGatewayStatus(message: string): AIGatewayProxyStatus {
    return {
      ...this.buildStatus(true, true, message),
      pid: null,
    };
  }

  private writeStatus(status: AIGatewayProxyStatus): void {
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

function isRetryableGoogleAiStudioStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}
