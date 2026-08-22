import { config } from '../config/index.js';
import type { FirstRunOnboardingContractSnapshot } from '../contracts/FirstRunOnboardingContract.js';
import type { WebsitePublicContractSnapshot } from '../contracts/WebsitePublicContract.js';
import type {
  UniversalAgentRun,
  ZavorthAgentGatewaySnapshot,
} from '../runtime/agent/index.js';
import {
  buildZavorthProductModeSnapshot,
  type ZavorthProductModeSnapshot,
} from './ProductModeService.js';

import type {
  ZavorthGatewayControlApiSnapshot,
  ZavorthGatewayRuntimeSnapshot,
} from './ZavorthGatewayRuntimeService.js';
import type { ZavorthSandboxControlPlaneSnapshot } from './ZavorthSandboxControlPlaneService.js';

export type ZavorthProductizationStatus = 'ready' | 'partial' | 'blocked';

export type ZavorthProductizationControlItemId =
  | 'experience-mode'
  | 'trust-posture'
  | 'active-permissions'
  | 'pending-approvals'
  | 'run-receipts'
  | 'sandbox-posture'
  | 'provider-route'
  | 'capabilities';

export type ZavorthProductizationSource =
  | 'runtime'
  | 'agent-gateway'
  | 'gateway-control'
  | 'onboarding'
  | 'website'
  | 'sandbox'
  | 'docs'
  | 'cli'
  | 'shared';

export type ZavorthProductizationControlItem = {
  id: ZavorthProductizationControlItemId;
  label: string;
  status: ZavorthProductizationStatus;
  source: ZavorthProductizationSource;
  evidence: string[];
  blockers: string[];
};

export type ZavorthProductizationOnboardingAreaId =
  | 'host'
  | 'providers'
  | 'channels'
  | 'workspace'
  | 'safety-posture';

export type ZavorthProductizationOnboardingArea = {
  id: ZavorthProductizationOnboardingAreaId;
  label: string;
  status: ZavorthProductizationStatus;
  configures: true;
  evidence: string[];
  blockers: string[];
};

export type ZavorthProductizationContractAcceptance = {
  commonUserUnderstands: boolean;
  operatorCanAudit: boolean;
  docsUiRuntimeAgree: boolean;
};

export type ZavorthProductizationContractSnapshot = {
  schemaVersion: 1;
  phase: 'C9';
  stage: 'C9';
  generatedAt: string;
  status: ZavorthProductizationStatus;
  activeRunId: string | null;
  activeSessionId: string | null;
  control: {
    route: '/zavorthControl';
    status: ZavorthProductizationStatus;
    productMode: ZavorthProductModeSnapshot;
    items: ZavorthProductizationControlItem[];
    summary: {
      ready: number;
      partial: number;
      blocked: number;
    };
  };
  cli: {
    status: ZavorthProductizationStatus;
    sameContract: boolean;
    command: 'zavorth productization --json';
    renderer: 'formatZavorthProductizationContractSnapshot';
    mirrorsControlItemIds: ZavorthProductizationControlItemId[];
    evidence: string[];
    blockers: string[];
  };
  onboarding: {
    status: ZavorthProductizationStatus;
    route: '/start';
    areas: ZavorthProductizationOnboardingArea[];
    summary: {
      ready: number;
      partial: number;
      blocked: number;
    };
  };
  docs: {
    status: ZavorthProductizationStatus;
    paths: string[];
    requiredTopics: string[];
    evidence: string[];
    blockers: string[];
  };
  website: {
    status: ZavorthProductizationStatus;
    sourceStatus: WebsitePublicContractSnapshot['status'] | 'missing';
    promisePolicy: 'stable-or-preview-only';
    forbiddenClaimsBlocked: boolean;
    evidence: string[];
    blockers: string[];
  };
  acceptance: ZavorthProductizationContractAcceptance;
  blockers: string[];
  explanation: string[];
};

