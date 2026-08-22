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
        reason: 'Aggressive opt-in active and Firecracker operational; promoting execution to kernel isolation.',
        policyTier,
      };
    }

    if (policyTier?.tier === 'microvm') {
      return {
        requestedTier: snapshot.firecracker.canRun ? 'microvm' : 'container',
        posture: snapshot.posture,
        reason: snapshot.firecracker.canRun ? 'Policy required microvm and the tier is available.'
          : 'Policy required microvm, but the host gracefully fell back to guarded container.',
        policyTier,
      };
    }

    if (policyTier?.tier === 'container') {
      return {
        requestedTier: 'container',
        posture: snapshot.posture,
        reason: snapshot.docker.gvisorActive ? 'Policy required container and gVisor runtime is active.'
          : 'Policy required container; using default container sandbox.',
        policyTier,
      };
    }

    if (snapshot.aggressiveOptIn && snapshot.docker.canRun) {
      return {
        requestedTier: 'container',
        posture: snapshot.posture,
        reason: snapshot.docker.gvisorActive ? 'Aggressive opt-in without Firecracker fell back to container with gVisor.'
          : 'Aggressive opt-in without Firecracker fell back to guarded container.',
        policyTier,
      };
    }

    if (snapshot.wasm.canRun) {
      return {
        requestedTier: 'wasm',
        posture: snapshot.posture,
        reason: 'No stronger tier required; Wasm remains available for controlled modules.',
        policyTier,
      };
    }

    return {
      requestedTier: 'local-jail',
      posture: snapshot.posture,
      reason: 'No deep tier operational; keeping local jail with honest reporting.',
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
    _gvisorActive: boolean,
  ): string {
    if (posture === 'microvm-kernel') {
      return 'Firecracker operational; the host supports deep isolation in microVM for aggressive tracks.';
    }
    if (posture === 'container-gvisor') {
      return aggressiveOptIn ? 'Aggressive opt-in active with container isolated by gVisor.'
        : 'Docker reachable and gVisor active for supervised container executions.';
    }
    if (posture === 'container-runc') {
      return `Docker reachable without gVisor active; current runtime: ${docker.sandboxRuntime || 'runc'}.`;
    }
    if (posture === 'wasm-only') {
      return wasm.detail;
    }
    return firecracker.detail || 'without operable Firecracker/Docker; only local jail is available.';
  }

  private buildNextAction(
    posture: DeepSandboxPosture,
    docker: DockerSandboxStatus,
    firecracker: FirecrackerSandboxStatus,
  ): string {
    if (posture === 'microvm-kernel') {
      return 'Run npm run qa:sandbox:aggressive to validate the deep track on the current host.';
    }
    if (posture === 'container-gvisor') {
      return 'Keep runsc/gVisor active and run npm run qa:sandbox:aggressive to preserve the guarded tier.';
    }
    if (posture === 'container-runc') {
      return docker.sandboxRuntime === 'runsc'
        ? 'Revalidate the Docker daemon and gVisor; the configured runtime did not actually become active.'
        : 'Enable ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc or Firecracker to harden the deep tier.';
    }
    if (firecracker.detail) {
      return firecracker.detail;
    }
    return `Enable ZAVORTH_FIRECRACKER_ENABLED=${config.firecrackerEnabled ? 'true' : 'true'} or the Docker sandbox to exit the local jail.`;
  }
}
