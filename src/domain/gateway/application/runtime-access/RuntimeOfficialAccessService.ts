import fs from 'fs';
import { config } from '../../../../config/index.js';
import {
  RuntimeAccessManifestService,
  type RuntimeAccessManifest,
} from './RuntimeAccessManifestService.js';
import {
  RuntimeAccessReadinessService,
  type RuntimeAccessReadinessReport,
} from './RuntimeAccessReadinessService.js';
import {
  RuntimeInstallJourneyService,
  type RuntimeInstallJourneyReport,
} from './RuntimeInstallJourneyService.js';
import { isWeakDashboardToken } from '../../../../services/DashboardTokenService.js';

type AccessProbe = {
  ok: boolean;
  targetUrl: string;
  statusCode: number | null;
  error: string | null;
};

type LocalTrustResult = {
  attempted: boolean;
  applied: boolean;
  statusCode: number | null;
  error: string | null;
};

type RuntimeOfficialAccessOptions = {
  dryRun?: boolean;
  autoTrustLocal?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  requireMutableAccess?: boolean;
};

type RuntimeOfficialAccessDeps = {
  installJourneyService?: Pick<RuntimeInstallJourneyService, 'run'>;
  accessReadinessService?: Pick<RuntimeAccessReadinessService, 'inspectLive'>;
  accessManifestService?: Pick<RuntimeAccessManifestService, 'buildManifestFromReadiness'>;
  fetchImpl?: typeof fetch;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  now?: () => Date;
  webAuthToken?: string;
  webAuthTokenFile?: string;
};

export type RuntimeOfficialAccessReport = {
  generatedAt: string;
  summary: string;
  tokenSource: 'env' | 'file' | 'missing';
  journey: RuntimeInstallJourneyReport;
  manifest: RuntimeAccessManifest;
  readiness: RuntimeAccessReadinessReport;
  local: {
    ready: boolean;
    appUrl: string;
    trust: LocalTrustResult;
  };
  remote: {
    configured: boolean;
    appUrl: string | null;
    appProbe: AccessProbe | null;
    authProbe: AccessProbe | null;
    issues: string[];
    ready: boolean;
  };
  nextSteps: string[];
};

export class RuntimeOfficialAccessService {
  private readonly installJourneyService: Pick<RuntimeInstallJourneyService, 'run'>;
  private readonly accessReadinessService: Pick<RuntimeAccessReadinessService, 'inspectLive'>;
  private readonly accessManifestService: Pick<RuntimeAccessManifestService, 'buildManifestFromReadiness'>;
  private readonly fetchImpl: typeof fetch | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly now: () => Date;
  private readonly webAuthToken: string;
  private readonly webAuthTokenFile: string;

  constructor(deps: RuntimeOfficialAccessDeps = {}) {
    this.installJourneyService = deps.installJourneyService || new RuntimeInstallJourneyService();
    this.accessReadinessService = deps.accessReadinessService || new RuntimeAccessReadinessService();
    this.accessManifestService = deps.accessManifestService || new RuntimeAccessManifestService();
    this.fetchImpl = deps.fetchImpl || globalThis.fetch || null;
    this.existsSync = deps.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = deps.readFileSync || fs.readFileSync.bind(fs);
    this.now = deps.now || (() => new Date());
    this.webAuthToken = String(deps.webAuthToken ?? config.zavorthWebAuthToken ?? '').trim();
    this.webAuthTokenFile = String(deps.webAuthTokenFile ?? config.zavorthWebAuthTokenFile ?? '').trim();
  }