export type ZavorthProductizationContractInput = {
  runtimeSnapshot?: Partial<ZavorthGatewayRuntimeSnapshot> | null;
  gatewayControlApi?: ZavorthGatewayControlApiSnapshot | null;
  agentGatewaySnapshot?: ZavorthAgentGatewaySnapshot | null;
  firstRunSnapshot?: FirstRunOnboardingContractSnapshot | null;
  websiteSnapshot?: WebsitePublicContractSnapshot | null;
  sandboxSnapshot?: ZavorthSandboxControlPlaneSnapshot | null;
  productMode?: ZavorthProductModeSnapshot | null;
  docs?: {
    paths?: string[];
    requiredTopics?: string[];
  } | null;
};

type ProductizationContractRuntime = {
  now?: () => Date;
};

const CONTROL_ITEM_IDS: ZavorthProductizationControlItemId[] = [
  'experience-mode',
  'trust-posture',
  'active-permissions',
  'pending-approvals',
  'run-receipts',
  'sandbox-posture',
  'provider-route',
  'capabilities',
];

const DEFAULT_DOC_PATHS = [
  'docs/quickstart.md',
  'docs/security.md',
  'docs/zavorth-cli.md',
  'docs/zavorth-gateway-convergence-handoff.md',
  'docs/README.md',
];

const DEFAULT_DOC_TOPICS = [
  '/zavorthControl shows experience, trust, approvals, receipts, sandbox, provider, and capabilities',
  'CLI renderiza o mesmo ZavorthProductizationContractSnapshot',
  'onboarding configura host, providers, channels, workspace e safety posture',
  'website promete only feature stable ou preview',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}


function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => text(value)).filter(Boolean)));
}

function statusFromChildren(
  children: Array<{ status: ZavorthProductizationStatus }>,
): ZavorthProductizationStatus {
  if (children.length === 0 || children.every((entry) => entry.status === 'blocked')) {
    return 'blocked';
  }
  if (children.every((entry) => entry.status === 'ready')) {
    return 'ready';
  }
  return 'partial';
}

function countStatuses(children: Array<{ status: ZavorthProductizationStatus }>): {
  ready: number;
  partial: number;
  blocked: number;
} {
  return {
    ready: children.filter((entry) => entry.status === 'ready').length,
    partial: children.filter((entry) => entry.status === 'partial').length,
    blocked: children.filter((entry) => entry.status === 'blocked').length,
  };
}

function hasForbiddenWebsiteFailure(snapshot: WebsitePublicContractSnapshot | null | undefined): boolean {
  return Boolean(snapshot?.checks?.some((check) =>
    check.status === 'fail' && /forbidden|claim|secret|secret|promise/i.test(`${check.id} ${check.title}`),
  ));
}

function readNestedRecord(source: unknown, keys: string[]): Record<string, unknown> | null {
  let current: unknown = source;
  for (const key of keys) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[key];
  }
  return asRecord(current);
}

export class ZavorthProductizationContractService {
  private readonly now: () => Date;

