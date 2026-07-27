import type { FeedbackTelemetryContractSnapshot } from '../../contracts/FeedbackTelemetryContract.js';
import type { PublicSiteDocsDemoSyncSnapshot } from './PublicSiteDocsDemoSyncService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
export const FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION = '2026-05-04.feedback-telemetry' as const;
export const FEEDBACK_TELEMETRY_PRODUCT_LOOP_METADATA_KEY = 'feedbackTelemetryProductLoop' as const;

export type FeedbackTelemetryProductLoopStatus =
  | 'opt-in-ready'
  | 'needs-public-sync'
  | 'needs-feedback-loop'
  | 'needs-redaction-preview'
  | 'needs-product-ledger'
  | 'blocked'
  | 'telemetry-disabled';

export type FeedbackTelemetryProductLoopGateStatus = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type FeedbackTelemetryProductLoopGate = {
  id: string;
  label: string;
  status: FeedbackTelemetryProductLoopGateStatus;
  source:
    | 'PublicSiteDocsDemoSyncService'
    | 'FeedbackTelemetryContractService'
    | 'FeedbackTelemetryProductLoopService';
  command: string;
  detail: string;
  critical: boolean;
};

export type FeedbackTelemetryProductLoopSurface = {
  id: 'cli' | 'control' | 'feedback' | 'privacy' | 'docs' | 'release';
  label: string;
  routeOrCommand: string;
  status: FeedbackTelemetryProductLoopGateStatus;
  detail: string;
};

export type FeedbackTelemetryProductLoopReceipt = {
  id: string;
  kind: 'public-sync' | 'feedback-loop' | 'redaction' | 'consent' | 'ledger' | 'policy';
  source: string;
  detail: string;
  status: FeedbackTelemetryProductLoopGateStatus;
};

export type FeedbackTelemetryProductLoopSnapshot = {
  contractVersion: typeof FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION;
  source: 'FeedbackTelemetryProductLoopService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: FeedbackTelemetryProductLoopStatus;
  feedback: {
    contractLinked: boolean;
    contractStatus: 'ready' | 'attention' | 'blocked' | 'unknown';
    route: '/feedback' | null;
    fixturePath: string | null;
    previewCommand: 'npm run feedback:preview';
    revokeCommand: 'npm run feedback:revoke';
    deleteCommand: 'npm run feedback:delete';
    requiredCommands: string[];
    previewAvailable: boolean;
    revokeAvailable: boolean;
    deleteAvailable: boolean;
  };
  telemetry: {
    enabledByDefault: false;
    optInRequired: true;
    externalTelemetryEnabled: false;
    redactedPreviewAvailable: boolean;
    aggregatedOnly: true;
    rawPayloadAllowed: false;
    consentAssumed: false;
  };
  productLoop: {
    ledgerPath: 'product-feedback-ledger.json';
    previewArtifactPath: 'feedback-preview-redacted.json';
    ledgerAvailable: boolean;
    issueTemplateAvailable: boolean;
    supportRoute: '/feedback';
    productLearningEnabled: boolean;
  };
  readiness: {
    publicSiteDocsDemoSyncLinked: boolean;
    feedbackTelemetryContractLinked: boolean;
    feedbackRouteReady: boolean;
    docsFeedbackLinked: boolean;
    privacyLinked: boolean;
    canCollectFeedbackPreview: boolean;
    canSendFeedbackExternally: false;
    canEnableTelemetry: false;
  };
  gates: FeedbackTelemetryProductLoopGate[];
  surfaces: FeedbackTelemetryProductLoopSurface[];
  receipts: FeedbackTelemetryProductLoopReceipt[];
  policy: {
    noTelemetryEnabled: true;
    noFeedbackSent: true;
    noExternalNetworkCall: true;
    noRawPayloadSerialized: true;
    noConsentAssumed: true;
    revokeDeleteAvailable: true;
    optInRequired: true;
    redactionPreviewRequired: true;
    productLedgerLocalOnly: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    feedbackRoute: '/feedback';
    privacyRoute: '/privacy';
    docsAnchor: '/docs#feedback-loop';
    previewCommand: 'npm run feedback:preview';
    revokeCommand: 'npm run feedback:revoke';
    deleteCommand: 'npm run feedback:delete';
  };
  nextSafeAction: string;
};

export type FeedbackTelemetryProductLoopInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type FeedbackTelemetryProductLoopDependencies = {
  now?: () => Date;
  feedbackTelemetryService?: { buildSnapshot(): FeedbackTelemetryContractSnapshot } | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeCall<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error: unknown) {return null;
  }
}

function normalizeFeedbackStatus(value: unknown): FeedbackTelemetryProductLoopSnapshot['feedback']['contractStatus'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'ready' || raw === 'attention' || raw === 'blocked') {
    return raw;
  }
  return 'unknown';
}

function gateStatusFromFeedbackStatus(status: FeedbackTelemetryProductLoopSnapshot['feedback']['contractStatus']): FeedbackTelemetryProductLoopGateStatus {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'attention') {
    return 'needs-action';
  }
  return 'unknown';
}

export class FeedbackTelemetryProductLoopService {
  private readonly now: () => Date;
  private readonly feedbackTelemetryService: { buildSnapshot(): FeedbackTelemetryContractSnapshot } | null;

  constructor(runtime: FeedbackTelemetryProductLoopDependencies = {}) {
    this.now = runtime.now || (() => new Date());
    this.feedbackTelemetryService = runtime.feedbackTelemetryService || null;
  }

  public buildSnapshot(input: FeedbackTelemetryProductLoopInput): FeedbackTelemetryProductLoopSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const publicSync = recordOrNull(run.metadata.publicSiteDocsDemoSync) as PublicSiteDocsDemoSyncSnapshot | null;
    const feedback = this.readFeedbackTelemetry(run);
    const feedbackStatus = normalizeFeedbackStatus(feedback?.status);
    const requiredCommands = this.resolveRequiredCommands(feedback);
    const previewAvailable = requiredCommands.includes('feedback:preview');
    const revokeAvailable = requiredCommands.includes('feedback:revoke');
    const deleteAvailable = requiredCommands.includes('feedback:delete');
    const feedbackRouteReady = feedbackStatus === 'ready' || feedbackStatus === 'attention';
    const docsFeedbackLinked = Boolean(publicSync?.sync.publicRoutes.includes('/docs') || publicSync?.surface.docsRoute);
    const privacyLinked = Boolean(publicSync?.sync.publicRoutes.includes('/privacy') || publicSync?.surface.websiteRoute);
    const ledgerAvailable = Boolean(feedback?.fixturePath || feedback?.checks?.some((check) => normalizeText(check.evidence?.join(' ')).includes('product-feedback-ledger.json')));
    const issueTemplateAvailable = Boolean(
      feedback?.checks?.some((check) => normalizeText(check.reason).toLowerCase().includes('template'))
      || requiredCommands.length > 0,
    );
    const publicSyncReady = publicSync?.status === 'synced-preview';
    const canCollectFeedbackPreview = Boolean(publicSyncReady && feedbackRouteReady && previewAvailable && revokeAvailable && deleteAvailable);
    const status = this.resolveStatus({
      publicSync,
      publicSyncStatus: publicSync?.status,
      feedbackStatus,
      previewAvailable,
      revokeAvailable,
      deleteAvailable,
      ledgerAvailable,
    });
    const gates = this.buildGates({
      publicSync,
      feedbackStatus,
      publicSyncReady,
      previewAvailable,
      revokeAvailable,
      deleteAvailable,
      ledgerAvailable,
      issueTemplateAvailable,
    });
    const surfaces = this.buildSurfaces({
      publicSync,
      feedbackStatus,
      docsFeedbackLinked,
      privacyLinked,
      canCollectFeedbackPreview,
    });
    const receipts = this.buildReceipts({
      publicSyncLinked: Boolean(publicSync),
      feedbackLinked: Boolean(feedback),
      previewAvailable,
      revokeAvailable,
      deleteAvailable,
      ledgerAvailable,
      issueTemplateAvailable,
    });

