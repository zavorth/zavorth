import { config } from '../config/index.js';
import { ZavorthBridgeRemoteDoctorService } from './ZavorthBridgeRemoteDoctorService.js';
import { SidecarStatusService } from './SidecarStatusService.js';

export type ExternalServiceSmokeStep = {
  label: string;
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  output?: string;
};

type ExternalServiceSmokeServiceOptions = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  sidecarStatusService?: Pick<SidecarStatusService, 'readSummary'>;
  zavorthBridgeRemoteDoctorService?: Pick<ZavorthBridgeRemoteDoctorService, 'run'>;
};

type ExternalSmokeTarget = 'AIGateway' | 'zavorth-bridge-remote';

export class ExternalServiceSmokeService {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  private readonly sidecarStatusService: Pick<SidecarStatusService, 'readSummary'>;
  private readonly zavorthBridgeRemoteDoctorService: Pick<ZavorthBridgeRemoteDoctorService, 'run'>;

  constructor(options: ExternalServiceSmokeServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.fetchImpl = options.fetchImpl || fetch;
    this.sidecarStatusService = options.sidecarStatusService || new SidecarStatusService();
    this.zavorthBridgeRemoteDoctorService =
      options.zavorthBridgeRemoteDoctorService || new ZavorthBridgeRemoteDoctorService();
  }

  public async run(input: {
    targetFile: string;
    validationHints?: string[];
    supervisedRuntime?: boolean;
    domains?: string[];
  }): Promise<ExternalServiceSmokeStep[]> {
    const targets = this.inferTargets(input.targetFile, input.validationHints || [], input.domains || []);
    const steps = await Promise.all(
      Array.from(targets).map((target) => {
        if (target === 'AIGateway') {
          return this.runAIGatewaySmoke(input.supervisedRuntime === true);
        }
        return this.runZavorthBridgeRemoteSmoke(input.supervisedRuntime === true);
      }),
    );
    return steps;
  }

  private inferTargets(targetFile: string, validationHints: string[], domains: string[]): Set<ExternalSmokeTarget> {
    const normalizedItems = [targetFile, ...validationHints, ...domains]
      .map((entry) => String(entry || '').replace(/\\/g, '/').trim().toLowerCase())
      .filter(Boolean);
    const targets = new Set<ExternalSmokeTarget>();

    if (
      domains.includes('launcher') ||
      domains.includes('host') ||
      domains.includes('telegram') ||
      normalizedItems.some((entry) =>
        entry.includes('AIGateway') ||
        entry.includes('src/index.ts') ||
        entry.includes('src/host.ts') ||
        entry.includes('runtimebootstrap') ||
        entry.includes('supervisedruntime'),
      )
    ) {
      targets.add('AIGateway');
    }

    if (
      domains.includes('launcher') ||
      normalizedItems.some((entry) => entry.includes('zavorthBridge') || entry.includes('remote'))
    ) {
      targets.add('zavorth-bridge-remote');
    }

    return targets;
  }

  private async runAIGatewaySmoke(supervisedRuntime: boolean): Promise<ExternalServiceSmokeStep> {
    if (!config.AIGatewaySidecarEnabled) {
      return this.createSkippedStep('AIGateway-smoke', 'AIGateway sidecar desativado nesta configuracao.');
    }
    if (!supervisedRuntime) {
      return this.createSkippedStep(
        'AIGateway-smoke',
        'Smoke externo do AIGateway so roda durante validacoes sob runtime supervisionado.',
      );
    }

    return this.runAsyncStep('AIGateway-smoke', 'GET /models no AIGateway', async () => {
      const sidecars = this.sidecarStatusService.readSummary();
      const snapshot = sidecars.AIGateway;
      if (!snapshot.ready || !snapshot.baseUrl) {
        throw new Error(snapshot.message || 'AIGateway nao esta pronto para smoke test.');
      }

      const baseUrl = snapshot.baseUrl.endsWith('/') ? snapshot.baseUrl : `${snapshot.baseUrl}/`;
      const response = await this.fetchImpl(new URL('models', baseUrl).toString(), { method: 'GET' });
      if (!(response.status > 0 && response.status < 500)) {
        throw new Error(`AIGateway respondeu com status HTTP ${response.status}.`);
      }

      return `AIGateway respondeu com HTTP ${response.status} em ${snapshot.baseUrl}.`;
    });
  }

  private async runZavorthBridgeRemoteSmoke(supervisedRuntime: boolean): Promise<ExternalServiceSmokeStep> {
    if (!config.ZavorthTerminalSidecarEnabled) {
      return this.createSkippedStep(
        'zavorth-bridge-remote-smoke',
        'Sidecar remoto do ZavorthBridge desativado nesta configuracao.',
      );
    }
    if (!supervisedRuntime) {
      return this.createSkippedStep(
        'zavorth-bridge-remote-smoke',
        'Smoke externo do ZavorthBridge remoto so roda durante validacoes sob runtime supervisionado.',
      );
    }

    return this.runAsyncStep('zavorth-bridge-remote-smoke', 'doctor do ZavorthBridge remoto', async () => {
      const report = await this.zavorthBridgeRemoteDoctorService.run(false, false);
      if (!report.readyAfter) {
        const remaining = report.remainingRecommendations.slice(0, 3).join(' | ');
        throw new Error(
          `${report.summary}${remaining ? ` | pendencias: ${remaining}` : ''}`.trim(),
        );
      }

      return report.summary;
    });
  }

  private async runAsyncStep(
    label: string,
    command: string,
    executor: () => Promise<string>,
  ): Promise<ExternalServiceSmokeStep> {
    const started = this.now();
    const startedAt = started.toISOString();
    try {
      const output = await executor();
      const finished = this.now();
      return {
        label,
        command,
        status: 'passed',
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        output: String(output || '').trim(),
      };
    } catch (error: any) {
      const finished = this.now();
      return {
        label,
        command,
        status: 'failed',
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        output: error?.message || String(error),
      };
    }
  }

  private createSkippedStep(label: string, output: string): ExternalServiceSmokeStep {
    const timestamp = this.now().toISOString();
    return {
      label,
      command: 'skip',
      status: 'skipped',
      startedAt: timestamp,
      finishedAt: timestamp,
      durationMs: 0,
      output,
    };
  }
}
