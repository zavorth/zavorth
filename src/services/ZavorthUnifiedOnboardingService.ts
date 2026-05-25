import {
  ZAVORTH_UNIFIED_ONBOARDING_CONTRACT_VERSION,
  type ZavorthUnifiedOnboardingProviderSummary,
  type ZavorthUnifiedOnboardingSnapshot,
  type ZavorthUnifiedOnboardingStatus,
  type ZavorthUnifiedOnboardingStep,
} from '../contracts/ZavorthUnifiedOnboardingContract.js';
import type { ProviderDoctorReport, ProviderDoctorService } from './ProviderDoctorService.js';
import {
  ZavorthProductizationProtectedRuntimeService,
  type ZavorthProductizationProtectedRuntimeInput,
  type ZavorthProductizationProtectedRuntimeSnapshot,
} from './ZavorthProductizationProtectedRuntimeService.js';
import { ZavorthConversationalSetupService } from './ZavorthConversationalSetupService.js';
import type { SandboxHostReadinessSnapshot } from './SandboxHostReadinessService.js';

type ProviderDoctorLike = Pick<ProviderDoctorService, 'inspect'>;
type ProductizationLike = Pick<ZavorthProductizationProtectedRuntimeService, 'buildSnapshot'>;

export type ZavorthUnifiedOnboardingInput = ZavorthProductizationProtectedRuntimeInput & {
  includeAdvanced?: boolean;
};

export type ZavorthUnifiedOnboardingRuntime = {
  now?: () => Date;
  productization?: ProductizationLike;
  providerDoctor?: ProviderDoctorLike;
};

export class ZavorthUnifiedOnboardingService {
  private readonly now: () => Date;
  private readonly productization: ProductizationLike;
  private readonly providerDoctor?: ProviderDoctorLike;

  constructor(runtime: ZavorthUnifiedOnboardingRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.productization = runtime.productization || new ZavorthProductizationProtectedRuntimeService({
      sandboxHostReadiness: buildQuickSandboxHostReadiness(),
    });
    this.providerDoctor = runtime.providerDoctor;
  }

  public buildSnapshot(input: ZavorthUnifiedOnboardingInput = {}): ZavorthUnifiedOnboardingSnapshot {
    const generatedAt = this.now().toISOString();
    const product = this.productization.buildSnapshot(input);
    const provider = this.buildProviderSummary(input);
    const conversationalSetup = new ZavorthConversationalSetupService().buildSnapshot({
      primaryUse: input.request,
      experienceProfile: input.experienceProfile,
      detailLevel: input.detailMode,
    });
    const status = resolveStatus(product, provider);
    const steps = buildSteps(product, provider);
    const safeDemo = {
      command: product.firstRun.safeDemoRun.command,
      templateId: product.firstRun.safeDemoRun.templateId,
      readOnly: true as const,
      summary: product.firstRun.safeDemoRun.summary,
    };

    return {
      contractVersion: ZAVORTH_UNIFIED_ONBOARDING_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'unified-onboarding',
      generatedAt,
      status,
      productMode: product.productMode,
      firstRun: product.firstRun,
      sandbox: product.sandbox,
      provider,
      templates: product.templates,
      steps,
      commands: [
        {
          id: 'onboard',
          command: 'zavorth onboard',
          summary: 'Show this unified journey without mutating the host.',
          appliesMutation: false,
        },
        {
          id: 'conversation',
          command: 'zavorth onboard conversation',
          summary: 'Personalize who the agent is, who the user is and how the experience should feel.',
          appliesMutation: false,
        },
        {
          id: 'go',
          command: 'zavorth go',
          summary: 'Start the local daily runtime after setup is understood.',
          appliesMutation: false,
        },
        {
          id: 'doctor-simple',
          command: 'zavorth doctor --simple',
          summary: 'Show human-readable readiness and missing setup.',
          appliesMutation: false,
        },
        {
          id: 'doctor-advanced',
          command: 'zavorth doctor --advanced',
          summary: 'Show policy, sandbox and technical readiness detail.',
          appliesMutation: false,
        },
        {
          id: 'templates',
          command: 'zavorth templates',
          summary: 'List guided mission templates for first use.',
          appliesMutation: false,
        },
        {
          id: 'missions',
          command: 'zavorth missions',
          summary: 'Show current mission projection.',
          appliesMutation: false,
        },
        {
          id: 'receipts',
          command: 'zavorth receipts',
          summary: 'Show the last visual receipt projection.',
          appliesMutation: false,
        },
        {
          id: 'gateway-status',
          command: 'zavorth gateway status',
          summary: 'Show Gateway/Channel Mesh status from the canonical spine.',
          appliesMutation: false,
        },
      ],
      conversationalSetup: {
        command: 'zavorth onboard conversation',
        status: conversationalSetup.status === 'applied' ? 'ready' : conversationalSetup.status,
        uiLanguage: conversationalSetup.uiLanguage,
        selectedProfile: conversationalSetup.answers.experienceProfileId,
        writesOnlyWithConfirmation: true,
      },
      safeDemo,
      dashboardProjection: {
        route: '/dashboard',
        executionAuthority: false,
        visualBlocksRequireOwnerApproval: true,
        endpoint: '/api/onboarding/unified',
      },
      invariants: [
        {
          id: 'setup-go-doctor-one-journey',
          status: 'passed',
          detail: 'setup, go, doctor, templates, missions and receipts are represented in one onboarding contract.',
        },
        {
          id: 'personal-governed-no-privilege-change',
          status: 'passed',
          detail: 'Personal/Governed changes wording and evidence density, not execution authority.',
        },
        {
          id: 'safe-demo-read-only',
          status: 'passed',
          detail: 'The first suggested mission is read-only and does not mutate the workspace.',
        },
        {
          id: 'dashboard-read-only',
          status: 'passed',
          detail: 'Dashboard consumes the projection without becoming an execution authority.',
        },
        {
          id: 'conversational-setup-preview-first',
          status: 'passed',
          detail: 'Conversational setup is part of onboarding and writes identity/user calibration only after explicit confirmation.',
        },
      ],
      nextAction: buildNextAction(status, provider),
    };
  }

