import type { AssembledAgentContext } from '../contracts/index.js';
import type { UniversalAgentChannel } from '../UniversalAgentRuntimeTypes.js';
import {
  resolveRunContextProfile,
  type RunContextDepth,
  type RunContextProfile,
} from './RunContextProfile.js';

export type CanonicalIdentityFile = {
  path: string;
  exists?: boolean | null;
  content?: string | null;
  summary?: string | null;
};

export type CanonicalHotContextInput = {
  continuityPrompt?: string | null;
  summaryPrompt?: string | null;
  canonicalSessionPrompt?: string | null;
  recentEvents?: unknown[];
  metadata?: Record<string, unknown>;
};

export type CanonicalWarmContextInput = {
  workspacePrompt?: string | null;
  workspaceProfile?: Record<string, unknown> | null;
  identityFiles?: CanonicalIdentityFile[];
  metadata?: Record<string, unknown>;
};

export type CanonicalColdContextInput = {
  memoryPrompt?: string | null;
  skillPrompt?: string | null;
  mcpSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type CanonicalSessionContextInput = {
  sessionId?: string | null;
  userId?: string | null;
  channel?: UniversalAgentChannel | string | null;
  traceId?: string | null;
  workspace?: string | null;
  profile?: RunContextProfile | RunContextDepth | null;
  hot?: CanonicalHotContextInput | null;
  warm?: CanonicalWarmContextInput | null;
  cold?: CanonicalColdContextInput | null;
  metadata?: Record<string, unknown>;
};

export type CanonicalHotContextSnapshot = Required<Pick<
  CanonicalHotContextInput,
  'continuityPrompt' | 'summaryPrompt' | 'canonicalSessionPrompt' | 'recentEvents' | 'metadata'
>>;

export type CanonicalWarmContextSnapshot = Required<Pick<
  CanonicalWarmContextInput,
  'workspacePrompt' | 'workspaceProfile' | 'identityFiles' | 'metadata'
>>;

export type CanonicalColdContextSnapshot = Required<Pick<
  CanonicalColdContextInput,
  'memoryPrompt' | 'skillPrompt' | 'mcpSnapshot' | 'metadata'
>>;

export type CanonicalSessionContextSnapshot = AssembledAgentContext & {
  userId?: string | null;
  channel?: UniversalAgentChannel | string | null;
  traceId?: string | null;
  workspace?: string | null;
  profile: RunContextProfile;
  hot: CanonicalHotContextSnapshot;
  warm?: CanonicalWarmContextSnapshot;
  cold?: CanonicalColdContextSnapshot;
  metadata: Record<string, unknown>;
};

function textOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return recordOrNull(value) || {};
}

function normalizeIdentityFiles(files: CanonicalIdentityFile[] | undefined): CanonicalIdentityFile[] {
  return (files || [])
    .filter((file) => file && textOrNull(file.path))
    .filter((file) => file.exists !== false)
    .map((file) => ({
      path: textOrNull(file.path) || '',
      exists: file.exists ?? true,
      content: textOrNull(file.content),
      summary: textOrNull(file.summary),
    }));
}

export class CanonicalSessionContextAssembler {
  public assemble(input: CanonicalSessionContextInput = {}): CanonicalSessionContextSnapshot {
    const profile = resolveRunContextProfile(input.profile);
    const hot: CanonicalHotContextSnapshot = {
      continuityPrompt: textOrNull(input.hot?.continuityPrompt),
      summaryPrompt: textOrNull(input.hot?.summaryPrompt),
      canonicalSessionPrompt: textOrNull(input.hot?.canonicalSessionPrompt),
      recentEvents: Array.isArray(input.hot?.recentEvents) ? input.hot.recentEvents : [],
      metadata: recordOrEmpty(input.hot?.metadata),
    };
    const warm = profile.includeWarm ? this.assembleWarm(input.warm) : undefined;
    const cold = profile.includeCold ? this.assembleCold(input.cold) : undefined;
    const metadata: Record<string, unknown> = {
      ...recordOrEmpty(input.metadata),
      contextProfile: profile.id,
      contextDepth: profile.depth,
      contextLayers: [
        'hot',
        ...(warm ? ['warm'] : []),
        ...(cold ? ['cold'] : []),
      ],
      toolExposureGatedByContextProfile: profile.gatesToolExposure,
    };

    return {
      sessionId: textOrNull(input.sessionId),
      userId: textOrNull(input.userId),
      channel: input.channel || null,
      traceId: textOrNull(input.traceId),
      workspace: textOrNull(input.workspace),
      continuityPrompt: hot.continuityPrompt,
      summaryPrompt: hot.summaryPrompt,
      canonicalSessionPrompt: hot.canonicalSessionPrompt,
      workspacePrompt: warm?.workspacePrompt ?? null,
      memoryPrompt: cold?.memoryPrompt ?? null,
      skillPrompt: cold?.skillPrompt ?? null,
      mcpSnapshot: cold?.mcpSnapshot ?? null,
      profile,
      hot,
      warm,
      cold,
      metadata,
    };
  }

  private assembleWarm(input: CanonicalWarmContextInput | null | undefined): CanonicalWarmContextSnapshot {
    return {
      workspacePrompt: textOrNull(input?.workspacePrompt),
      workspaceProfile: recordOrNull(input?.workspaceProfile),
      identityFiles: normalizeIdentityFiles(input?.identityFiles),
      metadata: recordOrEmpty(input?.metadata),
    };
  }

  private assembleCold(input: CanonicalColdContextInput | null | undefined): CanonicalColdContextSnapshot {
    return {
      memoryPrompt: textOrNull(input?.memoryPrompt),
      skillPrompt: textOrNull(input?.skillPrompt),
      mcpSnapshot: recordOrNull(input?.mcpSnapshot),
      metadata: recordOrEmpty(input?.metadata),
    };
  }
}
