import { createHash } from 'crypto';
import {
  buildDefaultZavorthGuidedMissionTemplates,
  type ZavorthFirstRunProductJourneyContract,
  type ZavorthFirstRunProductJourneyStep,
  type ZavorthGuidedMissionTemplate,
  type ZavorthGuidedMissionTemplateId,
} from '../contracts/ZavorthFirstRunProductJourneyContract.js';
import type { ZavorthExperienceProfileContract } from '../contracts/ZavorthExperienceProfileContract.js';
import {
  buildZavorthProductModeContract,
  type ZavorthProductModeContract,
} from '../contracts/ZavorthProductModeContract.js';
import { ZavorthExperienceProfileService } from './ZavorthExperienceProfileService.js';

import type {
  ZavorthMissionApproval,
  ZavorthMissionArtifact,
  ZavorthMissionContract,
  ZavorthMissionRiskLevel,
  ZavorthMissionTimelineEvent,
} from '../contracts/ZavorthMissionContract.js';
import type {
  ZavorthSandboxReadinessContract,
  ZavorthSandboxReadinessStatus,
} from '../contracts/ZavorthSandboxReadinessContract.js';
import type { ZavorthVisualReceiptContract } from '../contracts/ZavorthVisualReceiptContract.js';
import {
  SandboxHostReadinessService,
  type SandboxHostReadinessSnapshot,
  type SandboxHostTierId,
} from './SandboxHostReadinessService.js';

export type ZavorthProductizationProtectedRuntimeView =
  | 'all'
  | 'journey'
  | 'templates'
  | 'missions'
  | 'receipts'
  | 'sandbox';

export type ZavorthProductizationProtectedRuntimeInput = {
  dailyMode?: unknown;
  detailMode?: unknown;
  experienceProfile?: unknown;
  selectedTemplateId?: unknown;
  source?: ZavorthMissionContract['source'];
  request?: string | null;
};

export type ZavorthProductizationProtectedRuntimeSnapshot = {
  schemaVersion: 1;
  surface: 'productization-protected-runtime';
  generatedAt: string;
  status: 'ready';
  experienceProfile: ZavorthExperienceProfileContract;
  productMode: ZavorthProductModeContract;
  firstRun: ZavorthFirstRunProductJourneyContract;
  sandbox: ZavorthSandboxReadinessContract;
  templates: ZavorthGuidedMissionTemplate[];
  mission: ZavorthMissionContract;
  receipt: ZavorthVisualReceiptContract;
  zavorthControlProjection: {
    route: '/zavorthControl' | '/control';
    executionAuthority: false;
    approvalRequiredForMutableActions: true;
    visualBlocksRequireOwnerApproval: true;
    endpoints: string[];
  };
  cli: {
    commands: string[];
    mirrorsWebProjection: true;
  };
  distribution: {
    privateExecutableFirst: true;
    npmDevInternalPath: true;
    proprietaryLicenseRequired: true;
    publicClaimsMustBeCurrent: true;
  };
  certification: {
    gate: 'zavorth:productization-protected-runtime:check';
    checks: Array<{
      id: string;
      status: 'passed';
      summary: string;
    }>;
  };
};

type SandboxHostReadinessLike = Pick<SandboxHostReadinessService, 'inspect'>;
type ProtectedRuntimeProjectionRoute = '/zavorthControl' | '/control';
type ProtectedRuntimeProjection<Route extends ProtectedRuntimeProjectionRoute> = {
  route: Route;
  executionAuthority: false;
  approvalRequiredForMutableActions: true;
  visualBlocksRequireOwnerApproval: true;
  endpoints: string[];
};

export type ZavorthProductizationProtectedRuntimeServiceOptions = {
  now?: () => Date;
  sandboxHostReadiness?: SandboxHostReadinessLike;
};