  public async prepare(options: RuntimeOfficialAccessOptions = {}): Promise<RuntimeOfficialAccessReport> {
    const journey = await this.installJourneyService.run({
      dryRun: options.dryRun === true,
      timeoutMs: options.timeoutMs,
      pollIntervalMs: options.pollIntervalMs,
      requireMutableAccess: options.requireMutableAccess ?? false,
    });

    let readiness = journey.startup?.readiness || journey.bootstrapRepair.final.supervisedRuntime.accessReadiness;
    let manifest = journey.manifest;
    const tokenResolution = this.resolveWebToken();
    let trustResult: LocalTrustResult = {
      attempted: false,
      applied: Boolean(readiness.runtime.hostAuthorized),
      statusCode: null,
      error: null,
    };

    if (
      options.autoTrustLocal === true
      && options.dryRun !== true
      && readiness.runtime.hostAuthorized === false
      && Boolean(readiness.local.baseUrl)
      && tokenResolution.value.length > 0
      && readiness.runtime.hostSupervisor?.alive === true
    ) {
      trustResult = await this.authorizeLocalHost(readiness.local.baseUrl, tokenResolution.value);
      readiness = await this.accessReadinessService.inspectLive();
      manifest = this.accessManifestService.buildManifestFromReadiness(readiness);
    }

    const remoteAppUrl = manifest.remote.appUrl || (manifest.remote.baseUrl ? `${manifest.remote.baseUrl.replace(/\/+$/, '')}/dashboard` : null);
    const remoteAppProbe = await this.probeUrl(remoteAppUrl, { method: 'GET' });
    const remoteAuthProbe = manifest.remote.baseUrl
      ? await this.probeRemoteAuth(manifest.remote.baseUrl, tokenResolution.value)
      : null;
    const remoteProbeInconclusive = this.isRemoteProbeInconclusive(manifest, remoteAppProbe, remoteAuthProbe);
    const remoteReady = Boolean(
      manifest.remote.ready
      && (
        (remoteAppProbe?.ok && remoteAuthProbe?.ok)
        || remoteProbeInconclusive
      ),
    );
    const remoteIssues = this.buildRemoteIssues(
      manifest,
      tokenResolution.source,
      remoteAppProbe,
      remoteAuthProbe,
      remoteProbeInconclusive,
    );

    return {
      generatedAt: this.now().toISOString(),
      summary: this.buildSummary(manifest, trustResult, remoteReady),
      tokenSource: tokenResolution.source,
      journey,
      manifest,
      readiness,
      local: {
        ready: manifest.local.ready,
        appUrl: manifest.local.appUrl,
        trust: trustResult,
      },
      remote: {
        configured: Boolean(manifest.remote.baseUrl),
        appUrl: remoteAppUrl,
        appProbe: remoteAppProbe,
        authProbe: remoteAuthProbe,
        issues: remoteIssues,
        ready: remoteReady,
      },
      nextSteps: this.buildNextSteps(manifest, tokenResolution.source, trustResult, remoteReady),
    };
  }

  private resolveWebToken(): {
    source: 'env' | 'file' | 'missing';
    value: string;
  } {
    if (this.webAuthToken && !isWeakDashboardToken(this.webAuthToken)) {
      return {
        source: 'env',
        value: this.webAuthToken,
      };
    }

    if (this.webAuthTokenFile && this.existsSync(this.webAuthTokenFile)) {
      const value = String(this.readFileSync(this.webAuthTokenFile, 'utf8') || '').trim();
      if (value) {
        return {
          source: 'file',
          value,
        };
      }
    }

    return {
      source: 'missing',
      value: '',
    };
  }

  private async authorizeLocalHost(baseUrl: string, token: string): Promise<LocalTrustResult> {
    if (!this.fetchImpl) {
      return {
        attempted: true,
        applied: false,
        statusCode: null,
        error: 'fetch indisponivel neste ambiente',
      };
    }
    if (!baseUrl || !token) {
      return {
        attempted: true,
        applied: false,
        statusCode: null,
        error: 'faltou baseUrl local ou token web',
      };
    }

    const targetUrl = `${String(baseUrl || '').replace(/\/+$/, '')}/api/web/host/trust`;
    try {
      const response = await this.fetchImpl(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      return {
        attempted: true,
        applied: Boolean(response.ok && payload?.ok),
        statusCode: response.status,
        error: response.ok ? null : `status ${response.status}`,
      };
    } catch (error: any) {
      return {
        attempted: true,
        applied: false,
        statusCode: null,
        error: String(error?.message || error || 'falha de rede'),
      };
    }
  }

  private async probeRemoteAuth(baseUrl: string, token: string): Promise<AccessProbe | null> {
    if (!baseUrl) {
      return null;
    }
    return this.probeUrl(`${baseUrl.replace(/\/+$/, '')}/api/auth/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  }

  private async probeUrl(targetUrl: string | null, init: RequestInit): Promise<AccessProbe | null> {
    if (!this.fetchImpl || !targetUrl) {
      return null;
    }

    try {
      const response = await this.fetchImpl(targetUrl, init);
      return {
        ok: response.ok,
        targetUrl,
        statusCode: response.status,
        error: response.ok ? null : `status ${response.status}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        targetUrl,
        statusCode: null,
        error: String(error?.message || error || 'falha de rede'),
      };
    }
  }

