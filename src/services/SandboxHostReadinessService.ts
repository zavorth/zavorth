import fs from 'fs';
import os from 'os';
import path from 'path';
import { config as defaultConfig, type ZavorthConfig } from '../config/index.js';
import { SandboxExecutionService } from './SandboxExecutionService.js';
import { DockerSandboxRuntime, type DockerSandboxStatus } from './sandbox/DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime, type FirecrackerSandboxStatus } from './sandbox/FirecrackerSandboxRuntime.js';
import type { SandboxResult } from './sandbox/ISandboxRuntime.js';
import { LocalJailSandboxRuntime } from './sandbox/LocalJailSandboxRuntime.js';

export type SandboxHostTierId = 'local-jail' | 'docker' | 'gvisor' | 'firecracker';
export type SandboxHostTierStatus =
  | 'ready'
  | 'dormant'
  | 'disabled'
  | 'not_installed'
  | 'unsupported'
  | 'degraded';
export type SandboxHostCheckStatus = 'pass' | 'warn' | 'fail' | 'skip';
export type SandboxHostSmokeStatus = 'pass' | 'fail' | 'skip';

export type SandboxHostCheck = {
  id: string;
  label: string;
  status: SandboxHostCheckStatus;
  reason: string;
  path?: string;
  command?: string;
};

export type SandboxHostSmokeResult = {
  id: string;
  status: SandboxHostSmokeStatus;
  reason: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
};

export type SandboxHostTierReadiness = {
  id: SandboxHostTierId;
  label: string;
  status: SandboxHostTierStatus;
  canRun: boolean;
  strongBoundary: boolean;
  startsOnRead: false;
  platform: NodeJS.Platform;
  reasons: string[];
  checks: SandboxHostCheck[];
  smoke?: SandboxHostSmokeResult;
};

export type SandboxHostReadinessSnapshot = {
  phase: '38';
  generatedAt: string;
  platform: NodeJS.Platform;
  osRelease: string;
  summary: {
    ok: boolean;
    readyTiers: SandboxHostTierId[];
    dormantTiers: SandboxHostTierId[];
    unavailableStrongTiers: SandboxHostTierId[];
    blockingIssues: string[];
  };
  defaultPolicy: {
    strongSandboxReady: boolean;
    liveMutationDefault: 'sandboxed-with-approval' | 'dry-run-only' | 'blocked';
    safeWithoutStrongSandbox: Array<'read-only' | 'preview' | 'doctor' | 'receipt'>;
    blockedWithoutStrongSandbox: Array<'workspace-write' | 'host-command' | 'network-write' | 'channel-send' | 'live-skill-apply'>;
    explanation: string;
  };
  tiers: SandboxHostTierReadiness[];
  actions: string[];
  contracts: string[];
};

type DockerRuntimeLike = Pick<DockerSandboxRuntime, 'getStatus'>;
type FirecrackerRuntimeLike = Pick<FirecrackerSandboxRuntime, 'getStatus'>;
type LocalJailRuntimeLike = Pick<LocalJailSandboxRuntime, 'execute'>;
type SandboxExecutionServiceLike = Pick<SandboxExecutionService, 'executeCodeInMicrovm'>;

export type SandboxHostReadinessOptions = {
  platform?: NodeJS.Platform;
  osRelease?: string;
  config?: Partial<ZavorthConfig>;
  dockerRuntime?: DockerRuntimeLike;
  firecrackerRuntime?: FirecrackerRuntimeLike;
  localJailRuntime?: LocalJailRuntimeLike;
  sandboxExecutionService?: SandboxExecutionServiceLike;
  existsSync?: (targetPath: string) => boolean;
  accessSync?: (targetPath: string, mode?: number) => void;
  now?: () => Date;
};

export type SandboxHostSmokeOptions = {
  includeLocalJail?: boolean;
  includeMicrovm?: boolean;
};