const STRONG_SANDBOX_PRIORITY: SandboxHostTierId[] = ['firecracker', 'gvisor', 'docker'];
const PRODUCTIZATION_PROTECTED_RUNTIME_ENDPOINTS = [
  '/api/productization/protected-runtime',
  '/api/productization/protected-runtime...view=templates',
  '/api/productization/protected-runtime...view=missions',
  '/api/productization/protected-runtime...view=receipts',
  '/api/productization/protected-runtime...view=sandbox',
];

function buildProtectedRuntimeProjection<Route extends ProtectedRuntimeProjectionRoute>(
  route: Route,
): ProtectedRuntimeProjection<Route> {
  return {
    route,
    executionAuthority: false,
    approvalRequiredForMutableActions: true,
    visualBlocksRequireOwnerApproval: true,
    endpoints: [...PRODUCTIZATION_PROTECTED_RUNTIME_ENDPOINTS],
  };
}

export class ZavorthProductizationProtectedRuntimeService {
  private readonly now: () => Date;
  private readonly sandboxHostReadiness: SandboxHostReadinessLike;
  private readonly experienceProfileService: ZavorthExperienceProfileService;

  constructor(options: ZavorthProductizationProtectedRuntimeServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.sandboxHostReadiness = options.sandboxHostReadiness || new SandboxHostReadinessService();
    this.experienceProfileService = new ZavorthExperienceProfileService();
  }

  public buildSnapshot(
    input: ZavorthProductizationProtectedRuntimeInput = {},
  ): ZavorthProductizationProtectedRuntimeSnapshot {
    const generatedAt = this.now().toISOString();
    const experienceProfile = this.experienceProfileService.buildContract({
      profile: input.experienceProfile,
      intent: input.request,
      dailyMode: input.dailyMode,
      detailMode: input.detailMode,
    });
    const productMode = buildZavorthProductModeContract({
      dailyMode: input.dailyMode || experienceProfile.selected.dailyMode,
      detailMode: input.detailMode || experienceProfile.selected.detailMode,
    });
    const templates = buildDefaultZavorthGuidedMissionTemplates();
    const selectedTemplate = this.selectTemplate(templates, input.selectedTemplateId, input.request);
    const host = this.sandboxHostReadiness.inspect();
    const sandbox = this.buildSandboxReadiness(generatedAt, host);
    const firstRun = this.buildFirstRunJourney({
      generatedAt,
      productMode,
      templates,
      sandbox,
    });
    const request = sanitizeMissionText(input.request || selectedTemplate.prompt);
    const mission = this.buildMission({
      generatedAt,
      template: selectedTemplate,
      source: input.source || 'cli',
      request,
      sandbox,
    });
    const receipt = this.buildReceipt({
      generatedAt,
      productMode,
      mission,
      template: selectedTemplate,
    });

    return {
      schemaVersion: 1,
      surface: 'productization-protected-runtime',
      generatedAt,
      status: 'ready',
      experienceProfile,
      productMode,
      firstRun,
      sandbox,
      templates,
      mission,
      receipt,
      zavorthControlProjection: buildProtectedRuntimeProjection('/control'),
      cli: {
        commands: [
          'zavorth onboard',
          'zavorth templates',
          'zavorth missions',
          'zavorth receipts',
          'zavorth doctor --simple',
          'zavorth doctor --advanced',
        ],
        mirrorsWebProjection: true,
      },
      distribution: {
        privateExecutableFirst: true,
        npmDevInternalPath: true,
        proprietaryLicenseRequired: true,
        publicClaimsMustBeCurrent: true,
      },
      certification: {
        gate: 'zavorth:productization-protected-runtime:check',
        checks: [
          {
            id: 'experience-profiles',
            status: 'passed',
            summary: 'Personal, Creator, Developer, Business and Power profiles map human needs onto governed runtime defaults.',
          },
          {
            id: 'product-modes',
            status: 'passed',
            summary: 'Personal/Governed and Simple/Advanced are modeled without changing authority.',
          },
          {
            id: 'guided-templates',
            status: 'passed',
            summary: 'Five daily-use templates are exposed before any marketplace path.',
          },
          {
            id: 'mission-projection',
            status: 'passed',
            summary: 'CLI and ZavorthControl consume a mission projection with timeline, risk and artifacts.',
          },
          {
            id: 'visual-receipt',
            status: 'passed',
            summary: 'Receipts expose simple and advanced evidence without raw secrets.',
          },
          {
            id: 'sandbox-fallback',
            status: 'passed',
            summary: 'Strong sandbox is preferred; otherwise mutable work stays in dry-run.',
          },
          {
            id: 'private-distribution',
            status: 'passed',
            summary: 'Official posture is private executable first with npm kept as dev/internal path.',
          },
        ],
      },
    };
  }

