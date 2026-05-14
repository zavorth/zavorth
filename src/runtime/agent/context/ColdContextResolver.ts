import {
  CanonicalSessionContextAssembler,
  type CanonicalColdContextInput,
  type CanonicalColdContextSnapshot,
  type CanonicalHotContextInput,
  type CanonicalHotContextSnapshot,
  type CanonicalSessionContextInput,
  type CanonicalSessionContextSnapshot,
  type CanonicalWarmContextInput,
  type CanonicalWarmContextSnapshot,
} from './CanonicalSessionContextAssembler.js';
import {
  MemoryContextAssembler,
} from './MemoryContextAssembler.js';

export type ColdContextCanonicalAssembler = Pick<CanonicalSessionContextAssembler, 'assemble'>;
export type ColdContextMemoryAssembler = Pick<MemoryContextAssembler, 'assemble'>;

export type ColdContextResolverOptions = {
  canonicalAssembler?: ColdContextCanonicalAssembler | null;
  memoryAssembler?: ColdContextMemoryAssembler | null;
};

export type ColdMemoryContextInput = Pick<CanonicalColdContextInput, 'memoryPrompt' | 'metadata'>;
export type ColdSkillContextInput = Pick<CanonicalColdContextInput, 'skillPrompt' | 'metadata'>;
export type ColdMcpContextInput = Pick<CanonicalColdContextInput, 'mcpSnapshot' | 'metadata'>;

export type ColdContextResolverInput = Omit<
  CanonicalSessionContextInput,
  'profile' | 'cold'
> & {
  hot?: CanonicalHotContextInput | null;
  warm?: CanonicalWarmContextInput | null;
  cold?: CanonicalColdContextInput | null;
  memory?: ColdMemoryContextInput | null;
  skill?: ColdSkillContextInput | null;
  mcp?: ColdMcpContextInput | null;
};

export type ColdContextResolverSnapshot = {
  hot: CanonicalHotContextSnapshot;
  warm: CanonicalWarmContextSnapshot;
  cold: CanonicalColdContextSnapshot;
  canonical: CanonicalSessionContextSnapshot;
  metadata: Record<string, unknown>;
};

type MetadataCarrier = {
  metadata?: Record<string, unknown>;
} | null | undefined;

function metadataOrEmpty(input: MetadataCarrier): Record<string, unknown> {
  return input?.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
    ? input.metadata
    : {};
}

function scopedMetadata(key: string, input: MetadataCarrier): Record<string, unknown> {
  const metadata = metadataOrEmpty(input);
  return Object.keys(metadata).length > 0 ? { [key]: metadata } : {};
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function extractConnectedMcpToolNames(input: ColdContextResolverInput): string[] {
  const snapshots = [
    recordOrNull(input.mcp?.mcpSnapshot),
    recordOrNull(input.cold?.mcpSnapshot),
  ].filter(Boolean) as Record<string, unknown>[];
  const toolNames: string[] = [];

  for (const snapshot of snapshots) {
    const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
    for (const rawEntry of entries) {
      const entry = recordOrNull(rawEntry);
      if (!entry || entry.status !== 'connected') {
        continue;
      }
      const entryToolNames = Array.isArray(entry.toolNames) ? entry.toolNames : [];
      for (const toolName of entryToolNames) {
        const normalized = String(toolName || '').trim();
        if (normalized) {
          toolNames.push(normalized);
        }
      }
    }
  }

  return Array.from(new Set(toolNames));
}

function inferMemoryContextFromMcp(
  input: ColdContextResolverInput,
  memoryAssembler: ColdContextMemoryAssembler,
): ColdMemoryContextInput | null {
  if (input.memory || input.cold?.memoryPrompt) {
    return null;
  }

  const connectedToolNames = extractConnectedMcpToolNames(input);
  if (connectedToolNames.length === 0) {
    return null;
  }

  const memoryContext = memoryAssembler.assemble({
    connectedToolNames,
    compact: true,
    metadata: {
      memoryContextSource: 'ColdContextResolver.mcpSnapshot',
      connectedToolSource: 'McpSnapshotAssembler',
    },
  });

  return memoryContext.available ? memoryContext.cold : null;
}

function mergeColdContext(
  input: ColdContextResolverInput,
  inferredMemory: ColdMemoryContextInput | null,
): CanonicalColdContextInput {
  const memory = input.memory || inferredMemory;

  return {
    memoryPrompt: memory?.memoryPrompt ?? input.cold?.memoryPrompt ?? null,
    skillPrompt: input.skill?.skillPrompt ?? input.cold?.skillPrompt ?? null,
    mcpSnapshot: input.mcp?.mcpSnapshot ?? input.cold?.mcpSnapshot ?? null,
    metadata: {
      ...metadataOrEmpty(input.cold),
      ...scopedMetadata('memoryContext', memory),
      ...scopedMetadata('skillContext', input.skill),
      ...scopedMetadata('mcpContext', input.mcp),
      resolverSource: 'ColdContextResolver',
      toolExposureGatedByColdContext: false,
    },
  };
}

export class ColdContextResolver {
  private readonly canonicalAssembler: ColdContextCanonicalAssembler;
  private readonly memoryAssembler: ColdContextMemoryAssembler;

  constructor(options: ColdContextResolverOptions = {}) {
    this.canonicalAssembler = options.canonicalAssembler || new CanonicalSessionContextAssembler();
    this.memoryAssembler = options.memoryAssembler || new MemoryContextAssembler();
  }

  public resolve(input: ColdContextResolverInput = {}): ColdContextResolverSnapshot {
    const inferredMemory = inferMemoryContextFromMcp(input, this.memoryAssembler);
    const canonical = this.canonicalAssembler.assemble({
      ...input,
      profile: 'cold',
      hot: input.hot || {},
      warm: input.warm || {},
      cold: mergeColdContext(input, inferredMemory),
      metadata: {
        ...(input.metadata || {}),
        coldContextSource: 'ColdContextResolver',
      },
    });
    const metadata: Record<string, unknown> = {
      ...canonical.metadata,
      source: 'CanonicalSessionContextAssembler',
      layer: 'cold',
      required: false,
      includesWarm: true,
      includesCold: true,
      toolExposureGatedByColdContext: false,
    };

    return {
      hot: canonical.hot,
      warm: canonical.warm!,
      cold: canonical.cold!,
      canonical: {
        ...canonical,
        metadata,
      },
      metadata,
    };
  }
}