const DEFAULT_FIRECRACKER_DOC = 'docs/29-firecracker-host-bootstrap.md';

export class SandboxHostReadinessService {
  private readonly platform: NodeJS.Platform;
  private readonly osRelease: string;
  private readonly config: ZavorthConfig;
  private readonly dockerRuntime: DockerRuntimeLike;
  private readonly firecrackerRuntime: FirecrackerRuntimeLike;
  private readonly localJailRuntime: LocalJailRuntimeLike;
  private readonly sandboxExecutionService: SandboxExecutionServiceLike;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly accessSync: (targetPath: string, mode?: number) => void;
  private readonly now: () => Date;

  constructor(options: SandboxHostReadinessOptions = {}) {
    this.platform = options.platform || process.platform;
    this.osRelease = options.osRelease || os.release();
    this.config = {
      ...defaultConfig,
      ...(options.config || {}),
    } as ZavorthConfig;
    this.dockerRuntime = options.dockerRuntime || new DockerSandboxRuntime();
    this.firecrackerRuntime = options.firecrackerRuntime || new FirecrackerSandboxRuntime();
    this.localJailRuntime = options.localJailRuntime || new LocalJailSandboxRuntime();
    this.sandboxExecutionService = options.sandboxExecutionService || new SandboxExecutionService();
    this.existsSync = options.existsSync || fs.existsSync;
    this.accessSync = options.accessSync || fs.accessSync;
    this.now = options.now || (() => new Date());
  }

  public inspect(): SandboxHostReadinessSnapshot {
    const tiers = [
      this.inspectLocalJail(),
      this.inspectDocker(),
    ];
    tiers.push(this.inspectGvisor(tiers[1]));
    tiers.push(this.inspectFirecracker());

    return this.buildSnapshot(tiers);
  }

  public async runSmoke(
    options: SandboxHostSmokeOptions = {},
  ): Promise<SandboxHostReadinessSnapshot> {
    const includeLocalJail = options.includeLocalJail !== false;
    const includeMicrovm = options.includeMicrovm !== false;
    const snapshot = this.inspect();
    const localJail = snapshot.tiers.find((tier) => tier.id === 'local-jail');
    const firecracker = snapshot.tiers.find((tier) => tier.id === 'firecracker');

    if (includeLocalJail && localJail) {
      localJail.smoke = await this.runLocalJailSmoke();
      if (localJail.smoke.status === 'fail') {
        localJail.status = 'degraded';
        localJail.canRun = false;
        localJail.reasons.push(localJail.smoke.reason);
      }
    }

    if (includeMicrovm && firecracker) {
      firecracker.smoke = firecracker.canRun
        ? await this.runMicrovmSmoke()
        : {
            id: 'firecracker:e2e',
            status: 'skip',
            reason: 'MicroVM smoke pulado porque o host nao esta elegivel para Firecracker.',
          };
      if (firecracker.smoke.status === 'fail') {
        firecracker.status = 'degraded';
        firecracker.canRun = false;
        firecracker.reasons.push(firecracker.smoke.reason);
      }
    }

    return this.buildSnapshot(snapshot.tiers);
  }

