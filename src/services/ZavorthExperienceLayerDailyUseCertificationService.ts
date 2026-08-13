import {
  ZAVORTH_EXPERIENCE_LAYER_DAILY_USE_CERTIFICATION_VERSION,
  type ZavorthExperienceLayerDailyUseCertificationSnapshot,
  type ZavorthExperienceLayerDailyUsePhase,
} from '../contracts/ZavorthExperienceLayerDailyUseCertificationContract.js';
import { ZavorthAutonomySliderService } from './ZavorthAutonomySliderService.js';

import { ZavorthCapabilityStoreService } from './ZavorthCapabilityStoreService.js';
import { ZavorthCliExperienceCertificationService } from './ZavorthCliExperienceCertificationService.js';
import { ZavorthConversationalSetupService } from './ZavorthConversationalSetupService.js';
import { ZavorthControlExperienceHomeService } from './ZavorthControlExperienceHomeService.js';
import { ZavorthDoItWithMeService } from './ZavorthDoItWithMeService.js';
import { ZavorthExperienceProfileService } from './ZavorthExperienceProfileService.js';
import { ZavorthGuidedMissionsService } from './ZavorthGuidedMissionsService.js';
import { ZavorthModelCostGuardService } from './ZavorthModelCostGuardService.js';
import { ZavorthNaturalRuntimeQuestionsService } from './ZavorthNaturalRuntimeQuestionsService.js';
import { ZavorthSatelliteApprovalCompanionService } from './ZavorthSatelliteApprovalCompanionService.js';
import { ZavorthTrustPanelService } from './ZavorthTrustPanelService.js';
import { ZavorthVisualReceiptsV2Service } from './ZavorthVisualReceiptsV2Service.js';

export type ZavorthExperienceLayerDailyUseCertificationRuntime = {
  now?: () => Date;
};

type ContractBuilder = {
  buildContract(input?: Record<string, unknown>): unknown;
};

type SnapshotBuilder = {
  buildSnapshot(input?: Record<string, unknown>): unknown;
};