  constructor(runtime: ProductizationContractRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthProductizationContractInput = {}): ZavorthProductizationContractSnapshot {
    const generatedAt = this.now().toISOString();
    const productMode = input.productMode || buildZavorthProductModeSnapshot(
      config.zavorthProductMode,
      config.zavorthProfile,
    );
    const gatewayControlApi = input.gatewayControlApi || input.runtimeSnapshot?.gatewayControlApi || null;
    const activeRun = input.agentGatewaySnapshot?.activeRun || null;
    const controlItems = this.buildControlItems({
      activeRun,
      agentGatewaySnapshot: input.agentGatewaySnapshot || null,
      runtimeSnapshot: input.runtimeSnapshot || null,
      gatewayControlApi,
      sandboxSnapshot: input.sandboxSnapshot || null,
      productMode,
    });
    const onboardingAreas = this.buildOnboardingAreas({
      firstRunSnapshot: input.firstRunSnapshot || null,
      runtimeSnapshot: input.runtimeSnapshot || null,
      gatewayControlApi,
      sandboxSnapshot: input.sandboxSnapshot || null,
      trustItem: controlItems.find((item) => item.id === 'trust-posture') || null,
    });
    const controlStatus = statusFromChildren(controlItems);
    const onboardingStatus = statusFromChildren(onboardingAreas);
    const cli = this.buildCliSection(controlItems);
    const docs = this.buildDocsSection(input.docs || null, controlItems, onboardingAreas);
    const website = this.buildWebsiteSection(input.websiteSnapshot || null);
    const acceptance = this.buildAcceptance({
      controlItems,
      onboardingAreas,
      cli,
      docs,
      website,
    });
    const blockers = unique([
      ...controlItems.flatMap((item) => item.blockers),
      ...onboardingAreas.flatMap((area) => area.blockers),
      ...cli.blockers,
      ...docs.blockers,
      ...website.blockers,
    ]);
    const status = this.resolveStatus({
      controlStatus,
      onboardingStatus,
      cliStatus: cli.status,
      docsStatus: docs.status,
      websiteStatus: website.status,
      acceptance,
      blockers,
    });

    return {
      schemaVersion: 1,
      phase: 'C9',
      stage: 'C9',
      generatedAt,
      status,
      activeRunId: activeRun?.id || null,
      activeSessionId: activeRun?.sessionId || input.runtimeSnapshot?.controlPlane?.sessionId || null,
      control: {
        route: '/zavorthControl',
        status: controlStatus,
        productMode,
        items: controlItems,
        summary: countStatuses(controlItems),
      },
      cli,
      onboarding: {
        status: onboardingStatus,
        route: '/start',
        areas: onboardingAreas,
        summary: countStatuses(onboardingAreas),
      },
      docs,
      website,
      acceptance,
      blockers,
      explanation: [
        'C9 transforma o runtime em produto auditavel por um single contrato.',
        '/zavorthControl, CLI, onboarding, docs e website leem o mesmo snapshot em vez de contar historias paralelas.',
        'A public promise fica limitada ao que is stable ou explicitmente marcado como preview.',
      ],
    };
  }

  private buildControlItems(input: {
    activeRun: UniversalAgentRun | null;
    agentGatewaySnapshot: ZavorthAgentGatewaySnapshot | null;
    runtimeSnapshot: Partial<ZavorthGatewayRuntimeSnapshot> | null;
    gatewayControlApi: ZavorthGatewayControlApiSnapshot | null;
    sandboxSnapshot: ZavorthSandboxControlPlaneSnapshot | null;
    productMode: ZavorthProductModeSnapshot;
  }): ZavorthProductizationControlItem[] {
    return [
      this.buildExperienceModeItem(input.productMode),
      this.buildTrustPostureItem(input.activeRun, input.productMode),
      this.buildActivePermissionsItem(input.activeRun, input.gatewayControlApi),
      this.buildPendingApprovalsItem(input.activeRun, input.agentGatewaySnapshot),
      this.buildRunReceiptsItem(input.activeRun, input.agentGatewaySnapshot),
      this.buildSandboxPostureItem(input.activeRun, input.sandboxSnapshot),
      this.buildProviderRouteItem(input.activeRun, input.gatewayControlApi),
      this.buildCapabilitiesItem(input.activeRun, input.agentGatewaySnapshot),
    ];
  }

  private buildExperienceModeItem(
    productMode: ZavorthProductModeSnapshot,
  ): ZavorthProductizationControlItem {
    return {
      id: 'experience-mode',
      label: 'Experience mode',
      status: 'ready',
      source: 'runtime',
      evidence: [
        `modo=${productMode.id}`,
        `profile=${productMode.runtimeProfile}`,
        `visible surfaces=${productMode.visibleSurfaces.join(', ') || 'none'}`,
      ],
      blockers: [],
    };
  }