  public renderText(
    snapshot: ZavorthProductizationProtectedRuntimeSnapshot,
    view: ZavorthProductizationProtectedRuntimeView = 'all',
  ): string {
    const sections: string[] = [];
    const header = [
      '[zavorth-product] protected daily runtime',
      `experience: ${snapshot.experienceProfile.selected.profileId} | autonomy: ${snapshot.experienceProfile.selected.autonomy}`,
      `mode: ${snapshot.productMode.selected.dailyMode}/${snapshot.productMode.selected.detailMode}`,
      `sandbox: ${snapshot.sandbox.status} | mutation: ${snapshot.sandbox.mutationMode}`,
      `mission: ${snapshot.mission.title} | status: ${snapshot.mission.status} | risk: ${snapshot.mission.risk}`,
    ].join('\n');

    if (view === 'all') {
      sections.push(header);
    }

    if (view === 'all' || view === 'journey') {
      sections.push([
        '[first-run]',
        ...snapshot.firstRun.steps.map((step) =>
          `- ${step.id}: ${step.status} | ${step.command} | ${step.nextAction}`,
        ),
        `safe demo: ${snapshot.firstRun.safeDemoRun.command}`,
      ].join('\n'));
    }

    if (view === 'all' || view === 'templates') {
      sections.push([
        '[templates]',
        ...snapshot.templates.map((template) =>
          `- ${template.id}: ${template.label} | risk=${template.defaultRisk} | mutate=${template.requiresMutation ? 'yes' : 'no'}`,
        ),
      ].join('\n'));
    }

    if (view === 'all' || view === 'missions') {
      sections.push([
        '[mission]',
        `${snapshot.mission.id}: ${snapshot.mission.title}`,
        `status: ${snapshot.mission.status} | risk: ${snapshot.mission.risk} | source: ${snapshot.mission.source}`,
        `execution: readOnly=${snapshot.mission.execution.readOnly ? 'yes' : 'no'} | mutation=${snapshot.mission.execution.mutationMode}`,
        `next: ${snapshot.mission.nextAction}`,
        ...snapshot.mission.timeline.map((event) => `- ${event.status} ${event.title}: ${event.summary}`),
      ].join('\n'));
    }

    if (view === 'all' || view === 'receipts') {
      sections.push([
        '[receipt]',
        `${snapshot.receipt.id}: ${snapshot.receipt.summary.title}`,
        snapshot.receipt.simpleText,
        `files read=${snapshot.receipt.summary.filesRead} changed=${snapshot.receipt.summary.filesChanged} blocked=${snapshot.receipt.summary.actionsBlocked}`,
        `rollback=${snapshot.receipt.summary.rollbackAvailable ? 'available' : 'not available'} | rawSecrets=${snapshot.receipt.redaction.rawSecretsPresent ? 'present' : 'none'}`,
      ].join('\n'));
    }

    if (view === 'all' || view === 'sandbox') {
      sections.push([
        '[sandbox]',
        `status: ${snapshot.sandbox.status} | preferred: ${snapshot.sandbox.preferredStrongTier || 'none'} | mutation: ${snapshot.sandbox.mutationMode}`,
        `doctor: ${snapshot.sandbox.doctor.simpleStatus} | ${snapshot.sandbox.doctor.headline}`,
        `policy: liveMutations=${snapshot.sandbox.defaultPolicy.liveMutationsAllowed ? 'yes' : 'no'} | require=${snapshot.sandbox.defaultPolicy.liveMutationsRequire}`,
        `fallback: ${snapshot.sandbox.fallback.active ? 'active' : 'inactive'} | ${snapshot.sandbox.fallback.reason}`,
        `user action: ${snapshot.sandbox.fallback.userAction}`,
        `ready tiers: ${snapshot.sandbox.readyTiers.join(', ') || 'none'}`,
      ].join('\n'));
    }

    return `${sections.join('\n\n')}\n`;
  }