  public renderText(snapshot: ZavorthUnifiedOnboardingSnapshot): string {
    const lines = [
      '[zavorth-onboarding]',
      `status=${snapshot.status}`,
      `mode=${snapshot.productMode.selected.dailyMode}/${snapshot.productMode.selected.detailMode}`,
      `provider=${snapshot.provider.status} ready=${snapshot.provider.ready} missing_auth=${snapshot.provider.missingAuth} needs_probe=${snapshot.provider.needsProbe}`,
      `sandbox=${snapshot.sandbox.status} mutation=${snapshot.sandbox.mutationMode}`,
      `conversation=${snapshot.conversationalSetup.status} profile=${snapshot.conversationalSetup.selectedProfile} uiLanguage=${snapshot.conversationalSetup.uiLanguage}`,
      '',
      '[journey]',
      ...snapshot.steps.map((step) => `- ${step.id}: ${step.status} | ${step.command} | ${step.userAction}`),
      '',
      '[first safe mission]',
      `${snapshot.safeDemo.command}`,
      snapshot.safeDemo.summary,
      '',
      '[daily commands]',
      ...snapshot.commands.map((entry) => `- ${entry.command}: ${entry.summary}`),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ];
    return `${lines.join('\n')}`;
  }

  private buildProviderSummary(input: ZavorthUnifiedOnboardingInput): ZavorthUnifiedOnboardingProviderSummary {
    if (!this.providerDoctor) {
      return {
        status: 'attention',
        activeProvider: 'unknown',
        activeModel: 'unknown',
        ready: 0,
        missingAuth: 0,
        needsProbe: 0,
        nextAction: 'Run zavorth doctor --simple to inspect provider readiness.',
      };
    }

    let report: ProviderDoctorReport;
    try {
      report = this.providerDoctor.inspect({
        includeAdvanced: input.includeAdvanced === true,
      });
    } catch {
      return {
        status: 'attention',
        activeProvider: 'unknown',
        activeModel: 'unknown',
        ready: 0,
        missingAuth: 0,
        needsProbe: 0,
        nextAction: 'Provider doctor could not run; use zavorth doctor --advanced.',
      };
    }

    const ready = report.readyProviders.length;
    const missingAuth = report.pendingConfigProviders.length;
    const needsProbe = report.probeProviders.length;
    const status = ready > 0 ? 'ready' : missingAuth > 0 ? 'missing_auth' : needsProbe > 0 ? 'needs_probe' : 'attention';

    return {
      status,
      activeProvider: safeText(report.activeProviderName, 'not configured'),
      activeModel: safeText(report.activeModelName, 'not configured'),
      ready,
      missingAuth,
      needsProbe,
      nextAction: report.recommendations[0] || (ready > 0
        ? 'Provider is ready; run a safe first mission.'
        : 'Configure one provider credential or use a local provider.'),
    };
  }
}

