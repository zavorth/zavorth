import {
  ZAVORTH_VISUAL_RECEIPTS_V2_CONTRACT_VERSION,
  type ZavorthVisualReceiptV2Action,
  type ZavorthVisualReceiptV2Card,
  type ZavorthVisualReceiptV2ImpactItem,
  type ZavorthVisualReceiptV2Tone,
  type ZavorthVisualReceiptsV2Snapshot,
} from '../contracts/ZavorthVisualReceiptsV2Contract.js';
import type {
  ZavorthVisualReceiptUxCard,
  ZavorthVisualReceiptUxSnapshot,
} from '../contracts/ZavorthVisualReceiptUxContract.js';
import {
  ZavorthVisualReceiptUxService,
  type ZavorthVisualReceiptUxInput,
} from './ZavorthVisualReceiptUxService.js';

export type ZavorthVisualReceiptsV2Input = ZavorthVisualReceiptUxInput & {
  includeAdvancedStory?: boolean;
};

export type ZavorthVisualReceiptsV2Runtime = {
  visualReceipts?: Pick<ZavorthVisualReceiptUxService, 'buildSnapshot'>;
};

export class ZavorthVisualReceiptsV2Service {
  private readonly visualReceipts: Pick<ZavorthVisualReceiptUxService, 'buildSnapshot'>;

  constructor(runtime: ZavorthVisualReceiptsV2Runtime = {}) {
    this.visualReceipts = runtime.visualReceipts || new ZavorthVisualReceiptUxService();
  }