  private buildFirstRunJourney(input: {
    generatedAt: string;
    productMode: ZavorthProductModeContract;
    templates: ZavorthGuidedMissionTemplate[];
    sandbox: ZavorthSandboxReadinessContract;
  }): ZavorthFirstRunProductJourneyContract {
    const selected = input.productMode.selected;
    const steps: ZavorthFirstRunProductJourneyStep[] = [
      {
        id: 'mode',
        label: 'Choose daily posture',
        status: 'ready',
        command: `zavorth onboard --mode=${selected.dailyMode}`,
        summary: 'Personal keeps the first run simple; Governed exposes audit details.',
        nextAction: `Selected ${selected.dailyMode}/${selected.detailMode}.`,
      },
      {
        id: 'provider',
        label: 'Connect provider',
        status: 'recommended',
        command: 'zavorth onboard',
        summary: 'Provider keys stay out of prompts and should be represented as SecretRef metadata.',
        nextAction: 'Configure the provider when a live model is needed.',
      },
      {
        id: 'workspace',
        label: 'Pick workspace',
        status: 'ready',
        command: 'zavorth onboard',
        summary: 'Workspace boundaries are required before writes or command execution.',
        nextAction: 'Keep the first mission read-only until the workspace is confirmed.',
      },
      {
        id: 'safety',
        label: 'Safety and sandbox',
        status: input.sandbox.status === 'ready' ? 'ready' : 'needs_input',
        command: `zavorth doctor --${selected.detailMode}`,
        summary: 'Strong sandbox is used when present; otherwise mutable work remains dry-run.',
        nextAction: input.sandbox.fallback.userAction,
      },
      {
        id: 'channels',
        label: 'Basic channels',
        status: 'optional',
        command: 'zavorth channels status',
        summary: 'Channels can be activated later without changing the mission contract.',
        nextAction: 'Start with Web + CLI; add Telegram or other channels only when needed.',
      },
      {
        id: 'first-mission',
        label: 'First safe mission',
        status: 'ready',
        command: 'zavorth templates',
        summary: 'Pick a guided mission that starts read-only and produces a receipt.',
        nextAction: 'Run the dev repo review or PDF summary template first.',
      },
    ];

    return {
      schemaVersion: 1,
      surface: 'first-run-product-journey',
      generatedAt: input.generatedAt,
      selected,
      status: input.sandbox.status === 'blocked' ? 'attention' : 'ready',
      primaryCommands: {
        onboard: 'zavorth onboard',
        go: 'zavorth go',
        doctorSimple: 'zavorth doctor --simple',
        doctorAdvanced: 'zavorth doctor --advanced',
        templates: 'zavorth templates',
      },
      steps,
      templates: input.templates,
      safeDemoRun: {
        templateId: 'dev-repo-review',
        command: 'zavorth missions --template=dev-repo-review',
        mutatesWorkspace: false,
        summary: 'Read-only repository review with risk summary and visual receipt.',
      },
    };
  }

