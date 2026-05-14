import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { config } from '../../../../config/index.js';
import type { HostIdentityStatus } from '../../../../services/HostIdentityService.js';
import type { RuntimeOfficialRemoteAccessAction } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';

export class WebAppHostRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/web/host/status' && req.method === 'GET') {
      const host = deps.runtime.hostIdentityService?.getStatus?.() || null;
      const readiness = await this.inspectReadiness(host, deps);
      const detailMode = String(url.searchParams.get('detail') || 'summary').trim().toLowerCase();
      const includeFullDetail = detailMode === 'full';
      const manifest = deps.accessManifest.buildManifestFromReadiness
        ? deps.accessManifest.buildManifestFromReadiness(readiness)
        : await deps.accessManifest.buildManifest();
      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const surfaceParitySnapshot = requestedSessionId
        ? await deps.realtime.getResolvedSnapshot(requestedSessionId).catch(() => null)
        : null;
      const [installJourney, officialRemoteAccess, remoteAccess] = includeFullDetail
        ? await Promise.all([
          deps.installJourney.run({
            dryRun: true,
            requireMutableAccess: false,
          }),
          deps.officialRemoteAccess.inspect({
            dryRun: true,
            requireMutableAccess: false,
          }),
          deps.remoteAccess.inspect(),
        ])
        : [null, null, null];
      deps.writeJson(
        res,
        {
          ok: true,
          host,
          readiness,
          manifest,
          detailMode,
          installJourney,
          officialRemoteAccess,
          remoteAccess,
          surfaceParity: deps.surfaceParity.buildManifest({
            context: surfaceParitySnapshot
              ? {
                access: manifest,
                continuity: surfaceParitySnapshot.continuity,
                tasks: surfaceParitySnapshot.tasks,
                permissions: surfaceParitySnapshot.permissions,
                workflowRuns: surfaceParitySnapshot.workflowRuns,
              }
              : null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/ops/keepalive' && req.method === 'GET') {
      const runtimeDir = path.resolve(config.projectRoot, 'data', 'runtime');
      const snapshotPath = path.join(runtimeDir, 'ops-remote-keepalive.json');
      if (!fs.existsSync(snapshotPath)) {
        deps.writeJson(
          res,
          {
            ok: false,
            reason: 'snapshot indisponivel',
          },
          404,
        );
        return true;
      }

      try {
        const raw = fs.readFileSync(snapshotPath, 'utf8');
        const snapshot = JSON.parse(raw);
        const updatedAt = String(snapshot?.updatedAt || '');
        const intervalMs = Number(snapshot?.intervalMs || 0);
        const updatedAtMs = Date.parse(updatedAt);
        const stale = !updatedAt || !intervalMs || Number.isNaN(updatedAtMs)
          ? true
          : Date.now() - updatedAtMs > intervalMs * 2;
        deps.writeJson(
          res,
          {
            ok: true,
            snapshot,
            stale,
            now: new Date().toISOString(),
          },
          200,
        );
        return true;
      } catch (error) {
        deps.writeJson(
          res,
          {
            ok: false,
            reason: 'falha ao ler snapshot',
            detail: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/web/host/readiness' && req.method === 'GET') {
      const host = deps.runtime.hostIdentityService?.getStatus?.() || null;
      deps.writeJson(
        res,
        {
          ok: true,
          readiness: await this.inspectReadiness(host, deps),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/host/access-manifest' && req.method === 'GET') {
      const manifest = await deps.accessManifest.buildManifest();
      deps.writeJson(
        res,
        {
          ok: true,
          manifest,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/host/install-journey' && req.method === 'GET') {
      deps.writeJson(
        res,
        {
          ok: true,
          report: await deps.installJourney.run({
            dryRun: true,
            requireMutableAccess: false,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/host/install-journey/actions' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const action = this.normalizeInstallJourneyAction(body.action);
      if (!action) {
        deps.writeJson(res, { ok: false, error: 'action obrigatoria.' }, 400);
        return true;
      }

      try {
        const dryRun = body.dryRun === true;
        const report = await this.runInstallJourneyAction(action, dryRun, body, deps);
        const host = deps.runtime.hostIdentityService?.getStatus?.() || null;
        const readiness = await this.inspectReadiness(host, deps);
        const manifest = deps.accessManifest.buildManifestFromReadiness
          ? deps.accessManifest.buildManifestFromReadiness(readiness)
          : await deps.accessManifest.buildManifest();
        const installJourney = await deps.installJourney.run({
          dryRun: true,
          requireMutableAccess: false,
        });
        const officialRemoteAccess = await deps.officialRemoteAccess.inspect({
          dryRun: true,
          requireMutableAccess: false,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            action,
            report,
            host,
            readiness,
            manifest,
            installJourney,
            officialRemoteAccess,
            remoteAccess: await deps.remoteAccess.inspect(),
          },
          200,
        );
      } catch (error: any) {
        deps.writeJson(
          res,
          { ok: false, error: error?.message || 'Falha ao executar a jornada local do host.' },
          409,
        );
      }
      return true;
    }

    if (pathname === '/api/web/host/remote-access' && req.method === 'GET') {
      deps.writeJson(
        res,
        {
          ok: true,
          report: await deps.remoteAccess.inspect(),
        },
        200,
      );
      return true;
    }

    const isOfficialRemoteGetRoute =
      pathname === '/api/web/host/official-remote-access'
      || pathname === '/api/web/host/official-remote';
    const isOfficialRemoteActionRoute =
      pathname === '/api/web/host/official-remote-access/actions'
      || pathname === '/api/web/host/official-remote/actions';

    if (isOfficialRemoteGetRoute && req.method === 'GET') {
      deps.writeJson(
        res,
        {
          ok: true,
          report: await deps.officialRemoteAccess.inspect({
            dryRun: true,
            requireMutableAccess: false,
          }),
        },
        200,
      );
      return true;
    }

    if (isOfficialRemoteActionRoute && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const action = this.normalizeOfficialRemoteAction(body.action);
      if (!action) {
        deps.writeJson(res, { ok: false, error: 'action obrigatoria.' }, 400);
        return true;
      }

      const provider = this.normalizeOfficialRemoteProvider(body.provider);
      const report = await deps.officialRemoteAccess.runAction(action, {
        provider,
        autoTrustLocal: body.autoTrustLocal !== false,
        dryRun: body.dryRun === true,
        requireMutableAccess: false,
      });

      const manifest = await deps.accessManifest.buildManifest();
      deps.writeJson(
        res,
        {
          ok: true,
          action,
          report,
          host: deps.runtime.hostIdentityService?.getStatus?.() || null,
          readiness: await this.inspectReadiness(deps.runtime.hostIdentityService?.getStatus?.() || null, deps),
          manifest,
          remoteAccess: await deps.remoteAccess.inspect(),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/host/surface-parity' && req.method === 'GET') {
      const manifest = await deps.accessManifest.buildManifest();
      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const surfaceParitySnapshot = requestedSessionId
        ? await deps.realtime.getResolvedSnapshot(requestedSessionId).catch(() => null)
        : null;
      deps.writeJson(
        res,
        {
          ok: true,
          parity: deps.surfaceParity.buildManifest({
            context: surfaceParitySnapshot
              ? {
                access: manifest,
                continuity: surfaceParitySnapshot.continuity,
                tasks: surfaceParitySnapshot.tasks,
                permissions: surfaceParitySnapshot.permissions,
                workflowRuns: surfaceParitySnapshot.workflowRuns,
              }
              : { access: manifest },
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/host/trust' && req.method === 'POST') {
      const authorization = deps.runtime.hostIdentityService?.authorizeCurrentHost?.() || null;
      const host = deps.runtime.hostIdentityService?.getStatus?.() || null;
      const readiness = await this.inspectReadiness(host, deps);
      const manifest = await deps.accessManifest.buildManifest();
      deps.writeJson(
        res,
        {
          ok: true,
          authorization,
          host,
          readiness,
          manifest,
          installJourney: await deps.installJourney.run({
            dryRun: true,
            requireMutableAccess: false,
          }),
          officialRemoteAccess: await deps.officialRemoteAccess.inspect({
            dryRun: true,
            requireMutableAccess: false,
          }),
          remoteAccess: await deps.remoteAccess.inspect(),
          surfaceParity: deps.surfaceParity.buildManifest({
            context: {
              access: manifest,
            },
          }),
        },
        200,
      );
      return true;
    }
    return false;
  }

  private normalizeOfficialRemoteAction(value: unknown): RuntimeOfficialRemoteAccessAction | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'apply' || normalized === 'verify' || normalized === 'rollback' || normalized === 'go') {
      return normalized;
    }
    return null;
  }

  private normalizeInstallJourneyAction(value: unknown): 'go' | 'install' | 'start' | 'ready' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'go' || normalized === 'install' || normalized === 'start' || normalized === 'ready') {
      return normalized;
    }
    return null;
  }

  private normalizeOfficialRemoteProvider(value: unknown): 'local-cloudflare' | 'oracle-cloudflare' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'local-cloudflare' || normalized === 'oracle-cloudflare') {
      return normalized;
    }
    return null;
  }

  private async runInstallJourneyAction(
    action: 'go' | 'install' | 'start' | 'ready',
    dryRun: boolean,
    body: Record<string, any>,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<any> {
    switch (action) {
      case 'go':
      case 'ready': {
        const report = await deps.installJourney.run({
          dryRun,
          timeoutMs: this.normalizePositiveInteger(body.timeoutMs),
          pollIntervalMs: this.normalizePositiveInteger(body.pollIntervalMs),
          requireMutableAccess: false,
        });
        if (
          action === 'go'
          && !dryRun
          && report?.manifest?.local?.ready === true
          && deps.runtime.hostIdentityService?.getStatus?.()?.authorized === false
        ) {
          deps.runtime.hostIdentityService?.authorizeCurrentHost?.();
        }
        return report;
      }
      case 'install':
        if (!deps.bootstrapRepair) {
          throw new Error('Bootstrap repair indisponivel.');
        }
        return deps.bootstrapRepair.repairLive({ dryRun });
      case 'start':
        if (!deps.startupService) {
          throw new Error('Startup do runtime indisponivel.');
        }
        return deps.startupService.startAndWait({
          timeoutMs: this.normalizePositiveInteger(body.timeoutMs),
          pollIntervalMs: this.normalizePositiveInteger(body.pollIntervalMs),
          requireMutableAccess: false,
        });
      default:
        throw new Error('Acao de jornada local indisponivel.');
    }
  }

  private normalizePositiveInteger(value: unknown): number | undefined {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return undefined;
    }
    return Math.floor(normalized);
  }

  private async inspectReadiness(
    hostIdentityStatus: HostIdentityStatus | null,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<any> {
    const authStatus = deps.auth.getStatus();
    return deps.accessReadiness.inspectLive({
      hostIdentityStatus,
      authStatus: {
        enabled: authStatus.enabled,
        source: authStatus.source,
        tokenFile: authStatus.tokenFile,
      },
    });
  }
}

