import { randomUUID } from 'node:crypto';

import type {
  CanonicalChannelInboundMessage,
  CanonicalChannelPlatform,
} from '../channels/contracts/ChannelMessageContract.js';
import type { ChannelIntentEnvelope, ChannelPolicyDecision } from '../contracts/ChannelGovernanceContract.js';
import { ZavorthActionCatalog } from '../runtime/actions/index.js';

type ChannelGovernanceEnvelopeServiceOptions = {
  now?: () => Date;
  allowedRecipients?: Partial<Record<CanonicalChannelPlatform, string[]>>;
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/iu,
  /bypass\s+(approval|policy|safety)/iu,
  /execute\s+(shell|powershell|bash|cmd)/iu,
  /send\s+without\s+approval/iu,
  /system\s*:/iu,
  /<script\b/iu,
];

const SHELL_PATTERNS = [
  /\brm\s+-rf\b/iu,
  /\bdel\s+\/[sq]\b/iu,
  /\bpowershell\b.+\b(encodedcommand|invoke-expression|iex)\b/iu,
  /\bcurl\b.+\|\s*(sh|bash|powershell)/iu,
];

export class ChannelGovernanceEnvelopeService {
  private readonly now: () => Date;
  private readonly allowedRecipients: Partial<Record<CanonicalChannelPlatform, string[]>>;
  private readonly actionCatalog: ZavorthActionCatalog;

  constructor(options: ChannelGovernanceEnvelopeServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.allowedRecipients = options.allowedRecipients || {};
    this.actionCatalog = new ZavorthActionCatalog();
  }

  public normalizeInbound(message: CanonicalChannelInboundMessage): ChannelIntentEnvelope {
    const text = this.redact(String(message.rawText || '').trim());
    const promptInjectionSignals = this.detectSignals(text, PROMPT_INJECTION_PATTERNS);
    const shellSignals = this.detectSignals(text, SHELL_PATTERNS);
    const actionCandidates = this.lookupActionCandidates(text);
    const kind = this.classifyIntent(text, actionCandidates);
    const requestedTools = this.extractRequestedTools(text);
    const decision = this.decide({
      channel: message.platform,
      text,
      kind,
      promptInjectionSignals,
      shellSignals,
      recipients: [],
    });

    return this.envelope({
      channel: message.platform,
      userId: String(message.userId || ''),
      chatId: String(message.chatId || ''),
      messageId: message.messageId || null,
      text,
      kind,
      requestedTools,
      actionCandidates,
      promptInjectionSignals: [...promptInjectionSignals, ...shellSignals],
      decision,
    });
  }

  public previewOutbound(input: {
    channel: CanonicalChannelPlatform;
    userId: string;
    chatId: string;
    messageId?: string | null;
    message: string;
    recipients: string[];
  }): ChannelIntentEnvelope {
    const text = this.redact(input.message);
    const promptInjectionSignals = this.detectSignals(text, PROMPT_INJECTION_PATTERNS);
    const shellSignals = this.detectSignals(text, SHELL_PATTERNS);
    const decision = this.decide({
      channel: input.channel,
      text,
      kind: 'outbound_request',
      promptInjectionSignals,
      shellSignals,
      recipients: input.recipients,
    });

    return this.envelope({
      channel: input.channel,
      userId: input.userId,
      chatId: input.chatId,
      messageId: input.messageId || null,
      text,
      kind: 'outbound_request',
      requestedTools: [],
      promptInjectionSignals: [...promptInjectionSignals, ...shellSignals],
      decision,
    });
  }