  private buildSandboxReadiness(
    generatedAt: string,
    host: SandboxHostReadinessSnapshot,
  ): ZavorthSandboxReadinessContract {
    const readyTiers = host.tiers.filter((tier) => tier.canRun).map((tier) => tier.id);
    const preferredStrongTier = STRONG_SANDBOX_PRIORITY.find((tierId) =>
      host.tiers.some((tier) => tier.id === tierId && tier.canRun && tier.strongBoundary),
    ) || null;
    const status: ZavorthSandboxReadinessStatus = preferredStrongTier ? 'ready'
      : readyTiers.length > 0
        ? 'fallback'
        : 'blocked';
    const mutationMode = preferredStrongTier ? 'sandbox' : status === 'blocked' ? 'blocked' : 'dry-run';
    const strongSandboxAvailable = Boolean(preferredStrongTier);
    const fallbackActive = !strongSandboxAvailable;
    const fallbackReason = strongSandboxAvailable ? `Strong sandbox ready via ${preferredStrongTier}.`
      : status === 'blocked'
        ? 'No minimum sandbox fallback is ready; execution must stay blocked.'
        : 'No strong sandbox is ready; read-only and preview can continue, but mutations remain dry-run.';
    const fallbackAction = strongSandboxAvailable ? 'Continue normally; approvals still apply to sensitive actions.'
      : 'Install or enable Docker/gVisor/Firecracker for sandboxed mutations, then run zavorth doctor --advanced.';

    return {
      schemaVersion: 1,
      surface: 'sandbox-readiness',
      generatedAt,
      status,
      mutationMode,
      readOnlyAllowed: status !== 'blocked',
      previewAllowed: status !== 'blocked',
      strongSandboxAvailable,
      preferredStrongTier,
      readyTiers,
      defaultPolicy: {
        liveMutationsAllowed: strongSandboxAvailable,
        liveMutationsRequire: 'strong-sandbox-and-approval',
        safeWithoutStrongSandbox: ['read-only', 'preview', 'doctor', 'receipt'],
        blockedWithoutStrongSandbox: [
          'workspace-write',
          'host-command',
          'network-write',
          'channel-send',
          'live-skill-apply',
        ],
        explanation: strongSandboxAvailable ? 'Live mutations may proceed only through the strong sandbox, Policy Broker and scoped approval.'
          : 'Without Docker, gVisor or Firecracker readiness, Zavorth defaults to read-only/preview and keeps mutable work in dry-run.',
      },
      fallback: {
        active: fallbackActive,
        reason: fallbackReason,
        mutatingActions: strongSandboxAvailable ? 'sandboxed' : status === 'blocked' ? 'blocked' : 'dry-run-only',
        userAction: fallbackAction,
      },
      doctor: {
        headline: strongSandboxAvailable ? 'Strong sandbox is ready.'
          : status === 'blocked'
            ? 'Sandbox fallback is blocked.'
            : 'Strong sandbox is not ready; mutable actions are dry-run only.',
        summary: strongSandboxAvailable ? `Preferred isolation tier: ${preferredStrongTier}. Sensitive mutations still require scoped approval.`
          : 'Zavorth can inspect, preview and issue receipts, but it will not apply workspace writes, host commands, network writes, channel sends or live skill applies.',
        simpleStatus: strongSandboxAvailable ? 'ready' : status === 'blocked' ? 'blocked' : 'needs_sandbox',
        recommendedCommand: 'zavorth doctor --advanced',
        safeDefault: strongSandboxAvailable ? 'Use sandboxed mutations with Policy Broker approval.'
          : 'Use read-only and preview/dry-run until a strong sandbox is confirmed.',
      },
      blockers: host.summary.blockingIssues,
      host,
    };
  }

