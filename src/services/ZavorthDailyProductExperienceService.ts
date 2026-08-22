import {
  ZAVORTH_DAILY_PRODUCT_EXPERIENCE_VERSION,
  type ZavorthDailyProductExperienceZavorthControlCard,
  type ZavorthDailyProductExperienceLoopStep,
  type ZavorthDailyProductExperienceReviewItem,
  type ZavorthDailyProductExperienceSetupStep,
  type ZavorthDailyProductExperienceSnapshot,
  type ZavorthDailyProductExperienceStatus,
  type ZavorthDailyProductExperienceStepStatus,
} from '../contracts/ZavorthDailyProductExperienceContract.js';
import type { ZavorthControlSetupChecklistSnapshot } from '../contracts/ZavorthControlSetupChecklistContract.js';
import type { ZavorthDailyCapabilityFlowSnapshot } from '../contracts/ZavorthDailyCapabilityFlowContract.js';
import { ZavorthControlSetupChecklistService } from './ZavorthControlSetupChecklistService.js';
import { ZavorthDailyCapabilityFlowService, type ZavorthDailyCapabilityFlowInput } from './ZavorthDailyCapabilityFlowService.js';
import { ZavorthExperienceProfileService, type ZavorthExperienceProfileInput } from './ZavorthExperienceProfileService.js';

type Runtime = {
  now?: () => Date;
  profiles?: Pick<ZavorthExperienceProfileService, 'buildContract'>;
  setupChecklist?: Pick<ZavorthControlSetupChecklistService, 'buildSnapshot'>;
  capabilityFlow?: Pick<ZavorthDailyCapabilityFlowService, 'buildSnapshot'>;
};

export type ZavorthDailyProductExperienceInput = ZavorthExperienceProfileInput & ZavorthDailyCapabilityFlowInput;