export class ZavorthExperienceLayerDailyUseCertificationService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthExperienceLayerDailyUseCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthExperienceLayerDailyUseCertificationSnapshot {
    const phases: ZavorthExperienceLayerDailyUsePhase[] = [
      this.certifyContractPhase({
        id: 'gate-01',
        title: 'Experience Profiles',
        command: 'zavorth experience --profile personal',
        surface: 'onboarding',
        service: new ZavorthExperienceProfileService(),
        input: { profile: 'personal', intent: 'organize my day' },
        evidence: ['Profile catalog resolves Personal, Creator, Developer, Business and Power.'],
        riskBoundary: 'Profiles tune language and defaults, not authority.',
      }),
      this.certifySnapshotPhase({
        id: 'gate-02',
        title: 'Conversational Setup',
        command: 'zavorth onboard conversation',
        surface: 'onboarding',
        service: new ZavorthConversationalSetupService(),
        input: { agentName: 'Zavorth', userName: 'Operator', primaryUse: 'daily use' },
        evidence: ['Setup stays read-only unless --apply --confirm-local-profile are explicit.'],
        riskBoundary: 'Raw secrets are rejected and identity files are not changed by preview.',
      }),
      this.certifyContractPhase({
        id: 'gate-03',
        title: 'Guided Missions',
        command: 'zavorth missions guide',
        surface: 'runtime',
        service: new ZavorthGuidedMissionsService(),
        input: { intent: 'review this repository safely' },
        evidence: ['Mission cards expose goal, risk, safe first step, artifacts and approval boundary.'],
        riskBoundary: 'Mission starters are prompts and plans, not hidden execution shortcuts.',
      }),
      this.certifyContractPhase({
        id: 'gate-04',
        title: 'Capability Store',
        command: 'zavorth capability-store',
        surface: 'runtime',
        service: new ZavorthCapabilityStoreService(),
        input: { category: 'communication' },
        evidence: ['Capabilities use honest readiness instead of pretending every adapter is live.'],
        riskBoundary: 'Store cards guide setup; they never install, send, write or execute.',
      }),
      this.certifyContractPhase({
        id: 'gate-05',
        title: 'Do-It-With-Me Mode',
        command: 'zavorth do-it-with-me "help me configure Telegram approvals"',
        surface: 'runtime',
        service: new ZavorthDoItWithMeService(),
        input: { intent: 'help me configure Telegram approvals' },
        evidence: ['Guided steps separate user physical actions, safe checks and approval boundaries.'],
        riskBoundary: 'The guide does not collect raw credentials or perform live channel actions.',
      }),
      this.certifyContractPhase({
        id: 'gate-06',
        title: 'Trust Panel',
        command: 'zavorth trust-panel',
        surface: 'runtime',
        service: new ZavorthTrustPanelService(),
        input: { profile: 'personal' },
        evidence: ['Trust Panel explains allowed, approval-required and blocked action classes.'],
        riskBoundary: 'Trust language does not weaken Policy Broker decisions.',
      }),
      this.certifyContractPhase({
        id: 'gate-07',
        title: 'Autonomy Slider',
        command: 'zavorth autonomy --level balanced',
        surface: 'runtime',
        service: new ZavorthAutonomySliderService(),
        input: { level: 'balanced', profile: 'personal' },
        evidence: ['Autonomy levels are previewed as policy posture and explanation style.'],
        riskBoundary: 'Autonomy changes defaults only; it cannot bypass approval gates.',
      }),
      this.certifyContractPhase({
        id: 'gate-08',
        title: 'Model Cost Guard',
        command: 'zavorth model-cost "review this repository"',
        surface: 'runtime',
        service: new ZavorthModelCostGuardService(),
        input: { intent: 'review this repository', maxCents: 100 },
        evidence: ['Cost surprise, provider tier and unknown pricing are surfaced before live model use.'],
        riskBoundary: 'Hosted escalation remains behind readiness, budget and receipts.',
      }),
      this.certifySnapshotPhase({
        id: 'gate-09',
        title: 'Visual Receipts 2.0',
        command: 'zavorth visual-receipts',
        surface: 'runtime',
        service: new ZavorthVisualReceiptsV2Service(),
        input: { missionId: 'mission_daily_certification' },
        evidence: ['Receipts summarize outcome, impact, blocked actions, rollback and next steps.'],
        riskBoundary: 'Receipt cards are evidence; rollback actions remain approval-gated.',
      }),
      this.certifySnapshotPhase({
        id: 'gate-10',
        title: 'Satellite Approval Companion',
        command: 'zavorth satellite-approvals',
        surface: 'satellite',
        service: new ZavorthSatelliteApprovalCompanionService(),
        input: { user: 'local-operator' },
        evidence: ['Satellite projects approval cards and capability.result envelopes.'],
        riskBoundary: 'The browser companion resolves decisions but cannot execute target actions.',
      }),
      this.certifySnapshotPhase({
        id: 'gate-11',
        title: 'Natural Runtime Questions',
        command: 'zavorth ask-runtime "which providers are ready..."',
        surface: 'runtime',
        service: new ZavorthNaturalRuntimeQuestionsService(),
        input: { question: 'which providers are ready...' },
        evidence: ['Runtime questions answer from read-only projections by default.'],
        riskBoundary: 'No live probe, network call or mutation is hidden inside answers.',
      }),
      this.certifySnapshotPhase({
        id: 'gate-12',
        title: 'ZavorthControl Chat-First Entry',
        command: 'zavorth zavorthControl-home',
        surface: 'zavorthControl',
        service: new ZavorthControlExperienceHomeService(),
        input: {},
        evidence: ['ZavorthControl opens as chat-first daily use while memory, skills, approvals, receipts and setup remain reachable as explicit surfaces.'],
        riskBoundary: 'ZavorthControl daily entry is an experience layer, not execution authority.',
      }),
      this.certifySnapshotPhase({
        id: 'gate-13',
        title: 'CLI Experience Consistency',
        command: 'zavorth daily',
        surface: 'cli',
        service: new ZavorthCliExperienceCertificationService(),
        input: {},
        evidence: ['The CLI mirrors ZavorthControl Home with home areas, guided missions and runtime questions.'],
        riskBoundary: 'CLI convenience entrypoints do not skip preview, approval or receipts.',
      }),
    ];