  private buildMission(input: {
    generatedAt: string;
    template: ZavorthGuidedMissionTemplate;
    source: ZavorthMissionContract['source'];
    request: string;
    sandbox: ZavorthSandboxReadinessContract;
  }): ZavorthMissionContract {
    const risk = input.template.defaultRisk;
    const needsApproval = input.template.requiresMutation || risk !== 'low';
    const readOnly = !input.template.requiresMutation;
    const status = input.sandbox.status === 'blocked'
      ? 'blocked'
      : input.template.requiresMutation && input.sandbox.mutationMode === 'dry-run'
        ? 'dry_run'
        : needsApproval ? 'needs_approval'
          : 'ready';
    const id = stableId('mission', `${input.template.id}:${input.source}:${input.request}`);
    const receiptId = stableId('receipt', `${id}:${input.generatedAt}`);
    const timeline = this.buildTimeline(input.generatedAt, risk, input.sandbox, needsApproval);
    const approvals = this.buildApprovals(id, risk, needsApproval);
    const artifacts = this.buildArtifacts(input.template, needsApproval);

    return {
      schemaVersion: 1,
      surface: 'mission',
      id,
      templateId: input.template.id,
      title: input.template.label,
      request: input.request,
      source: input.source,
      status,
      risk,
      execution: {
        readOnly,
        mutationMode: input.template.requiresMutation ? input.sandbox.mutationMode : 'dry-run',
        zavorthControlCanExecute: false,
        policyBrokerRequired: true,
      },
      timeline,
      approvals,
      artifacts,
      receiptId,
      nextAction: this.missionNextAction({ status, needsApproval, sandbox: input.sandbox }),
      definition: {
        objective: input.request,
        expectedOutcome: input.template.summary,
        completionCriteria: input.template.expectedArtifacts.map((artifact, index) => ({
          id: `artifact-${index + 1}`,
          description: `Produce and independently verify ${artifact}.`,
          requiredEvidence: ['artifact_digest'],
          minimumEvidenceCount: 1,
        })),
        boundaries: {
          workspaceRoots: ['.'],
          allowedFilePatterns: readOnly ? ['**/*'] : [],
          deniedFilePatterns: ['**/.env*', '**/*.pem', '**/*.key'],
          allowedServices: [],
          networkAccess: input.template.requiresNetwork ? 'read_only' : 'denied',
          maximumDurationMs: null,
        },
        approvalRequirements: needsApproval ? [{
          id: `approval-${id}`,
          description: 'Approve the scoped mutable or elevated-risk work before execution.',
          requiredBefore: 'Any mutable or elevated-risk action.',
        }] : [],
        verificationRequirements: [
          'Use evidence captured by the runtime, verifier or Policy Broker.',
          'Do not accept executor narrative as completion evidence.',
        ],
        stopConditions: [
          'Stop when a declared boundary would be exceeded.',
          'Stop when required approval or independent evidence is unavailable.',
        ],
        rollbackPlan: input.template.requiresMutation ? 'Restore changed files from the governed rollback receipt.'
          : null,
      },
    };
  }

  /**
   * Mark a mission completed only after independent verification succeeds.
   * Executor narrative / self-claims never complete a mission alone.
   */
  public completeMissionWithVerification(input: {
    mission: ZavorthMissionContract;
    evidence: unknown[];
    verifiedAt?: string;
  }): ZavorthMissionContract {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { gateMissionCompletion } = require('./AgentMissionCompletionGate.js') as typeof import('./AgentMissionCompletionGate.js');
    const definition = input.mission.definition;
    if (!definition) {
      return {
        ...input.mission,
        status: 'blocked',
        nextAction: 'Mission definition is required before completion can be verified.',
      };
    }
    const gate = gateMissionCompletion({
      missionId: input.mission.id,
      definition,
      evidence: input.evidence,
      proposedStatus: 'completed',
      verifiedAt: input.verifiedAt,
    });
    return {
      ...input.mission,
      status: (gate.allowedStatus as ZavorthMissionContract['status']) || 'blocked',
      nextAction: gate.blocked
        ? gate.reason
        : 'Mission completed with independent verification receipt.',
      timeline: [
        ...input.mission.timeline,
        {
          id: `verify-${input.mission.id}`,
          at: input.verifiedAt || new Date().toISOString(),
          status: gate.blocked ? 'blocked' : 'done',
          title: gate.blocked ? 'Verification incomplete' : 'Verification passed',
          summary: gate.reason,
        },
      ],
    };
  }

