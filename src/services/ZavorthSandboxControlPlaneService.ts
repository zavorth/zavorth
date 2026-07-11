import { DockerSandboxRuntime, type DockerSandboxStatus } from './sandbox/DockerSandboxRuntime.js';

import crypto from 'crypto';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthCapabilityRunEnvelope,
  ZavorthMutationRiskLevel,
  ZavorthSandboxProfile,
} from '../contracts/ZavorthMutationPlaneContract.js';

import { FirecrackerSandboxRuntime, type FirecrackerSandboxStatus } from './sandbox/FirecrackerSandboxRuntime.js';
import type { SandboxLanguage, SandboxSecurityLevel } from './sandbox/ISandboxRuntime.js';
import { SandboxPolicyService } from './sandbox/SandboxPolicyService.js';
import { WasmSandboxCapabilityService, type WasmSandboxStatus } from './WasmSandboxCapabilityService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type SandboxPosture = 'healthy' | 'attention' | 'critical';
type SandboxProfileStatus = 'ready' | 'dormant' | 'disabled' | 'not_installed' | 'unsupported' | 'degraded';
type SandboxActionSeverity = 'info' | 'warn' | 'critical';
type SandboxNetworkPolicy = ZavorthCapabilityRunEnvelope['networkPolicy'];

type DockerPort = Pick<DockerSandboxRuntime, 'getStatus'> & Partial<Pick<DockerSandboxRuntime, 'isGvisorActive'>>;
type FirecrackerPort = Pick<FirecrackerSandboxRuntime, 'getStatus'>;
type WasmPort = Pick<WasmSandboxCapabilityService, 'getStatus'>;

export type ZavorthSandboxRuntimeProfile = {
  id: ZavorthSandboxProfile;
  label: string;
  securityLevel: SandboxSecurityLevel | 'remote-node' | 'none';
  status: SandboxProfileStatus;
  canRun: boolean;
  installed: boolean;
  heavyRuntime: boolean;
  startsOnRead: false;
  detail: string;
  recommendedAction: string | null;
};

export type ZavorthSandboxControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  platform: NodeJS.Platform;
  summary: {
    posture: SandboxPosture;
    preferredProfile: ZavorthSandboxProfile;
    availableProfiles: number;
    strongProfilesReady: number;
    untrustedExecutionReady: boolean;
    heavyRuntimesStarted: false;
    doctorStatus: 'ready' | 'needs_install' | 'unsupported' | 'disabled' | 'degraded';
  };
  policy: {
    defaultNetworkPolicy: 'none';
    allowedNetworkPolicies: SandboxNetworkPolicy[];
    filesystem: {
      tempWorkspaceOnly: true;
      hostMountsReadOnly: true;
      deniedHostWrite: true;
      artifactCollection: 'explicit';
      defaultTempRoot: string;
    };
    mutation: {
      dangerousCommandsRequirePlan: true;
      trustPlaneDomain: 'sandbox';
      approvalRequiredFor: Array<'execute-untrusted' | 'network-full' | 'host-mount-write' | 'profile-downgrade'>;
    };
    cleanup: {
      killOnTimeout: true;
      removeWorkspace: true;
      removeContainerOrVm: true;
      ttlMs: number;
    };
  };
  budgets: ZavorthCapabilityRunEnvelope['budget'];
  profiles: ZavorthSandboxRuntimeProfile[];
  doctor: {
    ready: string[];
    dormant: string[];
    disabled: string[];
    notInstalled: string[];
    unsupported: string[];
    degraded: string[];
    recommendedCommands: string[];
  };
  envelopePreview: ZavorthCapabilityRunEnvelope | null;
  actions: Array<{
    id: string;
    label: string;
    severity: SandboxActionSeverity;
    reason: string;
    command: string | null;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export type ZavorthSandboxEnvelopeInput = {
  code?: string | null;
  command?: string | null;
  language?: SandboxLanguage | null;
  preferredProfile?: ZavorthSandboxProfile | 'auto' | null;
  networkPolicy?: SandboxNetworkPolicy | null;
  mode?: ZavorthCapabilityRunEnvelope['mode'] | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
};

type SandboxControlPlaneRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  tempRoot?: string | null;
  dockerRuntime?: DockerPort | null;
  firecrackerRuntime?: FirecrackerPort | null;
  wasmCapabilityService?: WasmPort | null;
  policyService?: Pick<SandboxPolicyService, 'resolveCodeExecutionPolicy' | 'inferExecutionSandboxLanguage'> | null;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
};