  private buildTrustPostureItem(
    activeRun: UniversalAgentRun | null,
    productMode: ZavorthProductModeSnapshot,
  ): ZavorthProductizationControlItem {
    const trustSlider =
      readNestedRecord(activeRun?.metadata, ['trustSlider'])
      || readNestedRecord(activeRun?.metadata, ['responseDecision', 'trustSlider'])
      || null;
    const toolMode = text(activeRun?.toolExposure?.mode);
    const status: ZavorthProductizationStatus = trustSlider ? 'ready'
      : activeRun || productMode ? 'partial'
        : 'blocked';

    return {
      id: 'trust-posture',
      label: 'Trust posture',
      status,
      source: trustSlider ? 'agent-gateway' : 'shared',
      evidence: [
        trustSlider ? `trustSlider.level=${text(trustSlider.level, 'unknown')}` : '',
        trustSlider ? `permissionScope=${text(trustSlider.permissionScope, 'unknown')}` : '',
        toolMode ? `toolExposure.mode=${toolMode}` : '',
        `modo de produto=${productMode.id}`,
      ].filter(Boolean),
      blockers: status === 'blocked' ? ['Trust posture cannot be inferred.'] : [],
    };
  }

  private buildActivePermissionsItem(
    activeRun: UniversalAgentRun | null,
    gatewayControlApi: ZavorthGatewayControlApiSnapshot | null,
  ): ZavorthProductizationControlItem {
    const tools = activeRun?.toolExposure?.tools || [];
    const approvalTools = tools.filter((tool) => tool.requiresApproval);
    const sensitiveOperations = gatewayControlApi?.operations.filter((operation) => operation.requiresApproval) || [];
    const hasPolicy = tools.length > 0 || sensitiveOperations.length > 0;
    const status: ZavorthProductizationStatus = activeRun && hasPolicy ? 'ready'
      : hasPolicy ? 'partial'
        : 'blocked';

    return {
      id: 'active-permissions',
      label: 'Permissions actives',
      status,
      source: activeRun ? 'agent-gateway' : 'gateway-control',
      evidence: [
        activeRun ? `run=${activeRun.id}` : '',
        `${approvalTools.length}/${tools.length} tool(s) requerem approval`,
        `${sensitiveOperations.length} Gateway Control operation(s) require approval`,
      ].filter(Boolean),
      blockers: status === 'blocked'
        ? ['No tool policy or sensitive operation is visible to the product.']
        : [],
    };
  }

  private buildPendingApprovalsItem(
    activeRun: UniversalAgentRun | null,
    agentGatewaySnapshot: ZavorthAgentGatewaySnapshot | null,
  ): ZavorthProductizationControlItem {
    const approvals = activeRun?.approvals || [];
    const pending = approvals.filter((approval) => approval.status === 'pending');
    const snapshotAvailable = Boolean(agentGatewaySnapshot);
    const status: ZavorthProductizationStatus = activeRun || snapshotAvailable ? 'ready' : 'blocked';

    return {
      id: 'pending-approvals',
      label: 'Pending approvals',
      status,
      source: 'agent-gateway',
      evidence: [
        snapshotAvailable ? 'ZavorthAgentGatewaySnapshot anexado.' : '',
        activeRun ? `run=${activeRun.id}` : 'without run active',
        `pending=${pending.length}`,
      ].filter(Boolean),
      blockers: status === 'blocked'
        ? ['Approval queue is not exposed by Agent Gateway.']
        : [],
    };
  }