  public renderReport(snapshot: SandboxHostReadinessSnapshot = this.inspect()): string {
    const lines: string[] = [];
    lines.push('[sandbox:doctor] host readiness');
    lines.push(`platform: ${snapshot.platform} ${snapshot.osRelease}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'}`);
    lines.push(`ready: ${snapshot.summary.readyTiers.join(', ') || 'none'}`);
    lines.push(`dormant: ${snapshot.summary.dormantTiers.join(', ') || 'none'}`);
    lines.push(`mutation default: ${snapshot.defaultPolicy.liveMutationDefault}`);
    lines.push(`safe without strong sandbox: ${snapshot.defaultPolicy.safeWithoutStrongSandbox.join(', ')}`);
    lines.push(`blocked without strong sandbox: ${snapshot.defaultPolicy.blockedWithoutStrongSandbox.join(', ')}`);

    for (const tier of snapshot.tiers) {
      lines.push('');
      lines.push(`${tier.id}: ${tier.status} | canRun=${tier.canRun ? 'yes' : 'no'} | boundary=${tier.strongBoundary ? 'strong' : 'local'}`);
      for (const reason of tier.reasons) {
        lines.push(`  - ${reason}`);
      }
      for (const check of tier.checks) {
        const suffix = check.path ? ` (${check.path})` : check.command ? ` (${check.command})` : '';
        lines.push(`  [${check.status}] ${check.label}${suffix}: ${check.reason}`);
      }
      if (tier.smoke) {
        lines.push(`  [smoke:${tier.smoke.status}] ${tier.smoke.id}: ${tier.smoke.reason}`);
      }
    }

    if (snapshot.actions.length > 0) {
      lines.push('');
      lines.push('actions:');
      for (const action of snapshot.actions) {
        lines.push(`  - ${action}`);
      }
    }

    if (snapshot.summary.blockingIssues.length > 0) {
      lines.push('');
      lines.push('blocking issues:');
      for (const issue of snapshot.summary.blockingIssues) {
        lines.push(`  - ${issue}`);
      }
    }

    return lines.join('\n');
  }

  private inspectLocalJail(): SandboxHostTierReadiness {
    return {
      id: 'local-jail',
      label: 'Local jail sandbox',
      status: 'ready',
      canRun: true,
      strongBoundary: false,
      startsOnRead: false,
      platform: this.platform,
      reasons: [
        'Disponivel como fallback leve para codigo confiavel ou baixo risco.',
        'Nao substitui container, gVisor ou MicroVM para payload nao confiavel.',
      ],
      checks: [
        {
          id: 'local-jail:runtime',
          label: 'runtime local',
          status: 'pass',
          reason: 'executor local-jail instanciado sem iniciar processo persistente.',
        },
      ],
    };
  }

  private inspectDocker(): SandboxHostTierReadiness {
    const status = this.getDockerStatus();
    if (!status.enabled) {
      return {
        id: 'docker',
        label: 'Docker hardened sandbox',
        status: 'disabled',
        canRun: false,
        strongBoundary: true,
        startsOnRead: false,
        platform: this.platform,
        reasons: [status.detail],
        checks: [
          this.check('docker:enabled', 'Docker sandbox config', 'skip', status.detail),
        ],
      };
    }

    const tierStatus = this.mapDockerTierStatus(status);
    return {
      id: 'docker',
      label: 'Docker hardened sandbox',
      status: tierStatus,
      canRun: status.canRun,
      strongBoundary: true,
      startsOnRead: false,
      platform: this.platform,
      reasons: [status.detail],
      checks: [
        this.check(
          'docker:cli',
          'Docker CLI',
          status.dockerReachable ? 'pass' : 'fail',
          status.dockerReachable ? 'CLI Docker respondeu ao probe.' : 'CLI Docker nao respondeu.',
          { command: String(this.config.dockerCliPath || 'docker') },
        ),
        this.check(
          'docker:daemon',
          'Docker daemon',
          status.daemonReachable ? 'pass' : 'fail',
          status.daemonReachable ? 'daemon Docker acessivel.' : 'daemon Docker indisponivel.',
        ),
        this.check(
          'docker:image',
          `imagem ${status.image}`,
          status.imagePresent ? 'pass' : 'warn',
          status.imagePresent
            ? 'imagem base presente localmente.'
            : 'imagem ausente; primeira execucao pode exigir pull ou configuracao manual.',
        ),
        this.check(
          'docker:hardening',
          'hardening baseline',
          'pass',
          `runtime=${status.sandboxRuntime || 'runc'}, network=none, read-only/caps configurados pelo executor.`,
        ),
      ],
    };
  }

