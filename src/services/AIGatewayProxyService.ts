import fs from 'fs';
import http from 'http';
import path from 'path';
import { config } from '../config/index.js';
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

export class AIGatewayProxyService {
  private static server: http.Server | null = null;
  private static startedAt: string | null = null;
  private server: http.Server | null = null;

  public async start(): Promise<AIGatewayProxyStatus> {
    if (!config.zavorthAIGatewayGatewayEnabled) {
      const status = this.buildStatus(false, false, 'Gateway proprio do AIGateway desativado.');
      this.writeStatus(status);
      return status;
    }

    if (AIGatewayProxyService.server) {
      this.server = AIGatewayProxyService.server;
      const status = await this.readLiveStatus('Gateway proprio do AIGateway ja estava ativo.');
      this.writeStatus(status);
      return status;
    }

    const server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
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
    } catch (error: any) {
      server.removeAllListeners();
      this.server = null;
      if (error?.code === 'EADDRINUSE' && await this.isGatewayHealthy()) {
        const status = this.buildExternalGatewayStatus('Gateway proprio do AIGateway ja estava ativo em outro processo.');
        this.writeStatus(status);
        return status;
      }
      throw error;
    }

    AIGatewayProxyService.server = server;
    AIGatewayProxyService.startedAt = new Date().toISOString();
    const status = await this.readLiveStatus('Gateway proprio do AIGateway ativo.');
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
    AIGatewayProxyService.startedAt = null;
    const status = this.buildStatus(false, false, 'Gateway proprio do AIGateway encerrado.');
    this.writeStatus(status);
  }

  public readStatus(): AIGatewayProxyStatus {
    return this.readPersistedStatus();
  }

  public readPersistedStatus(): AIGatewayProxyStatus {
    const fallback = this.buildStatus(false, false, config.zavorthAIGatewayGatewayEnabled
      ? 'Gateway proprio do AIGateway ainda nao iniciou nesta sessao.'
      : 'Gateway proprio do AIGateway desativado.');

    try {
      if (!fs.existsSync(config.AIGatewayGatewayStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewayGatewayStatusFile, 'utf8')) as Partial<AIGatewayProxyStatus>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch {
      return fallback;
    }
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
      const status = this.buildStatus(true, ready, ready ? 'Gateway proprio do AIGateway saudavel.' : 'Gateway proprio do AIGateway sem upstream saudavel.');
      this.writeStatus(status);
      return;
    }

    if (!requestUrl.pathname.startsWith('/v1/')) {
      this.writeJson(res, { ok: false, error: 'Rota invalida para o gateway AIGateway do Zavorth.' }, 404);
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
      const status = this.buildStatus(true, response.ok, 'Gateway proprio do AIGateway respondeu ao upstream.');
      this.writeStatus(status);
    } catch (error: any) {
      const status = this.buildStatus(true, false, `Falha ao encaminhar request ao AIGateway upstream: ${error?.message || error}`);
      this.writeStatus(status);
      this.writeJson(res, { ok: false, error: status.message }, 502);
    }
  }

  private async readLiveStatus(message: string): Promise<AIGatewayProxyStatus> {
    const ready = await this.isGatewayHealthy();
    return this.buildStatus(true, ready, ready ? message : 'Gateway proprio do AIGateway subiu, mas ainda nao passou no health.');
  }

  private async isGatewayHealthy(): Promise<boolean> {
    try {
      const response = await safeFetch(this.joinUrl(config.zavorthAIGatewayGatewayBaseUrl, 'health'), { method: 'GET' }, {
        serviceName: 'AI Gateway proxy self healthcheck',
        allowLoopback: true,
      });
      return response.ok;
    } catch {
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
    } catch {
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
    const status = this.buildStatus(true, true, 'Gateway proprio do AIGateway saudavel via Google AI Studio.');
    this.writeStatus(status);
  }

  private async handleGoogleAiStudioChatCompletions(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    requestBody: Buffer,
  ): Promise<void> {
    const payload = JSON.parse(requestBody.toString('utf8') || '{}') as Record<string, any>;
    const model = this.resolveGoogleAiStudioModel(payload.model);
    const upstreamUrl = this.joinUrl(
      config.AIGatewayUpstreamBaseUrl,
      `v1/models/${encodeURIComponent(model.replace(/^google-ai-studio\//, ''))}:generateContent`,
    );
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    this.applyUpstreamHeaders(headers);

    const response = await safeFetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.toGoogleAiStudioGenerateContentPayload(payload)),
    }, {
      serviceName: 'AI Gateway Google AI Studio chat completions',
      allowLoopback: true,
    });
    const body = await response.json().catch(() => null) as Record<string, any> | null;
    if (!response.ok) {
      this.writeJson(res, {
        error: {
          message: body?.error?.message || body?.message || `Upstream returned HTTP ${response.status}`,
          type: 'upstream_error',
        },
      }, response.status);
      const status = this.buildStatus(true, false, 'Gateway proprio do AIGateway recebeu erro do Google AI Studio.');
      this.writeStatus(status);
      return;
    }

    this.writeJson(res, this.toOpenAiChatCompletion(body, model), 200);
    const status = this.buildStatus(true, true, 'Gateway proprio do AIGateway respondeu via Google AI Studio.');
    this.writeStatus(status);
  }

  private toGoogleAiStudioGenerateContentPayload(payload: Record<string, any>): Record<string, unknown> {
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

  private toOpenAiChatCompletion(body: Record<string, any> | null, model: string): Record<string, unknown> {
    const candidate = body?.candidates?.[0] || {};
    const content = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts.map((part: any) => part?.text || '').join('')
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
      return this.joinUrl(config.AIGatewayUpstreamBaseUrl, 'v1/models?pageSize=1');
    }
    return this.joinUrl(config.AIGatewayUpstreamBaseUrl, 'models');
  }

  private applyUpstreamHeaders(headers: Headers): void {
    const overlay = this.readOverlay();
    if (overlay.headers) {
      for (const [key, value] of Object.entries(overlay.headers)) {
        headers.set(key, value);
      }
    }
    if (this.isGoogleAiStudioUpstream() && config.geminiApiKey) {
      headers.set('x-goog-api-key', config.geminiApiKey);
    }
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
    } catch {
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