  private envelope(input: {
    channel: CanonicalChannelPlatform;
    userId: string;
    chatId: string;
    messageId: string | null;
    text: string;
    kind: ChannelIntentEnvelope['normalizedIntent']['kind'];
    requestedTools: string[];
    actionCandidates?: NonNullable<ChannelIntentEnvelope['normalizedIntent']['actionCandidates']>;
    promptInjectionSignals: string[];
    decision: { decision: ChannelPolicyDecision; reason: string; approvalRequired: boolean; recipientPreviewRequired: boolean };
  }): ChannelIntentEnvelope {
    const status = input.decision.decision === 'blocked'
      ? 'blocked'
      : input.decision.decision === 'requires_approval'
        ? 'waiting_approval'
        : 'created';
    return {
      contractVersion: 'channel-intent-envelope/1',
      id: `channel-intent-${randomUUID()}`,
      createdAt: this.now().toISOString(),
      channel: input.channel,
      sender: {
        userId: input.userId,
        chatId: input.chatId,
        messageId: input.messageId,
      },
      normalizedIntent: {
        text: input.text,
        kind: input.kind,
        requestedTools: input.requestedTools,
        promptInjectionSignals: input.promptInjectionSignals,
        ...(input.actionCandidates && input.actionCandidates.length > 0 ? { actionCandidates: input.actionCandidates } : {}),
      },
      policyDecision: input.decision,
      receipt: {
        id: `channel-receipt-${randomUUID()}`,
        status,
      },
      safety: {
        inboundNeverExecutesDirectly: true,
        outboundRequiresPolicy: true,
        shellExecutionBlocked: true,
        secretsRedacted: true,
      },
    };
  }

  private decide(input: {
    channel: CanonicalChannelPlatform;
    text: string;
    kind: ChannelIntentEnvelope['normalizedIntent']['kind'];
    promptInjectionSignals: string[];
    shellSignals: string[];
    recipients: string[];
  }): { decision: ChannelPolicyDecision; reason: string; approvalRequired: boolean; recipientPreviewRequired: boolean } {
    if (input.shellSignals.length > 0 || input.promptInjectionSignals.length > 0) {
      return {
        decision: 'blocked',
        reason: 'Prompt-injection or shell-execution signal detected; channel message normalized but not executed.',
        approvalRequired: false,
        recipientPreviewRequired: false,
      };
    }
    if (input.kind === 'mutation_request') {
      return {
        decision: 'requires_approval',
        reason: 'Mutation-like channel intent requires Transaction Plane approval.',
        approvalRequired: true,
        recipientPreviewRequired: false,
      };
    }
    if (input.kind === 'outbound_request') {
      const allowlist = this.allowedRecipients[input.channel] || [];
      const recipientAllowed = input.recipients.length > 0 && input.recipients.every((recipient) => allowlist.includes(recipient));
      return {
        decision: recipientAllowed ? 'requires_approval' : 'blocked',
        reason: recipientAllowed
          ? 'Outbound channel send needs preview and receipt before delivery.'
          : 'Outbound recipient is outside the channel allowlist.',
        approvalRequired: recipientAllowed,
        recipientPreviewRequired: true,
      };
    }
    return {
      decision: 'allowed',
      reason: 'Inbound channel message normalized into a governed intent.',
      approvalRequired: false,
      recipientPreviewRequired: false,
    };
  }

  private classifyIntent(
    text: string,
    actionCandidates: NonNullable<ChannelIntentEnvelope['normalizedIntent']['actionCandidates']> = [],
  ): ChannelIntentEnvelope['normalizedIntent']['kind'] {
    if (actionCandidates.some((candidate) => candidate.requiresApproval || candidate.requiresPreview || candidate.risk !== 'safe')) {
      return 'mutation_request';
    }
    if (/^\/(branch|commit|pr|export|new|side|btw|steer)\b/iu.test(text) || /\b(write|delete|modify|commit|merge|push)\b/iu.test(text)) {
      return 'mutation_request';
    }
    if (/^\//u.test(text)) {
      return 'command';
    }
    return 'chat';
  }

  private lookupActionCandidates(text: string): NonNullable<ChannelIntentEnvelope['normalizedIntent']['actionCandidates']> {
    return this.actionCatalog.lookup({ query: text, limit: 3 })
      .filter((candidate) => candidate.score > 0)
      .map((candidate) => ({
        actionId: candidate.actionId,
        risk: candidate.risk,
        requiresPreview: candidate.requiresPreview,
        requiresApproval: candidate.requiresApproval,
        score: candidate.score,
      }));
  }

  private extractRequestedTools(text: string): string[] {
    const matches = text.match(/@\w[\w.-]*/gu) || [];
    return Array.from(new Set(matches.map((match) => match.slice(1).toLowerCase())));
  }

  private detectSignals(text: string, patterns: RegExp[]): string[] {
    return patterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.source);
  }

  private redact(value: string): string {
    return value
      .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/giu, '$1=[redacted]')
      .slice(0, 4000);
  }
}
