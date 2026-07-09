import { ZavorthTerminalBackendsService } from './ZavorthTerminalBackendsService.js';
/**
 * Universal Power Fabric — elastic backends, trusted operator, learning promote,
 * external harness registry, context discipline.
 */

import crypto from 'node:crypto';
import path from 'node:path';

import {
  UNIVERSAL_POWER_FABRIC_CONTRACT_VERSION,
  type PowerBackendEntry,
  type PowerBackendId,
  type PowerBackendPosture,
  type PowerElasticProfileId,
  type PowerFabricReceipt,
  type PowerFabricSnapshot,
} from '../contracts/UniversalPowerFabricContract.js';

import { TrustedOperatorModeService } from './power/TrustedOperatorModeService.js';
import { LearningPromoteService } from './power/LearningPromoteService.js';
import { ExternalHarnessRegistryService } from './power/ExternalHarnessRegistryService.js';
import { ContextDisciplineService } from './power/ContextDisciplineService.js';
import { ZavorthAdaptiveLearningOsService } from './ZavorthAdaptiveLearningOsService.js';

export type PowerFabricBuildInput = {
  projectRoot?: string;
  elasticProfile?: PowerElasticProfileId;
  env?: Record<string, string | undefined>;
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  terminalBackends?: Pick<ZavorthTerminalBackendsService, 'execute'>;
  trustedOperator?: TrustedOperatorModeService;
  learningPromote?: LearningPromoteService;
  harnesses?: ExternalHarnessRegistryService;
  contextDiscipline?: ContextDisciplineService;
  adaptiveLearning?: Pick<ZavorthAdaptiveLearningOsService, 'ingestObservation'>;
};

const ELASTIC_BACKENDS = new Set<PowerBackendId>(['modal', 'daytona', 'vercel-sandbox']);

