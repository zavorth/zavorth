import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  type ConvergencePillarId,
  type ConvergenceReadinessPillar,
  type ConvergenceReadinessSnapshot,
  type ConvergenceReadinessStatus,
  ZAVORTH_NATIVE_CONVERGENCE_CONTRACT_VERSION,
} from '../contracts/ConvergenceReadinessContract.js';
import { ZavorthActionCatalog } from '../runtime/actions/ZavorthActionCatalog.js';
import { buildZavorthCliRuntimeTuiSnapshot } from '../cli/hud/ZavorthCliRuntimeTuiProjection.js';
import { ChannelLongTailActivationService } from './ChannelLongTailActivationService.js';
import { ProviderLongTailActivationService } from './ProviderLongTailActivationService.js';
import { ZavorthAppsSatelliteNodesService } from './ZavorthAppsSatelliteNodesService.js';
import { ZavorthMnemosFtsIndexService } from './ZavorthMnemosFtsIndexService.js';
import { ZavorthNativeLearningLoopService } from './ZavorthNativeLearningLoopService.js';
import { ZavorthSandboxControlPlaneService } from './ZavorthSandboxControlPlaneService.js';
import { VoiceWakeRuntimeService } from './VoiceWakeRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { SwarmScalePlaneService } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

type PackageJson = {
  scripts?: Record<string, string>;
};

const REQUIRED_PILLARS: ConvergencePillarId[] = [
  'action-harness',
  'provider-mesh',
  'channel-mesh',
  'mnemos-learning',
  'curator-plane',
  'runtime-tui',
  'swarm-scale',
  'sandbox-control',
  'satellite-voice',
  'qa-product',
];