  private inspectGvisor(dockerTier: SandboxHostTierReadiness): SandboxHostTierReadiness {
    const dockerStatus = this.getDockerStatus();
    const configuredRuntime = String(dockerStatus.sandboxRuntime || this.config.dockerSandboxRuntime || '').trim();
    if (configuredRuntime !== 'runsc') {
      return {
        id: 'gvisor',
        label: 'gVisor runsc sandbox',
        status: 'dormant',
        canRun: false,
        strongBoundary: true,
        startsOnRead: false,
        platform: this.platform,
        reasons: ['gVisor nao esta configurado como runtime Docker ativo.'],
        checks: [
          this.check(
            'gvisor:runtime-config',
            'Docker runtime',
            'skip',
            'defina ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc para usar gVisor.',
          ),
        ],
      };
    }

    const ready = dockerTier.canRun;
    return {
      id: 'gvisor',
      label: 'gVisor runsc sandbox',
      status: ready ? 'ready' : 'degraded',
      canRun: ready,
      strongBoundary: true,
      startsOnRead: false,
      platform: this.platform,
      reasons: [
        ready
          ? 'Docker esta configurado para usar runsc; o smoke profundo pode validar o runtime ativo.'
          : 'runsc foi solicitado, mas Docker ainda nao esta pronto para execucao.',
      ],
      checks: [
        this.check(
          'gvisor:runtime-config',
          'Docker runtime',
          'pass',
          'ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc configurado.',
        ),
        this.check(
          'gvisor:docker-ready',
          'Docker baseline',
          ready ? 'pass' : 'fail',
          ready ? 'Docker baseline pronto para usar runsc.' : 'Docker baseline indisponivel.',
        ),
      ],
    };
  }

  private inspectFirecracker(): SandboxHostTierReadiness {
    const status = this.getFirecrackerStatus();
    const checks = this.buildFirecrackerChecks(status);
    const tierStatus = this.mapFirecrackerTierStatus(status, checks);
    const canRun = status.canRun && tierStatus === 'ready';
    const reasons = [status.detail];

    if (this.platform === 'win32' && tierStatus !== 'ready') {
      reasons.push('Firecracker nao roda nativamente no Windows; use WSL/Linux com KVM para ativar MicroVM.');
    }
    if (this.platform === 'linux' && tierStatus !== 'ready') {
      reasons.push(`Bootstrap sugerido: ${DEFAULT_FIRECRACKER_DOC}`);
    }

    return {
      id: 'firecracker',
      label: 'Firecracker MicroVM sandbox',
      status: tierStatus,
      canRun,
      strongBoundary: true,
      startsOnRead: false,
      platform: this.platform,
      reasons,
      checks,
    };
  }