  private buildSummary(
    manifest: RuntimeAccessManifest,
    trustResult: LocalTrustResult,
    remoteReady: boolean,
  ): string {
    const planSummary = this.buildPlanAlignedSummary(manifest, trustResult, remoteReady);
    if (planSummary) {
      return planSummary;
    }
    if (manifest.local.ready && remoteReady) {
      return 'Zavorth pronto para uso local e remoto pelo caminho oficial.';
    }
    if (manifest.local.ready && (manifest.auth.authorizedHost || trustResult.applied)) {
      return 'Zavorth pronto para uso local; o acesso remoto oficial ainda pede fechamento.';
    }
    return manifest.summary;
  }

  private buildRemoteIssues(
    manifest: RuntimeAccessManifest,
    tokenSource: 'env' | 'file' | 'missing',
    remoteAppProbe: AccessProbe | null,
    remoteAuthProbe: AccessProbe | null,
    remoteProbeInconclusive: boolean,
  ): string[] {
    const issues: string[] = [];

    if (!manifest.remote.baseUrl) {
      issues.push('ZAVORTH_PUBLIC_BASE_URL ainda nao foi configurada.');
    }

    if (manifest.remote.baseUrl && manifest.remote.requiresHttps) {
      issues.push('A URL publica precisa usar HTTPS para a Dashboard remota.');
    }

    if (tokenSource === 'missing') {
      issues.push('ZAVORTH_WEB_AUTH_TOKEN ainda nao foi configurado para a Dashboard remota.');
    }

    if (manifest.remote.baseUrl && !manifest.remote.appUrl) {
      issues.push('A URL publica atual nao gerou um /dashboard remoto valido.');
    }

    if (remoteAppProbe && !remoteAppProbe.ok && !remoteProbeInconclusive) {
      issues.push(
        `O probe do Home remoto falhou em ${remoteAppProbe.targetUrl}${remoteAppProbe.error ? ` (${remoteAppProbe.error})` : ''}.`,
      );
    }

    if (remoteAuthProbe && !remoteAuthProbe.ok && !remoteProbeInconclusive) {
      issues.push(
        `O probe de auth remoto falhou em ${remoteAuthProbe.targetUrl}${remoteAuthProbe.error ? ` (${remoteAuthProbe.error})` : ''}.`,
      );
    }

    return issues;
  }

  private isRemoteProbeInconclusive(
    manifest: RuntimeAccessManifest,
    remoteAppProbe: AccessProbe | null,
    remoteAuthProbe: AccessProbe | null,
  ): boolean {
    if (!manifest.remote.ready) {
      return false;
    }
    return this.isTransportProbeFailure(remoteAppProbe) && this.isTransportProbeFailure(remoteAuthProbe);
  }

  private isTransportProbeFailure(probe: AccessProbe | null): boolean {
    if (!probe || probe.ok) {
      return false;
    }
    return probe.statusCode === null && Boolean(String(probe.error || '').trim());
  }