  private buildRunReceiptsItem(
    activeRun: UniversalAgentRun | null,
    agentGatewaySnapshot: ZavorthAgentGatewaySnapshot | null,
  ): ZavorthProductizationControlItem {
    const observatory = agentGatewaySnapshot?.runObservatory || null;
    const indexed = Boolean(
      activeRun
      && observatory?.indexes.runIds.includes(activeRun.id)
      && observatory?.indexes.traceIds.includes(activeRun.traceId),
    );
    const hasReceipts = Boolean(activeRun && (activeRun.events.length > 0 || activeRun.artifacts.length > 0));
    const status: ZavorthProductizationStatus = indexed && hasReceipts ? 'ready'
      : activeRun || observatory ? 'partial'
        : 'blocked';

    return {
      id: 'run-receipts',
      label: 'Run receipts',
      status,
      source: 'agent-gateway',
      evidence: [
        activeRun ? `run=${activeRun.id}` : '',
        activeRun ? `eventos=${activeRun.events.length}` : '',
        activeRun ? `artifacts=${activeRun.artifacts.length}` : '',
        observatory ? `observatory.runs=${observatory.totalRuns}` : '',
        indexed ? 'run active indexado por runId e traceId.' : '',
      ].filter(Boolean),
      blockers: status === 'blocked'
        ? ['Run Observatory or run receipts are not visible.']
        : [],
    };
  }

  private buildSandboxPostureItem(
    activeRun: UniversalAgentRun | null,
    sandboxSnapshot: ZavorthSandboxControlPlaneSnapshot | null,
  ): ZavorthProductizationControlItem {
    const metadataPosture = text(asRecord(activeRun?.metadata)?.sandboxPosture);
    const status: ZavorthProductizationStatus = sandboxSnapshot ? 'ready'
      : metadataPosture ? 'partial'
        : 'blocked';

    return {
      id: 'sandbox-posture',
      label: 'Sandbox posture',
      status,
      source: sandboxSnapshot ? 'sandbox' : 'agent-gateway',
      evidence: [
        sandboxSnapshot ? `posture=${sandboxSnapshot.summary.posture}` : '',
        sandboxSnapshot ? `doctor=${sandboxSnapshot.summary.doctorStatus}` : '',
        sandboxSnapshot ? `untrustedExecutionReady=${String(sandboxSnapshot.summary.untrustedExecutionReady)}` : '',
        metadataPosture ? `run.metadata.sandboxPosture=${metadataPosture}` : '',
      ].filter(Boolean),
      blockers: status === 'blocked'
        ? ['Sandbox posture is not connected to the product contract.']
        : [],
    };
  }

  private buildProviderRouteItem(
    activeRun: UniversalAgentRun | null,
    gatewayControlApi: ZavorthGatewayControlApiSnapshot | null,
  ): ZavorthProductizationControlItem {
    const modelPickerSelected = asRecord(gatewayControlApi?.modelPicker?.selected);
    const runRoute = activeRun?.modelProfile || null;
    const hasGatewayProvider = Boolean(gatewayControlApi?.providers.currentProvider || modelPickerSelected);
    const hasRunProvider = Boolean(runRoute?.providerLabel && runRoute?.modelLabel);
    const status: ZavorthProductizationStatus = hasGatewayProvider && hasRunProvider ? 'ready'
      : hasGatewayProvider || hasRunProvider ? 'partial'
        : 'blocked';

    return {
      id: 'provider-route',
      label: 'Provider, modelo e rota',
      status,
      source: hasGatewayProvider ? 'gateway-control' : 'agent-gateway',
      evidence: [
        gatewayControlApi?.providers.currentProvider ? `currentProvider=${gatewayControlApi.providers.currentProvider}` : '',
        gatewayControlApi?.providers.currentModel ? `currentModel=${gatewayControlApi.providers.currentModel}` : '',
        modelPickerSelected ? `modelPicker=${text(modelPickerSelected.providerLabel || modelPickerSelected.providerName)} / ${text(modelPickerSelected.modelLabel || modelPickerSelected.modelName)}` : '',
        runRoute ? `runRoute=${runRoute.providerLabel} / ${runRoute.modelLabel} / ${runRoute.routingPolicy}` : '',
        runRoute?.routeId ? `routeId=${runRoute.routeId}` : '',
      ].filter(Boolean),
      blockers: status === 'blocked'
        ? ['Provider/model/route are not visible in Gateway Control or the active run.']
        : [],
    };
  }