export class ZavorthDailyProductExperienceService {
  private readonly now: () => Date;
  private readonly profiles: Pick<ZavorthExperienceProfileService, 'buildContract'>;
  private readonly setupChecklist: Pick<ZavorthControlSetupChecklistService, 'buildSnapshot'>;
  private readonly capabilityFlow: Pick<ZavorthDailyCapabilityFlowService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profiles = runtime.profiles || new ZavorthExperienceProfileService();
    this.setupChecklist = runtime.setupChecklist || new ZavorthControlSetupChecklistService({ now: this.now });
    this.capabilityFlow = runtime.capabilityFlow || new ZavorthDailyCapabilityFlowService({ now: this.now });
  }

  public async buildSnapshot(input: ZavorthDailyProductExperienceInput = {}): Promise<ZavorthDailyProductExperienceSnapshot> {
    const profile = this.profiles.buildContract(input);
    const setup = this.setupChecklist.buildSnapshot();
    const capability = await this.capabilityFlow.buildSnapshot(input);
    const selectedProfile = profile.profiles.find((entry) => entry.id === profile.selected.profileId) || profile.profiles[0];
    const setupSteps = buildSetupSteps(setup);
    const chatReady = resolveChatReady(setup);
    const platformSetupComplete = resolvePlatformSetupComplete(setup);
    const status = resolveStatus(setup, capability, chatReady);

    return {
      generatedAt: this.now().toISOString(),
      version: ZAVORTH_DAILY_PRODUCT_EXPERIENCE_VERSION,
      status,
      headline: headlineFor(status, chatReady),
      chatReady,
      platformSetupComplete,
      happyPath: {
        title: 'Daily happy path',
        summary: chatReady ? 'Provider is ready. Open the daily surface and ask normally. Sensitive work still asks first.'
          : 'Configure one provider, then open chat. Channels, skills and evals are optional platform setup.',
        steps: [
          {
            id: 'open',
            label: 'Open Zavorth',
            summary: 'Use Desktop, Control, or `zavorth open`.',
            requiredForChat: true,
          },
          {
            id: 'provider',
            label: 'Prove one provider',
            summary: 'Add a model key or local model and run a probe.',
            requiredForChat: true,
          },
          {
            id: 'first-ask',
            label: 'First useful ask',
            summary: 'Ask a real question without file mutation (for example: explain this project).',
            requiredForChat: true,
          },
          {
            id: 'review-if-risky',
            label: 'Review only when risky',
            summary: 'Writes, shell, sends and sensitive memory stay on explicit approval.',
            requiredForChat: false,
          },
        ],
        nextCommand: chatReady ? 'zavorth open' : 'zavorth setup',
      },
      selectedProfile: {
        profileId: profile.selected.profileId,
        label: selectedProfile?.label || profile.selected.profileId,
        autonomy: profile.selected.autonomy,
        explanation: profile.selected.explanation,
        summary: selectedProfile?.summary || 'Daily work profile.',
      },
      firstRun: {
        title: 'Start guided',
        summary: 'Happy path: provider then chat. Full platform setup (channel, runtime, memory, tools, routines, evals) stays optional.',
        steps: setupSteps,
      },
      dailyLoop: {
        title: 'Daily loop',
        summary: 'Ask normally, let low-risk work stay quiet, review important changes, then check what changed later.',
        steps: buildDailyLoop(),
      },
      reviewCenter: {
        title: 'Review center',
        summary: 'Everything useful and reversible should be easy to inspect: learned memory, skills, channels, backends, evals and receipts.',
        items: buildReviewItems(capability),
      },
      zavorthControlProjection: {
        route: '/control',
        renderMode: 'daily-product-experience',
        cards: buildZavorthControlCards(status, capability),
      },
      language: {
        publicTone: 'plain-product-language',
        defaultWords: ['setup', 'review', 'approve', 'undo', 'learned', 'history', 'ready', 'needs setup'],
        advancedWordsHiddenByDefault: ['policy broker', 'transaction plane', 'ledger', 'quarantine', 'sandbox primitive'],
        allowedWhenUserAsksForDetails: ['approval scope', 'receipt evidence', 'runtime profile', 'readiness proof', 'dry-run'],
      },
      qualityGates: {
        commands: [
          'npm run zavorth:daily-product-experience:check --silent',
          'npm run zavorth:daily-capability-flow:check --silent',
          'npm run zavorth:zavorthControl-setup-checklist:check --silent',
          'npm run zavorth-control-vite:check --silent',
          'npm run security:secrets --silent',
        ],
        covers: [
          'first-run setup remains guided',
          'daily loop stays projection-only',
          'learned memory remains editable and forgettable',
          'skills and MCP stay preview-first',
          'channels and providers do not claim synthetic live readiness',
          'execution backends stay dry-run until strong smoke passes',
          'approval fatigue is tested as a product risk',
          'daily mutations emit operator continuity receipt ids and policy decisions',
        ],
      },
      safety: {
        projectionOnly: true,
        noLiveActionExecuted: true,
        rawSecretsSerialized: false,
        setupDoesNotGrantAuthority: true,
        liveActionsRemainApprovalBound: true,
        memoryChangesRemainReviewable: true,
        externalToolsRemainPreviewUntilApproved: true,
        operatorContinuityBound: true,
      },
      operatorContinuity: {
        kernel: 'OperatorContinuityKernel',
        contract: 'operator-continuity-envelope/1',
        dailyMutationPaths: [
          'tool-executor',
          'action-gateway',
          'agent-native-tool-loop',
          'mcp',
        ],
        projectionOnly: true,
      },
    };
  }

  public renderText(snapshot: ZavorthDailyProductExperienceSnapshot): string {
    return [
      'Zavorth Daily Product Experience',
      snapshot.headline,
      '',
      `Profile: ${snapshot.selectedProfile.label} (${snapshot.selectedProfile.profileId})`,
      `Chat ready: ${snapshot.chatReady ? 'yes' : 'no'}`,
      `Platform setup complete: ${snapshot.platformSetupComplete ? 'yes' : 'no'}`,
      '',
      '[Daily happy path]',
      ...snapshot.happyPath.steps.map((step) => `- ${step.label}: ${step.summary}`),
      `Next: ${snapshot.happyPath.nextCommand}`,
      '',
      '[Start guided]',
      ...snapshot.firstRun.steps.map((step) => `- [${step.status}] ${step.label}: ${step.nextAction}`),
      '',
      '[Daily loop]',
      ...snapshot.dailyLoop.steps.map((step) => `- ${step.label}: ${step.summary}`),
      '',
      '[Review center]',
      ...snapshot.reviewCenter.items.map((item) => `- [${item.status}] ${item.label}: ${item.userQuestion}`),
      '',
      '[Quality gates]',
      ...snapshot.qualityGates.commands.map((command) => `- ${command}`),
    ].join('\n');
  }
}