export class UniversalPowerFabricService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly terminalBackends: Pick<ZavorthTerminalBackendsService, 'execute'>;
  private readonly trustedOperator: TrustedOperatorModeService;
  private readonly learningPromote: LearningPromoteService;
  private readonly harnesses: ExternalHarnessRegistryService;
  private readonly contextDiscipline: ContextDisciplineService;
  private readonly adaptiveLearning: Pick<ZavorthAdaptiveLearningOsService, 'ingestObservation'>;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.terminalBackends = runtime.terminalBackends || new ZavorthTerminalBackendsService({
      env: this.env,
      cwd: this.projectRoot,
      now: this.now,
    });
    this.trustedOperator = runtime.trustedOperator || new TrustedOperatorModeService({
      stateFile: path.join(this.projectRoot, '.zavorth', 'trusted-operator-mode.json'),
      now: this.now,
    });
    this.learningPromote = runtime.learningPromote || new LearningPromoteService({
      storeDir: path.join(this.projectRoot, '.zavorth', 'learning-promote'),
      now: this.now,
    });
    this.harnesses = runtime.harnesses || new ExternalHarnessRegistryService({
      storeFile: path.join(this.projectRoot, '.zavorth', 'external-harnesses.json'),
      now: this.now,
    });
    this.contextDiscipline = runtime.contextDiscipline || new ContextDisciplineService();
    this.adaptiveLearning = runtime.adaptiveLearning || new ZavorthAdaptiveLearningOsService({ now: this.now });
  }

  public buildSnapshot(input: PowerFabricBuildInput = {}): PowerFabricSnapshot {
    const elasticProfile = input.elasticProfile || this.inferElasticProfile();
    const backends = this.buildBackends();
    const trustedOperator = this.trustedOperator.getState();
    const yellowCandidates = this.learningPromote.list('staged');
    const harnesses = this.harnesses.list();
    const context = this.contextDiscipline.buildSnapshot();
    const receipts: PowerFabricReceipt[] = [
      this.receipt('inventory', 'pass', `Power Fabric inventory with ${backends.length} backends.`, null),
    ];

    const summary = {
      backendsTotal: backends.length,
      backendsReady: backends.filter((b) => b.liveReady || b.posture === 'ready' || b.posture === 'available-on-demand').length,
      backendsElastic: backends.filter((b) => b.elastic).length,
      yellowCandidates: yellowCandidates.length,
      harnessesReady: harnesses.filter((h) => h.status === 'ready').length,
      trustedOperatorEnabled: trustedOperator.enabled,
    };

    const status: PowerFabricSnapshot['status'] =
      backends.filter((b) => b.id === 'modal' || b.id === 'daytona').every((b) => b.posture === 'needs-configuration')
        && !summary.trustedOperatorEnabled
        ? 'attention'
        : 'ok';

    return {
      contractVersion: UNIVERSAL_POWER_FABRIC_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      backends,
      elasticProfile,
      trustedOperator,
      learning: {
        greenAutoPrefs: true,
        yellowCandidates,
        redBlocked: true,
      },
      harnesses,
      context,
      receipts,
      summary,
      policy: {
        liveMutationOffByDefault: true,
        elasticBackendsNeedConfigAndApproval: true,
        trustedModeDoesNotBypassRedLane: true,
        learningPromotionNeedsConsent: true,
        externalHarnessReadOnlyDefault: true,
        brandAgnostic: true,
        rawSecretsSerialized: false,
      },
      narrative: {
        headline: 'Power Fabric inventory',
        operatorSummary: `${summary.backendsReady}/${summary.backendsTotal} backends usable · elastic ${summary.backendsElastic} · yellow ${summary.yellowCandidates} · trusted=${summary.trustedOperatorEnabled} · harness ready ${summary.harnessesReady}`,
        nextSafeAction: summary.trustedOperatorEnabled
          ? 'Green actions stay low-friction; promote Yellow candidates with consent; keep cloud backends gated.'
          : 'Enable Trusted Operator Mode for single-user green friction reduction, or configure modal/daytona for elastic exec.',
      },
    };
  }

  public planBackend(input: {
    backend?: PowerBackendId;
    command?: string;
  }) {
    const snap = this.terminalBackends.execute({
      action: 'terminal.plan',
      backend: input.backend || 'local',
      command: input.command || null,
      live: false,
    });
    return {
      snapshot: snap,
      receipt: this.receipt(
        'backend-plan',
        'preview',
        `Plan ${snap.selectedBackend}: ${snap.plan.reason}`,
        snap.selectedBackend,
      ),
    };
  }

  public setTrustedOperator(input: {
    enabled: boolean;
    updatedBy?: string | null;
    note?: string | null;
  }) {
    const state = input.enabled
      ? this.trustedOperator.enable(input.updatedBy || null, input.note || null)
      : this.trustedOperator.disable(input.updatedBy || null, input.note || null);
    return {
      state,
      receipt: this.receipt(
        'trusted-mode',
        'pass',
        `Trusted Operator Mode ${state.enabled ? 'enabled' : 'disabled'}. Red lane intact; receipts always.`,
        'trusted-operator',
      ),
    };
  }

  public decideTrusted(input: {
    description?: string;
    risk?: 'low' | 'medium' | 'high' | 'critical';
    mutation?: boolean;
    trustedFolder?: boolean;
  }) {
    return this.trustedOperator.decide(input);
  }

  public async observeLearning(input: {
    observation: string;
    userId?: string | null;
    stageYellow?: boolean;
  }) {
    const adaptive = await this.adaptiveLearning.ingestObservation({
      observation: input.observation,
      userId: input.userId || null,
      sourceSurface: 'power-fabric',
      commitGreenMemory: true,
    });

    const staged: Array<ReturnType<LearningPromoteService['stage']>> = [];
    if (input.stageYellow !== false) {
      for (const skill of adaptive.shadowSkills || []) {
        staged.push(this.learningPromote.stage({
          kind: 'shadow-skill',
          title: String(skill.title || 'shadow-skill'),
          summary: String(skill.intent || input.observation).slice(0, 1500),
          evidenceRefs: Array.isArray(skill.evidence) ? skill.evidence : [],
          lane: 'yellow',
        }));
      }
      for (const proc of adaptive.procedures || []) {
        staged.push(this.learningPromote.stage({
          kind: 'procedure',
          title: String(proc.title || 'procedure'),
          summary: String(proc.summary || input.observation).slice(0, 1500),
          evidenceRefs: Array.isArray(proc.evidence) ? proc.evidence : [],
          lane: 'yellow',
        }));
      }
    }

    return {
      adaptive,
      staged: staged.map((s) => s.candidate),
      receipt: this.receipt(
        'learning-observe',
        'pass',
        `Observation processed; green auto-prefs may persist; ${staged.length} yellow candidate(s) staged.`,
        null,
      ),
    };
  }

  public promoteLearning(input: { candidateId: string; consent: boolean; previewOnly?: boolean }) {
    if (input.previewOnly || !input.consent) {
      const preview = this.learningPromote.previewPromote(input.candidateId);
      return {
        ...preview,
        materialPath: null as string | null,
        receipt: this.receipt(
          'learning-promote',
          preview.receipt.status === 'deny' ? 'deny' : 'preview',
          preview.receipt.summary,
          input.candidateId,
        ),
      };
    }
    const result = this.learningPromote.promote(input.candidateId, true);
    return {
      candidate: result.candidate,
      materialPath: result.materialPath,
      receipt: this.receipt(
        'learning-promote',
        result.receipt.status === 'deny' ? 'deny' : 'pass',
        result.receipt.summary,
        input.candidateId,
      ),
    };
  }

  public registerHarness(input: {
    id?: string;
    label: string;
    kind?: any;
    commandOrEndpoint?: string | null;
    notes?: string[];
  }) {
    const adapter = this.harnesses.register(input);
    return {
      adapter,
      receipt: this.receipt('harness-register', 'pass', `Harness ${adapter.id} registered (${adapter.status}).`, adapter.id),
    };
  }

  public previewHarness(input: { harnessId: string; prompt: string; mutation?: boolean }) {
    return this.harnesses.previewInvoke(input);
  }

  public contextSnapshot(input?: { visibleToolCount?: number; skillBytesInPrompt?: number }) {
    const snapshot = this.contextDiscipline.buildSnapshot(input);
    return {
      snapshot,
      receipt: this.receipt('context-discipline', 'pass', snapshot.recommendations[0] || 'Context discipline ok.', null),
    };
  }

  private buildBackends(): PowerBackendEntry[] {
    const statusSnap = this.terminalBackends.execute({ action: 'terminal.status' });
    return statusSnap.backends.map((b) => {
      const id = b.id as PowerBackendId;
      const elastic = ELASTIC_BACKENDS.has(id);
      const configured = b.status === 'ready' || b.status === 'available-on-demand'
        || (b.status === 'needs-configuration' && b.requiresConfiguration.length === 0);
      // Treat env-configured cloud backends as available-on-demand even without CLI probe success
      const envConfigured = this.cloudEnvConfigured(id);
      let posture: PowerBackendPosture = mapPosture(b.status);
      if (elastic && envConfigured && posture === 'needs-configuration') {
        posture = 'available-on-demand';
      }
      // Docs used to say planned — code path is real; only singularity-like unknown stays planned if status says so
      if ((id === 'modal' || id === 'daytona') && posture === 'planned') {
        posture = envConfigured ? 'available-on-demand' : 'needs-configuration';
      }
      return {
        id,
        label: b.label,
        posture,
        isolation: b.isolation,
        elastic,
        hibernateWhenIdle: elastic,
        liveCapable: b.liveCapable,
        liveReady: b.liveReady || (elastic && envConfigured && posture === 'available-on-demand' ? false : b.liveReady),
        configured: Boolean(configured || envConfigured),
        requiresConfiguration: b.requiresConfiguration,
        defaultCommand: b.defaultCommand,
        nextSafeAction: b.nextCommand,
        limitations: b.limitations,
      };
    });
  }

  private cloudEnvConfigured(id: PowerBackendId): boolean {
    if (id === 'modal') {
      const tokenPair = Boolean(this.env.MODAL_TOKEN_ID && this.env.MODAL_TOKEN_SECRET);
      return tokenPair || Boolean(this.env.ZAVORTH_MODAL_TOKEN) || isTruthy(this.env.ZAVORTH_MODAL_ENABLED);
    }
    if (id === 'daytona') {
      const apiKey = Boolean(this.env.DAYTONA_API_KEY || this.env.ZAVORTH_DAYTONA_API_KEY);
      const workspace = Boolean(this.env.ZAVORTH_DAYTONA_WORKSPACE);
      return (apiKey && workspace) || isTruthy(this.env.ZAVORTH_DAYTONA_ENABLED);
    }
    if (id === 'vercel-sandbox') {
      return isTruthy(this.env.ZAVORTH_VERCEL_SANDBOX_ENABLED) && Boolean(this.env.VERCEL_TOKEN);
    }
    return false;
  }

  private inferElasticProfile(): PowerElasticProfileId {
    if (isTruthy(this.env.ZAVORTH_PROFILE_SERVERLESS_IDLE)) return 'serverless-idle';
    if (isTruthy(this.env.ZAVORTH_PROFILE_SAFE_8GB)) return 'safe-8gb';
    if (isTruthy(this.env.ZAVORTH_PROFILE_VPS_24_7)) return 'vps-24-7';
    if (isTruthy(this.env.ZAVORTH_PROFILE_LAB_FULL)) return 'lab-full';
    return 'local-supervised';
  }

  private receipt(
    kind: PowerFabricReceipt['kind'],
    status: PowerFabricReceipt['status'],
    summary: string,
    subjectId: string | null,
  ): PowerFabricReceipt {
    return {
      id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
      kind,
      status,
      summary,
      subjectId,
      createdAt: this.now().toISOString(),
      rawSecretsSerialized: false,
    };
  }
}

function mapPosture(status: string): PowerBackendPosture {
  switch (status) {
    case 'ready': return 'ready';
    case 'available-on-demand': return 'available-on-demand';
    case 'needs-configuration': return 'needs-configuration';
    case 'planned': return 'planned';
    default: return 'needs-configuration';
  }
}

function isTruthy(value: unknown): boolean {
  const v = String(value || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
