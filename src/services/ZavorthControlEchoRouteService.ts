import * as http from 'http';
import { EchoEdgeHardeningService } from '../domain/trust-governance/infrastructure/EchoEdgeHardeningService.js';
import {
  EchoVoiceAssetStoreService,
  getDefaultEchoVoiceAssetStore,
} from '../domain/surface/infrastructure/EchoVoiceAssetStoreService.js';
import type { ZavorthEchoService } from './ZavorthEchoService.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { NexusFacadeService } from './NexusFacadeService.js';
import type {
  NormalizedInboundMessage,
  UniversalAgentRunResult,
} from '../runtime/agent/index.js';
import {
  EchoExecuteRequestSchema,
  EchoPermissionResolveRequestSchema,
  EchoSpeechRequestSchema,
  NexusExecuteRequestSchema,
  parseZavorthControlRouteBody,
  type EchoPermissionResolveRequestDto,
} from './ZavorthControlEchoRouteSchemas.js';

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;

type ZavorthControlRouteSurface = 'echo' | 'nexus';

type AgentGatewayLike = {
  handle(input: NormalizedInboundMessage): Promise<UniversalAgentRunResult>;
};

export type ZavorthControlEchoRouteDeps = {
  echo: ZavorthEchoService;
  writeJson: WriteJson;
  agentGateway?: AgentGatewayLike | null;
};

type RequestBodyTooLargeError = Error & {
  statusCode: number;
  code: string;
};

/**
 * REST routes for /api/v2/echo/* and the converged /api/v2/nexus/* alias.
 */
export class ZavorthControlEchoRouteService {
  private readonly edgeHardening: EchoEdgeHardeningService;
  private readonly voiceAssetStore: EchoVoiceAssetStoreService;
  private readonly nexusFacade: NexusFacadeService;