function buildSetupSteps(setup: ZavorthControlSetupChecklistSnapshot): ZavorthDailyProductExperienceSetupStep[] {
  const byId = new Map(setup.items.map((item) => [item.id, item]));
  const provider = byId.get('connect-provider');
  const channel = byId.get('connect-channel') || byId.get('connect-telegram');
  const backend = byId.get('configure-executor');
  const memory = byId.get('review-memory');
  const skills = byId.get('install-skills-governed');
  const scheduler = byId.get('schedule-with-preview');
  const quality = byId.get('run-quality-evals');

  return [
    {
      id: 'choose-profile',
      area: 'profile',
      label: 'Choose profile',
      status: 'done',
      summary: 'Personal, Creator, Developer, Business and Power change wording, suggestions and detail.',
      nextAction: 'Pick a profile or describe how you want Zavorth to work.',
      command: 'zavorth experience --profile personal',
      href: '/control...setup=profile',
      proof: 'Experience profiles do not grant execution authority.',
    },
    setupStep('test-provider', 'provider', 'Test provider', provider),
    setupStep('connect-channel', 'channel', 'Connect channel', channel),
    setupStep('configure-runtime', 'runtime', 'Configure runtime', backend),
    setupStep('review-memory', 'memory', 'Review learned memory', memory),
    setupStep('review-tools', 'skills', 'Review tools and skills', skills),
    setupStep('schedule-routine', 'scheduler', 'Schedule a routine', scheduler),
    setupStep('run-evals', 'quality', 'Run evals', quality),
  ];
}

function setupStep(
  id: ZavorthDailyProductExperienceSetupStep['id'],
  area: ZavorthDailyProductExperienceSetupStep['area'],
  label: string,
  source: ZavorthControlSetupChecklistSnapshot['items'][number] | undefined,
): ZavorthDailyProductExperienceSetupStep {
  return {
    id,
    area,
    label,
    status: mapStepStatus(source?.status),
    summary: source?.summary || 'Open this setup step and follow the next command.',
    nextAction: source?.nextAction || 'Open setup checklist.',
    command: source?.command || 'npm run zavorth:zavorthControl-setup-checklist --silent',
    href: source?.href || '/control...setup=checklist',
    proof: source?.proof || 'Projection-only setup step.',
  };
}

function buildDailyLoop(): ZavorthDailyProductExperienceLoopStep[] {
  return [
    loop('ask', 'Ask', 'Use natural language from zavorthControl, CLI, API or a configured channel.', true, []),
    loop('understand', 'Understand', 'Zavorth reads profile, context, readiness and risk before choosing a route.', true, []),
    loop('choose-route', 'Choose route', 'It decides whether to answer, use a skill, call a subagent, schedule work or ask for setup.', true, []),
    loop('work', 'Work', 'Low-risk reversible work can stay quiet; writes, shell, sends, provider changes and sensitive memory ask first.', false, [
      'file or system mutation',
      'shell execution',
      'external send',
      'provider or channel change',
      'security setting change',
      'sensitive learned memory',
    ]),
    loop('deliver', 'Deliver', 'Results return where the user asked, or stay as preview/outbox until a live route is proven.', true, []),
    loop('receipt', 'History', 'Important actions leave a redacted record the user can inspect later.', true, []),
    loop('review', 'Review', 'The user can edit or forget learned memory, reject candidates, roll back behavior and archive skills.', true, []),
  ];
}

function loop(
  id: ZavorthDailyProductExperienceLoopStep['id'],
  label: string,
  summary: string,
  quietByDefault: boolean,
  approvalAppearsFor: string[],
): ZavorthDailyProductExperienceLoopStep {
  return {
    id,
    label,
    summary,
    quietByDefault,
    approvalAppearsFor,
    visibleInZavorthControl: true,
  };
}

function buildReviewItems(capability: ZavorthDailyCapabilityFlowSnapshot): ZavorthDailyProductExperienceReviewItem[] {
  return [
    reviewItem('learned-memory', 'Learned memory', 'attention', 'Review what Zavorth learned, why, confidence, expiry, edit and forget.', '/control/memory...view=learned', 'npm run zavorth:memory-learning-loop:check --silent', 'What did Zavorth learn about me and why...'),
    reviewItem('skill-lifecycle', 'Skills lifecycle', 'attention', 'Draft, scan, smoke, approve, install, measure and archive from one lifecycle.', '/control/skills...view=lifecycle', 'npm run zavorth:skill-curator-live-loop:check --silent', 'Which skills are drafts, active or unused...'),
    reviewItem('channel-readiness', 'Channels', 'attention', 'Show live, outbox, preview or blocked with the next setup step.', '/control/providers...view=channels', 'npm run zavorth:channel-connection-playbook:check --silent', 'Which channels can really send now...'),
    reviewItem('backend-readiness', 'Execution', 'attention', 'Show local-jail, Docker, WSL and cloud readiness with dry-run when strong smoke is missing.', '/control/providers...view=execution', 'npm run zavorth:execution-backend-playbook:check --silent', 'Can Zavorth execute live here or only preview...'),
    reviewItem('quality-evals', 'Quality evals', capability.continuousEvals.status, capability.continuousEvals.summary, '/control/docs...view=quality', 'npm run zavorth:operational-rollout-eval:check --silent', 'Did response quality, leaks, tool-use or approval fatigue regress...'),
    reviewItem('receipts', 'History', 'ready', 'Important changes stay reviewable with redacted evidence and rollback context.', '/control/logs...view=receipts', 'npm run security:secrets --silent', 'What changed, what was blocked, and what can I undo...'),
  ];
}

