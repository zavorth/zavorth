import type { IntegrationCatalogEntry, IntegrationCatalogSnapshot } from '../contracts/IntegrationHubContract.js';
import type { NodeMeshSnapshot } from '../contracts/NodeMeshContract.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import type { OperationsHealthSnapshot } from '../observability/OperationsHealthService.js';
import { OperationsHealthService } from '../observability/OperationsHealthService.js';
import type { LogRepository } from '../storage/LogRepository.js';

type OperationsHealthLike = Pick<OperationsHealthService, 'readSnapshot'> &
  Partial<Pick<OperationsHealthService, 'readSnapshotFast'>>;
type IntegrationHubLike = Pick<IntegrationHubService, 'buildCatalogSnapshot'>;
type NodeMeshLike = Pick<ZavorthNodeMeshService, 'buildSnapshot'>;

type ZavorthRuntimeModesRuntime = {
  now?: () => Date;
  operationsHealthService?: OperationsHealthLike;
  integrationHubService?: IntegrationHubLike;
  nodeMeshService?: NodeMeshLike;
};

export type ZavorthRuntimeModeReadiness = 'ready' | 'partial' | 'planned' | 'disabled';

export type ZavorthRuntimeModeSnapshot = {
  id: string;
  label: string;
  family: 'local' | 'container' | 'microvm' | 'wasm' | 'node-host' | 'remote-sidecar';
  tier: 'core' | 'extension';
  readiness: ZavorthRuntimeModeReadiness;
  available: boolean;
  operatorSummary: string;
  recommendedFor: string;
  actionHint: string | null;
  details: string[];
};

export type ZavorthRuntimeModesSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
    coreReady: number;
    extensionReady: number;
  };
  entries: ZavorthRuntimeModeSnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthRuntimeModesService {
  private readonly now: () => Date;
  private readonly operationsHealth: OperationsHealthLike;
  private readonly integrationHub: IntegrationHubLike;
  private readonly nodeMesh: NodeMeshLike;

  constructor(runtime: ZavorthRuntimeModesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.operationsHealth = runtime.operationsHealthService || new OperationsHealthService({
      log: () => undefined,
      getRecentLogs: () => [],
    } as unknown as LogRepository);
    this.integrationHub = runtime.integrationHubService || new IntegrationHubService();
    this.nodeMesh = runtime.nodeMeshService || new ZavorthNodeMeshService();
  }

  public buildSnapshot(input: { live?: boolean } = {}): ZavorthRuntimeModesSnapshot {
    const health = input.live || typeof this.operationsHealth.readSnapshotFast !== 'function'
      ? this.operationsHealth.readSnapshot()
      : this.operationsHealth.readSnapshotFast();
    const integrations = this.integrationHub.buildCatalogSnapshot();
    const nodeMesh = this.nodeMesh.buildSnapshot();
    const entries = [
      this.buildLocalJailMode(),
      this.buildContainerMode(health),
      this.buildMicrovmMode(health),
      this.buildWasmMode(health),
      this.buildNodeHostMode(nodeMesh),
      this.buildRemoteSidecarMode(integrations),
    ];
    const summary = this.summarize(entries);

    return {
      generatedAt: this.now().toISOString(),
      summary,
      entries,
      narrative: {
        headline: `Zavorth exposes ${summary.total} modos oficiais no Runtime & Security Mesh.`,
        operatorSummary: [
          `${summary.coreReady} tier(s) core ready agora.`,
          `${summary.extensionReady} extension(s) already ampliam o runtime.`,
          `${summary.partial} modo(s) ainda are em preparo e ${summary.planned} seguem planejados.`,
        ].join(' '),
      },
    };
  }

  private buildLocalJailMode(): ZavorthRuntimeModeSnapshot {
    return {
      id: 'local-jail',
      label: 'local jail',
      family: 'local',
      tier: 'core',
      readiness: 'ready',
      available: true,
      operatorSummary: 'Runtime efemero local para code trusted e experimentos de baixo risk.',
      recommendedFor: 'Trechos leves, validations curtas e exploraction rapida without depender de bridge external.',
      actionHint: '/runtime',
      details: [
        'Isolamento leve para code trusted.',
        'Melhor ponto de partida before subir para container ou microVM.',
      ],
    };
  }

  private buildContainerMode(health: OperationsHealthSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness = health.docker.canRun ? 'ready'
      : (health.docker.enabled || health.docker.available ? 'partial' : 'planned');
    const runtimeLabel = health.docker.sandboxRuntime || 'runc';
    const gvisorLabel = health.docker.gvisorActive ? 'gVisor active' : 'gVisor inactive';

    return {
      id: 'container-hardened',
      label: 'Container endurecido',
      family: 'container',
      tier: 'core',
      readiness,
      available: health.docker.canRun,
      operatorSummary: health.docker.canRun ? `Container forte ready with ${runtimeLabel}. ${gvisorLabel}.`
        : `Strong container is not ready yet. ${health.docker.detail || 'Runtime availability is missing.'}`,
      recommendedFor: 'code de risk moderado, shell sensitive, rede blocked e validations seguras.',
      actionHint: health.docker.recommendedAction || 'npm run sandbox:doctor',
      details: [
        `Runtime: ${runtimeLabel}.`,
        `${gvisorLabel}.`,
        `${health.docker.hardeningActive ? 'Hardening active.' : 'Hardening ainda incompleto.'}`,
        `JavaScript: ${health.docker.languages.javascript.detail}`,
        `Python: ${health.docker.languages.python.detail}`,
      ],
    };
  }

  private buildMicrovmMode(health: OperationsHealthSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness = health.firecracker.canRun ? 'ready'
      : (health.firecracker.enabled || health.firecracker.kernelPresent || health.firecracker.rootfsPresent ? 'partial'
        : 'planned');
    const transport = health.firecracker.transport === 'wsl'
      ? 'bridge WSL'
      : (health.firecracker.transport === 'direct' ? 'host Linux' : 'runtime dedicado');

    return {
      id: 'microvm-firecracker',
      label: 'MicroVM Firecracker',
      family: 'microvm',
      tier: 'core',
      readiness,
      available: health.firecracker.canRun,
      operatorSummary: health.firecracker.canRun ? `MicroVM ready via ${transport} para alto risk with never-downgrade.`
        : `MicroVM is not fully ready yet. ${health.firecracker.detail || 'The MicroVM host still needs preparation.'}`,
      recommendedFor: 'Untrusted content, external origin, and executions that cannot fall back to container.',
      actionHint: health.firecracker.recommendedAction || 'npm run sandbox:firecracker:smoke',
      details: [
        `Transport: ${transport}.`,
        `KVM: ${health.firecracker.kvmAvailable ? 'available' : 'unavailable'}.`,
        `Kernel: ${health.firecracker.kernelPresent ? 'present' : 'missing'}.`,
        `Rootfs: ${health.firecracker.rootfsPresent ? 'present' : 'missing'}.`,
      ],
    };
  }

  private buildWasmMode(health: OperationsHealthSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness = health.wasm.canRun ? 'ready'
      : (health.wasm.enabled || health.wasm.available ? 'partial' : 'planned');

    return {
      id: 'wasm-sandbox',
      label: 'Wasm sandbox',
      family: 'wasm',
      tier: 'extension',
      readiness,
      available: health.wasm.canRun,
      operatorSummary: health.wasm.canRun ? 'Tier Wasm ready for modulos WebAssembly literais e controlados.'
        : health.wasm.detail,
      recommendedFor: 'Execution controlada de modulos .wasm leves before escalar para container ou microVM.',
      actionHint: health.wasm.recommendedAction,
      details: [
        `Runtime: ${health.wasm.runtime}.`,
        `Initial languages: ${(health.wasm.supportedLanguages || []).join(', ') || 'none'}.`,
        health.wasm.detail,
      ],
    };
  }

  private buildNodeHostMode(nodeMesh: NodeMeshSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness =
      nodeMesh.summary.online > 0 && nodeMesh.summary.invokable > 0
        ? 'ready'
        : nodeMesh.summary.paired > 0
          ? 'partial'
          : 'planned';
    const selected = nodeMesh.selected || nodeMesh.entries[0] || null;

    return {
      id: 'node-host',
      label: 'Node host',
      family: 'node-host',
      tier: 'extension',
      readiness,
      available: readiness === 'ready',
      operatorSummary: readiness === 'ready'
        ? `${nodeMesh.summary.online} node(s) online e invocavel(is) agora.`
        : readiness === 'partial'
          ? `${nodeMesh.summary.paired} node(s) paired(s), mas o transporte ainda pede ajuste.`
          : 'There is no paired node host to expand the runtime yet.',
      recommendedFor: 'Safe remote execution, device actions, and Zavorth expansion for paired hosts.',
      actionHint: selected?.id ? `/nodeinvoke ${selected.id} system.run` : '/nodepair headless',
      details: [
        `Visible nodes: ${nodeMesh.summary.total}.`,
        `Pareados: ${nodeMesh.summary.paired}.`,
        `Invocaveis: ${nodeMesh.summary.invokable}.`,
        selected?.nextAction || 'Generate a pairing draft for subir o primeiro node host.',
      ],
    };
  }

  private buildRemoteSidecarMode(integrations: IntegrationCatalogSnapshot): ZavorthRuntimeModeSnapshot {
    const entry = this.findIntegration(integrations, 'AIGateway');
    const readiness: ZavorthRuntimeModeReadiness =
      entry?.readiness === 'ready'
        ? 'ready'
        : entry?.readiness === 'needs_configuration'
          ? 'partial'
          : (entry ? 'planned' : 'disabled');
    const manifest = entry?.manifest || null;
    const doctor = entry?.doctor || null;

    return {
      id: 'remote-sidecar',
      label: manifest?.label || 'Remote sidecar',
      family: 'remote-sidecar',
      tier: 'extension',
      readiness,
      available: readiness === 'ready',
      operatorSummary: manifest
        ? (entry?.readiness === 'ready'
          ? `${manifest.label} ready for ampliar o roteamento remote do Zavorth.`
          : `${manifest.label} exists in the hub, but still needs guided configuration.`)
        : 'No sidecar remote first-class foi registrado ainda no Integration Hub.',
      recommendedFor: manifest?.summary || 'Roteamento remote, sidecars especializados e bridges externas.',
      actionHint: doctor?.nextAction?.command || '/connect AIGateway',
      details: [
        manifest?.description || 'without manifest detalhado loaded.',
        doctor?.nextAction?.reason || 'Use Integration Hub to prepare the remote sidecar.',
      ],
    };
  }

  private findIntegration(integrations: IntegrationCatalogSnapshot, integrationId: string): IntegrationCatalogEntry | null {
    return (integrations.entries || []).find((item) => item.manifest.id === integrationId) || null;
  }

  private summarize(entries: ZavorthRuntimeModeSnapshot[]): ZavorthRuntimeModesSnapshot['summary'] {
    const summary = {
      total: entries.length,
      ready: 0,
      partial: 0,
      planned: 0,
      disabled: 0,
      coreReady: 0,
      extensionReady: 0,
    };

    for (const entry of entries) {
      summary[entry.readiness] += 1;
      if (entry.readiness === 'ready') {
        if (entry.tier === 'core') {
          summary.coreReady += 1;
        } else {
          summary.extensionReady += 1;
        }
      }
    }

    return summary;
  }
}
