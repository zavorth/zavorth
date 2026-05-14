import type { IntegrationCatalogEntry, IntegrationCatalogSnapshot } from '../contracts/IntegrationHubContract.js';
import type { NodeMeshSnapshot } from '../contracts/NodeMeshContract.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import type { OperationsHealthSnapshot } from '../observability/OperationsHealthService.js';
import { OperationsHealthService } from '../observability/OperationsHealthService.js';

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
    } as any);
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
        headline: `Zavorth expoe ${summary.total} modos oficiais no Runtime & Security Mesh.`,
        operatorSummary: [
          `${summary.coreReady} tier(s) core pronto(s) agora.`,
          `${summary.extensionReady} extensao(oes) ja ampliam o runtime.`,
          `${summary.partial} modo(s) ainda estao em preparo e ${summary.planned} seguem planejados.`,
        ].join(' '),
      },
    };
  }

  private buildLocalJailMode(): ZavorthRuntimeModeSnapshot {
    return {
      id: 'local-jail',
      label: 'Local jail',
      family: 'local',
      tier: 'core',
      readiness: 'ready',
      available: true,
      operatorSummary: 'Runtime efemero local para codigo confiavel e experimentos de baixo risco.',
      recommendedFor: 'Trechos leves, validacoes curtas e exploracao rapida sem depender de bridge externa.',
      actionHint: '/runtime',
      details: [
        'Isolamento leve para codigo confiavel.',
        'Melhor ponto de partida antes de subir para container ou microVM.',
      ],
    };
  }

  private buildContainerMode(health: OperationsHealthSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness = health.docker.canRun
      ? 'ready'
      : (health.docker.enabled || health.docker.available ? 'partial' : 'planned');
    const runtimeLabel = health.docker.sandboxRuntime || 'runc';
    const gvisorLabel = health.docker.gvisorActive ? 'gVisor ativo' : 'gVisor inativo';

    return {
      id: 'container-hardened',
      label: 'Container endurecido',
      family: 'container',
      tier: 'core',
      readiness,
      available: health.docker.canRun,
      operatorSummary: health.docker.canRun
        ? `Container forte pronto com ${runtimeLabel}. ${gvisorLabel}.`
        : `Container forte ainda nao esta pronto. ${health.docker.detail || 'Falta disponibilidade do runtime.'}`,
      recommendedFor: 'Codigo de risco moderado, shell sensivel, rede bloqueada e validacoes seguras.',
      actionHint: health.docker.recommendedAction || 'npm run sandbox:doctor',
      details: [
        `Runtime: ${runtimeLabel}.`,
        `${gvisorLabel}.`,
        `${health.docker.hardeningActive ? 'Hardening ativo.' : 'Hardening ainda incompleto.'}`,
        `JavaScript: ${health.docker.languages.javascript.detail}`,
        `Python: ${health.docker.languages.python.detail}`,
      ],
    };
  }

  private buildMicrovmMode(health: OperationsHealthSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness = health.firecracker.canRun
      ? 'ready'
      : (health.firecracker.enabled || health.firecracker.kernelPresent || health.firecracker.rootfsPresent
        ? 'partial'
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
      operatorSummary: health.firecracker.canRun
        ? `MicroVM pronta via ${transport} para alto risco com never-downgrade.`
        : `MicroVM ainda nao esta completamente pronta. ${health.firecracker.detail || 'Falta preparar o host da microVM.'}`,
      recommendedFor: 'Conteudo nao confiavel, origem externa e execucoes que nao podem cair para container.',
      actionHint: health.firecracker.recommendedAction || 'npm run sandbox:firecracker:smoke',
      details: [
        `Transport: ${transport}.`,
        `KVM: ${health.firecracker.kvmAvailable ? 'disponivel' : 'indisponivel'}.`,
        `Kernel: ${health.firecracker.kernelPresent ? 'presente' : 'ausente'}.`,
        `Rootfs: ${health.firecracker.rootfsPresent ? 'presente' : 'ausente'}.`,
      ],
    };
  }

  private buildWasmMode(health: OperationsHealthSnapshot): ZavorthRuntimeModeSnapshot {
    const readiness: ZavorthRuntimeModeReadiness = health.wasm.canRun
      ? 'ready'
      : (health.wasm.enabled || health.wasm.available ? 'partial' : 'planned');

    return {
      id: 'wasm-sandbox',
      label: 'Wasm sandbox',
      family: 'wasm',
      tier: 'extension',
      readiness,
      available: health.wasm.canRun,
      operatorSummary: health.wasm.canRun
        ? 'Tier Wasm pronto para modulos WebAssembly literais e controlados.'
        : health.wasm.detail,
      recommendedFor: 'Execucao controlada de modulos .wasm leves antes de escalar para container ou microVM.',
      actionHint: health.wasm.recommendedAction,
      details: [
        `Runtime: ${health.wasm.runtime}.`,
        `Linguagens iniciais: ${(health.wasm.supportedLanguages || []).join(', ') || 'nenhuma'}.`,
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
          ? `${nodeMesh.summary.paired} node(s) pareado(s), mas o transporte ainda pede ajuste.`
          : 'Ainda nao ha node host pareado para ampliar o runtime.',
      recommendedFor: 'Execucao remota segura, device actions e expansao do Zavorth para hosts pareados.',
      actionHint: selected?.id ? `/nodeinvoke ${selected.id} system.run` : '/nodepair headless',
      details: [
        `Nodes visiveis: ${nodeMesh.summary.total}.`,
        `Pareados: ${nodeMesh.summary.paired}.`,
        `Invocaveis: ${nodeMesh.summary.invokable}.`,
        selected?.nextAction || 'Gere um pairing draft para subir o primeiro node host.',
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
          ? `${manifest.label} pronto para ampliar o roteamento remoto do Zavorth.`
          : `${manifest.label} existe no hub, mas ainda precisa de configuracao guiada.`)
        : 'Nenhum sidecar remoto first-class foi registrado ainda no Integration Hub.',
      recommendedFor: manifest?.summary || 'Roteamento remoto, sidecars especializados e bridges externas.',
      actionHint: doctor?.nextAction?.command || '/connect AIGateway',
      details: [
        manifest?.description || 'Sem manifesto detalhado carregado.',
        doctor?.nextAction?.reason || 'Use o Integration Hub para preparar o sidecar remoto.',
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

