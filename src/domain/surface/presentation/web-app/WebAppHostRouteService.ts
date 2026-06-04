import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { config } from '../../../../config/index.js';
import type { HostIdentityStatus } from '../../../../services/HostIdentityService.js';
import { DiskMutationGateService } from '../../../../services/DiskMutationGateService.js';
import { ProjectConstitutionImportService } from '../../../../services/ProjectConstitutionImportService.js';
import { AcpGenericChannelAdapterService } from '../../../../services/AcpGenericChannelAdapterService.js';
import { ZavorthExternalAgentGatewayService } from '../../../../services/ZavorthExternalAgentGatewayService.js';
import { ZavorthAgentReviewService } from '../../../../services/ZavorthAgentReviewService.js';
import { ZavorthGitWorkflowService, type ZavorthGitWorkflowAction } from '../../../../services/ZavorthGitWorkflowService.js';
import type { RuntimeOfficialRemoteAccessAction } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type {
  ZavorthExternalAgentAdapterKind,
  ZavorthExternalAgentIsolationKind,
  ZavorthExternalAgentNetworkMode,
} from '../../../../contracts/ZavorthExternalAgentGatewayContract.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';

export class WebAppHostRouteService {
  private readonly diskMutationGate = new DiskMutationGateService();
  private readonly gitWorkflow = new ZavorthGitWorkflowService();
  private readonly agentReview = new ZavorthAgentReviewService();
  private readonly projectConstitutionImporter = new ProjectConstitutionImportService();
  private readonly acpGenericChannelAdapter = new AcpGenericChannelAdapterService();
  private readonly externalAgentGateway = new ZavorthExternalAgentGatewayService();

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
      const surfaceConsistencySnapshot = requestedSessionId
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
          surfaceConsistency: deps.surfaceConsistency.buildManifest({
            context: surfaceConsistencySnapshot
              ? {
                access: manifest,
                continuity: surfaceConsistencySnapshot.continuity,
                tasks: surfaceConsistencySnapshot.tasks,
                permissions: surfaceConsistencySnapshot.permissions,
                workflowRuns: surfaceConsistencySnapshot.workflowRuns,
              }
              : null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/project-constitution/import' && req.method === 'GET') {
      try {
        const workspaceRoot = this.resolveLocalWorkspace(url.searchParams.get('workspaceRoot'));
        deps.writeJson(res, {
          ok: true,
          status: this.projectConstitutionImporter.buildStatus({ workspaceRoot }),
        }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao inspecionar constituicao do projeto.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/project-constitution/import' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const workspaceRoot = this.resolveLocalWorkspace(body.workspaceRoot);
        const action = String(body.action || 'preview').trim().toLowerCase();
        if (action === 'apply') {
          const result = this.projectConstitutionImporter.applyPreview({
            workspaceRoot,
            previewId: String(body.previewId || '').trim(),
            approvalPhrase: String(body.approvalPhrase || '').trim(),
            approvedBy: String(body.approvedBy || deps.runtime.webUserId || 'dashboard').trim() || 'dashboard',
          });
          deps.writeJson(res, { ok: true, result }, 200);
          return true;
        }

        const preview = this.projectConstitutionImporter.createPreview({
          workspaceRoot,
          sourcePaths: Array.isArray(body.sourcePaths) ? body.sourcePaths.map((entry: unknown) => String(entry || '')) : null,
        });
        deps.writeJson(res, { ok: true, preview }, preview.status === 'preview_ready' ? 200 : 404);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao preparar importacao da constituicao.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/disk-mutation-gate' && req.method === 'GET') {
      try {
        const workspaceRoot = this.resolveLocalWorkspace(url.searchParams.get('workspaceRoot'));
        deps.writeJson(res, {
          ok: true,
          status: this.diskMutationGate.buildStatus({
            workspaceRoot,
            limit: this.normalizePositiveInteger(url.searchParams.get('limit')),
          }),
        }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao inspecionar gate de mutacao em disco.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/disk-mutation-gate' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const workspaceRoot = this.resolveLocalWorkspace(body.workspaceRoot);
        const action = String(body.action || 'preview').trim().toLowerCase();
        if (action === 'apply') {
          const result = this.diskMutationGate.applyPreview({
            workspaceRoot,
            previewId: String(body.previewId || '').trim(),
            approvalPhrase: String(body.approvalPhrase || '').trim(),
            approvedBy: String(body.approvedBy || deps.runtime.webUserId || 'dashboard').trim() || 'dashboard',
          });
          deps.writeJson(res, { ok: true, result }, 200);
          return true;
        }

        const preview = this.diskMutationGate.createPreview({
          workspaceRoot,
          operations: Array.isArray(body.operations) ? body.operations : [],
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || 'dashboard').trim() || 'dashboard',
          sourceSurface: String(body.sourceSurface || 'dashboard').trim() || 'dashboard',
          reason: String(body.reason || '').trim() || null,
        });
        deps.writeJson(res, { ok: true, preview }, preview.status === 'blocked' ? 409 : 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao preparar gate de mutacao em disco.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/git/status' && req.method === 'GET') {
      try {
        const workspaceRoot = this.resolveLocalWorkspace(url.searchParams.get('workspaceRoot'));
        const snapshot = await this.gitWorkflow.run({
          action: 'status',
          workspaceRoot,
        });
        deps.writeJson(res, { ok: true, snapshot }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao inspecionar Git workflow.' }, 400);
      }
      return true;
    }

    const gitWorkflowMatch = pathname.match(/^\/api\/web\/git\/(branch|commit|pr)$/);
    if (gitWorkflowMatch && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const workspaceRoot = this.resolveLocalWorkspace(body.workspaceRoot);
        const action = gitWorkflowMatch[1] as ZavorthGitWorkflowAction;
        const snapshot = await this.gitWorkflow.run({
          action,
          workspaceRoot,
          args: Array.isArray(body.args) ? body.args.map((entry: unknown) => String(entry || '')) : String(body.args || ''),
          apply: body.apply === true,
          approvalId: String(body.approvalId || '').trim() || null,
          approvedBy: String(body.approvedBy || deps.runtime.webUserId || 'dashboard').trim() || 'dashboard',
        });
        deps.writeJson(res, { ok: snapshot.status !== 'failed' && snapshot.status !== 'blocked', snapshot }, snapshot.status === 'blocked' ? 409 : 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar Git workflow.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/review' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const workspaceRoot = this.resolveLocalWorkspace(body.workspaceRoot);
        const snapshot = await this.agentReview.run({
          objective: String(body.objective || body.args || '').trim() || null,
          workspace: workspaceRoot,
          target: body.target === 'provided' || body.target === 'github-pr' || body.target === 'workspace-diff' ? body.target : null,
          mode: body.mode === 'security-review' || body.mode === 'policy-review' || body.mode === 'regression-review' || body.mode === 'code-review'
            ? body.mode
            : null,
          baseRef: String(body.baseRef || body.base || '').trim() || null,
          targetRef: String(body.targetRef || body.head || '').trim() || null,
          prTarget: String(body.prTarget || body.pr || '').trim() || null,
          repo: String(body.repo || '').trim() || null,
          diffText: String(body.diffText || '').trim() || null,
          postComment: body.postComment === true,
          applyPatch: body.applyPatch === true,
          launchLiveAgents: body.launchLiveAgents === true,
          approvalId: String(body.approvalId || '').trim() || null,
          userId: String(body.userId || deps.runtime.webUserId || 'dashboard').trim() || 'dashboard',
          sessionId: String(body.sessionId || '').trim() || 'dashboard-review',
        });
        deps.writeJson(res, { ok: true, snapshot }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar review governado.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/acp-generic-channel-adapter' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        snapshot: this.acpGenericChannelAdapter.buildSnapshot(),
      }, 200);
      return true;
    }

    if (pathname === '/api/web/acp-generic-channel-adapter' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const receipt = this.acpGenericChannelAdapter.ingest(body.frame || body, {
          emitGatewayEvent: false,
          receiptPath: String(body.receiptPath || '').trim() || null,
        });
        const ok = receipt.status !== 'blocked' && receipt.status !== 'failed';
        deps.writeJson(
          res,
          { ok, receipt },
          receipt.status === 'approval_required'
            ? 202
            : ok
              ? 200
              : 409,
        );
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao normalizar frame ACP generico.' }, 400);
      }
      return true;
    }

    if ((pathname === '/api/web/zavorth-runtime-adapters' || pathname === '/api/web/external-agents') && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        snapshot: this.externalAgentGateway.buildDashboardSnapshot(),
      }, 200);
      return true;
    }

    if ((pathname === '/api/web/zavorth-runtime-adapters/register' || pathname === '/api/web/external-agents/register') && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const receipt = this.externalAgentGateway.registerProfile({
          id: this.cleanOptionalString(body.id || body.profileId),
          label: this.cleanOptionalString(body.label || body.name),
          adapter: this.normalizeExternalAgentAdapter(body.adapter),
          root: this.cleanOptionalString(body.root || body.workspaceRoot),
          command: this.cleanOptionalString(body.command),
          args: this.normalizeStringArray(body.args),
          endpoint: this.cleanOptionalString(body.endpoint || body.url),
          acpServerId: this.cleanOptionalString(body.acpServerId || body.serverId),
          acpTransport: this.normalizeExternalAgentAcpTransport(body.acpTransport || body.transport),
          promptMode: this.normalizeExternalAgentPromptMode(body.promptMode),
          allowedCapabilities: this.normalizeStringArray(body.allowedCapabilities || body.capabilities),
          enableLive: body.enableLive === true || body.liveExecutionEnabled === true,
          allowRemoteNetwork: body.allowRemoteNetwork === true,
          isolation: this.normalizeExternalAgentIsolation(body.isolation),
          sandboxImage: this.cleanOptionalString(body.sandboxImage),
          dockerImage: this.cleanOptionalString(body.dockerImage || body.image),
          wslDistro: this.cleanOptionalString(body.wslDistro || body.distro),
          workspaceMount: this.cleanOptionalString(body.workspaceMount),
          sandboxWorkdir: this.cleanOptionalString(body.sandboxWorkdir),
          workingDirectory: this.cleanOptionalString(body.workingDirectory || body.cwd),
          network: this.normalizeExternalAgentNetwork(body.network),
          readOnlyRoot: body.readOnlyRoot !== false,
          requireStrongIsolation: body.requireStrongIsolation === true,
          requestedBy: this.cleanOptionalString(body.requestedBy) || deps.runtime.webUserId || 'dashboard',
          approvalGranted: body.approvalGranted === true || body.approveRegistration === true,
          onboardingCandidateId: this.cleanOptionalString(body.onboardingCandidateId),
          source: 'api',
        });
        const ok = receipt.status === 'registered';
        deps.writeJson(res, {
          ok,
          receipt,
          snapshot: this.externalAgentGateway.buildDashboardSnapshot(),
        }, ok ? 200 : 202);
      } catch (error: any) {
        deps.writeJson(res, {
          ok: false,
          error: error?.message || 'Falha ao registrar agente externo.',
          snapshot: this.externalAgentGateway.buildDashboardSnapshot(),
        }, 400);
      }
      return true;
    }

    if ((pathname === '/api/web/zavorth-runtime-adapters/invoke' || pathname === '/api/web/external-agents/invoke') && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const receipt = await this.externalAgentGateway.invoke({
          profileId: String(body.profileId || body.id || '').trim(),
          prompt: String(body.prompt || body.text || '').trim(),
          requestedBy: this.cleanOptionalString(body.requestedBy) || deps.runtime.webUserId || 'dashboard',
          approvalGranted: body.approvalGranted === true || body.approveExternalExecution === true,
          dryRun: body.dryRun === true,
          timeoutMs: this.normalizePositiveInteger(body.timeoutMs) || null,
          receiptPath: this.cleanOptionalString(body.receiptPath),
        });
        const ok = receipt.status !== 'blocked' && receipt.status !== 'failed';
        deps.writeJson(res, {
          ok,
          receipt,
          snapshot: this.externalAgentGateway.buildDashboardSnapshot(),
        }, receipt.status === 'approval-required' ? 202 : ok ? 200 : receipt.status === 'failed' ? 500 : 409);
      } catch (error: any) {
        deps.writeJson(res, {
          ok: false,
          error: error?.message || 'Falha ao executar agente externo.',
          snapshot: this.externalAgentGateway.buildDashboardSnapshot(),
        }, 400);
      }
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

    if (pathname === '/api/web/host/surface-consistency' && req.method === 'GET') {
      const manifest = await deps.accessManifest.buildManifest();
      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const surfaceConsistencySnapshot = requestedSessionId
        ? await deps.realtime.getResolvedSnapshot(requestedSessionId).catch(() => null)
        : null;
      deps.writeJson(
        res,
        {
          ok: true,
          consistency: deps.surfaceConsistency.buildManifest({
            context: surfaceConsistencySnapshot
              ? {
                access: manifest,
                continuity: surfaceConsistencySnapshot.continuity,
                tasks: surfaceConsistencySnapshot.tasks,
                permissions: surfaceConsistencySnapshot.permissions,
                workflowRuns: surfaceConsistencySnapshot.workflowRuns,
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
          surfaceConsistency: deps.surfaceConsistency.buildManifest({
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

  private normalizeExternalAgentAdapter(value: unknown): ZavorthExternalAgentAdapterKind | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'cli' || normalized === 'http' || normalized === 'acp' || normalized === 'mcp') {
      return normalized;
    }
    return null;
  }

  private normalizeExternalAgentIsolation(value: unknown): ZavorthExternalAgentIsolationKind | 'local' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'docker' || normalized === 'wsl' || normalized === 'local' || normalized === 'local-supervised') {
      return normalized;
    }
    return null;
  }

  private normalizeExternalAgentNetwork(value: unknown): ZavorthExternalAgentNetworkMode | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'disabled' || normalized === 'local-only' || normalized === 'profile') {
      return normalized;
    }
    return null;
  }

  private normalizeExternalAgentPromptMode(value: unknown): 'stdin' | 'arg' | 'json' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'stdin' || normalized === 'arg' || normalized === 'json') {
      return normalized;
    }
    return null;
  }

  private normalizeExternalAgentAcpTransport(value: unknown): 'mock-jsonrpc' | 'stdio-jsonrpc' | 'acp-sdk-stdio' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'mock-jsonrpc' || normalized === 'stdio-jsonrpc' || normalized === 'acp-sdk-stdio') {
      return normalized;
    }
    return null;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || '').trim()).filter(Boolean);
    }
    const text = String(value || '').trim();
    if (!text) return [];
    return text.split(/\s+/).map((entry) => entry.trim()).filter(Boolean);
  }

  private cleanOptionalString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
  }

  private resolveLocalWorkspace(value: unknown): string {
    const requested = String(value || '').trim();
    const workspaceRoot = path.resolve(requested || config.defaultWorkspace || config.projectRoot);
    const allowedRoot = path.resolve(config.workspaceRoot || config.projectRoot);
    const projectRoot = path.resolve(config.projectRoot);
    if (workspaceRoot !== projectRoot && !this.isInsidePath(allowedRoot, workspaceRoot)) {
      throw new Error('Workspace fora do escopo local autorizado.');
    }
    return workspaceRoot;
  }

  private isInsidePath(parent: string, child: string): boolean {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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