  public buildSnapshot(input: ZavorthVisualReceiptsV2Input = {}): ZavorthVisualReceiptsV2Snapshot {
    const source = this.visualReceipts.buildSnapshot({
      receipts: input.receipts,
      includeAdvanced: input.includeAdvanced === true || input.includeAdvancedStory === true,
    });
    const cards = source.cards.map((card) => buildCard(card, input.includeAdvancedStory === true));
    const needsReview = cards.filter((card) => card.confidence === 'needs_review').length;
    const blockedOrRisky = cards.filter((card) => card.confidence === 'blocked' || card.tone === 'risk' || card.tone === 'blocked').length;
    const rollbackAvailable = cards.filter((card) => card.safeActions.some((action) => action.kind === 'rollback')).length;

    return {
      contractVersion: ZAVORTH_VISUAL_RECEIPTS_V2_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'visual-receipts-v2',
      generatedAt: source.generatedAt,
      status: blockedOrRisky > 0 ? 'blocked' : needsReview > 0 ? 'attention' : 'ready',
      summary: {
        totalReceipts: cards.length,
        completed: cards.filter((card) => card.confidence === 'clear').length,
        needsReview,
        rollbackAvailable,
        blockedOrRisky,
        rawSecretsSerialized: false,
      },
      cards,
      plainLanguage: {
        userCanTrust: 'The receipt says what happened, what was not changed, and where the evidence came from.',
        userShouldReview: 'Review any receipt with approvals, file changes, blocked actions, network use or high risk.',
        userCanUndo: rollbackAvailable > 0
          ? 'At least one receipt has a rollback preview. Rollback still requires scoped approval.'
          : 'No rollback is needed or available for these receipts.',
      },
      sourceProjection: {
        surface: source.surface,
        contractVersion: source.contractVersion,
        zavorthControlProjection: source.zavorthControlProjection,
      },
      zavorthControlProjection: {
        route: '/control',
        renderMode: 'product-cards',
        executionAuthority: false,
        advancedModeAvailable: true,
      },
      exportFormats: ['markdown', 'json', 'audit-json'],
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        zavorthControlCanExecute: false,
        approvalActionsStayScoped: true,
        rollbackRequiresApproval: true,
      },
      nextAction: resolveNextAction(cards, source.nextAction),
      invariants: [
        'Visual Receipts 2.0 is a product-facing projection over existing receipt contracts, not a new execution path.',
        'Receipt cards can suggest approval, export or rollback commands, but ZavorthControl/Satellite cannot execute them directly.',
        'Raw secrets, emails and token-looking values remain redacted before rendering.',
        'Simple mode explains outcome and impact; advanced mode exposes policy, sandbox and artifact evidence.',
        'Rollback is never automatic from a receipt card; it remains scoped and approval-gated.',
      ],
    };
  }

  public renderText(snapshot: ZavorthVisualReceiptsV2Snapshot): string {
    return [
      '[zavorth-visual-receipts-v2]',
      `status=${snapshot.status} receipts=${snapshot.summary.totalReceipts} review=${snapshot.summary.needsReview} rollback=${snapshot.summary.rollbackAvailable} risky=${snapshot.summary.blockedOrRisky}`,
      '',
      ...snapshot.cards.map((card) => [
        `[${card.id}] ${card.headline}`,
        `${card.statusLine} | confidence=${card.confidence} | tone=${card.tone}`,
        ...card.receiptStory.map((line) => `- ${line}`),
        '[impact]',
        ...card.impact.map((item) => `- ${item.label}: ${item.value} | ${item.plainMeaning}`),
        '[actions]',
        ...card.safeActions.map((action) => `- ${action.label}: ${action.command} | approval=${action.requiresApproval} | mutates=${action.mutatesState}`),
        '',
      ].join('\n')),
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildCard(source: ZavorthVisualReceiptUxCard, includeAdvancedStory: boolean): ZavorthVisualReceiptV2Card {
  const tone = resolveTone(source);
  const confidence = resolveConfidence(source);
  return {
    id: source.id,
    title: source.title,
    headline: buildHeadline(source, confidence),
    statusLine: buildStatusLine(source),
    tone,
    confidence,
    receiptStory: buildStory(source, includeAdvancedStory),
    impact: buildImpact(source),
    safeActions: buildActions(source),
    advancedSummary: {
      visibleByDefault: false,
      policyBroker: source.advanced.policyBroker,
      trustPlane: source.advanced.trustPlane,
      sandboxMutationMode: source.advanced.sandboxMutationMode,
      artifacts: source.advanced.artifacts,
      secretPolicy: source.safety.secretPolicy,
    },
  };
}

function buildHeadline(source: ZavorthVisualReceiptUxCard, confidence: ZavorthVisualReceiptV2Card['confidence']): string {
  if (confidence === 'blocked') {
    return `${source.title}: review blocked or risky work before continuing.`;
  }
  if (confidence === 'needs_review') {
    return `${source.title}: completed with items to review.`;
  }
  return `${source.title}: completed with clear evidence.`;
}

function buildStatusLine(source: ZavorthVisualReceiptUxCard): string {
  return `${source.risk} risk; ${source.outcome}; ${source.subtitle}`;
}

function buildStory(source: ZavorthVisualReceiptUxCard, includeAdvancedStory: boolean): string[] {
  const changed = evidenceValue(source, 'files-changed');
  const blocked = evidenceValue(source, 'actions-blocked');
  const network = evidenceValue(source, 'network-used');
  const approvals = evidenceValue(source, 'approvals');
  const rollback = evidenceValue(source, 'rollback');
  const story = [
    sanitize(source.simpleText),
    changed === '0' ? 'No files were changed.' : `${changed} file change(s) were recorded.`,
    blocked === '0' ? 'No blocked action was recorded.' : `${blocked} action(s) were blocked by policy or sandbox.`,
    network === '0' ? 'No network use was recorded.' : `${network} network action(s) were recorded.`,
    approvals === '0' ? 'No pending approval is shown on this receipt.' : `${approvals} approval item(s) require review.`,
    rollback === 'available' ? 'Rollback evidence is available as a preview, not an automatic action.' : 'No rollback action is attached.',
  ];
  if (includeAdvancedStory) {
    story.push(
      `Policy Broker: ${source.advanced.policyBroker}.`,
      `Sandbox mutation mode: ${source.advanced.sandboxMutationMode}.`,
      `Artifacts: ${source.advanced.artifacts.length ? source.advanced.artifacts.join(', ') : 'none'}.`,
    );
  }
  return story;
}

function buildImpact(source: ZavorthVisualReceiptUxCard): ZavorthVisualReceiptV2ImpactItem[] {
  return source.evidence.map((row) => ({
    id: row.id,
    label: row.label,
    value: row.value,
    tone: mapTone(row.tone),
    plainMeaning: row.detail,
  }));
}

function buildActions(source: ZavorthVisualReceiptUxCard): ZavorthVisualReceiptV2Action[] {
  const base = source.actions.map((action): ZavorthVisualReceiptV2Action => ({
    id: action.id,
    label: action.label,
    command: action.command,
    kind: action.kind,
    safeByDefault: !action.mutatesState && !action.requiresApproval,
    requiresApproval: action.requiresApproval,
    mutatesState: action.mutatesState,
    zavorthControlCanExecute: false,
  }));
  base.push({
    id: 'export-markdown',
    label: 'Export readable receipt',
    command: `zavorth receipts ${source.id} --format markdown`,
    kind: 'export',
    safeByDefault: true,
    requiresApproval: false,
    mutatesState: false,
    zavorthControlCanExecute: false,
  });
  return base;
}

function resolveTone(source: ZavorthVisualReceiptUxCard): ZavorthVisualReceiptV2Tone {
  if (source.tone === 'danger') return 'blocked';
  if (source.risk === 'high') return 'risk';
  if (source.tone === 'warn') return 'attention';
  return 'calm';
}

function resolveConfidence(source: ZavorthVisualReceiptUxCard): ZavorthVisualReceiptV2Card['confidence'] {
  if (source.tone === 'danger' || source.risk === 'high') return 'blocked';
  if (source.actions.some((action) => action.kind === 'approval') || source.evidence.some((row) => row.tone === 'warn')) {
    return 'needs_review';
  }
  return 'clear';
}

function evidenceValue(source: ZavorthVisualReceiptUxCard, id: string): string {
  return source.evidence.find((row) => row.id === id)?.value || '0';
}

function resolveNextAction(cards: ZavorthVisualReceiptV2Card[], fallback: string): string {
  if (cards.some((card) => card.confidence === 'blocked')) {
    return 'Review blocked or high-risk receipt evidence before continuing.';
  }
  if (cards.some((card) => card.confidence === 'needs_review')) {
    return 'Review approvals, file changes, network use or rollback evidence before claiming the mission is done.';
  }
  return fallback || 'Receipt cards are ready for export or audit review.';
}

function mapTone(tone: ZavorthVisualReceiptUxCard['tone']): ZavorthVisualReceiptV2Tone {
  if (tone === 'danger') return 'blocked';
  if (tone === 'warn') return 'attention';
  return 'calm';
}

function sanitize(value: string): string {
  return String(value || '')
    .replace(/\b([A-Z0-9_]*(?:api[_-]?key|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_SECRET]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bpk_(?:live|test)_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .slice(0, 1200);
}
