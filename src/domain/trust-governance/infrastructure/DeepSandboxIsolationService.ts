import type { ExecutionRequest } from '../../../contracts/ExecutionContract.js';
import { config } from '../../../config/index.js';
import { SandboxExecutionService, type SandboxTierDecision } from '../../../services/SandboxExecutionService.js';
import { WasmSandboxCapabilityService, type WasmSandboxStatus } from '../../../services/WasmSandboxCapabilityService.js';
import { DockerSandboxRuntime, type DockerSandboxStatus } from '../../../services/sandbox/DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime, type FirecrackerSandboxStatus } from '../../../services/sandbox/FirecrackerSandboxRuntime.js';

export type DeepSandboxPosture =
  | 'microvm-kernel'
  | 'container-gvisor'
  | 'container-runc'
  | 'wasm-only'
  | 'local-jail';

export type DeepSandboxSnapshot = {
  generatedAt: string;
  aggressiveOptIn: boolean;
  posture: DeepSandboxPosture;
  preferredTier: 'microvm' | 'container' | 'wasm' | 'local-jail';
  docker: DockerSandboxStatus & { gvisorActive: boolean };
  firecracker: FirecrackerSandboxStatus;
  wasm: WasmSandboxStatus;
  summary: string;
  nextAction: string;
};

export type DeepSandboxDecision = {
  requestedTier: 'microvm' | 'container' | 'wasm' | 'local-jail';
  posture: DeepSandboxPosture;
  reason: string;
  policyTier: SandboxTierDecision | null;
};

type DockerRuntimePort = Pick<DockerSandboxRuntime, 'getStatus' | 'isGvisorActive'>;
type FirecrackerRuntimePort = Pick<FirecrackerSandboxRuntime, 'getStatus'>;
type WasmCapabilityPort = Pick<WasmSandboxCapabilityService, 'getStatus'>;

export class DeepSandboxIsolationService {
  private readonly sandboxExecution: SandboxExecutionService;
  private readonly dockerRuntime: DockerRuntimePort;
  private readonly firecrackerRuntime: FirecrackerRuntimePort;
  private readonly wasmCapability: WasmCapabilityPort;
  private readonly now: () => Date;

  constructor(options: {
    sandboxExecutionService?: SandboxExecutionService;
    dockerRuntime?: DockerRuntimePort;
    firecrackerRuntime?: FirecrackerRuntimePort;
    wasmCapabilityService?: WasmCapabilityPort;
    now?: () => Date;
  } = {}) {
    this.sandboxExecution = options.sandboxExecutionService || new SandboxExecutionService();
    this.dockerRuntime = options.dockerRuntime || new DockerSandboxRuntime();
    this.firecrackerRuntime = options.firecrackerRuntime || new FirecrackerSandboxRuntime();
    this.wasmCapability = options.wasmCapabilityService || new WasmSandboxCapabilityService();
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: {
    aggressiveOptIn?: boolean;
    language?: 'javascript' | 'python' | 'shell' | 'wasm';
  } = {}): DeepSandboxSnapshot {
    const aggressiveOptIn = input.aggressiveOptIn === true;
    const language = input.language || 'javascript';
    const docker = this.dockerRuntime.getStatus(language === 'wasm' ? 'javascript' : language);
    const gvisorActive = docker.canRun && this.dockerRuntime.isGvisorActive();
    const firecracker = this.firecrackerRuntime.getStatus();
    const wasm = this.wasmCapability.getStatus('wasm');
    const posture = this.resolvePosture({ aggressiveOptIn, docker, gvisorActive, firecracker, wasm });
    const preferredTier = this.resolvePreferredTier({ posture });

    return {
      generatedAt: this.now().toISOString(),
      aggressiveOptIn,
      posture,
      preferredTier,
      docker: {
        ...docker,
        gvisorActive,
      },
      firecracker,
      wasm,
      summary: this.buildSummary(posture, aggressiveOptIn, docker, firecracker, wasm, gvisorActive),
      nextAction: this.buildNextAction(posture, docker, firecracker),
    };
  }

