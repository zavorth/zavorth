import type { UniversalReplyPortKind } from '../agent/UniversalAgentRuntimeTypes.js';

export type ChannelReplyCapabilities = {
  kind: UniversalReplyPortKind;
  maxTextLength: number;
  supportsChunks: boolean;
  supportsEdit: boolean;
  supportsArtifacts: boolean;
  supportsTyping: boolean;
};

const DEFAULT_CAPABILITIES: Record<UniversalReplyPortKind, ChannelReplyCapabilities> = {
  web: {
    kind: 'web',
    maxTextLength: 16_000,
    supportsChunks: true,
    supportsEdit: true,
    supportsArtifacts: true,
    supportsTyping: true,
  },
  cli: {
    kind: 'cli',
    maxTextLength: 32_000,
    supportsChunks: true,
    supportsEdit: false,
    supportsArtifacts: true,
    supportsTyping: false,
  },
  telegram: {
    kind: 'telegram',
    maxTextLength: 4_096,
    supportsChunks: true,
    supportsEdit: true,
    supportsArtifacts: true,
    supportsTyping: true,
  },
  discord: {
    kind: 'discord',
    maxTextLength: 2_000,
    supportsChunks: true,
    supportsEdit: true,
    supportsArtifacts: true,
    supportsTyping: true,
  },
  api: {
    kind: 'api',
    maxTextLength: 32_000,
    supportsChunks: true,
    supportsEdit: false,
    supportsArtifacts: true,
    supportsTyping: false,
  },
  unknown: {
    kind: 'unknown',
    maxTextLength: 4_000,
    supportsChunks: true,
    supportsEdit: false,
    supportsArtifacts: false,
    supportsTyping: false,
  },
};

export class ChannelCapabilityMatrix {
  private readonly capabilities: Record<UniversalReplyPortKind, ChannelReplyCapabilities>;

  constructor(overrides: Partial<Record<UniversalReplyPortKind, Partial<ChannelReplyCapabilities>>> = {}) {
    this.capabilities = Object.fromEntries(
      Object.entries(DEFAULT_CAPABILITIES).map(([kind, capabilities]) => [
        kind,
        {
          ...capabilities,
          ...(overrides[kind as UniversalReplyPortKind] || {}),
          kind: kind as UniversalReplyPortKind,
          maxTextLength: Math.max(1, overrides[kind as UniversalReplyPortKind]?.maxTextLength || capabilities.maxTextLength),
        },
      ]),
    ) as Record<UniversalReplyPortKind, ChannelReplyCapabilities>;
  }

  public get(kind: UniversalReplyPortKind): ChannelReplyCapabilities {
    return this.capabilities[kind] || this.capabilities.unknown;
  }
}