export class ZavorthSandboxControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly dockerRuntime: DockerPort;
  private readonly firecrackerRuntime: FirecrackerPort;
  private readonly wasmCapability: WasmPort;
  private readonly policy: Pick<SandboxPolicyService, 'resolveCodeExecutionPolicy' | 'inferExecutionSandboxLanguage'>;
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;

  constructor(runtime: SandboxControlPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = String(runtime.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.tempRoot = String(runtime.tempRoot || path.resolve(config.projectRoot, 'data', 'runtime', 'sandbox-runs')).trim();
    this.dockerRuntime = runtime.dockerRuntime || new DockerSandboxRuntime();
    this.firecrackerRuntime = runtime.firecrackerRuntime || new FirecrackerSandboxRuntime();
    this.wasmCapability = runtime.wasmCapabilityService || new WasmSandboxCapabilityService();
    this.policy = runtime.policyService || new SandboxPolicyService();
    this.env = runtime.env || process.env;
    this.platform = runtime.platform || process.platform;
  }

  public buildSnapshot(input: ZavorthSandboxEnvelopeInput = {}): ZavorthSandboxControlPlaneSnapshot {
    const language = this.resolveLanguage(input);
    const profiles = this.buildProfiles(language);
    const envelopePreview = this.hasExecutableInput(input) ? this.buildRunEnvelope(input, profiles) : null;
    const strongProfilesReady = profiles.filter((entry) => (
      entry.canRun
      && (entry.id === 'container' || entry.id === 'gvisor' || entry.id === 'firecracker' || entry.id === 'remote-node')
    )).length;
    const preferredProfile = this.resolvePreferredProfile(profiles);
    const summary = {
      posture: this.resolvePosture(profiles, envelopePreview),
      preferredProfile,
      availableProfiles: profiles.filter((entry) => entry.canRun).length,
      strongProfilesReady,
      untrustedExecutionReady: strongProfilesReady > 0,
      heavyRuntimesStarted: false as false,
      doctorStatus: this.resolveDoctorStatus(profiles),
    };
    const doctor = this.buildDoctor(profiles);
    const actions = this.buildActions(profiles, summary, envelopePreview, doctor);
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      platform: this.platform,
      summary,
      policy: {
        defaultNetworkPolicy: 'none',
        allowedNetworkPolicies: ['none', 'allowlisted', 'internet-readonly', 'full-with-approval'],
        filesystem: {
          tempWorkspaceOnly: true,
          hostMountsReadOnly: true,
          deniedHostWrite: true,
          artifactCollection: 'explicit',
          defaultTempRoot: this.tempRoot,
        },
        mutation: {
          dangerousCommandsRequirePlan: true,
          trustPlaneDomain: 'sandbox',
          approvalRequiredFor: ['execute-untrusted', 'network-full', 'host-mount-write', 'profile-downgrade'],
        },
        cleanup: {
          killOnTimeout: true,
          removeWorkspace: true,
          removeContainerOrVm: true,
          ttlMs: 24 * 60 * 60 * 1000,
        },
      },
      budgets: this.defaultBudget(input.networkPolicy || null),
      profiles,
      doctor,
      envelopePreview,
      actions,
      narrative: {
        headline: 'Sandbox forte lazy',
        operatorSummary:
          `${summary.availableProfiles} perfil(is) de sandbox disponiveis, `
          + `${summary.strongProfilesReady} forte(s), runtime pesado iniciado=${summary.heavyRuntimesStarted ? 'sim' : 'nao'}.`,
        nextAction: actions[0]?.label || 'Usar ops:sandbox antes de executar codigo nao confiavel.',
      },
    };
  }

  public renderReport(input: ZavorthSandboxEnvelopeInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Sandbox forte lazy',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Perfil preferido: ${snapshot.summary.preferredProfile}.`,
      `Doctor: ${snapshot.summary.doctorStatus}.`,
      `Rede default: ${snapshot.policy.defaultNetworkPolicy}.`,
      `Filesystem: temp-only=${snapshot.policy.filesystem.tempWorkspaceOnly ? 'sim' : 'nao'} | host read-only=${snapshot.policy.filesystem.hostMountsReadOnly ? 'sim' : 'nao'}.`,
      `Budget: ${snapshot.budgets.maxDurationMs}ms | memoria ${snapshot.budgets.memoryMb} MB | rede ${snapshot.budgets.maxNetworkCalls}.`,
      '',
      'Perfis:',
      ...snapshot.profiles.map((entry) => (
        `- ${entry.id}: ${entry.status} | canRun=${entry.canRun ? 'yes' : 'no'} | ${entry.detail}`
      )),
    ];
    if (snapshot.envelopePreview) {
      lines.push(
        '',
        'Envelope preview:',
        `- id: ${snapshot.envelopePreview.id}`,
        `- profile: ${snapshot.envelopePreview.sandboxProfile}`,
        `- status: ${snapshot.envelopePreview.status}`,
        `- risk: ${snapshot.envelopePreview.riskLevel}`,
      );
    }
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.actions.map((entry) => `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  public buildRunEnvelope(
    input: ZavorthSandboxEnvelopeInput,
    profiles: ZavorthSandboxRuntimeProfile[] = this.buildProfiles(this.resolveLanguage(input)),
  ): ZavorthCapabilityRunEnvelope {
    const language = this.resolveLanguage(input);
    const code = this.resolveCode(input);
    const preferred = this.normalizePreferred(input.preferredProfile);
    const policy = this.policy.resolveCodeExecutionPolicy(
      language,
      code,
      preferred === 'auto' ? 'auto' : this.toPolicyPreference(preferred),
    );
    const sandboxProfile = this.resolveEnvelopeProfile(policy.securityLevel, preferred, profiles);
    const networkPolicy = input.networkPolicy || 'none';
    const riskLevel = this.resolveRisk(policy.securityLevel, networkPolicy, code);
    const requiresPlan = this.requiresMutationPlan(riskLevel, networkPolicy, sandboxProfile);
    const profileStatus = profiles.find((entry) => entry.id === sandboxProfile) || null;
    const canRunProfile = profileStatus?.canRun === true;
    const status: ZavorthCapabilityRunEnvelope['status'] =
      requiresPlan
        ? 'waiting_approval'
        : canRunProfile
          ? 'ready'
          : 'blocked';
    const reasons = [
      policy.reason,
      networkPolicy === 'none'
        ? 'Rede desabilitada por padrao.'
        : `Network policy solicitada: ${networkPolicy}.`,
      canRunProfile
        ? `Perfil ${sandboxProfile} disponivel.`
        : `Perfil ${sandboxProfile} indisponivel: ${profileStatus?.detail || 'sem runtime associado'}.`,
      requiresPlan
        ? 'Comando perigoso ou rede elevada exige MutationPlan e Trust Plane antes do apply.'
        : 'Execucao pode seguir como preview/dry-run com budget e cleanup.',
    ];

    return {
      id: `sandbox-run:${this.hash([code, language, sandboxProfile, networkPolicy]).slice(0, 16)}`,
      capabilityId: 'sandbox-execution',
      requestedBy: this.nullableText(input.requestedBy),
      sourceSurface: this.nullableText(input.sourceSurface),
      mode: input.mode || 'preview',
      trustDecisionId: null,
      budget: this.defaultBudget(networkPolicy),
      sandboxProfile,
      networkPolicy,
      filesystemPolicy: {
        tempWorkspaceOnly: true,
        hostMountsReadOnly: true,
        deniedHostWrite: true,
        allowlistedMounts: [],
        artifactCollection: 'explicit',
      },
      inputRefs: [`inline:${this.hash(code).slice(0, 16)}`],
      outputRefs: [],
      cleanupPlan: {
        killOnTimeout: true,
        removeWorkspace: true,
        removeContainerOrVm: true,
        ttlMs: 24 * 60 * 60 * 1000,
        notes: [
          'Workspace temporario removido no finally.',
          'Container/VM/processo encerrado em timeout ou cancelamento.',
          'Artefatos precisam ser coletados explicitamente.',
        ],
      },
      auditId: `audit:sandbox:${this.hash([code, Date.now()]).slice(0, 12)}`,
      riskLevel,
      status,
      reasons,
    };
  }

  private buildProfiles(language: SandboxLanguage): ZavorthSandboxRuntimeProfile[] {
    const docker = this.safeDockerStatus(language === 'wasm' ? 'javascript' : language);
    const firecracker = this.safeFirecrackerStatus();
    const wasm = this.safeWasmStatus();
    const remoteConfigured = Boolean(
      String(this.env.ZAVORTH_REMOTE_SANDBOX_NODE || '').trim()
      || String(this.env.ZAVORTH_NODE_MESH_SANDBOX_NODE || '').trim(),
    );
    return [
      {
        id: 'process',
        label: 'Process local jail',
        securityLevel: 'local-jail',
        status: 'ready',
        canRun: true,
        installed: true,
        heavyRuntime: false,
        startsOnRead: false,
        detail: 'Jail local efemero disponivel para codigo de baixo risco; nao substitui isolamento forte.',
        recommendedAction: null,
      },
      this.fromDockerStatus('container', docker),
      this.fromGvisorStatus(docker),
      this.fromFirecrackerStatus(firecracker),
      {
        id: 'remote-node',
        label: 'Remote node sandbox',
        securityLevel: 'remote-node',
        status: remoteConfigured ? 'dormant' : 'disabled',
        canRun: false,
        installed: remoteConfigured,
        heavyRuntime: true,
        startsOnRead: false,
        detail: remoteConfigured
          ? 'Node remoto configurado, mas execucao remota fica dormente ate handshake explicito.'
          : 'Nenhum node remoto de sandbox configurado neste host.',
        recommendedAction: remoteConfigured ? 'ops:distributed --verify' : 'Configurar Federated Mesh antes de usar remote-node.',
      },
      this.fromWasmStatus(wasm),
    ];
  }

  private fromDockerStatus(
    profile: 'container',
    status: DockerSandboxStatus,
  ): ZavorthSandboxRuntimeProfile {
    const normalized = this.normalizeDockerStatus(status);
    return {
      id: profile,
      label: 'Docker container sandbox',
      securityLevel: 'container',
      status: normalized.status,
      canRun: status.canRun,
      installed: status.dockerReachable,
      heavyRuntime: true,
      startsOnRead: false,
      detail: status.detail,
      recommendedAction: normalized.recommendedAction,
    };
  }

  private fromGvisorStatus(status: DockerSandboxStatus): ZavorthSandboxRuntimeProfile {
    const runtime = String(status.sandboxRuntime || '').trim().toLowerCase();
    const configured = runtime === 'runsc';
    return {
      id: 'gvisor',
      label: 'Docker + gVisor/runsc',
      securityLevel: 'container',
      status: configured && status.canRun ? 'ready' : configured ? 'degraded' : 'dormant',
      canRun: configured && status.canRun,
      installed: configured,
      heavyRuntime: true,
      startsOnRead: false,
      detail: configured
        ? 'gVisor/runsc configurado; doctor profundo pode validar runtime real.'
        : 'gVisor/runsc nao configurado em ZAVORTH_DOCKER_SANDBOX_RUNTIME.',
      recommendedAction: configured ? 'npm run sandbox:doctor -- --deep' : 'Configurar ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc.',
    };
  }

  private fromFirecrackerStatus(status: FirecrackerSandboxStatus): ZavorthSandboxRuntimeProfile {
    const mapped = this.normalizeFirecrackerStatus(status);
    return {
      id: 'firecracker',
      label: 'Firecracker MicroVM',
      securityLevel: 'microvm',
      status: mapped.status,
      canRun: status.canRun,
      installed: status.firecrackerReachable || status.kernelPresent || status.rootfsPresent,
      heavyRuntime: true,
      startsOnRead: false,
      detail: status.detail,
      recommendedAction: mapped.recommendedAction,
    };
  }

  private fromWasmStatus(status: WasmSandboxStatus): ZavorthSandboxRuntimeProfile {
    return {
      id: 'wasm',
      label: 'WebAssembly sandbox',
      securityLevel: 'wasm',
      status: status.canRun ? 'ready' : status.enabled ? 'degraded' : 'disabled',
      canRun: status.canRun,
      installed: status.available,
      heavyRuntime: false,
      startsOnRead: false,
      detail: status.detail,
      recommendedAction: status.recommendedAction,
    };
  }

  private normalizeDockerStatus(status: DockerSandboxStatus): {
    status: SandboxProfileStatus;
    recommendedAction: string | null;
  } {
    if (!status.enabled) {
      return {
        status: 'disabled',
        recommendedAction: 'Habilitar ZAVORTH_DOCKER_SANDBOX_ENABLED=true.',
      };
    }
    if (!status.dockerReachable) {
      return {
        status: 'not_installed',
        recommendedAction: 'Instalar Docker ou configurar ZAVORTH_DOCKER_CLI_PATH.',
      };
    }
    if (!status.daemonReachable) {
      return {
        status: 'dormant',
        recommendedAction: 'Iniciar Docker Desktop/daemon antes de executar containers.',
      };
    }
    if (!status.imagePresent) {
      return {
        status: 'dormant',
        recommendedAction: status.autoPullEnabled ? null : `docker pull ${status.image}`,
      };
    }
    return {
      status: status.canRun ? 'ready' : 'degraded',
      recommendedAction: status.canRun ? null : 'Rodar npm run sandbox:doctor para diagnostico detalhado.',
    };
  }

  private normalizeFirecrackerStatus(status: FirecrackerSandboxStatus): {
    status: SandboxProfileStatus;
    recommendedAction: string | null;
  } {
    if (!status.enabled) {
      return {
        status: 'disabled',
        recommendedAction: 'Habilitar ZAVORTH_FIRECRACKER_ENABLED=true quando o host suportar.',
      };
    }
    if (status.canRun) {
      return { status: 'ready', recommendedAction: null };
    }
    if (status.detail.includes('Plataforma atual') || status.detail.includes('KVM indisponivel')) {
      return { status: 'unsupported', recommendedAction: 'Usar WSL/Linux com KVM ou cair para container/gVisor.' };
    }
    if (
      status.detail.includes('nao encontrado')
      || status.detail.includes('Rootfs')
      || status.detail.includes('Kernel')
      || status.detail.includes('firecracker')
    ) {
      return { status: 'not_installed', recommendedAction: 'Seguir docs/product-direction.md.' };
    }
    return { status: 'degraded', recommendedAction: 'npm run sandbox:doctor' };
  }

  private buildDoctor(profiles: ZavorthSandboxRuntimeProfile[]): ZavorthSandboxControlPlaneSnapshot['doctor'] {
    const byStatus = (status: SandboxProfileStatus): string[] =>
      profiles.filter((entry) => entry.status === status).map((entry) => entry.id);
    return {
      ready: byStatus('ready'),
      dormant: byStatus('dormant'),
      disabled: byStatus('disabled'),
      notInstalled: byStatus('not_installed'),
      unsupported: byStatus('unsupported'),
      degraded: byStatus('degraded'),
      recommendedCommands: Array.from(new Set(
        profiles
          .map((entry) => entry.recommendedAction)
          .filter((entry): entry is string => Boolean(entry)),
      )).slice(0, 8),
    };
  }

  private buildActions(
    profiles: ZavorthSandboxRuntimeProfile[],
    summary: ZavorthSandboxControlPlaneSnapshot['summary'],
    envelope: ZavorthCapabilityRunEnvelope | null,
    doctor: ZavorthSandboxControlPlaneSnapshot['doctor'],
  ): ZavorthSandboxControlPlaneSnapshot['actions'] {
    const actions: ZavorthSandboxControlPlaneSnapshot['actions'] = [];
    if (!summary.untrustedExecutionReady) {
      actions.push({
        id: 'enable-strong-sandbox',
        label: 'Preparar sandbox forte',
        severity: 'warn',
        reason: 'Nenhum profile container/gVisor/Firecracker/remoto esta pronto para codigo nao confiavel.',
        command: 'npm run sandbox:doctor',
      });
    }
    if (doctor.notInstalled.length > 0) {
      actions.push({
        id: 'install-sandbox-runtime',
        label: 'Instalar runtime de sandbox ausente',
        severity: 'warn',
        reason: `Perfis ausentes: ${doctor.notInstalled.join(', ')}.`,
        command: doctor.recommendedCommands[0] || 'npm run sandbox:doctor',
      });
    }
    if (profiles.some((entry) => entry.id === 'gvisor' && entry.status === 'dormant')) {
      actions.push({
        id: 'configure-gvisor',
        label: 'Configurar gVisor/runsc',
        severity: 'info',
        reason: 'Container existe como tier medio, mas gVisor ainda nao esta configurado.',
        command: 'docs/product-direction.md',
      });
    }
    if (envelope?.status === 'waiting_approval') {
      actions.push({
        id: 'approve-sandbox-plan',
        label: 'Criar approval antes de executar',
        severity: 'critical',
        reason: 'Envelope detectou risco alto, rede elevada ou necessidade de sandbox forte.',
        command: 'npm run ops:sandbox -- --preview',
      });
    }
    return actions.slice(0, 6);
  }

  private resolvePosture(
    profiles: ZavorthSandboxRuntimeProfile[],
    envelope: ZavorthCapabilityRunEnvelope | null,
  ): SandboxPosture {
    if (envelope?.status === 'blocked') {
      return 'critical';
    }
    if (profiles.some((entry) => entry.id === 'firecracker' && entry.canRun)) {
      return 'healthy';
    }
    if (profiles.some((entry) => entry.id === 'gvisor' && entry.canRun)) {
      return 'healthy';
    }
    if (profiles.some((entry) => entry.id === 'container' && entry.canRun)) {
      return 'attention';
    }
    return 'attention';
  }

  private resolveDoctorStatus(
    profiles: ZavorthSandboxRuntimeProfile[],
  ): ZavorthSandboxControlPlaneSnapshot['summary']['doctorStatus'] {
    if (profiles.some((entry) => entry.id === 'firecracker' && entry.canRun)) {
      return 'ready';
    }
    if (profiles.some((entry) => entry.id === 'gvisor' && entry.canRun)) {
      return 'ready';
    }
    if (profiles.some((entry) => entry.status === 'not_installed')) {
      return 'needs_install';
    }
    if (profiles.some((entry) => entry.status === 'unsupported')) {
      return 'unsupported';
    }
    if (profiles.some((entry) => entry.status === 'degraded')) {
      return 'degraded';
    }
    return 'disabled';
  }

  private resolvePreferredProfile(profiles: ZavorthSandboxRuntimeProfile[]): ZavorthSandboxProfile {
    for (const profile of ['firecracker', 'gvisor', 'container', 'wasm', 'process'] as ZavorthSandboxProfile[]) {
      if (profiles.some((entry) => entry.id === profile && entry.canRun)) {
        return profile;
      }
    }
    return 'process';
  }

  private resolveEnvelopeProfile(
    tier: SandboxSecurityLevel,
    preferred: ZavorthSandboxProfile | 'auto',
    profiles: ZavorthSandboxRuntimeProfile[],
  ): ZavorthSandboxProfile {
    if (preferred !== 'auto') {
      return preferred;
    }
    if (tier === 'local-jail') {
      return 'process';
    }
    if (tier === 'wasm') {
      return 'wasm';
    }
    if (tier === 'container') {
      const gvisor = profiles.find((entry) => entry.id === 'gvisor');
      return gvisor?.canRun ? 'gvisor' : 'container';
    }
    if (tier === 'microvm') {
      return 'firecracker';
    }
    return 'process';
  }

  private resolveRisk(
    tier: SandboxSecurityLevel,
    networkPolicy: SandboxNetworkPolicy,
    code: string,
  ): ZavorthMutationRiskLevel {
    if (networkPolicy === 'full-with-approval') {
      return 'critical';
    }
    if (tier === 'microvm') {
      return 'high';
    }
    if (/(?:sudo|rm\s+-rf|curl|wget|npm\s+install|pip\s+install|docker|mount|nmap)/i.test(code)) {
      return 'high';
    }
    if (tier === 'container') {
      return 'medium';
    }
    return 'low';
  }

  private requiresMutationPlan(
    risk: ZavorthMutationRiskLevel,
    networkPolicy: SandboxNetworkPolicy,
    profile: ZavorthSandboxProfile,
  ): boolean {
    return risk === 'high'
      || risk === 'critical'
      || networkPolicy === 'full-with-approval'
      || profile === 'firecracker'
      || profile === 'remote-node';
  }

  private defaultBudget(networkPolicy: SandboxNetworkPolicy | null): ZavorthCapabilityRunEnvelope['budget'] {
    return {
      cpuCores: 1,
      memoryMb: 512,
      diskMb: 512,
      maxDurationMs: 30_000,
      maxNetworkCalls: networkPolicy && networkPolicy !== 'none' ? 5 : 0,
      maxFilesystemWrites: 0,
      maxProcesses: 8,
      maxInvocations: 1,
    };
  }

  private resolveLanguage(input: ZavorthSandboxEnvelopeInput): SandboxLanguage {
    const explicit = String(input.language || '').trim().toLowerCase();
    if (explicit === 'javascript' || explicit === 'python' || explicit === 'shell' || explicit === 'wasm') {
      return explicit;
    }
    const command = String(input.command || '').trim();
    if (command) {
      return this.policy.inferExecutionSandboxLanguage(command);
    }
    return 'javascript';
  }

  private resolveCode(input: ZavorthSandboxEnvelopeInput): string {
    return String(input.code || input.command || '').trim();
  }

  private hasExecutableInput(input: ZavorthSandboxEnvelopeInput): boolean {
    return Boolean(this.resolveCode(input));
  }

  private normalizePreferred(value: unknown): ZavorthSandboxProfile | 'auto' {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'process'
      || normalized === 'container'
      || normalized === 'gvisor'
      || normalized === 'firecracker'
      || normalized === 'remote-node'
      || normalized === 'wasm'
      || normalized === 'none'
    ) {
      return normalized;
    }
    return 'auto';
  }

  private toPolicyPreference(value: ZavorthSandboxProfile): 'auto' | 'local-jail' | 'wasm' | 'container' | 'microvm' {
    if (value === 'process' || value === 'none') {
      return 'local-jail';
    }
    if (value === 'firecracker' || value === 'remote-node') {
      return 'microvm';
    }
    if (value === 'wasm') {
      return 'wasm';
    }
    return 'container';
  }

  private safeDockerStatus(language: SandboxLanguage): DockerSandboxStatus {
    try {
      return this.dockerRuntime.getStatus(language);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Sandbox Control Plane] filesystem check failed', error);
    return {
        enabled: config.dockerSandboxEnabled,
        language,
        image: language === 'python'
          ? config.dockerSandboxPythonImage
          : language === 'shell'
            ? config.dockerSandboxShellImage
            : config.dockerSandboxJavascriptImage,
        dockerReachable: false,
        daemonReachable: false,
        imagePresent: false,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime: config.dockerSandboxRuntime || 'runc',
        canRun: false,
        detail: `Falha ao ler Docker sandbox: ${error instanceof Error ? err.message : String(error)}`,
      };
  }
  }

  private safeFirecrackerStatus(): FirecrackerSandboxStatus {
    try {
      return this.firecrackerRuntime.getStatus();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Sandbox Control Plane] filesystem check failed', error);
    return {
        enabled: config.firecrackerEnabled,
        transport: this.platform === 'win32' ? 'wsl' : 'direct',
        firecrackerReachable: false,
        kvmAvailable: false,
        kernelPresent: false,
        rootfsPresent: false,
        canRun: false,
        detail: `Falha ao ler Firecracker: ${error instanceof Error ? err.message : String(error)}`,
      };
  }
  }

  private safeWasmStatus(): WasmSandboxStatus {
    try {
      return this.wasmCapability.getStatus('wasm');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Sandbox Control Plane] filesystem check failed', error);
    return {
        enabled: config.wasmSandboxEnabled,
        available: false,
        canRun: false,
        detail: `Falha ao ler Wasm sandbox: ${error instanceof Error ? err.message : String(error)}`,
        runtime: 'node-webassembly',
        supportedLanguages: ['wasm'],
        recommendedAction: 'npm run sandbox:wasm:smoke',
      };
  }
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private hash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