  private buildCapabilitiesItem(
    activeRun: UniversalAgentRun | null,
    agentGatewaySnapshot: ZavorthAgentGatewaySnapshot | null,
  ): ZavorthProductizationControlItem {
    const tools = activeRun?.toolExposure?.tools || [];
    const blockedTools = activeRun?.toolExposure?.blockedTools || [];
    const governance = agentGatewaySnapshot?.capabilityLoopGovernance || null;
    const hasGovernance = Boolean(governance);
    const status: ZavorthProductizationStatus = hasGovernance || tools.length > 0 || blockedTools.length > 0
      ? 'ready'
      : activeRun ? 'partial'
        : 'blocked';

    return {
      id: 'capabilities',
      label: 'Capabilities active and quarantined',
      status,
      source: hasGovernance ? 'agent-gateway' : 'shared',
      evidence: [
        hasGovernance ? 'CapabilityLoopGovernanceService anexado ao snapshot.' : '',
        `actives=${tools.length}`,
        `quarantined=${blockedTools.length}`,
        activeRun?.toolExposure.toolExposureGatedByImportedCapabilityTrust ? 'imported capability trust gate active.'
          : '',
      ].filter(Boolean),
      blockers: status === 'blocked'
        ? ['Active/quarantined capabilities are not exposed to the product.']
        : [],
    };
  }

  private buildOnboardingAreas(input: {
    firstRunSnapshot: FirstRunOnboardingContractSnapshot | null;
    runtimeSnapshot: Partial<ZavorthGatewayRuntimeSnapshot> | null;
    gatewayControlApi: ZavorthGatewayControlApiSnapshot | null;
    sandboxSnapshot: ZavorthSandboxControlPlaneSnapshot | null;
    trustItem: ZavorthProductizationControlItem | null;
  }): ZavorthProductizationOnboardingArea[] {
    const firstRunStatus = input.firstRunSnapshot?.status || null;
    const firstRunAvailable = Boolean(input.firstRunSnapshot);
    const providerReady = Number(input.gatewayControlApi?.providers.summary.ready || 0) > 0;
    const modelPickerReady = input.gatewayControlApi?.modelPicker?.schemaVersion === 1;
    const transports = input.runtimeSnapshot?.controlPlane?.availableTransports || [];
    const workspaceArtifactReady = Boolean(input.firstRunSnapshot?.requiredArtifacts.includes('fixture/zavorth-first-run-workspace'));
    const sandboxReady = Boolean(input.sandboxSnapshot?.policy && input.trustItem?.status !== 'blocked');

    return [
      this.onboardingArea({
        id: 'host',
        label: 'Host local',
        status: firstRunStatus === 'ready'
          ? 'ready'
          : firstRunAvailable ? 'partial'
            : 'blocked',
        evidence: [
          firstRunAvailable ? `first-run status=${firstRunStatus}` : '',
          input.firstRunSnapshot?.route ? `route=${input.firstRunSnapshot.route}` : '',
        ].filter(Boolean),
        blockers: firstRunAvailable ? [] : ['Onboarding /start is not attached to the C9 contract.'],
      }),
      this.onboardingArea({
        id: 'providers',
        label: 'Providers e modelos',
        status: providerReady && modelPickerReady ? 'ready'
          : input.gatewayControlApi ? 'partial'
            : 'blocked',
        evidence: [
          input.gatewayControlApi ? `providers ready=${input.gatewayControlApi.providers.summary.ready}/${input.gatewayControlApi.providers.summary.total}` : '',
          modelPickerReady ? 'ModelPickerContract visible.' : '',
        ].filter(Boolean),
        blockers: input.gatewayControlApi ? [] : ['Gateway Control API was not attached to provider onboarding.'],
      }),
      this.onboardingArea({
        id: 'channels',
        label: 'Channels',
        status: transports.length > 0
          ? 'ready'
          : input.runtimeSnapshot ? 'partial'
            : 'blocked',
        evidence: transports.length > 0 ? [`transportes=${transports.join(', ')}`] : [],
        blockers: transports.length > 0 ? [] : ['Control plane did not publish transports/channels for onboarding.'],
      }),
      this.onboardingArea({
        id: 'workspace',
        label: 'Workspace',
        status: workspaceArtifactReady ? 'ready'
          : firstRunAvailable ? 'partial'
            : 'blocked',
        evidence: workspaceArtifactReady ? ['fixture/zavorth-first-run-workspace present no contrato.'] : [],
        blockers: workspaceArtifactReady ? [] : ['Onboarding did not declare a workspace fixture.'],
      }),
      this.onboardingArea({
        id: 'safety-posture',
        label: 'Safety posture',
        status: sandboxReady ? 'ready'
          : input.sandboxSnapshot || input.trustItem ? 'partial'
            : 'blocked',
        evidence: [
          input.sandboxSnapshot ? `sandbox=${input.sandboxSnapshot.summary.posture}` : '',
          input.trustItem ? `trust=${input.trustItem.status}` : '',
        ].filter(Boolean),
        blockers: sandboxReady ? [] : ['Safety posture does not yet join sandbox and trust posture in onboarding.'],
      }),
    ];
  }