  private buildFirecrackerChecks(status: FirecrackerSandboxStatus): SandboxHostCheck[] {
    if (this.platform === 'win32') {
      return [
        this.check(
          'firecracker:platform',
          'host platform',
          status.canRun ? 'pass' : 'skip',
          status.canRun
            ? 'WSL bridge reportou Firecracker pronto.'
            : 'Windows local mantem Firecracker dormente/unsupported sem bloquear o core.',
        ),
        this.check(
          'firecracker:transport',
          'transport',
          status.transport === 'wsl' ? 'warn' : 'skip',
          status.transport === 'wsl'
            ? 'transporte WSL configurado; valide no host Linux interno antes do smoke.'
            : 'transporte direto nao e aplicavel ao Windows local.',
        ),
      ];
    }

    if (this.platform !== 'linux') {
      return [
        this.check(
          'firecracker:platform',
          'host platform',
          'fail',
          `Firecracker requer Linux com KVM; plataforma atual: ${this.platform}.`,
        ),
      ];
    }

    const kvmExists = this.existsSync('/dev/kvm');
    const kvmAccess = kvmExists && this.canAccess('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK);
    const binPath = String(this.config.firecrackerBinPath || 'firecracker');
    const binConfigured = status.firecrackerReachable || this.pathLooksPresent(binPath);
    const kernelPath = String(this.config.firecrackerKernelPath || '');
    const rootfsPath = String(this.config.firecrackerRootfsPath || '');

    return [
      this.check(
        'firecracker:enabled',
        'Firecracker config',
        this.config.firecrackerEnabled ? 'pass' : 'skip',
        this.config.firecrackerEnabled
          ? 'ZAVORTH_FIRECRACKER_ENABLED=true.'
          : 'Firecracker esta desabilitado por configuracao.',
      ),
      this.check(
        'firecracker:kvm-node',
        '/dev/kvm',
        kvmExists ? 'pass' : 'fail',
        kvmExists ? '/dev/kvm existe.' : '/dev/kvm nao existe neste host.',
        { path: '/dev/kvm' },
      ),
      this.check(
        'firecracker:kvm-access',
        'KVM read/write',
        kvmAccess ? 'pass' : 'fail',
        kvmAccess ? '/dev/kvm permite leitura e escrita.' : 'sem permissao de leitura/escrita em /dev/kvm.',
        { path: '/dev/kvm' },
      ),
      this.check(
        'firecracker:binary',
        'firecracker binary',
        binConfigured ? 'pass' : 'fail',
        binConfigured
          ? 'binario Firecracker resolvido pelo runtime.'
          : `binario Firecracker nao encontrado em ${binPath}.`,
        { path: binPath },
      ),
      this.check(
        'firecracker:kernel',
        'vmlinux',
        status.kernelPresent || this.pathLooksPresent(kernelPath) ? 'pass' : 'fail',
        status.kernelPresent || this.pathLooksPresent(kernelPath)
          ? 'kernel vmlinux presente.'
          : `kernel vmlinux ausente em ${kernelPath}.`,
        { path: kernelPath },
      ),
      this.check(
        'firecracker:rootfs',
        'rootfs.ext4',
        status.rootfsPresent || this.pathLooksPresent(rootfsPath) ? 'pass' : 'fail',
        status.rootfsPresent || this.pathLooksPresent(rootfsPath)
          ? 'rootfs.ext4 presente.'
          : `rootfs.ext4 ausente em ${rootfsPath}.`,
        { path: rootfsPath },
      ),
    ];
  }

  private mapDockerTierStatus(status: DockerSandboxStatus): SandboxHostTierStatus {
    if (status.canRun) {
      return 'ready';
    }
    if (!status.dockerReachable) {
      return 'not_installed';
    }
    if (!status.daemonReachable) {
      return 'degraded';
    }
    if (!status.imagePresent) {
      return 'dormant';
    }
    return 'degraded';
  }

  private mapFirecrackerTierStatus(
    status: FirecrackerSandboxStatus,
    checks: SandboxHostCheck[],
  ): SandboxHostTierStatus {
    if (status.canRun) {
      return 'ready';
    }

    if (this.platform === 'win32') {
      return status.transport === 'wsl' ? 'dormant' : 'unsupported';
    }

    if (this.platform !== 'linux') {
      return 'unsupported';
    }

    if (!this.config.firecrackerEnabled || !status.enabled) {
      return 'disabled';
    }

    const failedCheckIds = new Set(
      checks.filter((check) => check.status === 'fail').map((check) => check.id),
    );
    if (failedCheckIds.has('firecracker:kvm-node') || failedCheckIds.has('firecracker:kvm-access')) {
      return 'unsupported';
    }
    if (
      failedCheckIds.has('firecracker:binary')
      || failedCheckIds.has('firecracker:kernel')
      || failedCheckIds.has('firecracker:rootfs')
    ) {
      return 'not_installed';
    }
    return 'degraded';
  }

  private async runLocalJailSmoke(): Promise<SandboxHostSmokeResult> {
    try {
      const result = await this.localJailRuntime.execute({
        language: 'javascript',
        code: 'console.log("zavorth-local-jail-ok")',
        timeoutMs: 5000,
      });
      return this.resultToSmoke(
        'local-jail:e2e',
        result,
        result.stdout.includes('zavorth-local-jail-ok')
          ? 'Local-jail executou codigo efemero e limpou o workspace temporario.'
          : 'Local-jail executou, mas a saida esperada nao apareceu.',
      );
    } catch (error) {
      return {
        id: 'local-jail:e2e',
        status: 'fail',
        reason: `Local-jail smoke falhou: ${this.errorMessage(error)}.`,
      };
    }
  }

  private async runMicrovmSmoke(): Promise<SandboxHostSmokeResult> {
    try {
      const result = await this.sandboxExecutionService.executeCodeInMicrovm(
        'console.log("zavorth-microvm-ok")',
        'javascript',
        15_000,
      );
      return this.resultToSmoke(
        'firecracker:e2e',
        result,
        result.stdout.includes('zavorth-microvm-ok')
          ? 'MicroVM executou codigo e retornou saida esperada.'
          : 'MicroVM executou, mas a saida esperada nao apareceu.',
      );
    } catch (error) {
      return {
        id: 'firecracker:e2e',
        status: 'fail',
        reason: `MicroVM smoke falhou: ${this.errorMessage(error)}.`,
      };
    }
  }

  private resultToSmoke(
    id: string,
    result: SandboxResult,
    passReason: string,
  ): SandboxHostSmokeResult {
    const ok = result.exitCode === 0 && !passReason.includes('nao apareceu');
    return {
      id,
      status: ok ? 'pass' : 'fail',
      reason: ok
        ? passReason
        : `execucao retornou exitCode=${result.exitCode}; saida esperada ausente ou falha.`,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }

  private buildSnapshot(tiers: SandboxHostTierReadiness[]): SandboxHostReadinessSnapshot {
    const blockingIssues = this.collectBlockingIssues(tiers);
    const strongSandboxReady = tiers.some((tier) => tier.strongBoundary && tier.canRun);
    const localFallbackReady = tiers.some((tier) => tier.id === 'local-jail' && tier.canRun);
    return {
      phase: '38',
      generatedAt: this.now().toISOString(),
      platform: this.platform,
      osRelease: this.osRelease,
      summary: {
        ok: blockingIssues.length === 0,
        readyTiers: tiers.filter((tier) => tier.status === 'ready').map((tier) => tier.id),
        dormantTiers: tiers
          .filter((tier) => tier.status === 'dormant' || tier.status === 'disabled')
          .map((tier) => tier.id),
        unavailableStrongTiers: tiers
          .filter((tier) => tier.strongBoundary && tier.status !== 'ready')
          .map((tier) => tier.id),
        blockingIssues,
      },
      defaultPolicy: {
        strongSandboxReady,
        liveMutationDefault: strongSandboxReady
          ? 'sandboxed-with-approval'
          : localFallbackReady
            ? 'dry-run-only'
            : 'blocked',
        safeWithoutStrongSandbox: ['read-only', 'preview', 'doctor', 'receipt'],
        blockedWithoutStrongSandbox: [
          'workspace-write',
          'host-command',
          'network-write',
          'channel-send',
          'live-skill-apply',
        ],
        explanation: strongSandboxReady
          ? 'Strong sandbox is ready; mutable execution still requires Policy Broker and scoped approval.'
          : localFallbackReady
            ? 'Only the lightweight fallback is ready; live mutations must remain dry-run until Docker, gVisor or Firecracker is ready.'
            : 'No sandbox fallback is ready; execution is blocked until doctor issues are resolved.',
      },
      tiers,
      actions: this.buildActions(tiers),
      contracts: [
        'Firecracker roda somente em Linux/WSL elegivel com KVM validado.',
        'Windows local reporta Firecracker dormente/unsupported sem falso erro.',
        'Doctor de leitura nao inicia VM, container nem processo persistente.',
        'MicroVM smoke so executa quando o tier Firecracker esta pronto.',
        'Live mutations default to dry-run unless Docker, gVisor or Firecracker is confirmed ready.',
      ],
    };
  }

  private collectBlockingIssues(tiers: SandboxHostTierReadiness[]): string[] {
    const issues: string[] = [];
    const localJail = tiers.find((tier) => tier.id === 'local-jail');
    const docker = tiers.find((tier) => tier.id === 'docker');

    if (!localJail?.canRun) {
      issues.push('local-jail indisponivel; o fallback minimo de sandbox nao esta operacional.');
    }
    if (this.config.dockerSandboxRequired && !docker?.canRun) {
      issues.push('Docker sandbox e obrigatorio por configuracao, mas nao esta pronto.');
    }

    for (const tier of tiers) {
      if (tier.smoke?.status === 'fail') {
        issues.push(`${tier.id} smoke falhou: ${tier.smoke.reason}`);
      }
    }

    return issues;
  }

  private buildActions(tiers: SandboxHostTierReadiness[]): string[] {
    const actions: string[] = [];
    const docker = tiers.find((tier) => tier.id === 'docker');
    const gvisor = tiers.find((tier) => tier.id === 'gvisor');
    const firecracker = tiers.find((tier) => tier.id === 'firecracker');

    if (docker && docker.status !== 'ready') {
      actions.push('Para container forte: instale/inicie Docker e garanta a imagem configurada localmente.');
    }
    if (gvisor && gvisor.status !== 'ready') {
      actions.push('Para gVisor: instale runsc, registre no Docker e defina ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc.');
    }
    if (firecracker && firecracker.status !== 'ready') {
      actions.push(`Para MicroVM: siga ${DEFAULT_FIRECRACKER_DOC} em host Linux com KVM.`);
    }
    return actions;
  }

  private getDockerStatus(): DockerSandboxStatus {
    try {
      return this.dockerRuntime.getStatus('javascript');
    } catch (error) {
      return {
        enabled: this.config.dockerSandboxEnabled,
        language: 'javascript',
        image: String(this.config.dockerSandboxJavascriptImage || this.config.dockerSandboxImage || 'node:22-bullseye'),
        dockerReachable: false,
        daemonReachable: false,
        imagePresent: false,
        autoPullEnabled: this.config.dockerSandboxAutoPull,
        sandboxRuntime: this.config.dockerSandboxRuntime || 'runc',
        canRun: false,
        detail: `falha ao consultar Docker: ${this.errorMessage(error)}`,
      };
    }
  }

  private getFirecrackerStatus(): FirecrackerSandboxStatus {
    try {
      return this.firecrackerRuntime.getStatus();
    } catch (error) {
      return {
        enabled: this.config.firecrackerEnabled,
        transport: this.config.firecrackerTransport === 'wsl' ? 'wsl' : 'direct',
        bridgeReady: false,
        firecrackerReachable: false,
        kvmAvailable: false,
        kernelPresent: false,
        rootfsPresent: false,
        canRun: false,
        detail: `falha ao consultar Firecracker: ${this.errorMessage(error)}`,
      };
    }
  }

  private canAccess(targetPath: string, mode: number): boolean {
    try {
      this.accessSync(targetPath, mode);
      return true;
    } catch {
      return false;
    }
  }

  private pathLooksPresent(targetPath: string): boolean {
    const normalized = String(targetPath || '').trim();
    if (!normalized) {
      return false;
    }
    if (path.isAbsolute(normalized) || normalized.includes('/') || normalized.includes('\\')) {
      return this.existsSync(normalized);
    }
    return false;
  }

  private check(
    id: string,
    label: string,
    status: SandboxHostCheckStatus,
    reason: string,
    refs: Pick<SandboxHostCheck, 'path' | 'command'> = {},
  ): SandboxHostCheck {
    return {
      id,
      label,
      status,
      reason,
      ...refs,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
