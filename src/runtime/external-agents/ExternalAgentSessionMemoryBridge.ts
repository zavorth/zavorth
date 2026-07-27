import {
  CanonicalSessionContextAssembler,
  type CanonicalSessionContextSnapshot,
} from '../agent/context/index.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRequest,
  UniversalArtifactSummary,
  UniversalMemorySignal,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ExternalAgentAdapter,
  ExternalAgentSessionDescriptor,
} from './contracts.js';
import type {
  ExternalAgentBridgeMediaAttachment,
  ExternalAgentChannelHistoryEntry,
} from './ExternalAgentChannelBridge.js';

export type ExternalAgentTranscriptVisibility = 'public' | 'restricted' | 'private';

export type ExternalAgentTranscriptEntry = {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  createdAt: string;
  channel?: UniversalAgentChannel;
  visibility?: ExternalAgentTranscriptVisibility;
  memoryLayer?: UniversalMemorySignal['layer'];
  eventId?: string;
  replyPacketId?: string;
  attachments?: ExternalAgentBridgeMediaAttachment[];
  metadata?: Record<string, unknown>;
};

export type ExternalAgentSessionPrivacyPolicy = {
  allowPrivateEntries: false;
  redactRestrictedEntries: boolean;
  maxEntries: number;
};

export type ExternalAgentSessionHistoryEntry = ExternalAgentChannelHistoryEntry & {
  visibility: ExternalAgentTranscriptVisibility;
  privacy: 'visible' | 'redacted';
};

export type ExternalAgentSessionReadModel = {
  id: string;
  runtimeId: string;
  title: string;
  userId: string;
  channel: UniversalAgentChannel;
  workspace?: string | null;
  updatedAt: string | null;
  entries: ExternalAgentSessionHistoryEntry[];
  privacy: {
    policy: ExternalAgentSessionPrivacyPolicy;
    totalEntries: number;
    visibleEntries: number;
    redactedEntries: number;
    blockedPrivateEntries: number;
  };
  memorySignals: UniversalMemorySignal[];
  context: CanonicalSessionContextSnapshot;
  replay: ExternalAgentSessionReplaySnapshot;
  handoff: ExternalAgentSessionHandoffSnapshot;
};

export type ExternalAgentSessionReplaySnapshot = {
  id: string;
  sessionId: string;
  status: 'available' | 'empty';
  eventCount: number;
  artifactCount: number;
  summary: string;
  updatedAt: string;
};

export type ExternalAgentSessionHandoffSnapshot = {
  id: string;
  sessionId: string;
  status: 'ready' | 'fresh';
  prompt: string;
  artifact: UniversalArtifactSummary;
};