  private onboardingArea(input: {
    id: ZavorthProductizationOnboardingAreaId;
    label: string;
    status: ZavorthProductizationStatus;
    evidence: string[];
    blockers: string[];
  }): ZavorthProductizationOnboardingArea {
    return {
      ...input,
      configures: true,
    };
  }

  private buildCliSection(
    controlItems: ZavorthProductizationControlItem[],
  ): ZavorthProductizationContractSnapshot['cli'] {
    const itemIds = controlItems.map((item) => item.id);
    const sameContract = CONTROL_ITEM_IDS.every((id) => itemIds.includes(id));
    return {
      status: sameContract ? 'ready' : 'blocked',
      sameContract,
      command: 'zavorth productization --json',
      renderer: 'formatZavorthProductizationContractSnapshot',
      mirrorsControlItemIds: [...CONTROL_ITEM_IDS],
      evidence: sameContract
        ? ['CLI usa ZavorthProductizationContractSnapshot e espelha todos os itens de /zavorthControl.']
        : [],
      blockers: sameContract ? [] : ['CLI does not mirror all required /zavorthControl items.'],
    };
  }

  private buildDocsSection(
    docs: ZavorthProductizationContractInput['docs'],
    controlItems: ZavorthProductizationControlItem[],
    onboardingAreas: ZavorthProductizationOnboardingArea[],
  ): ZavorthProductizationContractSnapshot['docs'] {
    const paths = docs?.paths?.length ? unique(docs.paths) : [...DEFAULT_DOC_PATHS];
    const requiredTopics = docs?.requiredTopics?.length ? unique(docs.requiredTopics) : [...DEFAULT_DOC_TOPICS];
    const requiredControlReady = CONTROL_ITEM_IDS.every((id) => controlItems.some((item) => item.id === id));
    const requiredOnboardingReady = ['host', 'providers', 'channels', 'workspace', 'safety-posture']
      .every((id) => onboardingAreas.some((area) => area.id === id));
    const status: ZavorthProductizationStatus = paths.length > 0 && requiredTopics.length > 0 && requiredControlReady && requiredOnboardingReady ? 'ready'
      : paths.length > 0
        ? 'partial'
        : 'blocked';

    return {
      status,
      paths,
      requiredTopics,
      evidence: [
        `${paths.length} C9 document(s) declared.`,
        `${requiredTopics.length} required topic(s) declared.`,
      ],
      blockers: status === 'ready' ? [] : ['C9 docs do not cover runtime, CLI, onboarding, and website.'],
    };
  }