  constructor(options: {
    edgeHardening?: EchoEdgeHardeningService;
    voiceAssetStore?: EchoVoiceAssetStoreService;
    nexusFacade?: NexusFacadeService;
  } = {}) {
    this.edgeHardening = options.edgeHardening || new EchoEdgeHardeningService();
    this.voiceAssetStore = options.voiceAssetStore || getDefaultEchoVoiceAssetStore();
    this.nexusFacade = options.nexusFacade || new NexusFacadeService();
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    _url: URL,
    pathname: string,
    deps: ZavorthControlEchoRouteDeps,
  ): Promise<boolean> {
    const routeSurface = this.resolveRouteSurface(pathname);
    const canonicalPathname = routeSurface === 'nexus'
      ? pathname.replace('/api/v2/nexus/', '/api/v2/echo/')
      : pathname;
    const edgeDecision = this.edgeHardening.evaluateRequest(req, pathname);
    if (edgeDecision) {
      this.applyHeaders(res, edgeDecision.headers);
      if (!edgeDecision.ok) {
        deps.writeJson(res, edgeDecision.body, edgeDecision.statusCode);
        return true;
      }
    }

    if (routeSurface === 'nexus' && pathname === '/api/v2/nexus/status' && req.method === 'GET') {
      deps.writeJson(res, await this.nexusFacade.buildStatus({
        echo: deps.echo,
        agentGatewayAvailable: Boolean(deps.agentGateway),
      }), 200);
      return true;
    }

    if (routeSurface === 'nexus' && pathname === '/api/v2/nexus/capabilities' && req.method === 'GET') {
      deps.writeJson(res, await this.nexusFacade.buildCapabilities({
        echo: deps.echo,
      }), 200);
      return true;
    }

    if (routeSurface === 'nexus' && pathname === '/api/v2/nexus/workbench' && req.method === 'GET') {
      deps.writeJson(res, await this.nexusFacade.buildWorkbench({
        echo: deps.echo,
        agentGatewayAvailable: Boolean(deps.agentGateway),
      }), 200);
      return true;
    }

    if (routeSurface === 'echo' && pathname === '/api/v2/echo/experience' && req.method === 'GET') {
      deps.writeJson(res, await this.nexusFacade.buildEchoExperience({
        echo: deps.echo,
      }), 200);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/execute' && req.method === 'POST') {
      try {
        const body = await this.readJson(req);

        if (routeSurface === 'nexus') {
          const parsed = parseZavorthControlRouteBody(
            NexusExecuteRequestSchema,
            body,
            'Payload Nexus invalido.',
          );
          if (!parsed.ok) {
            deps.writeJson(res, { error: parsed.error }, 400);
            return true;
          }
          deps.writeJson(res, await this.nexusFacade.execute({
            request: parsed.data,
            echo: deps.echo,
            agentGateway: deps.agentGateway,
          }), 200);
          return true;
        }

        const parsed = parseZavorthControlRouteBody(
          EchoExecuteRequestSchema,
          body,
          'Payload Echo invalido.',
        );
        if (!parsed.ok) {
          deps.writeJson(res, { error: parsed.error }, 400);
          return true;
        }
        const { prompt, category, sessionId, requestedBy, surface } = parsed.data;
        const result = await deps.echo.processIntent(prompt, {
          category,
          sessionId,
          requestedBy,
          surface,
        });
        deps.writeJson(res, result, 200);
      } catch (error: any) {
        this.writeRouteError(res, deps, error, 'Erro no Echo');
      }
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/tools' && req.method === 'GET') {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const category = url.searchParams.get('category') || undefined;
      deps.writeJson(res, deps.echo.listTools(category), 200);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/history' && req.method === 'GET') {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const limitRaw = url.searchParams.get('limit');
      const limit = safeParseInt(limitRaw, 20);
      deps.writeJson(res, deps.echo.getHistory(Number.isFinite(limit) ? limit : 20), 200);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/snapshot' && req.method === 'GET') {
      deps.writeJson(res, await deps.echo.buildSnapshot(), 200);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/voice-metrics' && req.method === 'GET') {
      deps.writeJson(res, deps.echo.buildVoiceMetricsSnapshot(), 200);
      return true;
    }

    const voiceAssetMatch = req.method === 'GET'
      ? canonicalPathname.match(/^\/api\/v2\/echo\/audio\/assets\/([^/]+)(?:\/access\/([^/]+))?$/)
      : null;
    if (voiceAssetMatch) {
      const assetId = decodeURIComponent(voiceAssetMatch[1] || '');
      const token = decodeURIComponent(voiceAssetMatch[2] || '') || _url.searchParams.get('token') || '';
      const asset = this.voiceAssetStore.read(assetId, token);
      if (!asset) {
        this.applyHeaders(res, {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'X-Content-Type-Options': 'nosniff',
          'X-Zavorth-Echo-Edge': 'voice-asset',
        });
        deps.writeJson(res, { error: 'Asset de audio Echo nao encontrado ou expirado.' }, 404);
        return true;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', asset.mimeType || 'audio/wav');
      res.setHeader('Content-Length', String(asset.audio.length));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Zavorth-Echo-Edge', 'voice-asset');
      res.setHeader('X-Zavorth-Voice-Surface', asset.surface);
      res.end(asset.audio);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/audio/speech' && req.method === 'POST') {
      try {
        const body = await this.readJson(req);
        const parsed = parseZavorthControlRouteBody(
          EchoSpeechRequestSchema,
          body,
          'Payload de audio Echo invalido.',
        );
        if (!parsed.ok) {
          deps.writeJson(res, { error: parsed.error }, 400);
          return true;
        }
        const bodyDto = parsed.data;

        const synthesis = await deps.echo.synthesizeSpeech({
          text: bodyDto.input,
          surface: bodyDto.surface,
          requestedBy: bodyDto.requestedBy,
          sessionId: bodyDto.sessionId,
          model: bodyDto.model,
          voiceName: bodyDto.voice || bodyDto.voiceName,
          languageCode: bodyDto.languageCode,
        });

        if (!synthesis.ok) {
          deps.writeJson(res, { error: synthesis.error }, synthesis.statusCode);
          return true;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', synthesis.mimeType || 'audio/wav');
        res.setHeader('Content-Length', String(synthesis.audio.length));
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Zavorth-Echo-Edge', 'voice');
        if (synthesis.model) {
          res.setHeader('X-Zavorth-Voice-Model', synthesis.model);
        }
        if (synthesis.voiceName) {
          res.setHeader('X-Zavorth-Voice-Name', synthesis.voiceName);
        }
        res.setHeader('X-Zavorth-Voice-Latency-Ms', String(synthesis.latencyMs));
        res.end(synthesis.audio);
      } catch (error: any) {
        this.writeRouteError(res, deps, error, 'Erro no audio Echo');
      }
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/connection' && req.method === 'GET') {
      deps.writeJson(res, await deps.echo.testConnection(), 200);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/permissions' && req.method === 'GET') {
      deps.writeJson(res, deps.echo.getPendingPermissions(), 200);
      return true;
    }

    if (canonicalPathname === '/api/v2/echo/permissions/resolve' && req.method === 'POST') {
      try {
        const body = await this.readJson(req);
        const parsed = parseZavorthControlRouteBody(
          EchoPermissionResolveRequestSchema,
          body,
          'Campos "id" (string) e "approved" (boolean) obrigatorios.',
        );
        if (!parsed.ok) {
          deps.writeJson(res, { error: parsed.error }, 400);
          return true;
        }
        const { id, approved } = parsed.data;

        const resolverContext = this.readResolverContext(parsed.data);
        const result = resolverContext
          ? await deps.echo.resolvePermission(id, approved, resolverContext)
          : await deps.echo.resolvePermission(id, approved);
        if (!result.ok) {
          const statusCode = result.error?.includes('ja foi resolvida') ? 409 : 404;
          deps.writeJson(res, { error: result.error }, statusCode);
          return true;
        }

        deps.writeJson(res, result, 200);
      } catch (error: any) {
        this.writeRouteError(res, deps, error, 'Erro');
      }
      return true;
    }

    return false;
  }

  private resolveRouteSurface(pathname: string): ZavorthControlRouteSurface | null {
    if (pathname.startsWith('/api/v2/nexus/')) {
      return 'nexus';
    }
    if (pathname.startsWith('/api/v2/echo/')) {
      return 'echo';
    }
    return null;
  }

  private async readJson(req: http.IncomingMessage): Promise<unknown> {
    const raw = await this.readBody(req);
    if (!raw.trim()) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      const error = new Error('Payload JSON invalido.') as RequestBodyTooLargeError;
      error.statusCode = 400;
      error.code = 'invalid_json';
      throw error;
    }
  }

  private readResolverContext(body: EchoPermissionResolveRequestDto) {
    const context = {
      sessionId: body.sessionId,
      surface: body.surface,
      requestedBy: body.requestedBy,
      channel: body.channel,
      chatId: body.chatId,
      threadId: body.threadId,
      userId: body.userId,
    };
    return Object.values(context).some((value) => typeof value === 'string' && value.trim().length > 0)
      ? context
      : null;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      req.on('data', (chunk) => {
        size += Buffer.byteLength(chunk);
        if (size > this.edgeHardening.getMaxBodyBytes()) {
          const error = new Error(
            `Payload Echo excede o limite seguro de ${this.edgeHardening.getMaxBodyBytes()} bytes.`,
          ) as RequestBodyTooLargeError;
          error.statusCode = 413;
          error.code = 'payload_too_large';
          reject(error);
          return;
        }
        data += chunk;
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  private writeRouteError(
    res: http.ServerResponse,
    deps: ZavorthControlEchoRouteDeps,
    error: unknown,
    prefix: string,
  ): void {
    const statusCode = this.getErrorStatusCode(error);
    const message = error instanceof Error ? error.message : String(error);
    deps.writeJson(res, { error: `${prefix}: ${message}` }, statusCode);
  }

  private getErrorStatusCode(error: unknown): number {
    const candidate = Number((error as RequestBodyTooLargeError | undefined)?.statusCode);
    return Number.isFinite(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;
  }

  private applyHeaders(res: http.ServerResponse, headers: Record<string, string>): void {
    if (!res || typeof res.setHeader !== 'function') {
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }
}
