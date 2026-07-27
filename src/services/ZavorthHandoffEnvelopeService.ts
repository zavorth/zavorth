import {
  ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER,
  ZAVORTH_HANDOFF_ENVELOPE_SECTION_TITLES,
  ZAVORTH_HANDOFF_ENVELOPE_VERSION,
  type ZavorthHandoffEnvelopeInput,
  type ZavorthHandoffEnvelopeSection,
  type ZavorthHandoffEnvelopeSectionId,
  type ZavorthHandoffEnvelopeSnapshot,
} from '../contracts/ZavorthHandoffEnvelopeContract.js';
import {
  ContextCompactionService,
  type ContextCompactionMessage,
} from './ContextCompactionService.js';

type ZavorthHandoffEnvelopeRuntime = {
  now?: () => Date;
  compactionService?: Pick<ContextCompactionService, 'compact'> | null;
};

type BuildEnvelopeInput = ZavorthHandoffEnvelopeInput & {
  messages?: ContextCompactionMessage[] | null;
  lastActivityAt?: string | Date | null;
  usableContextTokens?: number;
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b(?:api[_-]...key|token|secret|password)\s*[:=]\s*["']...[^"'\s]+/gi,
];

function sanitize(value: unknown): string {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  const redacted = SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), raw);
  return redacted || 'Not specified.';
}

function uniqueItems(items: Array<unknown>, limit = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = sanitize(item);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
    if (out.length >= limit) {
      break;
    }
  }
  return out.length ? out : ['Not specified.'];
}

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export class ZavorthHandoffEnvelopeService {
  private readonly now: () => Date;
  private readonly compactionService: Pick<ContextCompactionService, 'compact'>;

  constructor(runtime: ZavorthHandoffEnvelopeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.compactionService = runtime.compactionService || new ContextCompactionService();
  }

  public buildEnvelope(input: BuildEnvelopeInput = {}): ZavorthHandoffEnvelopeSnapshot {
    const now = this.now();
    const messages = Array.isArray(input.messages) ? input.messages : [];
    const compaction = this.compactionService.compact({
      messages,
      now,
      lastActivityAt: input.lastActivityAt || null,
      usableContextTokens: input.usableContextTokens || 64000,
      recentVerbatimTurns: 5,
    });
    const anchor = compaction.anchorSummary;

    const sectionMap: Record<ZavorthHandoffEnvelopeSectionId, string[]> = {
      'active-mandate': uniqueItems([
        input.activeMandate,
        input.sessionId ? `Session: ${input.sessionId}` : null,
        input.workspace ? `Workspace: ${input.workspace}` : null,
      ]),
      'current-architecture-decisions': uniqueItems([
        ...(input.architectureDecisions || []),
        ...(anchor?.stateMap || []),
      ]),
      'modified-paths': uniqueItems([
        ...(input.modifiedPaths || []),
        ...(anchor?.modifiedPaths || []),
      ]),
      'tool-failure-log': uniqueItems(anchor?.toolFailureLog || ['No tool failure detected in compacted turns.']),
      'security-approvals-granted': uniqueItems([
        ...(input.securityApprovals || []),
        ...(anchor?.securityApprovals || []),
      ]),
      'verbatim-user-directives': uniqueItems([
        ...messages.filter((message) => message.role === 'user').map((message) => message.content),
        ...(anchor?.verbatimUserDirectives || []),
      ], 30),
      'remaining-todo-checklist': uniqueItems([
        ...(input.remainingTodos || []),
        ...(anchor?.pendingChecklist || []),
      ]),
      'dry-run-state-preview': uniqueItems([
        ...(input.dryRunStatePreview || []),
        compaction.triggered ? `Context is resumable after ${compaction.mode}; ${compaction.reductionTokens} estimated token(s) reduced.`
          : 'Context is fresh enough to resume without compaction.',
      ]),
      'next-prescribed-action': uniqueItems([
        input.nextPrescribedAction,
        anchor?.nextPrescribedAction,
        'Read this envelope, inspect recent receipts, then continue with the safest pending action.',
      ], 3),
    };

    const sections = ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER.map((id): ZavorthHandoffEnvelopeSection => ({
      id,
      title: ZAVORTH_HANDOFF_ENVELOPE_SECTION_TITLES[id],
      items: sectionMap[id],
    }));
    const generatedAt = now.toISOString();
    const markdown = this.renderMarkdown({
      generatedAt,
      sessionId: input.sessionId || null,
      workspace: input.workspace || null,
      operator: input.operator || null,
      sections,
    });

    return {
      version: ZAVORTH_HANDOFF_ENVELOPE_VERSION,
      generatedAt,
      status: 'preview-ready',
      sessionId: input.sessionId || null,
      workspace: input.workspace || null,
      operator: input.operator || null,
      sections,
      markdown,
      receipt: {
        id: `handoff-envelope-${stableId(`${generatedAt}:${markdown}`)}`,
        providerCall: false,
        durableMutation: false,
        toolExecution: false,
        secretsRedacted: true,
        approvalRequiredToPersist: true,
      },
    };
  }

  private renderMarkdown(input: {
    generatedAt: string;
    sessionId: string | null;
    workspace: string | null;
    operator: string | null;
    sections: ZavorthHandoffEnvelopeSection[];
  }): string {
    const header = [
      '# Zavorth Handoff Envelope',
      '',
      `Generated at: ${input.generatedAt}`,
      `Session: ${sanitize(input.sessionId)}`,
      `Workspace: ${sanitize(input.workspace)}`,
      `Operator: ${sanitize(input.operator)}`,
      '',
      '> Preview only. Persisting or injecting this handoff requires explicit approval.',
    ];
    const body = input.sections.flatMap((section) => [
      '',
      `## ${section.title}`,
      '',
      ...section.items.map((item) => `- ${sanitize(item)}`),
    ]);

    return [...header, ...body, ''].join('\n');
  }
}