function buildSteps(
  product: ZavorthProductizationProtectedRuntimeSnapshot,
  provider: ZavorthUnifiedOnboardingProviderSummary,
): ZavorthUnifiedOnboardingStep[] {
  return [
    {
      id: 'mode',
      label: 'Mode',
      status: 'done',
      summary: `Selected ${product.productMode.selected.dailyMode}/${product.productMode.selected.detailMode}.`,
      command: 'zavorth onboard --mode=personal',
      userAction: 'Keep Personal for daily use or choose Governed for audit-heavy work.',
      safeDefault: 'personal/simple',
    },
    {
      id: 'provider',
      label: 'Provider',
      status: provider.status === 'ready' ? 'done' : 'needs_input',
      summary: `${provider.ready} ready provider(s), ${provider.missingAuth} missing credential(s), ${provider.needsProbe} needing probe.`,
      command: 'zavorth doctor --simple',
      userAction: provider.nextAction,
      safeDefault: 'read-only preview works before live provider actions.',
    },
    {
      id: 'workspace',
      label: 'Workspace',
      status: 'ready',
      summary: 'Workspace boundary is part of every first mission.',
      command: 'zavorth go',
      userAction: 'Confirm the workspace before allowing mutations.',
      safeDefault: 'read-only first mission',
    },
    {
      id: 'sandbox',
      label: 'Sandbox',
      status: product.sandbox.strongSandboxAvailable ? 'done' : 'recommended',
      summary: `Sandbox status is ${product.sandbox.status}; mutation mode is ${product.sandbox.mutationMode}.`,
      command: product.sandbox.strongSandboxAvailable ? 'zavorth doctor --simple' : 'zavorth doctor --advanced',
      userAction: product.sandbox.fallback.userAction,
      safeDefault: 'dry-run when strong sandbox is not ready.',
    },
    {
      id: 'channels',
      label: 'Channels',
      status: 'optional',
      summary: 'Channels are configured after the first local Web/CLI mission.',
      command: 'zavorth gateway status',
      userAction: 'Use Web + CLI first; add Telegram or other channels after readiness is clear.',
      safeDefault: 'no live channel write without approval.',
    },
    {
      id: 'template',
      label: 'Template',
      status: 'ready',
      summary: `${product.templates.length} guided templates are available.`,
      command: 'zavorth templates',
      userAction: 'Pick dev repo review or PDF summary for a safe first run.',
      safeDefault: product.firstRun.safeDemoRun.templateId,
    },
    {
      id: 'first-mission',
      label: 'First mission',
      status: 'ready',
      summary: product.firstRun.safeDemoRun.summary,
      command: product.firstRun.safeDemoRun.command,
      userAction: 'Run the safe demo and inspect the receipt.',
      safeDefault: 'read-only, no workspace mutation.',
    },
  ];
}

function resolveStatus(
  product: ZavorthProductizationProtectedRuntimeSnapshot,
  provider: ZavorthUnifiedOnboardingProviderSummary,
): ZavorthUnifiedOnboardingStatus {
  if (product.sandbox.status === 'blocked') return 'attention';
  if (provider.status === 'ready') return 'ready';
  return 'needs_setup';
}

function buildNextAction(status: ZavorthUnifiedOnboardingStatus, provider: ZavorthUnifiedOnboardingProviderSummary): string {
  if (status === 'ready') {
    return 'Run zavorth go or start the first safe mission from zavorth templates.';
  }
  if (provider.status === 'missing_auth') {
    return provider.nextAction;
  }
  return 'Run zavorth doctor --simple and follow the first missing setup item.';
}

function safeText(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function buildQuickSandboxHostReadiness() {
  return {
    inspect: (): SandboxHostReadinessSnapshot => ({
      phase: '38',
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      osRelease: 'quick-unified-onboarding',
      summary: {
        ok: true,
        readyTiers: ['local-jail'],
        dormantTiers: ['docker', 'gvisor', 'firecracker'],
        unavailableStrongTiers: ['docker', 'gvisor', 'firecracker'],
        blockingIssues: [],
      },
      defaultPolicy: {
        strongSandboxReady: false,
        liveMutationDefault: 'dry-run-only',
        safeWithoutStrongSandbox: ['read-only', 'preview', 'doctor', 'receipt'],
        blockedWithoutStrongSandbox: [
          'workspace-write',
          'host-command',
          'network-write',
          'channel-send',
          'live-skill-apply',
        ],
        explanation: 'Quick onboarding never claims live mutations; use advanced doctor to confirm Docker, gVisor or Firecracker.',
      },
      tiers: [
        {
          id: 'local-jail',
          label: 'Local jail sandbox',
          status: 'ready',
          canRun: true,
          strongBoundary: false,
          startsOnRead: false,
          platform: process.platform,
          reasons: ['Unified onboarding keeps normal first-run checks lightweight.'],
          checks: [],
        },
        {
          id: 'docker',
          label: 'Docker hardened sandbox',
          status: 'dormant',
          canRun: false,
          strongBoundary: true,
          startsOnRead: false,
          platform: process.platform,
          reasons: ['Run zavorth doctor --advanced to probe Docker explicitly.'],
          checks: [],
        },
        {
          id: 'gvisor',
          label: 'gVisor runsc sandbox',
          status: 'dormant',
          canRun: false,
          strongBoundary: true,
          startsOnRead: false,
          platform: process.platform,
          reasons: ['Run zavorth doctor --advanced for runtime-specific sandbox details.'],
          checks: [],
        },
        {
          id: 'firecracker',
          label: 'Firecracker MicroVM sandbox',
          status: 'dormant',
          canRun: false,
          strongBoundary: true,
          startsOnRead: false,
          platform: process.platform,
          reasons: ['Run zavorth doctor --advanced on a Linux/KVM-capable host.'],
          checks: [],
        },
      ],
      actions: ['Run zavorth doctor --advanced to perform live sandbox probes.'],
      contracts: [
        'Unified onboarding does not start Docker, VM, sidecar or persistent process.',
        'Mutable actions remain dry-run unless a strong sandbox is explicitly confirmed.',
      ],
    }),
  };
}