    const blocked = phases.some((phase) => phase.status === 'blocked');
    return {
      contractVersion: ZAVORTH_EXPERIENCE_LAYER_DAILY_USE_CERTIFICATION_VERSION,
      schemaVersion: 1,
      surface: 'experience-layer-daily-use-certification',
      generatedAt: this.now().toISOString(),
      result: blocked ? 'blocked' : 'passed',
      coveredPhases: phases.length,
      phases,
      dailyUseFlow: [
        'User starts with zavorth daily or ZavorthControl chat.',
        'Zavorth starts from Inbox, Tasks, Approvals, Receipts or Connectors, then suggests a guided mission or answers a runtime question.',
        'Sensitive work becomes preview, risk, scoped approval and receipt.',
        'Satellite and CLI can help decide or inspect, but target execution remains in the governed runtime.',
      ],
      safety: {
        projectionsOnly: true,
        hiddenExecutionAuthority: false,
        policyBrokerRequiredForSensitiveActions: true,
        rawSecretsSerialized: false,
      },
      invariants: [
        'The Experience Layer adapts complexity to the user without creating a second runtime.',
        'Every visible shortcut remains a prompt, projection or governed envelope.',
        'No profile, zavorthControl card, CLI entrypoint or Satellite card grants extra authority.',
        'Daily-use simplicity must preserve Policy Broker, scoped approvals, receipts and SecretRefs.',
      ],
    };
  }

  public renderText(snapshot: ZavorthExperienceLayerDailyUseCertificationSnapshot): string {
    return [
      '[zavorth-experience-layer-daily-use-certification]',
      `result=${snapshot.result}`,
      `coveredPhases=${snapshot.coveredPhases}`,
      '',
      '[phases]',
      ...snapshot.phases.map((phase) =>
        `- ${phase.id} ${phase.title}: ${phase.status} | ${phase.command} | ${phase.riskBoundary}`,
      ),
      '',
      '[daily-use-flow]',
      ...snapshot.dailyUseFlow.map((step) => `- ${step}`),
      '',
    ].join('\n');
  }

  private certifyContractPhase(input: {
    id: string;
    title: string;
    command: string;
    surface: ZavorthExperienceLayerDailyUsePhase['surface'];
    service: ContractBuilder;
    input: Record<string, unknown>;
    evidence: string[];
    riskBoundary: string;
  }): ZavorthExperienceLayerDailyUsePhase {
    return this.certifyPhase({
      id: input.id,
      title: input.title,
      command: input.command,
      surface: input.surface,
      evidence: input.evidence,
      riskBoundary: input.riskBoundary,
      build: () => input.service.buildContract(input.input),
    });
  }

  private certifySnapshotPhase(input: {
    id: string;
    title: string;
    command: string;
    surface: ZavorthExperienceLayerDailyUsePhase['surface'];
    service: SnapshotBuilder;
    input: Record<string, unknown>;
    evidence: string[];
    riskBoundary: string;
  }): ZavorthExperienceLayerDailyUsePhase {
    return this.certifyPhase({
      id: input.id,
      title: input.title,
      command: input.command,
      surface: input.surface,
      evidence: input.evidence,
      riskBoundary: input.riskBoundary,
      build: () => input.service.buildSnapshot(input.input),
    });
  }

  private certifyPhase(input: {
    id: string;
    title: string;
    command: string;
    surface: ZavorthExperienceLayerDailyUsePhase['surface'];
    evidence: string[];
    riskBoundary: string;
    build: () => unknown;
  }): ZavorthExperienceLayerDailyUsePhase {
    const projection = input.build();
    const validation = validateProjectionSafety(projection);
    return {
      id: input.id,
      title: input.title,
      command: input.command,
      surface: input.surface,
      status: validation.ok ? 'projection_passed' : 'blocked',
      evidence: validation.ok ? input.evidence : validation.errors,
      riskBoundary: input.riskBoundary,
    };
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateProjectionSafety(value: unknown): { ok: boolean; errors: string[] } {
  if (!isObjectRecord(value)) {
    return { ok: false, errors: ['Projection builder did not return an object.'] };
  }
  const serialized = JSON.stringify(value);
  const errors: string[] = [];
  for (const [label, pattern] of [
    ['raw secrets serialized', /"rawSecretsSerialized"\s*:\s*true/],
    ['hidden execution authority', /"hiddenExecutionAuthority"\s*:\s*true/],
    ['generic execution authority', /"executionAuthority"\s*:\s*true/],
    ['zavorthControl execution authority', /"zavorthControlCanExecute(?:TargetAction)?"\s*:\s*true/],
    ['zavorth control execution authority', /"zavorthControlCanExecute(?:TargetAction)?"\s*:\s*true/],
    ['satellite target execution authority', /"satelliteCanExecuteTargetAction"\s*:\s*true/],
    ['cli target execution authority', /"cliCanExecuteTargetAction"\s*:\s*true/],
    ['openai-like secret', /\bsk-[A-Za-z0-9_-]{12,}\b/],
    ['stripe-like public/live secret', /\bpk_(?:live|test)_[A-Za-z0-9_-]{12,}\b/],
    ['github-token-like secret', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
    ['slack-token-like secret', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
    ['google-api-key-like secret', /\bAIza[0-9A-Za-z_-]{20,}\b/],
    ['bearer-token-like secret', /\bBearer\s+[A-Za-z0-9._~+/-]+=*/],
  ] as const) {
    if (pattern.test(serialized)) {
      errors.push(`Unsafe projection marker detected: ${label}.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