function reviewItem(
  id: ZavorthDailyProductExperienceReviewItem['id'],
  label: string,
  status: ZavorthDailyProductExperienceStatus,
  summary: string,
  href: string,
  command: string,
  userQuestion: string,
): ZavorthDailyProductExperienceReviewItem {
  return { id, label, status, summary, href, command, userQuestion };
}

function buildZavorthControlCards(
  status: ZavorthDailyProductExperienceStatus,
  capability: ZavorthDailyCapabilityFlowSnapshot,
): ZavorthDailyProductExperienceZavorthControlCard[] {
  return [
    card('daily-start', 'Start here', 'Choose profile, test one provider, connect one channel and run one small mission.', '/control...daily=start', 'Start daily setup. Show profile, provider, channel, runtime and first mission as a guided checklist.', status),
    card('setup-guide', 'Setup guide', 'Providers, channels and execution backend show honest ready, preview, outbox or blocked state.', '/control/providers...daily=setup', 'Open setup guide. Show providers, channels, backends and the next useful command.', status),
    card('daily-loop', 'Daily loop', 'Ask, understand, work, deliver, record history and review what changed.', '/control...daily=loop', 'Explain the current request through the daily loop and show where approval would appear.', 'ready'),
    card('review-center', 'Review center', 'Learned memory, skills, channels, execution, evals and history stay inspectable.', '/control/memory...daily=review', 'Open review center. Show learned memory, skills, channels, backends, quality checks and history.', 'attention'),
    card('quality-gates', 'Quality gates', 'Run checks for leaks, readiness, approval fatigue, tool-use and recovery before promotion.', '/control/docs...daily=quality', 'Run the daily product quality overview and list failing checks without executing live actions.', capability.continuousEvals.status),
  ];
}

function card(
  id: ZavorthDailyProductExperienceZavorthControlCard['id'],
  title: string,
  summary: string,
  href: string,
  prompt: string,
  status: ZavorthDailyProductExperienceStatus,
): ZavorthDailyProductExperienceZavorthControlCard {
  return {
    id,
    title,
    summary,
    href,
    prompt,
    status,
    mutatesState: false,
    executionAuthority: false,
  };
}

/**
 * Chat is ready when a provider is proven.
 * Runtime/executor may be present but is not required; full 8-step platform
 * (channel, memory, skills, routines, evals) must never gate chatReady.
 */
function resolveChatReady(setup: ZavorthControlSetupChecklistSnapshot): boolean {
  const provider = setup.items.find((item) => item.id === 'connect-provider');
  if (provider) return provider.status === 'done';
  // Fallback only when the checklist has no provider row: partial progress is not full platform.
  return setup.summary.needsSetup === 0 && setup.summary.blocked === 0 && setup.summary.done > 0;
}

function resolvePlatformSetupComplete(setup: ZavorthControlSetupChecklistSnapshot): boolean {
  return setup.summary.blocked === 0
    && setup.summary.needsSetup === 0
    && setup.summary.next === 0
    && setup.summary.done >= setup.summary.total
    && setup.summary.total > 0;
}

function resolveStatus(
  setup: ZavorthControlSetupChecklistSnapshot,
  capability: ZavorthDailyCapabilityFlowSnapshot,
  chatReady: boolean,
): ZavorthDailyProductExperienceStatus {
  if (setup.summary.blocked > 0 || capability.status === 'blocked') return 'blocked';
  if (!chatReady) return 'needs-setup';
  if (!resolvePlatformSetupComplete(setup) || capability.status === 'attention' || setup.summary.next > 0) {
    return 'attention';
  }
  return 'ready';
}

function headlineFor(status: ZavorthDailyProductExperienceStatus, chatReady: boolean): string {
  if (status === 'blocked') return 'Fix the blocked item before making Zavorth part of daily work.';
  if (status === 'needs-setup') return 'Add and prove one provider, then open chat. Full platform setup can wait.';
  if (status === 'attention') {
    return chatReady ? 'Chat is ready. Optional platform steps remain for channels, tools and routines.'
      : 'Zavorth is usable now, with a few reviewable next steps.';
  }
  return 'Zavorth is ready for daily use with reviewable memory, tools and history.';
}

function mapStepStatus(status: ZavorthControlSetupChecklistSnapshot['items'][number]['status'] | undefined): ZavorthDailyProductExperienceStepStatus {
  if (!status) return 'pending';
  if (status === 'done') return 'done';
  if (status === 'blocked') return 'blocked';
  if (status === 'needs-setup') return 'needs-setup';
  return 'next';
}