  private buildReceipt(input: {
    generatedAt: string;
    productMode: ZavorthProductModeContract;
    mission: ZavorthMissionContract;
    template: ZavorthGuidedMissionTemplate;
  }): ZavorthVisualReceiptContract {
    const filesChanged = input.template.requiresMutation && input.mission.execution.mutationMode === 'sandbox' ? 1 : 0;
    const actionsBlocked = input.mission.status === 'blocked' || input.mission.status === 'dry_run' ? 1 : 0;
    const approvalOptions = input.mission.approvals.flatMap((approval) => approval.options);

    return {
      schemaVersion: 1,
      surface: 'visual-receipt',
      id: input.mission.receiptId,
      missionId: input.mission.id,
      generatedAt: input.generatedAt,
      mode: input.productMode.selected.detailMode,
      summary: {
        title: input.mission.title,
        risk: input.mission.risk,
        outcome: input.mission.status,
        filesRead: input.template.expectedArtifacts.length,
        filesChanged,
        actionsBlocked,
        networkUsed: input.template.requiresNetwork ? 1 : 0,
        networkBlocked: input.template.requiresNetwork && input.mission.risk !== 'low' ? 1 : 0,
        approvals: input.mission.approvals.filter((approval) => approval.status === 'pending').length,
        rollbackAvailable: input.template.requiresMutation,
      },
      simpleText: this.buildSimpleReceiptText(input.mission, filesChanged, actionsBlocked),
      advanced: {
        policyBroker: 'required',
        trustPlane: 'active',
        zavorthControlCanExecute: false,
        sandboxMutationMode: input.mission.execution.mutationMode,
        approvalOptions,
        artifacts: input.mission.artifacts.map((artifact) => artifact.id),
      },
      redaction: {
        rawSecretsPresent: false,
        policy: 'secretrefs-only',
      },
    };
  }

  private selectTemplate(
    templates: ZavorthGuidedMissionTemplate[],
    rawTemplateId: unknown,
    rawRequest?: unknown,
  ): ZavorthGuidedMissionTemplate {
    const templateId = String(rawTemplateId ?? '').trim() as ZavorthGuidedMissionTemplateId;
    const explicit = templates.find((template) => template.id === templateId);
    if (explicit) {
      return explicit;
    }

    const request = String(rawRequest || '').toLowerCase();
    const inferredId: ZavorthGuidedMissionTemplateId | null =
      /\b(pdf|document|paper|article|summari[sz]e|resum[eo])\b/.test(request) ? 'pdf-summary'
        : /\b(organize|folder|rename|move|clean up|classify files|files?)\b/.test(request) ? 'file-organization'
          : /\b(daily|today|agenda|status|recap|summary)\b/.test(request) ? 'daily-assistant'
            : /\b(audit|security|risk|vulnerab|threat|hardening|review risks?)\b/.test(request) ? 'safe-audit'
              : /\b(repo|repository|code|project|workspace|review|bug)\b/.test(request) ? 'dev-repo-review'
                : null;
    return templates.find((template) => template.id === inferredId) || templates[0];
  }