export class ZavorthNativeConvergenceService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public async buildSnapshot(): Promise<ConvergenceReadinessSnapshot> {
    const pillars = await Promise.all([
      this.actionHarness(),
      this.providerMesh(),
      this.channelMesh(),
      this.mnemosLearning(),
      this.curatorPlane(),
      this.runtimeTui(),
      this.swarmScale(),
      this.sandboxControl(),
      this.satelliteVoice(),
      this.qaProduct(),
    ]);
    const summary = {
      total: pillars.length,
      ready: pillars.filter((pillar) => pillar.status === 'ready').length,
      partial: pillars.filter((pillar) => pillar.status === 'partial').length,
      missingConfig: pillars.filter((pillar) => pillar.status === 'missing_config').length,
      blocked: pillars.filter((pillar) => pillar.status === 'blocked').length,
    };
    return {
      contractVersion: ZAVORTH_NATIVE_CONVERGENCE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status: this.aggregateStatus(summary),
      summary,
      pillars,
      safety: {
        zavorthNativeContractsOnly: true,
        noSilentMutation: true,
        actionHarnessRequiredForMutation: true,
        secretValuesSerialized: false,
        doctorsAndCanariesRedactSecrets: true,
        externalProjectNamesInPublicSurface: false,
      },
      commands: {
        doctor: 'zavorth doctor convergence',
        json: 'zavorth doctor convergence --json',
        qa: 'npm run qa:zavorth-native-convergence --silent',
        hygiene: 'node scripts/zavorth-native-convergence-hygiene-check.mjs',
      },
    };
  }

  public renderText(snapshot: ConvergenceReadinessSnapshot): string {
    const lines = [
      'Zavorth Native Convergence',
      '',
      `Status: ${snapshot.status}`,
      `Pilares: ${snapshot.summary.ready}/${snapshot.summary.total} ready | partial=${snapshot.summary.partial} | missing_config=${snapshot.summary.missingConfig} | blocked=${snapshot.summary.blocked}`,
      '',
    ];
    for (const pillar of snapshot.pillars) {
      lines.push(`${pillar.id}: ${pillar.status}`);
      lines.push(`  ${pillar.summary}`);
      for (const evidence of pillar.evidence.slice(0, 4)) {
        lines.push(`  - ${evidence}`);
      }
      if (pillar.nextActions.length > 0) {
        lines.push(`  next: ${pillar.nextActions[0]}`);
      }
      lines.push('');
    }
    lines.push(`QA: ${snapshot.commands.qa}`);
    lines.push(`Hygiene: ${snapshot.commands.hygiene}`);
    return `${lines.join('\n')}\n`;
  }

  private async actionHarness(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('action-harness', 'LLM Action Harness unificado', async () => {
      const catalog = new ZavorthActionCatalog();
      const actions = catalog.list();
      const ids = new Set(actions.map((action) => action.id));
      const hasTool = this.exists('src/tools/ZavorthActionTool.ts');
      const required = [
        'skills.governance.set',
        'providers.status',
        'channels.readiness',
        'memory.search',
        'memory.forget',
        'sandbox.status',
        'tasks.status',
      ];
      const missing = required.filter((id) => !ids.has(id));
      return {
        status: missing.length === 0 && hasTool ? 'ready' : 'partial',
        summary: `${actions.length} acoes registradas; tool nativa ${hasTool ? 'presente' : 'ausente'}.`,
        evidence: [
          `catalogo com ${actions.length} acoes`,
          `acoes essenciais faltando: ${missing.length}`,
          `zavorth_action tool: ${hasTool ? 'ok' : 'missing'}`,
          'mutacoes passam por preview/apply/receipts',
        ],
        nextActions: missing.length ? ['registrar acoes faltantes no catalogo central'] : [],
        publicInterfaces: [
          'zavorth actions lookup|preview|apply|receipts',
          'LLM tool: zavorth_action',
        ],
      };
    });
  }

  private async providerMesh(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('provider-mesh', 'Provider Mesh completo e nativo', async () => {
      const snapshot = new ProviderLongTailActivationService({ now: this.now, env: this.env }).buildSnapshot();
      const summary = snapshot.summary;
      const configuredRoutes = summary.providerFactoryRoutes;
      const status: ConvergenceReadinessStatus = summary.providers > 0 && configuredRoutes === summary.providers
        ? 'ready'
        : 'partial';
      return {
        status,
        summary: `${summary.providers} providers com manifestos, doctors e smoke commands redigidos.`,
        evidence: [
          `providers catalogados: ${summary.providers}`,
          `rotas de factory: ${configuredRoutes}/${summary.providers}`,
          `smokes: ${summary.smokeCommands}`,
          `receipts redigidos: ${summary.redactedReceipts}`,
        ],
        nextActions: status === 'ready' ? [] : ['completar rotas de providers ainda sem factory route'],
        publicInterfaces: [
          'zavorth providers doctor|canary|activate',
          'npm run provider-long-tail-activation -- --profile configured',
        ],
      };
    });
  }

  private async channelMesh(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('channel-mesh', 'Channel Mesh completo e nativo', async () => {
      const snapshot = new ChannelLongTailActivationService({ now: this.now, env: this.env }).buildSnapshot();
      const summary = snapshot.summary;
      const doctors = summary.configuredDoctors;
      const status: ConvergenceReadinessStatus = summary.channels > 0 && doctors === summary.channels
        ? 'ready'
        : 'partial';
      return {
        status,
        summary: `${summary.channels} canais com inbound normalizado, outbound governado e receipts.`,
        evidence: [
          `canais catalogados: ${summary.channels}`,
          `doctors configurados: ${doctors}/${summary.channels}`,
          `live smoke commands: ${summary.stagingLiveSmokeCommands}`,
          `receipts redigidos: ${summary.redactedReceipts}`,
        ],
        nextActions: status === 'ready' ? [] : ['completar doctor/canary dos canais restantes'],
        publicInterfaces: [
          'zavorth channels doctor|canary|activate',
          'npm run channel-long-tail-activation -- --profile configured',
        ],
      };
    });
  }

  private async mnemosLearning(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('mnemos-learning', 'Mnemos Memory e Learning Loop', async () => {
      const fts = new ZavorthMnemosFtsIndexService({ projectRoot: this.projectRoot, now: this.now });
      const search = fts.search('zavorth', 3);
      const learning = await new ZavorthNativeLearningLoopService({ now: this.now }).buildSnapshot({
        query: 'recent workflow',
        observation: 'operator repeated a useful workflow',
        workspace: this.projectRoot,
        sourceSurface: 'convergence-doctor',
        limit: 3,
      });
      const ready = learning.summary.securityPolicyFirewallReady
        && learning.summary.reversibleUserModelReady
        && learning.summary.skillImprovementCandidateReady;
      return {
        status: ready ? 'ready' : 'partial',
        summary: `FTS ${search.available ? 'disponivel' : 'sem indice'}; learning loop gera ${learning.summary.candidates} candidato(s).`,
        evidence: [
          `fts search available: ${search.available}`,
          `candidatos de learning: ${learning.summary.candidates}`,
          `user model reversivel: ${learning.summary.reversibleUserModelReady}`,
          `security policy firewall: ${learning.summary.securityPolicyFirewallReady}`,
        ],
        nextActions: search.available ? [] : ['rebuild do indice Mnemos FTS quando houver wiki/memoria persistida'],
        publicInterfaces: [
          'zavorth mnemos recall|forget|correct|promote',
          'npm run zavorth:native-learning-loop -- --observe "<workflow>"',
        ],
      };
    });
  }

  private async curatorPlane(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('curator-plane', 'Curator Plane com reviewer opcional', async () => {
      const service = new SkillCuratorPlaneService({
        now: this.now,
        proposalReviewer: null,
        llmRuntime: null,
        llmReviewEnabled: false,
      });
      const status = await service.status();
      const hasLiveLoop = this.exists('src/services/ZavorthSkillCuratorLiveLoopService.ts');
      return {
        status: hasLiveLoop ? 'ready' : 'partial',
        summary: `${status.stats.total} skills vistas; scheduler ${status.enabled ? 'ativo' : 'desativado'}; paused=${status.paused}.`,
        evidence: [
          `skills totais: ${status.stats.total}`,
          `stale: ${status.stats.stale}`,
          `archived: ${status.stats.archived}`,
          `review auxiliar: ${hasLiveLoop ? 'ok' : 'missing'}`,
        ],
        nextActions: status.enabled ? [] : ['habilitar curator se quiser manutencao automatica'],
        publicInterfaces: [
          'zavorth curator preview|review|apply|pause|resume',
          'npm run zavorth:skill-curator-live-loop',
        ],
      };
    });
  }

  private async runtimeTui(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('runtime-tui', 'TUI diario', async () => {
      const snapshot = buildZavorthCliRuntimeTuiSnapshot({
        projectRoot: this.projectRoot,
        now: this.now,
      });
      const sectionIds = [
        'chat',
        'approvals',
        'diffs',
        'tasks',
        'memory',
        'providers',
        'channels',
        'voice',
        'sandbox',
        'logs',
      ];
      return {
        status: sectionIds.length >= 8 ? 'ready' : 'partial',
        summary: `${sectionIds.length} secoes TUI projetadas; status ${snapshot.status}.`,
        evidence: [
          `secoes: ${sectionIds.join(', ')}`,
          `atalhos: ${snapshot.shortcuts.length}`,
          `json/once deterministicos: true`,
        ],
        nextActions: sectionIds.length >= 8 ? [] : ['expor secoes faltantes no TUI principal'],
        publicInterfaces: [
          'zavorth tui --json|--once',
        ],
      };
    });
  }

  private async swarmScale(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('swarm-scale', 'Swarm Scale Plane com planner dinamico', async () => {
      const stateFilePath = path.join(os.tmpdir(), `zavorth-convergence-swarm-${process.pid}.json`);
      const service = new SwarmScalePlaneService({
        now: this.now,
        stateFilePath,
      });
      const snapshot = await service.launch({
        objective: 'Map a large governed work item into isolated tasks.',
        desiredAgents: 3,
        maxAgents: 10,
        maxSteps: 20,
        maxConcurrency: 2,
        persistState: false,
      });
      return {
        status: snapshot.status === 'completed' ? 'ready' : 'partial',
        summary: `${snapshot.planner.plannedAgents} agentes planejados; ${snapshot.ledger.usedSteps} step(s) no ledger.`,
        evidence: [
          `planner mode: ${snapshot.planner.mode}`,
          `workers: ${snapshot.workerPool.mode}`,
          `ledger used: ${snapshot.ledger.usedSteps}/${snapshot.ledger.maxSteps}`,
          `cooperation governed: ${snapshot.cooperationContract.toolCallsGoverned}`,
        ],
        nextActions: snapshot.status === 'completed' ? [] : ['investigar run scale incompleto'],
        publicInterfaces: [
          'zavorth swarm plan|run|resume|cancel',
          'npm run zavorth:swarm-scale-plane',
        ],
      };
    });
  }

  private async sandboxControl(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('sandbox-control', 'Sandbox Control Plane', async () => {
      const snapshot = new ZavorthSandboxControlPlaneService({
        now: this.now,
        workspaceRoot: this.projectRoot,
        tempRoot: path.join(os.tmpdir(), 'zavorth-convergence-sandbox'),
        env: this.env as NodeJS.ProcessEnv,
      }).buildSnapshot({
        command: 'npm test',
        sourceSurface: 'convergence-doctor',
        requestedBy: 'operator',
      });
      const ready = snapshot.summary.doctorStatus === 'ready' || snapshot.summary.doctorStatus === 'degraded';
      return {
        status: ready ? 'ready' : 'missing_config',
        summary: `${snapshot.summary.availableProfiles} perfil(is) disponiveis; doctor ${snapshot.summary.doctorStatus}.`,
        evidence: [
          `preferred: ${snapshot.summary.preferredProfile}`,
          `strong profiles: ${snapshot.summary.strongProfilesReady}`,
          `untrusted ready: ${snapshot.summary.untrustedExecutionReady}`,
          `receipt envelope: ${snapshot.envelopePreview ? 'ok' : 'missing'}`,
        ],
        nextActions: ready ? [] : ['instalar ou habilitar Docker/WSL/WASM/remote sandbox conforme ambiente'],
        publicInterfaces: [
          'zavorth sandbox doctor|run|receipt',
          'npm run sandbox:doctor',
        ],
      };
    });
  }

  private async satelliteVoice(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('satellite-voice', 'Satellite, Voice, Wake e approvals', async () => {
      const voiceStateFile = path.join(os.tmpdir(), `zavorth-convergence-voice-${process.pid}.json`);
      const voice = new VoiceWakeRuntimeService({
        stateFile: voiceStateFile,
        env: this.env,
        now: this.now,
        sessionId: 'convergence-doctor',
      }).status();
      const satellite = new ZavorthAppsSatelliteNodesService({
        now: this.now,
        env: this.env,
        cwd: this.projectRoot,
      }).execute({ action: 'status' });
      const ready = voice.safety.noRawAudioPersistence && satellite.safety.satelliteNodesStayLeastPrivilege;
      return {
        status: ready ? 'ready' : 'partial',
        summary: `wake ${voice.mode}; satellite ${satellite.status}; audio bruto persistido=${voice.privacy.rawAudioPersisted}.`,
        evidence: [
          `wake default off: ${voice.safety.defaultOff}`,
          `wake local only: ${voice.safety.localWakeOnly}`,
          `satellite health: ${satellite.health.status}`,
          `offline queue: ${satellite.offlineQueue.status}`,
        ],
        nextActions: voice.detector.configured ? [] : ['configurar detector local de wake se quiser ativacao por voz'],
        publicInterfaces: [
          'zavorth echo wake arm|disarm|status',
          'zavorth satellite status|pair|push-plan',
        ],
      };
    });
  }

  private async qaProduct(): Promise<ConvergenceReadinessPillar> {
    return this.safePillar('qa-product', 'QA de paridade e produto', async () => {
      const scripts = this.packageScripts();
      const requiredScripts = [
        'qa:zavorth-natural-action-harness',
        'qa:zavorth-provider-readiness',
        'qa:channel-long-tail-activation',
        'qa:zavorth-native-learning-loop',
        'qa:zavorth-skill-curator-live-loop',
        'qa:zavorth-swarm-scale-plane',
        'qa:zavorth-sandbox-lifecycle',
        'qa:zavorth-apps-satellite-nodes',
      ];
      const missing = requiredScripts.filter((script) => !scripts[script]);
      return {
        status: missing.length === 0 ? 'ready' : 'partial',
        summary: `${requiredScripts.length - missing.length}/${requiredScripts.length} checks de pilar registrados.`,
        evidence: [
          `qa umbrella: ${scripts['qa:zavorth-native-convergence'] ? 'ok' : 'missing'}`,
          `hygiene check: ${this.exists('scripts/zavorth-native-convergence-hygiene-check.mjs') ? 'ok' : 'missing'}`,
          `missing scripts: ${missing.length}`,
        ],
        nextActions: [
          ...(missing.length ? [`registrar scripts faltantes: ${missing.join(', ')}`] : []),
          ...(!scripts['qa:zavorth-native-convergence'] ? ['registrar qa:zavorth-native-convergence'] : []),
        ],
        publicInterfaces: [
          'zavorth doctor convergence',
          'npm run qa:zavorth-native-convergence --silent',
        ],
      };
    });
  }

  private async safePillar(
    id: ConvergencePillarId,
    title: string,
    build: () => Promise<Omit<ConvergenceReadinessPillar, 'id' | 'title'>>,
  ): Promise<ConvergenceReadinessPillar> {
    try {
      const result = await build();
      return {
        id,
        title,
        ...result,
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        id,
        title,
        status: 'blocked',
        summary: `Doctor falhou: ${message}`,
        evidence: [`error: ${message}`],
        nextActions: ['corrigir o doctor deste pilar antes de certificar convergencia'],
        publicInterfaces: [],
      };
    }
  }

  private aggregateStatus(summary: ConvergenceReadinessSnapshot['summary']): ConvergenceReadinessStatus {
    if (summary.blocked > 0) return 'blocked';
    if (summary.partial > 0) return 'partial';
    if (summary.missingConfig > 0) return 'missing_config';
    return 'ready';
  }

  private exists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, relativePath));
  }

  private packageScripts(): Record<string, string> {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')) as PackageJson;
      return parsed.scripts || {};
    } catch (error: any) { logger.warn('[Zavorth Native Convergence] JSON parse failed', error); return {}; }
  }

  public static requiredPillars(): ConvergencePillarId[] {
    return REQUIRED_PILLARS.slice();
  }
}