    return {
      contractVersion: FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION,
      source: 'FeedbackTelemetryProductLoopService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      feedback: {
        contractLinked: Boolean(feedback),
        contractStatus: feedbackStatus,
        route: feedback ? '/feedback' : null,
        fixturePath: normalizeText(feedback?.fixturePath) || null,
        previewCommand: 'npm run feedback:preview',
        revokeCommand: 'npm run feedback:revoke',
        deleteCommand: 'npm run feedback:delete',
        requiredCommands,
        previewAvailable,
        revokeAvailable,
        deleteAvailable,
      },
      telemetry: {
        enabledByDefault: false,
        optInRequired: true,
        externalTelemetryEnabled: false,
        redactedPreviewAvailable: previewAvailable,
        aggregatedOnly: true,
        rawPayloadAllowed: false,
        consentAssumed: false,
      },
      productLoop: {
        ledgerPath: 'product-feedback-ledger.json',
        previewArtifactPath: 'feedback-preview-redacted.json',
        ledgerAvailable,
        issueTemplateAvailable,
        supportRoute: '/feedback',
        productLearningEnabled: canCollectFeedbackPreview,
      },
      readiness: {
        publicSiteDocsDemoSyncLinked: Boolean(publicSync),
        feedbackTelemetryContractLinked: Boolean(feedback),
        feedbackRouteReady,
        docsFeedbackLinked,
        privacyLinked,
        canCollectFeedbackPreview,
        canSendFeedbackExternally: false,
        canEnableTelemetry: false,
      },
      gates,
      surfaces,
      receipts,
      policy: {
        noTelemetryEnabled: true,
        noFeedbackSent: true,
        noExternalNetworkCall: true,
        noRawPayloadSerialized: true,
        noConsentAssumed: true,
        revokeDeleteAvailable: true,
        optInRequired: true,
        redactionPreviewRequired: true,
        productLedgerLocalOnly: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth feedback-product-loop run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl...runId=${encodeURIComponent(run.id)}&sector=config`,
        feedbackRoute: '/feedback',
        privacyRoute: '/privacy',
        docsAnchor: '/docs#feedback-loop',
        previewCommand: 'npm run feedback:preview',
        revokeCommand: 'npm run feedback:revoke',
        deleteCommand: 'npm run feedback:delete',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readFeedbackTelemetry(run: UniversalAgentRun): FeedbackTelemetryContractSnapshot | null {
    const metadata = recordOrNull(run.metadata.feedbackTelemetry)
      || recordOrNull(run.metadata.feedbackLoop)
      || recordOrNull(run.metadata.feedbackTelemetryContract);
    if (metadata) {
      return metadata as unknown as FeedbackTelemetryContractSnapshot;
    }
    return this.feedbackTelemetryService ? safeCall(() => this.feedbackTelemetryService!.buildSnapshot()) : null;
  }

  private resolveRequiredCommands(feedback: FeedbackTelemetryContractSnapshot | null): string[] {
    const commands = arrayOrEmpty<string>(feedback?.requiredCommands);
    const fallback = ['feedback:preview', 'feedback:revoke', 'feedback:delete'];
    return Array.from(new Set((commands.length > 0 ? commands : fallback).map((command) => normalizeText(command)).filter(Boolean)));
  }

  private resolveStatus(input: {
    publicSync: PublicSiteDocsDemoSyncSnapshot | null;
    publicSyncStatus?: string | null;
    feedbackStatus: FeedbackTelemetryProductLoopSnapshot['feedback']['contractStatus'];
    previewAvailable: boolean;
    revokeAvailable: boolean;
    deleteAvailable: boolean;
    ledgerAvailable: boolean;
  }): FeedbackTelemetryProductLoopStatus {
    if (!input.publicSync) {
      return 'needs-public-sync';
    }
    if (input.publicSyncStatus === 'blocked' || input.feedbackStatus === 'blocked') {
      return 'blocked';
    }
    if (input.publicSyncStatus !== 'synced-preview') {
      return 'needs-public-sync';
    }
    if (!input.previewAvailable) {
      return 'needs-redaction-preview';
    }
    if (!input.revokeAvailable || !input.deleteAvailable || !input.ledgerAvailable) {
      return 'needs-product-ledger';
    }
    if (input.feedbackStatus === 'unknown') {
      return 'needs-feedback-loop';
    }
    return 'opt-in-ready';
  }

  private buildGates(input: {
    publicSync: PublicSiteDocsDemoSyncSnapshot | null;
    publicSyncReady: boolean;
    feedbackStatus: FeedbackTelemetryProductLoopSnapshot['feedback']['contractStatus'];
    previewAvailable: boolean;
    revokeAvailable: boolean;
    deleteAvailable: boolean;
    ledgerAvailable: boolean;
    issueTemplateAvailable: boolean;
  }): FeedbackTelemetryProductLoopGate[] {
    return [
      {
        id: 'public-site-docs-demo-sync',
        label: 'Public Site / Docs / Demo Sync',
        status: input.publicSyncReady ? 'ready' : input.publicSync?.status === 'blocked' ? 'blocked' : 'needs-action',
        source: 'PublicSiteDocsDemoSyncService',
        command: 'zavorth public-sync --json',
        detail: input.publicSync ? `Public sync is ${input.publicSync.status}.`
          : 'Feedback loop needs Channel mesh9 publicada no run.',
        critical: true,
      },
      {
        id: 'feedback-telemetry-contract',
        label: 'Feedback telemetry contract',
        status: gateStatusFromFeedbackStatus(input.feedbackStatus),
        source: 'FeedbackTelemetryContractService',
        command: 'npm run qa:feedback-loop',
        detail: input.feedbackStatus === 'ready'
          ? '/feedback covers opt-in, redaction, revoke/delete, and ledger.'
          : 'Attach feedback contract before opening the product loop.',
        critical: true,
      },
      {
        id: 'redaction-preview',
        label: 'Redacted preview',
        status: input.previewAvailable ? 'ready' : 'needs-action',
        source: 'FeedbackTelemetryProductLoopService',
        command: 'npm run feedback:preview',
        detail: input.previewAvailable ? 'Redacted preview available without external send.'
          : 'Feedback needs redacted preview before any opt-in.',
        critical: true,
      },
      {
        id: 'consent-revoke-delete',
        label: 'Consent, revoke, and delete',
        status: input.revokeAvailable && input.deleteAvailable ? 'ready' : 'needs-action',
        source: 'FeedbackTelemetryProductLoopService',
        command: 'npm run feedback:revoke && npm run feedback:delete',
        detail: input.revokeAvailable && input.deleteAvailable ? 'Local revoke/delete are available.'
          : 'Opt-in needs revoke/delete before collecting feedback.',
        critical: true,
      },
      {
        id: 'product-feedback-ledger',
        label: 'Product feedback ledger',
        status: input.ledgerAvailable ? 'ready' : 'needs-action',
        source: 'FeedbackTelemetryProductLoopService',
        command: 'npm run feedback:preview',
        detail: input.ledgerAvailable ? 'Local feedback ledger is represented.'
          : 'Create a local ledger before turning feedback into product work.',
        critical: true,
      },
      {
        id: 'telemetry-disabled-by-default',
        label: 'Telemetry disabled by default',
        status: 'ready',
        source: 'FeedbackTelemetryProductLoopService',
        command: 'npm run feedback:preview -- --json',
        detail: input.issueTemplateAvailable ? 'Issue/report template exists without enabling telemetry.'
          : 'Telemetry segue desligada; template pode ser refinado after.',
        critical: false,
      },
    ];
  }

  private buildSurfaces(input: {
    publicSync: PublicSiteDocsDemoSyncSnapshot | null;
    feedbackStatus: FeedbackTelemetryProductLoopSnapshot['feedback']['contractStatus'];
    docsFeedbackLinked: boolean;
    privacyLinked: boolean;
    canCollectFeedbackPreview: boolean;
  }): FeedbackTelemetryProductLoopSurface[] {
    return [
      {
        id: 'cli',
        label: 'CLI feedback loop',
        routeOrCommand: 'zavorth feedback-product-loop --json',
        status: 'ready',
        detail: 'Read-only snapshot for opt-in, preview, and ledger.',
      },
      {
        id: 'control',
        label: 'ZavorthControl',
        routeOrCommand: '/zavorthControl...sector=config',
        status: 'ready',
        detail: 'Config shows feedback, consent, and telemetry policy.',
      },
      {
        id: 'feedback',
        label: 'Feedback',
        routeOrCommand: '/feedback',
        status: gateStatusFromFeedbackStatus(input.feedbackStatus),
        detail: input.canCollectFeedbackPreview ? 'Feedback preview is ready.' : 'Feedback needs sync.',
      },
      {
        id: 'privacy',
        label: 'Privacy',
        routeOrCommand: '/privacy',
        status: input.privacyLinked ? 'ready' : 'needs-action',
        detail: 'Privacy must explain telemetry opt-in and revoke/delete.',
      },
      {
        id: 'docs',
        label: 'Docs feedback loop',
        routeOrCommand: '/docs#feedback-loop',
        status: input.docsFeedbackLinked ? 'ready' : 'needs-action',
        detail: 'Docs must point to redacted preview and local ledger.',
      },
      {
        id: 'release',
        label: 'Release route',
        routeOrCommand: '/release',
        status: input.publicSync?.sync.releaseBundleLinked ? 'ready' : 'needs-action',
        detail: 'Public release must link feedback without mandatory telemetry.',
      },
    ];
  }

  private buildReceipts(input: {
    publicSyncLinked: boolean;
    feedbackLinked: boolean;
    previewAvailable: boolean;
    revokeAvailable: boolean;
    deleteAvailable: boolean;
    ledgerAvailable: boolean;
    issueTemplateAvailable: boolean;
  }): FeedbackTelemetryProductLoopReceipt[] {
    return [
      {
        id: 'feedback-loop:public-sync',
        kind: 'public-sync',
        source: 'PublicSiteDocsDemoSyncService',
        detail: input.publicSyncLinked ? 'Public sync attached.' : 'Public sync missing.',
        status: input.publicSyncLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'feedback-loop:contract',
        kind: 'feedback-loop',
        source: 'FeedbackTelemetryContractService',
        detail: input.feedbackLinked ? 'Feedback contract attached.' : 'Feedback contract missing.',
        status: input.feedbackLinked ? 'ready' : 'needs-action',
      },
      {
        id: 'feedback-loop:redaction',
        kind: 'redaction',
        source: 'FeedbackTelemetryProductLoopService',
        detail: input.previewAvailable ? 'Redacted preview available.' : 'Redacted preview pending.',
        status: input.previewAvailable ? 'ready' : 'needs-action',
      },
      {
        id: 'feedback-loop:consent',
        kind: 'consent',
        source: 'FeedbackTelemetryProductLoopService',
        detail: input.revokeAvailable && input.deleteAvailable ? 'Revoke/delete available.' : 'Revoke/delete pending.',
        status: input.revokeAvailable && input.deleteAvailable ? 'ready' : 'needs-action',
      },
      {
        id: 'feedback-loop:ledger',
        kind: 'ledger',
        source: 'FeedbackTelemetryProductLoopService',
        detail: input.ledgerAvailable && input.issueTemplateAvailable ? 'Ledger and issue/report template represented.' : 'Ledger or template pending.',
        status: input.ledgerAvailable && input.issueTemplateAvailable ? 'ready' : 'needs-action',
      },
      {
        id: 'feedback-loop:policy',
        kind: 'policy',
        source: 'FeedbackTelemetryProductLoopService',
        detail: 'Telemetry stays disabled-by-default and no external send occurs in Feedback Telemetry.',
        status: 'ready',
      },
    ];
  }

  private resolveNextSafeAction(status: FeedbackTelemetryProductLoopStatus): string {
    if (status === 'needs-public-sync') {
      return 'run Channel mesh9 and publish publicSiteDocsDemoSync before the feedback loop.';
    }
    if (status === 'needs-feedback-loop') {
      return 'Attach FeedbackTelemetryContract and validate npm run qa:feedback-loop.';
    }
    if (status === 'needs-redaction-preview') {
      return 'Generate drafted preview only with npm run feedback:preview.';
    }
    if (status === 'needs-product-ledger') {
      return 'Ensure revoke/delete and local ledger support before collecting feedback.';
    }
    if (status === 'blocked') {
      return 'Fix feedback/public sync blockers before any opt-in.';
    }
    if (status === 'telemetry-disabled') {
      return 'Keep telemetry disabled until explicit consent.';
    }
    return 'Allow only opt-in feedback in redacted preview; do not send external telemetry.';
  }
}
