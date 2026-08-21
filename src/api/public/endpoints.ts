import { randomUUID } from 'crypto';
import { CanonicalPublicApiService } from './CanonicalPublicApiService.js';
import { PublicApiRouter } from './PublicApiRouter.js';
import { InvalidRequestError } from '../../contracts/public/errors.js';
import type {
  CanonicalRuntimeApiEnvelopeDTO,
} from '../../contracts/public/rest/runtime-api-v1-dto.js';
import type { PermissionStatus } from '../../contracts/PermissionRequest.js';

function resolveUrl(req: { url?: string | null; headers: { host?: string | null } }): URL {
  return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
}

function readNullableNumber(url: URL, key: string): number | undefined {
  const raw = String(url.searchParams.get(key) || '').trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readBoolean(url: URL, key: string): boolean {
  const raw = String(url.searchParams.get(key) || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function readPermissionStatus(url: URL): PermissionStatus | 'all' {
  const raw = String(url.searchParams.get('status') || 'pending').trim().toLowerCase();
  return raw === 'approved'
    || raw === 'rejected'
    || raw === 'expired'
    || raw === 'all'
    ? raw
    : 'pending';
}

function readMissionSource(value: unknown): 'cli' | 'web' | 'channel' | 'scheduler' | 'internal' {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'cli'
    || raw === 'channel'
    || raw === 'scheduler'
    || raw === 'internal'
    ? raw
    : 'web';
}

function readPathId(pathname: string, pattern: RegExp): string {
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1] || '').trim() : '';
}

function createTraceId(): string {
  return `api_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function sendEnvelope<T>(
  res: Parameters<typeof PublicApiRouter.sendJson>[0],
  data: T,
  traceId: string = createTraceId(),
): void {
  const envelope: CanonicalRuntimeApiEnvelopeDTO<T> = {
    ok: true,
    data,
    error: null,
    traceId,
  };
  PublicApiRouter.sendJson(res, 200, envelope);
}

interface JsonBodyRequest {
  on(event: 'data', listener: (chunk: Buffer | string) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

async function readJsonBody(req: JsonBodyRequest): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error: unknown) {
        reject(new InvalidRequestError('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

export function configureCanonicalPublicApi(
  router: PublicApiRouter,
  service: CanonicalPublicApiService,
) {
  router.register('GET', /^\/api\/v1\/status$/, async (_req, res) => {
    sendEnvelope(res, service.readRuntimeStatus());
  }, { access: 'public' });

  router.register('GET', /^\/api\/v1\/health$/, async (req, res) => {
    const url = resolveUrl(req);
    sendEnvelope(res, service.readRuntimeHealth(readBoolean(url, 'live') ? 'live' : 'fast'));
  }, { access: 'public' });

  router.register('GET', /^\/metrics$/, async (_req, res) => {
    const body = await service.readPrometheusMetrics();
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(body);
  }, { access: 'public' });

  router.register('GET', /^\/api\/v1\/providers$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    sendEnvelope(res, service.readProviders({
      includeAdvanced: readBoolean(url, 'advanced') || readBoolean(url, 'includeAdvanced'),
      selectedTarget: url.searchParams.get('selectedTarget') || url.searchParams.get('target'),
      profileId: url.searchParams.get('profileId') || url.searchParams.get('profile'),
    }));
  });

  router.register('GET', /^\/api\/v1\/channels$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    sendEnvelope(res, service.readChannels({
      selectedId: url.searchParams.get('selectedId') || url.searchParams.get('channelId'),
    }));
  });

  router.register('GET', /^\/api\/v1\/approvals$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    sendEnvelope(res, await service.readApprovals({
      status: readPermissionStatus(url),
      limit: readNullableNumber(url, 'limit'),
    }));
  });

  router.register('GET', /^\/api\/v1\/receipts$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    sendEnvelope(res, service.readReceipts({
      includeAdvanced: readBoolean(url, 'advanced') || readBoolean(url, 'includeAdvanced'),
    }));
  });

  router.register('GET', /^\/api\/v1\/missions$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    sendEnvelope(res, service.readMissions({
      request: url.searchParams.get('request') || url.searchParams.get('q'),
      selectedTemplateId: url.searchParams.get('templateId'),
      source: readMissionSource(url.searchParams.get('source')),
    }));
  });

  router.register('POST', /^\/api\/v1\/chat$/, async (req, res) => {
    PublicApiRouter.requireAuth(req);
    const body = await readJsonBody(req);
    sendEnvelope(res, await service.submitChat({
      message: body.message || body.text,
      sessionId: body.sessionId,
      live: body.live === true || body.execute === true,
      approved: body.approved === true || body.confirmed === true,
      selectedTemplateId: body.templateId || body.selectedTemplateId,
    }));
  });

  router.register('POST', /^\/api\/v1\/approvals\/[^/]+\/approve$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    const body = await readJsonBody(req);
    sendEnvelope(res, await service.approveApproval({
      approvalId: readPathId(url.pathname, /^\/api\/v1\/approvals\/([^/]+)\/approve$/),
      decidedBy: auth.userId,
      note: body.note || body.reason || body.decisionNote,
      totp: body.totp || body.code || body.approvalCode || body.approval_code || null,
    }));
  });

  router.register('POST', /^\/api\/v1\/approvals\/[^/]+\/deny$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    const body = await readJsonBody(req);
    sendEnvelope(res, await service.denyApproval({
      approvalId: readPathId(url.pathname, /^\/api\/v1\/approvals\/([^/]+)\/deny$/),
      decidedBy: auth.userId,
      reason: body.reason || body.note || body.decisionNote,
    }));
  });

  router.register('POST', /^\/api\/v1\/missions\/[^/]+\/cancel$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    const body = await readJsonBody(req);
    sendEnvelope(res, await service.cancelMission({
      missionId: readPathId(url.pathname, /^\/api\/v1\/missions\/([^/]+)\/cancel$/),
      requestedBy: auth.userId,
      reason: body.reason || body.note,
    }));
  });

  router.register('POST', /^\/api\/v1\/providers\/[^/]+\/test$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    const body = await readJsonBody(req);
    sendEnvelope(res, await service.testProvider({
      providerId: readPathId(url.pathname, /^\/api\/v1\/providers\/([^/]+)\/test$/),
      live: body.live === true || body.probe === true || readBoolean(url, 'live'),
      approved: body.approved === true || body.confirmed === true,
    }));
  });

  router.register('POST', /^\/api\/v1\/channels\/[^/]+\/action$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    const body = await readJsonBody(req);
    sendEnvelope(res, await service.executeChannelAction({
      channelId: readPathId(url.pathname, /^\/api\/v1\/channels\/([^/]+)\/action$/),
      actionId: body.actionId || body.action,
      requestedBy: auth.userId,
      approved: body.approved === true || body.confirmed === true,
    }));
  });

  router.register('GET', /^\/api\/v1\/events$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    const sessionId = String(url.searchParams.get('sessionId') || 'default').trim() || 'default';
    const wantsStream = readBoolean(url, 'stream')
      || String(req.headers.accept || '').toLowerCase().includes('text/event-stream');
    if (!wantsStream) {
      sendEnvelope(res, await service.readRuntimeEvents({ sessionId }));
      return;
    }

    const realtime = service.getRealtimeForEvents();
    if (!realtime) {
      sendEnvelope(res, await service.readRuntimeEvents({ sessionId }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    realtime.ensureSession(sessionId);
    await realtime.captureBaseline(sessionId);
    const eventService = service.getPublicRuntimeEventService();
    const unsubscribe = realtime.subscribe(sessionId, (event) => {
      for (const publicEvent of eventService.mapWebRealtimeEvent(event)) {
        res.write(`event: ${publicEvent.type}\n`);
        res.write(`id: ${publicEvent.id}\n`);
        res.write(`data: ${JSON.stringify(publicEvent)}\n\n`);
      }
    });
    const heartbeat = setInterval(() => {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  router.register('GET', /^\/api\/v1\/gateway\/status$/, async (_req, res) => {
    PublicApiRouter.sendJson(res, 200, service.readGatewayStatus());
  }, { access: 'public' });

  router.register('GET', /^\/api\/v1\/gateway\/domains$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, await service.readGatewayDomains({
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
      detail: String(url.searchParams.get('detail') || '').trim().toLowerCase() === 'full' ? 'full' : 'summary',
    }));
  });

  router.register('GET', /^\/api\/v1\/ops\/health$/, async (req, res) => {
    const url = resolveUrl(req);
    const live = String(url.searchParams.get('live') || '').trim().toLowerCase();
    PublicApiRouter.sendJson(res, 200, service.readOpsHealth(live === '1' || live === 'true' ? 'live' : 'fast'));
  }, { access: 'public' });

  router.register('GET', /^\/api\/v1\/ops\/quality$/, async (req, res) => {
    const url = resolveUrl(req);
    const live = String(url.searchParams.get('live') || '').trim().toLowerCase();
    const auth = PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, await service.readOpsQuality({
      mode: live === '1' || live === 'true' ? 'live' : 'fast',
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
      workspaceHint: url.searchParams.get('workspace'),
    }));
  });

  router.register('GET', /^\/api\/v1\/sessions$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    const sessions = await service.readSessions({
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
      sourceUserId: auth.userId,
      limit: readNullableNumber(url, 'limit'),
    });
    PublicApiRouter.sendJson(res, 200, sessions);
  });

  router.register('GET', /^\/api\/v1\/platform\/status$/, async (_req, res) => {
    PublicApiRouter.sendJson(res, 200, service.readPlatformStatus());
  }, { access: 'public' });

  router.register('GET', /^\/api\/v1\/config\/personalization\/validate$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, service.readPersonalizationValidation({
      migrate: readBoolean(url, 'migrate'),
    }));
  });

  router.register('GET', /^\/api\/v1\/platform\/catalog$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, service.readPlatformCatalog({
      selectedId: url.searchParams.get('selectedId'),
      query: url.searchParams.get('q') || url.searchParams.get('query'),
    }));
  }, { access: 'public' });

  router.register('GET', /^\/api\/v1\/nodes$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, service.readNodes({
      selectedNodeId: url.searchParams.get('selectedId'),
    }));
  });

  router.register('GET', /^\/api\/v1\/transports$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, service.readTransports({
      selectedId: url.searchParams.get('selectedId'),
    }));
  });

  router.register('GET', /^\/api\/v1\/artifacts$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    const artifacts = await service.readArtifacts({
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
    });
    PublicApiRouter.sendJson(res, 200, artifacts);
  });

  router.register('GET', /^\/api\/v1\/learning\/status$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, service.readLearningStatus({
      workspace: url.searchParams.get('workspace'),
    }));
  }, { access: 'admin' });

  router.register('GET', /^\/api\/v1\/learning\/candidates$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, service.readLearningCandidates({
      workspace: url.searchParams.get('workspace'),
    }));
  }, { access: 'admin' });

  router.register('GET', /^\/api\/v1\/learning\/metrics$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, service.readLearningMetrics({
      workspace: url.searchParams.get('workspace'),
    }));
  }, { access: 'admin' });

  router.register('POST', /^\/api\/v1\/learning\/actions$/, async (req, res) => {
    const body = await readJsonBody(req);
    PublicApiRouter.sendJson(res, 200, await service.executeLearningAction({
      candidateId: body.candidateId,
      actionId: body.actionId,
      approvalId: body.approvalId,
    }));
  }, { access: 'admin' });

  router.register('GET', /^\/api\/v1\/memory\/status$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, await service.readMemoryStatus({
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
      workspaceHint: url.searchParams.get('workspace'),
    }));
  });

  router.register('GET', /^\/api\/v1\/memory\/search$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, await service.searchMemory({
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
      workspaceHint: url.searchParams.get('workspace'),
      query: url.searchParams.get('q'),
      limit: readNullableNumber(url, 'limit'),
    }));
  });

  router.register('GET', /^\/api\/v1\/memory\/procedures$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.sendJson(res, 200, await service.readMemoryProcedures({
      workspaceHint: url.searchParams.get('workspace'),
    }));
  });

  router.register('GET', /^\/api\/v1\/memory\/metrics$/, async (req, res) => {
    const url = resolveUrl(req);
    const auth = PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, await service.readMemoryMetrics({
      userId: auth.userId,
      sessionId: url.searchParams.get('sessionId'),
      chatId: url.searchParams.get('chatId'),
      workspaceHint: url.searchParams.get('workspace'),
    }));
  });

  router.register('GET', /^\/api\/v1\/memory\/lifecycle$/, async (req, res) => {
    const url = resolveUrl(req);
    PublicApiRouter.requireAuth(req);
    PublicApiRouter.sendJson(res, 200, service.readMemoryLifecycle({
      apply: readBoolean(url, 'apply'),
    }));
  });

  return router;
}