export type ExternalAgentSessionMemoryBridgeOptions = {
  adapter: ExternalAgentAdapter;
  now?: () => Date;
  privacyPolicy?: Partial<ExternalAgentSessionPrivacyPolicy>;
  contextAssembler?: CanonicalSessionContextAssembler;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function digestText(value: string, maxLength = 140): string {
  const text = normalizeText(value);
  return `${text.slice(0, maxLength)}${text.length > maxLength ? '...' : ''}`;
}

function normalizeVisibility(value: unknown): ExternalAgentTranscriptVisibility {
  return value === 'restricted' || value === 'private' || value === 'public'
    ? value
    : 'public';
}

function toZavorthSessionId(sessionId: string): string {
  const normalized = normalizeId(sessionId, 'session');
  return normalized.startsWith('external:')
    ? normalized
    : `external:${normalized}`;
}

export class ExternalAgentSessionMemoryBridge {
  private readonly adapter: ExternalAgentAdapter;
  private readonly now: () => Date;
  private readonly privacyPolicy: ExternalAgentSessionPrivacyPolicy;
  private readonly contextAssembler: CanonicalSessionContextAssembler;
  private readonly sessions = new Map<string, ExternalAgentSessionReadModel>();

  constructor(options: ExternalAgentSessionMemoryBridgeOptions) {
    this.adapter = options.adapter;
    this.now = options.now || (() => new Date());
    this.privacyPolicy = {
      allowPrivateEntries: false,
      redactRestrictedEntries: options.privacyPolicy?.redactRestrictedEntries ?? true,
      maxEntries: Math.max(1, options.privacyPolicy?.maxEntries || 24),
    };
    this.contextAssembler = options.contextAssembler || new CanonicalSessionContextAssembler();
  }

  public async importSession(input: {
    session: ExternalAgentSessionDescriptor;
    channelHistory?: ExternalAgentChannelHistoryEntry[];
    transcript?: ExternalAgentTranscriptEntry[];
  }): Promise<ExternalAgentSessionReadModel> {
    const zavorthSessionId = toZavorthSessionId(input.session.id);
    const rawEntries = [
      ...(input.channelHistory || []).map((entry): ExternalAgentTranscriptEntry => ({
        id: entry.id,
        sessionId: entry.sessionId,
        role: entry.role === 'assistant' || entry.role === 'system' || entry.role === 'user' ? entry.role : 'tool',
        text: entry.text,
        createdAt: entry.createdAt,
        channel: entry.channel,
        visibility: 'public',
        eventId: entry.eventId,
        replyPacketId: entry.replyPacketId,
        attachments: entry.attachments,
      })),
      ...(input.transcript || []),
    ];
    const entries = this.applyPrivacyPolicy(rawEntries, zavorthSessionId);
    const memorySignals = this.mapMemorySignals(entries);
    const replay = this.buildReplaySnapshot(zavorthSessionId, entries);
    const handoff = this.buildHandoffSnapshot(input.session, zavorthSessionId, replay);
    const context = this.buildContext({
      session: input.session,
      zavorthSessionId,
      entries,
      memorySignals,
      handoff,
    });
    const readModel: ExternalAgentSessionReadModel = {
      id: zavorthSessionId,
      runtimeId: this.adapter.descriptor.id,
      title: normalizeText(input.session.title, 'External session'),
      userId: input.session.userId,
      channel: input.session.channel,
      workspace: input.session.workspace ?? null,
      updatedAt: input.session.lastEventAt || entries.at(-1)?.createdAt || null,
      entries,
      privacy: {
        policy: this.privacyPolicy,
        totalEntries: rawEntries.length,
        visibleEntries: entries.filter((entry) => entry.privacy === 'visible').length,
        redactedEntries: entries.filter((entry) => entry.privacy === 'redacted').length,
        blockedPrivateEntries: rawEntries.filter((entry) => normalizeVisibility(entry.visibility) === 'private').length,
      },
      memorySignals,
      context,
      replay,
      handoff,
    };

    this.sessions.set(readModel.id, readModel);
    return readModel;
  }

  public querySessionHistory(sessionId: string): ExternalAgentSessionHistoryEntry[] {
    return this.sessions.get(toZavorthSessionId(sessionId))?.entries.slice() || [];
  }

  public getSessionReadModel(sessionId: string): ExternalAgentSessionReadModel | null {
    return this.sessions.get(toZavorthSessionId(sessionId)) || null;
  }

  public buildContinuationRequest(input: {
    sessionId: string;
    userId: string;
    text?: string;
  }): UniversalAgentRequest {
    const readModel = this.getSessionReadModel(input.sessionId);
    if (!readModel) {
      throw new Error(`No imported external session read model for ${input.sessionId}`);
    }

    return {
      userId: input.userId,
      sessionId: readModel.id,
      channel: readModel.channel,
      text: normalizeText(input.text, readModel.handoff.prompt),
      workspace: readModel.workspace || null,
      metadata: {
        context: readModel.context,
        externalSessionReplay: readModel.replay,
        externalSessionHandoff: readModel.handoff,
        importedMemorySignals: readModel.memorySignals,
        externalSessionPrivacy: readModel.privacy,
      },
    };
  }

  private applyPrivacyPolicy(
    entries: ExternalAgentTranscriptEntry[],
    zavorthSessionId: string,
  ): ExternalAgentSessionHistoryEntry[] {
    return entries.flatMap((entry): ExternalAgentSessionHistoryEntry[] => {
      const visibility = normalizeVisibility(entry.visibility);
      if (visibility === 'private') {
        return [];
      }
      const redacted = visibility === 'restricted' && this.privacyPolicy.redactRestrictedEntries;
      return [{
        id: `external-history:${normalizeId(entry.id, 'entry')}`,
        sessionId: zavorthSessionId,
        runId: typeof entry.metadata?.runId === 'string' ? entry.metadata.runId : undefined,
        role: entry.role === 'tool' ? 'system' : entry.role,
        channel: entry.channel || 'api',
        text: redacted ? '[redacted by Zavorth external session privacy policy]' : entry.text,
        createdAt: entry.createdAt,
        eventId: entry.eventId,
        replyPacketId: entry.replyPacketId,
        attachments: entry.attachments,
        visibility,
        privacy: redacted ? 'redacted' : 'visible',
      }];
    }).slice(-this.privacyPolicy.maxEntries);
  }

  private mapMemorySignals(entries: ExternalAgentSessionHistoryEntry[]): UniversalMemorySignal[] {
    return entries
      .filter((entry) => entry.privacy === 'visible')
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .slice(-6)
      .map((entry, index) => ({
        id: `external-memory:${normalizeId(entry.id, `memory-${index + 1}`)}`,
        title: entry.role === 'user' ? 'Imported user context' : 'Imported assistant context',
        layer: 'episodic',
        summary: digestText(entry.text),
        confidence: 0.72,
      }));
  }

  private buildReplaySnapshot(
    sessionId: string,
    entries: ExternalAgentSessionHistoryEntry[],
  ): ExternalAgentSessionReplaySnapshot {
    const updatedAt = entries.at(-1)?.createdAt || this.now().toISOString();
    return {
      id: `external-replay:${normalizeId(sessionId, 'session')}`,
      sessionId,
      status: entries.length > 0 ? 'available' : 'empty',
      eventCount: entries.length,
      artifactCount: entries.reduce((total, entry) => total + (entry.attachments?.length || 0), 0),
      summary: entries.length > 0
        ? `Imported session replay has ${entries.length} visible/redacted event(s).`
        : 'No imported session replay is visible.',
      updatedAt,
    };
  }

  private buildHandoffSnapshot(
    session: ExternalAgentSessionDescriptor,
    sessionId: string,
    replay: ExternalAgentSessionReplaySnapshot,
  ): ExternalAgentSessionHandoffSnapshot {
    const createdAt = this.now().toISOString();
    const title = normalizeText(session.title, 'External session handoff');
    return {
      id: `external-handoff:${normalizeId(sessionId, 'session')}`,
      sessionId,
      status: replay.status === 'available' ? 'ready' : 'fresh',
      prompt: replay.status === 'available'
        ? `Continue from the imported Zavorth session ${sessionId}. Summarize what happened, respect redactions, and propose the next useful step.`
        : `Start a fresh Zavorth continuation for ${sessionId}.`,
      artifact: {
        id: `external-handoff-artifact:${normalizeId(sessionId, 'session')}`,
        title,
        kind: 'handoff',
        createdAt,
        sessionId,
        status: 'ready',
      },
    };
  }

  private buildContext(input: {
    session: ExternalAgentSessionDescriptor;
    zavorthSessionId: string;
    entries: ExternalAgentSessionHistoryEntry[];
    memorySignals: UniversalMemorySignal[];
    handoff: ExternalAgentSessionHandoffSnapshot;
  }): CanonicalSessionContextSnapshot {
    const visibleText = input.entries
      .filter((entry) => entry.privacy === 'visible')
      .map((entry) => `${entry.role}: ${digestText(entry.text, 96)}`)
      .join('\n');
    const memoryPrompt = input.memorySignals
      .map((signal) => `- ${signal.summary}`)
      .join('\n');

    return this.contextAssembler.assemble({
      sessionId: input.zavorthSessionId,
      userId: input.session.userId,
      channel: input.session.channel,
      workspace: input.session.workspace || null,
      profile: 'cold',
      hot: {
        continuityPrompt: input.handoff.prompt,
        summaryPrompt: visibleText || null,
        canonicalSessionPrompt: `Use Zavorth session ${input.zavorthSessionId} as the canonical continuation target.`,
        recentEvents: input.entries,
        metadata: {
          source: 'ExternalAgentSessionMemoryBridge',
          privacyApplied: true,
        },
      },
      warm: {
        workspacePrompt: input.session.workspace ? `Workspace context is ${input.session.workspace}.`
          : null,
        metadata: {
          source: 'ExternalAgentSessionMemoryBridge',
        },
      },
      cold: {
        memoryPrompt: memoryPrompt || null,
        metadata: {
          source: 'ExternalAgentSessionMemoryBridge',
          memorySignalCount: input.memorySignals.length,
          privateEntriesIncluded: false,
        },
      },
      metadata: {
        externalSessionBridge: true,
        sourceRuntimeQuarantined: true,
        canonicalSessionId: input.zavorthSessionId,
      },
    });
  }
}