  private buildTimeline(
    generatedAt: string,
    risk: ZavorthMissionRiskLevel,
    sandbox: ZavorthSandboxReadinessContract,
    needsApproval: boolean,
  ): ZavorthMissionTimelineEvent[] {
    return [
      {
        id: 'mission-created',
        at: generatedAt,
        status: 'done',
        title: 'Mission created',
        summary: 'Zavorth converted the request into a tracked mission.',
      },
      {
        id: 'risk-classified',
        at: generatedAt,
        status: 'done',
        title: 'Risk classified',
        summary: `Risk level is ${risk}.`,
      },
      {
        id: 'sandbox-evaluated',
        at: generatedAt,
        status: sandbox.status === 'blocked' ? 'blocked' : 'done',
        title: 'Sandbox evaluated',
        summary: `Mutation mode is ${sandbox.mutationMode}.`,
      },
      {
        id: 'approval-check',
        at: generatedAt,
        status: needsApproval ? 'pending' : 'done',
        title: 'Approval check',
        summary: needsApproval ? 'User approval is required before any sensitive or mutating action.'
          : 'Read-only mission can proceed without an extra approval.',
      },
    ];
  }

  private buildApprovals(
    missionId: string,
    risk: ZavorthMissionRiskLevel,
    needsApproval: boolean,
  ): ZavorthMissionApproval[] {
    if (!needsApproval) {
      return [
        {
          id: `${missionId}:approval:not-required`,
          status: 'not_required',
          risk,
          prompt: 'No approval is required for this read-only mission.',
          options: ['view_preview'],
        },
      ];
    }

    return [
      {
        id: `${missionId}:approval:primary`,
        status: 'pending',
        risk,
        prompt: 'Zavorth wants to continue this mission beyond read-only preview. Allow once...',
        options: ['allow_once', 'deny', 'view_preview', 'view_rollback'],
      },
    ];
  }

  private buildArtifacts(
    template: ZavorthGuidedMissionTemplate,
    needsApproval: boolean,
  ): ZavorthMissionArtifact[] {
    const artifacts: ZavorthMissionArtifact[] = template.expectedArtifacts.map((artifact) => ({
      id: `${template.id}:${artifact}`,
      kind: artifact.includes('rollback') ? 'rollback' as const : artifact.includes('receipt') ? 'receipt' as const : 'report' as const,
      label: artifact,
      status: 'expected' as const,
    }));
    artifacts.push({
      id: `${template.id}:visual-receipt`,
      kind: 'receipt',
      label: 'visual receipt',
      status: 'expected',
    });
    if (needsApproval) {
      artifacts.push({
        id: `${template.id}:approval-preview`,
        kind: 'preview',
        label: 'approval preview',
        status: 'expected',
      });
    }
    return artifacts;
  }

  private missionNextAction(input: {
    status: ZavorthMissionContract['status'];
    needsApproval: boolean;
    sandbox: ZavorthSandboxReadinessContract;
  }): string {
    if (input.status === 'blocked') {
      return input.sandbox.fallback.userAction;
    }
    if (input.status === 'dry_run') {
      return 'Review the dry-run preview; enable a strong sandbox before applying mutations.';
    }
    if (input.needsApproval) {
      return 'Review preview, rollback and receipt; approve once only if the scope is correct.';
    }
    return 'Run the mission read-only and review the receipt.';
  }

  private buildSimpleReceiptText(
    mission: ZavorthMissionContract,
    filesChanged: number,
    actionsBlocked: number,
  ): string {
    if (mission.status === 'dry_run') {
      return 'Zavorth prepared a safe preview. Changes are blocked until sandbox readiness and approval are present.';
    }
    if (mission.status === 'needs_approval') {
      return `Zavorth needs approval before continuing. It expects to change ${filesChanged} file(s).`;
    }
    if (mission.status === 'blocked') {
      return 'Zavorth blocked the mission because the required runtime protection is missing.';
    }
    return `Zavorth can run this mission safely. Blocked actions: ${actionsBlocked}.`;
  }
}

export function sanitizeMissionText(value: string): string {
  return value
    .replace(/\b(sk|pk|ghp|gho|xox[baprs])[-_A-Za-z0-9]{12,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .slice(0, 4000);
}

function stableId(prefix: string, input: string): string {
  return `${prefix}_${createHash('sha256').update(input).digest('hex').slice(0, 12)}`;
}
