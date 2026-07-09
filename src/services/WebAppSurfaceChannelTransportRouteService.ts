import * as http from 'http';
import { CHANNEL_MESH_ROUTE_PATHS } from '../contracts/ChannelMeshContract.js';
import { PLATFORM_KEYS, type PlatformKey } from '../contracts/PlatformContract.js';
import type { ChannelInstallMode } from './ChannelInstallScaffoldService.js';
import { NaturalSetupMutationPlannerService } from './NaturalSetupMutationPlannerService.js';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteService.js';

const CHANNEL_INSTALL_MODES = [
  'native',
  'bridge',
  'stub',
  'cloud-api',
  'baileys',
  'signal-cli',
  'mac-bridge',
  'graph-bot',
  'smtp-imap',
] as const;

interface NaturalSetupPreviewResult {
  mutationPlan?: unknown;
  trustDecision?: unknown;
  snapshot?: unknown;
  ok?: boolean;
  status?: string;
  results?: unknown;
  summary?: unknown;
}

interface NaturalSetupApplyResult {
  ok: boolean;
  status: string;
  mutationPlan?: unknown;
  results?: unknown;
  snapshot?: unknown;
  summary?: unknown;
}

interface InstallReportChannelEntry {
  channelId?: string;
  modes?: ChannelInstallMode[];
  [key: string]: unknown;
}

interface NaturalSetupMutationPlannerLike {
  preview: (input: {
    intentText?: string | null;
    channelId?: string | null;
    mode?: string | null;
    apply?: boolean;
    doctor?: boolean;
    test?: boolean;
    localOnly?: boolean;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }) => Promise<NaturalSetupPreviewResult>;
  apply: (input: { planId: string; requestedBy?: string | null }) => Promise<NaturalSetupApplyResult>;
}

export class WebAppSurfaceChannelTransportRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: any,
  ): Promise<boolean> {
    if (pathname === CHANNEL_MESH_ROUTE_PATHS.collection && req.method === 'GET') {
      if (!deps.channelMesh) {
        deps.writeJson(res, { ok: false, error: 'Channel Mesh indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          channels: deps.channelMesh.buildSnapshot({
            selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/channels/setup-assistant' && req.method === 'GET') {
      if (!deps.channelSetupAssistant) {
        deps.writeJson(res, { ok: false, error: 'Assistente de setup de canais indisponivel.' }, 503);
        return true;
      }

      const channelId = String(
        url.searchParams.get('channelId')
        || url.searchParams.get('selectedId')
        || '',
      ).trim().toLowerCase() || null;
      const mode = String(url.searchParams.get('mode') || '').trim().toLowerCase() || null;
      const intentText = String(url.searchParams.get('q') || url.searchParams.get('intentText') || '').trim() || null;
      const assistant = deps.channelSetupAssistant.buildSession({
        channelId,
        mode,
        intentText,
      });

      deps.writeJson(
        res,
        {
          ok: true,
          assistant,
          channels: assistant.channels || deps.channelMesh?.buildSnapshot({
            selectedId: assistant.selected?.channelId || channelId,
          }) || null,
        },
        200,
      );
      return true;
    }

    if (
      pathname.startsWith(`${CHANNEL_MESH_ROUTE_PATHS.collection}/`)
      && pathname !== '/api/web/channels/install'
      && pathname !== '/api/web/channels/install/apply'
      && req.method === 'GET'
    ) {
      if (!deps.channelMesh) {
        deps.writeJson(res, { ok: false, error: 'Channel Mesh indisponivel.' }, 503);
        return true;
      }

      const channelId = this.extractChannelId(pathname);
      if (!channelId) {
        deps.writeJson(res, { ok: false, error: 'channelId obrigatorio.' }, 400);
        return true;
      }

      const snapshot = deps.channelMesh.buildSnapshot({ selectedId: channelId });
      const channel = snapshot.selected;
      if (!channel || String(channel.id || '').trim().toLowerCase() !== channelId) {
        deps.writeJson(res, { ok: false, error: `Canal ${channelId} nao encontrado.` }, 404);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          channel,
          channels: snapshot,
          registry: deps.gatewayChannelRegistry?.getChannel(channelId) || null,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/channels/setup-assistant/apply' && req.method === 'POST') {
      if (!deps.channelSetupAssistant) {
        deps.writeJson(res, { ok: false, error: 'Assistente de setup de canais indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const channelId = String(body?.channelId || body?.selectedId || '').trim().toLowerCase();
        const mode = String(body?.mode || '').trim().toLowerCase() || null;
        const planId = String(body?.planId || body?.mutationPlanId || '').trim();
        if (!channelId && !planId) {
          deps.writeJson(res, { ok: false, error: 'channelId obrigatorio.' }, 400);
          return true;
        }

        const planner = this.buildNaturalSetupMutationPlanner(deps);
        if (planId) {
          const applied = await planner.apply({
            planId,
            requestedBy: deps.runtime?.webUserId || 'web-user',
          });
          deps.writeJson(
            res,
            {
              ok: applied.ok,
              status: applied.status,
              mutationPlan: applied.mutationPlan,
              results: applied.results,
              naturalSetup: applied.snapshot,
              summary: applied.summary,
            },
            applied.status === 'waiting_approval' ? 202 : applied.ok ? 200 : 409,
          );
          return true;
        }

        const preview = await planner.preview({
          channelId,
          mode,
          apply: true,
          localOnly: body?.localOnly === true,
          requestedBy: deps.runtime?.webUserId || 'web-user',
          sourceSurface: 'web',
        });
        deps.writeJson(
          res,
          {
            ok: false,
            status: 'waiting_approval',
            mutationPlan: preview.mutationPlan,
            trustDecision: preview.trustDecision,
            naturalSetup: preview.snapshot,
          },
          202,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao aplicar setup assistido do canal.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/channels/setup-assistant/doctor' && req.method === 'POST') {
      if (!deps.channelSetupAssistant) {
        deps.writeJson(res, { ok: false, error: 'Assistente de setup de canais indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const planId = String(body?.planId || body?.mutationPlanId || '').trim();
        const planner = this.buildNaturalSetupMutationPlanner(deps);
        if (planId) {
          const applied = await planner.apply({
            planId,
            requestedBy: deps.runtime?.webUserId || 'web-user',
          });
          deps.writeJson(
            res,
            {
              ok: applied.ok,
              status: applied.status,
              mutationPlan: applied.mutationPlan,
              results: applied.results,
              naturalSetup: applied.snapshot,
              summary: applied.summary,
            },
            applied.status === 'waiting_approval' ? 202 : applied.ok ? 200 : 409,
          );
          return true;
        }

        const preview = await planner.preview({
          channelId: String(body?.selectedId || body?.channelId || '').trim() || null,
          doctor: true,
          localOnly: body?.localOnly === true,
          requestedBy: deps.runtime?.webUserId || 'web-user',
          sourceSurface: 'web',
        });
        deps.writeJson(
          res,
          {
            ok: false,
            status: 'waiting_approval',
            mutationPlan: preview.mutationPlan,
            trustDecision: preview.trustDecision,
            naturalSetup: preview.snapshot,
          },
          202,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao executar doctor assistido do canal.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/channels/setup-assistant/turn' && req.method === 'POST') {
      if (!deps.naturalChannelSetupTurn) {
        deps.writeJson(res, { ok: false, error: 'Fluxo natural de setup de canais indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const result = await deps.naturalChannelSetupTurn.buildTurn({
          intentText: String(body?.intentText || body?.text || '').trim() || null,
          channelId: String(body?.channelId || body?.selectedId || '').trim().toLowerCase() || null,
          mode: String(body?.mode || '').trim().toLowerCase() || null,
          requestedBy: deps.runtime?.webUserId || 'web-user',
          autoApply: body?.autoApply === true,
          autoDoctor: body?.autoDoctor === true,
          autoTest: body?.autoTest === true,
          localOnly: body?.localOnly === true,
          previewOnly: true,
        });
        deps.writeJson(res, {
          ok: true,
          ...result,
          channels: result.assistant.channels || deps.channelMesh?.buildSnapshot({
            selectedId: result.assistant.selected?.channelId || result.channelId || null,
          }) || null,
        }, 200);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao executar o fluxo natural de setup do canal.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === CHANNEL_MESH_ROUTE_PATHS.actions && req.method === 'POST') {
      if (!deps.channelMesh || !deps.channelActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes do Channel Mesh indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const channelId = String(body?.channelId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.channelActions.execute({
          channelId,
          actionId,
          requestedBy: deps.runtime?.webUserId || 'web-user',
        });
        deps.writeJson(res, {
          ok: true,
          result,
          channels: deps.channelMesh.buildSnapshot({ selectedId: channelId }),
        }, 200);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao executar a acao do Channel Mesh.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/channels/install' && req.method === 'GET') {
      if (!deps.channelInstall) {
        deps.writeJson(res, { ok: false, error: 'Plano de scaffold de canais indisponivel.' }, 503);
        return true;
      }

      const report = deps.channelInstall.buildReport();
      const selectedId = String(url.searchParams.get('selectedId') || '').trim().toLowerCase() || null;
      const requestedMode = String(url.searchParams.get('mode') || '').trim().toLowerCase();
      const selected = Array.isArray(report?.channels)
        ? report.channels.find((entry: InstallReportChannelEntry) => String(entry?.channelId || '').trim().toLowerCase() === selectedId)
          || report.channels[0]
          || null
        : null;
      const modeScopedSelected =
        selectedId
        && requestedMode
        && PLATFORM_KEYS.includes(selectedId as PlatformKey)
        && (CHANNEL_INSTALL_MODES as readonly string[]).includes(requestedMode)
        && typeof deps.channelInstall.buildPlanForChannel === 'function'
          ? deps.channelInstall.buildPlanForChannel(
            selectedId as PlatformKey,
            requestedMode as ChannelInstallMode,
          )
          : null;

      deps.writeJson(
        res,
        {
          ok: true,
          report,
          selected: modeScopedSelected || selected,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/channels/install/apply' && req.method === 'POST') {
      if (!deps.channelInstall) {
        deps.writeJson(res, { ok: false, error: 'Plano de scaffold de canais indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const channelId = String(body?.channelId || '').trim().toLowerCase();
        const mode = String(body?.mode || '').trim().toLowerCase();
        if (!channelId) {
          deps.writeJson(res, { ok: false, error: 'channelId obrigatorio.' }, 400);
          return true;
        }
        if (!mode) {
          deps.writeJson(res, { ok: false, error: 'mode obrigatorio.' }, 400);
          return true;
        }
        if (!PLATFORM_KEYS.includes(channelId as PlatformKey)) {
          deps.writeJson(res, { ok: false, error: 'channelId invalido.' }, 400);
          return true;
        }
        if (!(CHANNEL_INSTALL_MODES as readonly string[]).includes(mode)) {
          deps.writeJson(res, { ok: false, error: 'mode invalido.' }, 400);
          return true;
        }

        const installReport = deps.channelInstall.buildReport();
        const selected = Array.isArray(installReport?.channels)
          ? installReport.channels.find((entry: InstallReportChannelEntry) => String(entry?.channelId || '').trim().toLowerCase() === channelId) || null
          : null;
        const selectedMode = selected && Array.isArray(selected?.modes) && selected.modes.length > 0
          ? selected.modes.find((entry: ChannelInstallMode) => String(entry || '').trim().toLowerCase() === mode) || null
          : (mode as ChannelInstallMode);
        if (!selectedMode) {
          deps.writeJson(res, { ok: false, error: `Modo ${mode} nao suportado por ${channelId}.` }, 400);
          return true;
        }

        const applyReport = await deps.channelInstall.applyScaffold({
          channelId: (selected?.channelId || channelId) as PlatformKey,
          mode: selectedMode,
          extraEntries: Array.isArray(body?.extraEntries) ? body.extraEntries : [],
        });

        deps.writeJson(
          res,
          {
            ok: true,
            applyReport,
            report: applyReport?.report || deps.channelInstall.buildReport(),
            channels: deps.channelMesh?.buildSnapshot({ selectedId: String(selected?.channelId || channelId) }) || null,
          },
          200,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao aplicar o scaffold do canal.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/channels/doctor' && req.method === 'POST') {
      if (!deps.channelProviderDoctor) {
        deps.writeJson(res, { ok: false, error: 'Doctor dos canais indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const doctor = await deps.channelProviderDoctor.run({
          localOnly: body?.localOnly === true,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            doctor,
            channels: deps.channelMesh?.buildSnapshot({
              selectedId: String(body?.selectedId || '').trim() || null,
            }) || null,
          },
          200,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao executar o doctor dos canais.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    return this.handleTransportMutation(req, res, url, pathname, deps);
  }

  private async handleTransportMutation(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: any,
  ): Promise<boolean> {
    if (
      pathname.startsWith(`${CHANNEL_MESH_ROUTE_PATHS.collection}/`)
      && pathname !== '/api/web/channels/install'
      && pathname !== '/api/web/channels/install/apply'
      && req.method === 'POST'
    ) {
      const channelId = this.extractChannelId(pathname);
      const operation = this.extractChannelOperation(pathname);
      if (!channelId || !operation) {
        return false;
      }

      if (!deps.channelMesh || !deps.gatewayChannelRouter || !deps.runtime) {
        deps.writeJson(res, { ok: false, error: 'Plano canonico de canais indisponivel.' }, 503);
        return true;
      }

      const snapshot = deps.channelMesh.buildSnapshot({ selectedId: channelId });
      const meshChannel = snapshot?.selected || null;
      const registryChannel = deps.gatewayChannelRouter.getChannel(channelId) || deps.gatewayChannelRegistry?.getChannel(channelId) || null;
      const channel = meshChannel || registryChannel || null;
      if (!channel) {
        deps.writeJson(res, { ok: false, error: `Canal ${channelId} nao encontrado.` }, 404);
        return true;
      }
      const features = channel?.features || registryChannel?.features || null;

      try {
        const body = await deps.readJsonBody(req);
        if (operation === 'send') {
          if (features?.sessionSend !== true) {
            deps.writeJson(res, { ok: false, error: `Canal ${channelId} nao aceita sessions_send no contrato atual.` }, 400);
            return true;
          }
          const text = String(body?.message || body?.text || '').trim();
          if (!text) {
            deps.writeJson(res, { ok: false, error: 'message obrigatoria.' }, 400);
            return true;
          }

          const result = await deps.gatewayChannelRouter.sendToSession({
            userId: deps.runtime.webUserId,
            platform: channelId,
            chatId: String(body?.chatId || '').trim() || null,
            sessionId: String(body?.sessionId || '').trim() || null,
            sourceUserId: String(body?.sourceUserId || '').trim() || null,
            text,
            composerPayload: body?.composerPayload || null,
            mentions: Array.isArray(body?.mentions) ? body.mentions : [],
          });
          deps.writeJson(res, { ok: true, result, channel, channels: snapshot }, 200);
          return true;
        }

        if (features?.sessionSpawn !== true) {
          deps.writeJson(res, { ok: false, error: `Canal ${channelId} nao aceita sessions_spawn no contrato atual.` }, 400);
          return true;
        }
        const result = deps.gatewayChannelRouter.spawnSession({
          userId: deps.runtime.webUserId,
          platform: channelId,
        });
        deps.writeJson(res, { ok: true, result, channel, channels: snapshot }, 200);
        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao operar o canal.';
        deps.writeJson(res, { ok: false, error: message }, 400);
        return true;
      }
    }

    if (pathname === '/api/web/transports' && req.method === 'GET') {
      if (!deps.remoteTransports) {
        deps.writeJson(res, { ok: false, error: 'Plano de transportes remotos indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          transports: deps.remoteTransports.buildSnapshot({
            selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/transports/actions' && req.method === 'POST') {
      if (!deps.remoteTransports || !deps.remoteTransportActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes do plano remoto indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const transportId = String(body?.transportId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.remoteTransportActions.execute({
          transportId,
          actionId,
          requestedBy: deps.runtime?.webUserId || 'web-user',
        });
        deps.writeJson(res, {
          ok: true,
          result,
          transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
        }, 200);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao executar a acao do plano remoto.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname.startsWith('/api/web/transports/') && req.method === 'GET') {
      const transportId = this.extractTransportId(pathname);
      const operation = this.extractTransportOperation(pathname);
      if (!transportId || operation !== 'history') {
        return false;
      }
      if (!deps.remoteTransports) {
        deps.writeJson(res, { ok: false, error: 'Plano de transportes remotos indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          transport: deps.remoteTransports.buildSnapshot({ selectedId: transportId }).selected,
          transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
          history: deps.remoteTransportActions?.readHistory
            ? deps.remoteTransportActions.readHistory({ transportId, limit: 10 })
            : null,
          doctor: deps.remoteTransportDoctor?.readLastReport
            ? deps.remoteTransportDoctor.readLastReport({ selectedId: transportId })
            : null,
        },
        200,
      );
      return true;
    }

    if (pathname.startsWith('/api/web/transports/') && req.method === 'POST') {
      const transportId = this.extractTransportId(pathname);
      const operation = this.extractTransportOperation(pathname);
      if (!transportId || !operation || !['doctor', 'recover'].includes(operation)) {
        return false;
      }
      if (!deps.remoteTransports) {
        deps.writeJson(res, { ok: false, error: 'Plano de transportes remotos indisponivel.' }, 503);
        return true;
      }
      if (operation === 'doctor') {
        if (!deps.remoteTransportDoctor) {
          deps.writeJson(res, { ok: false, error: 'Doctor do plano remoto indisponivel.' }, 503);
          return true;
        }

        try {
          const report = await deps.remoteTransportDoctor.run({ selectedId: transportId });
          deps.writeJson(
            res,
            {
              ok: report.status !== 'failed',
              report,
              transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
            },
            report.status === 'failed' ? 409 : 200,
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Falha ao rodar o doctor remoto.';
          deps.writeJson(res, { ok: false, error: message }, 400);
        }
        return true;
      }

      if (!deps.remoteTransportActions) {
        deps.writeJson(res, { ok: false, error: 'Recover do plano remoto indisponivel.' }, 503);
        return true;
      }

      try {
        const result = await deps.remoteTransportActions.execute({
          transportId,
          actionId: 'repair',
          requestedBy: deps.runtime?.webUserId || 'web-user',
          workspace: deps.workspaceRoot,
        });
        deps.writeJson(
          res,
          {
            ok: result.ok,
            result,
            transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
            history: deps.remoteTransportActions.readHistory
              ? deps.remoteTransportActions.readHistory({ transportId, limit: 10 })
              : null,
          },
          result.ok ? 200 : 409,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao recuperar o transporte remoto.';
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    return false;
  }

  private buildNaturalSetupMutationPlanner(deps: any): NaturalSetupMutationPlannerLike {
    return deps.naturalSetupMutationPlanner || new NaturalSetupMutationPlannerService({
      controlPlaneService: deps.naturalSetupControlPlane || undefined,
      channelSetupAssistant: deps.channelSetupAssistant || null,
      channelActions: deps.channelActions || null,
    });
  }

  private extractChannelId(pathname: string): string | null {
    const prefix = `${CHANNEL_MESH_ROUTE_PATHS.collection}/`;
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const suffix = pathname.slice(prefix.length);
    const [channelId] = suffix.split('/');
    const normalized = String(channelId || '').trim().toLowerCase();
    return normalized || null;
  }

  private extractChannelOperation(pathname: string): 'send' | 'spawn' | null {
    const prefix = `${CHANNEL_MESH_ROUTE_PATHS.collection}/`;
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const suffix = pathname.slice(prefix.length);
    const parts = suffix.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    if (parts[1] === 'send' || parts[1] === 'spawn') {
      return parts[1];
    }
    return null;
  }

  private extractTransportId(pathname: string): string | null {
    const prefix = '/api/web/transports/';
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const suffix = pathname.slice(prefix.length);
    const [transportId] = suffix.split('/');
    const normalized = String(transportId || '').trim().toLowerCase();
    return normalized || null;
  }

  private extractTransportOperation(pathname: string): 'history' | 'doctor' | 'recover' | null {
    const prefix = '/api/web/transports/';
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const suffix = pathname.slice(prefix.length);
    const parts = suffix.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    if (parts[1] === 'history' || parts[1] === 'doctor' || parts[1] === 'recover') {
      return parts[1];
    }
    return null;
  }
}