  public resolveDecision(
    request: ExecutionRequest,
    input: {
      aggressiveOptIn?: boolean;
      language?: 'javascript' | 'python' | 'shell' | 'wasm';
    } = {},
  ): DeepSandboxDecision {
    const snapshot = this.buildSnapshot(input);
    const policyTier = this.sandboxExecution.resolveSandboxTier(request);

    if (snapshot.aggressiveOptIn && snapshot.firecracker.canRun) {
      return {
        requestedTier: 'microvm',
        posture: snapshot.posture,
        reason: 'Opt-in agressivo ativo e Firecracker operavel; promovendo execucao para isolamento em kernel.',
        policyTier,
      };
    }

    if (policyTier?.tier === 'microvm') {
      return {
        requestedTier: snapshot.firecracker.canRun ? 'microvm' : 'container',
        posture: snapshot.posture,
        reason: snapshot.firecracker.canRun
          ? 'Politica exigiu microvm e o tier esta disponivel.'
          : 'Politica exigiu microvm, mas o host caiu com honestidade para container guardado.',
        policyTier,
      };
    }

    if (policyTier?.tier === 'container') {
      return {
        requestedTier: 'container',
        posture: snapshot.posture,
        reason: snapshot.docker.gvisorActive
          ? 'Politica exigiu container e o runtime gVisor esta ativo.'
          : 'Politica exigiu container; usando sandbox de container padrao.',
        policyTier,
      };
    }

    if (snapshot.aggressiveOptIn && snapshot.docker.canRun) {
      return {
        requestedTier: 'container',
        posture: snapshot.posture,
        reason: snapshot.docker.gvisorActive
          ? 'Opt-in agressivo sem Firecracker caiu para container com gVisor.'
          : 'Opt-in agressivo sem Firecracker caiu para container guardado.',
        policyTier,
      };
    }

    if (snapshot.wasm.canRun) {
      return {
        requestedTier: 'wasm',
        posture: snapshot.posture,
        reason: 'Nenhum tier mais forte requerido; Wasm segue disponivel para modulos controlados.',
        policyTier,
      };
    }

    return {
      requestedTier: 'local-jail',
      posture: snapshot.posture,
      reason: 'Nenhum tier profundo operavel; mantendo jail local com reporting honesto.',
      policyTier,
    };
  }

  private resolvePosture(input: {
    aggressiveOptIn: boolean;
    docker: DockerSandboxStatus;
    gvisorActive: boolean;
    firecracker: FirecrackerSandboxStatus;
    wasm: WasmSandboxStatus;
  }): DeepSandboxPosture {
    if (input.aggressiveOptIn && input.firecracker.canRun) {
      return 'microvm-kernel';
    }
    if (input.docker.canRun && input.gvisorActive) {
      return 'container-gvisor';
    }
    if (input.docker.canRun) {
      return 'container-runc';
    }
    if (input.wasm.canRun) {
      return 'wasm-only';
    }
    return 'local-jail';
  }

  private resolvePreferredTier(input: { posture: DeepSandboxPosture }): DeepSandboxSnapshot['preferredTier'] {
    if (input.posture === 'microvm-kernel') {
      return 'microvm';
    }
    if (input.posture === 'container-gvisor' || input.posture === 'container-runc') {
      return 'container';
    }
    if (input.posture === 'wasm-only') {
      return 'wasm';
    }
    return 'local-jail';
  }

  private buildSummary(
    posture: DeepSandboxPosture,
    aggressiveOptIn: boolean,
    docker: DockerSandboxStatus,
    firecracker: FirecrackerSandboxStatus,
    wasm: WasmSandboxStatus,
    gvisorActive: boolean,
  ): string {
    if (posture === 'microvm-kernel') {
      return 'Firecracker operavel; o host suporta isolamento profundo em microVM para trilhas agressivas.';
    }
    if (posture === 'container-gvisor') {
      return aggressiveOptIn
        ? 'Opt-in agressivo ativo com container isolado por gVisor.'
        : 'Docker alcancavel e gVisor ativo para execucoes de container supervisionadas.';
    }
    if (posture === 'container-runc') {
      return `Docker alcancavel sem gVisor ativo; runtime atual: ${docker.sandboxRuntime || 'runc'}.`;
    }
    if (posture === 'wasm-only') {
      return wasm.detail;
    }
    return firecracker.detail || 'Sem Firecracker/Docker operavel; somente jail local disponivel.';
  }

  private buildNextAction(
    posture: DeepSandboxPosture,
    docker: DockerSandboxStatus,
    firecracker: FirecrackerSandboxStatus,
  ): string {
    if (posture === 'microvm-kernel') {
      return 'Rode npm run qa:sandbox:aggressive para validar a trilha profunda no host atual.';
    }
    if (posture === 'container-gvisor') {
      return 'Mantenha runsc/gVisor ativo e rode npm run qa:sandbox:aggressive para preservar o tier guardado.';
    }
    if (posture === 'container-runc') {
      return docker.sandboxRuntime === 'runsc'
        ? 'Revalide o Docker daemon e gVisor; o runtime configurado nao ficou realmente ativo.'
        : 'Ative ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc ou Firecracker para endurecer o tier profundo.';
    }
    if (firecracker.detail) {
      return firecracker.detail;
    }
    return `Ative ZAVORTH_FIRECRACKER_ENABLED=${config.firecrackerEnabled ? 'true' : 'true'} ou o sandbox Docker para sair do jail local.`;
  }
}