  private buildWebsiteSection(
    websiteSnapshot: WebsitePublicContractSnapshot | null,
  ): ZavorthProductizationContractSnapshot['website'] {
    const sourceStatus = websiteSnapshot?.status || 'missing';
    const forbiddenClaimsBlocked = websiteSnapshot ? !hasForbiddenWebsiteFailure(websiteSnapshot) : false;
    const status: ZavorthProductizationStatus = websiteSnapshot?.status === 'ready' && forbiddenClaimsBlocked ? 'ready'
      : websiteSnapshot && forbiddenClaimsBlocked ? 'partial'
        : 'blocked';

    return {
      status,
      sourceStatus,
      promisePolicy: 'stable-or-preview-only',
      forbiddenClaimsBlocked,
      evidence: [
        websiteSnapshot ? `website status=${websiteSnapshot.status}` : '',
        websiteSnapshot ? `checks=${websiteSnapshot.summary.passed}/${websiteSnapshot.summary.passed + websiteSnapshot.summary.warnings + websiteSnapshot.summary.failed}` : '',
        forbiddenClaimsBlocked ? 'forbidden claims blocked by the public contract.' : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!websiteSnapshot ? ['WebsitePublicContractSnapshot missing.'] : []),
        ...(!forbiddenClaimsBlocked ? ['Website may still contain forbidden or unvalidated claims.'] : []),
        ...(websiteSnapshot && websiteSnapshot.status !== 'ready' ? [`Public website is ${websiteSnapshot.status}.`] : []),
      ],
    };
  }

  private buildAcceptance(input: {
    controlItems: ZavorthProductizationControlItem[];
    onboardingAreas: ZavorthProductizationOnboardingArea[];
    cli: ZavorthProductizationContractSnapshot['cli'];
    docs: ZavorthProductizationContractSnapshot['docs'];
    website: ZavorthProductizationContractSnapshot['website'];
  }): ZavorthProductizationContractAcceptance {
    const controlReady = (id: ZavorthProductizationControlItemId) =>
      this.controlStatus(input.controlItems, id) === 'ready';
    const controlNotBlocked = (id: ZavorthProductizationControlItemId) =>
      this.controlStatus(input.controlItems, id) !== 'blocked';
    const onboardingNotBlocked = input.onboardingAreas.every((area) => area.status !== 'blocked');

    return {
      commonUserUnderstands:
        controlReady('experience-mode')
        && controlNotBlocked('trust-posture')
        && onboardingNotBlocked
        && input.website.status !== 'blocked',
      operatorCanAudit:
        controlNotBlocked('active-permissions')
        && controlReady('pending-approvals')
        && controlNotBlocked('run-receipts')
        && controlNotBlocked('provider-route'),
      docsUiRuntimeAgree:
        input.cli.sameContract
        && input.docs.status !== 'blocked'
        && input.website.promisePolicy === 'stable-or-preview-only'
        && CONTROL_ITEM_IDS.every((id) => input.cli.mirrorsControlItemIds.includes(id)),
    };
  }

  private resolveStatus(input: {
    controlStatus: ZavorthProductizationStatus;
    onboardingStatus: ZavorthProductizationStatus;
    cliStatus: ZavorthProductizationStatus;
    docsStatus: ZavorthProductizationStatus;
    websiteStatus: ZavorthProductizationStatus;
    acceptance: ZavorthProductizationContractAcceptance;
    blockers: string[];
  }): ZavorthProductizationStatus {
    const allAccepted = Object.values(input.acceptance).every(Boolean);
    const allReady = [
      input.controlStatus,
      input.onboardingStatus,
      input.cliStatus,
      input.docsStatus,
      input.websiteStatus,
    ].every((status) => status === 'ready');

    if (allAccepted && allReady && input.blockers.length === 0) {
      return 'ready';
    }
    if ([
      input.controlStatus,
      input.onboardingStatus,
      input.cliStatus,
      input.docsStatus,
      input.websiteStatus,
    ].some((status) => status === 'ready' || status === 'partial')) {
      return 'partial';
    }
    return 'blocked';
  }

  private controlStatus(
    items: ZavorthProductizationControlItem[],
    id: ZavorthProductizationControlItemId,
  ): ZavorthProductizationStatus {
    return items.find((item) => item.id === id)?.status || 'blocked';
  }
}