  private buildNextSteps(
    manifest: RuntimeAccessManifest,
    tokenSource: 'env' | 'file' | 'missing',
    trustResult: LocalTrustResult,
    remoteReady: boolean,
  ): string[] {
    const steps: string[] = [];
    const goCommand = this.resolveOfficialGoCommand(manifest);
    const trustCommand = this.resolveTrustCommand(manifest);
    const primaryStep = this.buildPlanAlignedPrimaryStep(manifest, trustResult, remoteReady);
    if (primaryStep) {
      steps.push(primaryStep);
    }

    if (!manifest.local.ready && !this.hasStepWithCommand(steps, goCommand)) {
      steps.push(`Siga pelo atalho oficial com ${goCommand} para preparar, subir e abrir o Zavorth.`);
    }
    if (
      manifest.auth.authorizedHost === false
      && !trustResult.applied
      && !this.hasStepWithCommand(steps, trustCommand)
    ) {
      steps.push(`Autorize este host com ${trustCommand} ou rode ${goCommand} para aplicar o trust local pelo caminho oficial.`);
    }
    if (tokenSource === 'missing') {
      steps.push('Defina ZAVORTH_WEB_AUTH_TOKEN ou gere o token em arquivo antes de abrir o acesso remoto.');
    }
    if (!manifest.remote.baseUrl) {
      steps.push(`Defina ZAVORTH_PUBLIC_BASE_URL quando quiser expor o runtime por HTTPS; depois rode ${goCommand} para validar a melhor superficie.`);
    } else if (!remoteReady && !this.hasStepWithCommand(steps, goCommand)) {
      steps.push(`Rode ${goCommand} para revalidar o acesso remoto oficial e abrir a melhor superficie disponivel.`);
    }

    return steps.length > 0
      ? steps
      : ['Abra o Home em ' + manifest.local.appUrl + ' ou compartilhe ' + (manifest.remote.appUrl || manifest.remote.baseUrl || manifest.local.appUrl) + '.'];
  }

  private resolveOfficialGoCommand(manifest: RuntimeAccessManifest): string {
    const command = String(manifest.commands.go || '').trim();
    return command || 'zavorth go';
  }

  private resolveTrustCommand(manifest: RuntimeAccessManifest): string {
    const command = String(manifest.commands.trust || '').trim();
    return command || '/hostauth trust';
  }

  private hasStepWithCommand(steps: string[], command: string): boolean {
    const normalized = String(command || '').trim();
    return Boolean(normalized) && steps.some((step) => step.includes(normalized));
  }

  private buildPlanAlignedSummary(
    manifest: RuntimeAccessManifest,
    trustResult: LocalTrustResult,
    remoteReady: boolean,
  ): string | null {
    const plan = manifest.recommendedPlan || null;
    if (!plan) {
      return null;
    }

    if (plan.primaryAction === 'open-local') {
      return remoteReady
        ? 'Zavorth pronto para uso local e remoto pelo caminho oficial.'
        : 'Zavorth pronto para uso local; o acesso remoto oficial ainda pede fechamento.';
    }

    if (plan.primaryAction === 'trust') {
      return trustResult.applied
        ? 'O host foi liberado e o Zavorth ja pode seguir pelo caminho oficial.'
        : 'O runtime ja responde, mas este host ainda precisa de liberacao antes de executar acoes mutaveis.';
    }

    if (plan.primaryAction === 'remote') {
      return 'Zavorth pronto para uso local; o acesso remoto oficial ainda pede fechamento.';
    }

    if (plan.primaryAction === 'go') {
      return 'O caminho oficial ainda precisa preparar o runtime antes de abrir a melhor superficie.';
    }

    return null;
  }

  private buildPlanAlignedPrimaryStep(
    manifest: RuntimeAccessManifest,
    trustResult: LocalTrustResult,
    remoteReady: boolean,
  ): string | null {
    const plan = manifest.recommendedPlan || null;
    if (!plan) {
      return null;
    }

    if (plan.primaryAction === 'trust' && !trustResult.applied) {
      return `Autorize este host com ${plan.primaryCommand || this.resolveTrustCommand(manifest)}.`;
    }

    if (plan.primaryAction === 'remote' && !remoteReady) {
      return `Rode ${this.resolveOfficialGoCommand(manifest)} para revalidar o acesso remoto oficial e abrir a melhor superficie disponivel.`;
    }

    if (plan.primaryAction === 'go' && plan.primaryCommand) {
      return `Siga pelo atalho oficial com ${plan.primaryCommand}.`;
    }

    if (plan.primaryAction === 'open-local' && plan.openTarget) {
      return `Abra o Home em ${plan.openTarget}.`;
    }

    return null;
  }
}
