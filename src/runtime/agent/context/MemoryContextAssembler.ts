import {
  buildMnemosCognitiveInstruction,
  buildMnemosCognitiveInstructionCompact,
  isMnemosAvailable,
  MNEMOS_CANONICAL_CADENCE,
  MNEMOS_CONTEXT_REQUIRED_TOOLS,
  MNEMOS_INDEX_FILE_TOOL,
  MNEMOS_INDEXING_APPROVAL_BOUNDARY,
} from '../../../services/MnemosCognitiveProtocol.js';
import type { CanonicalColdContextInput } from './CanonicalSessionContextAssembler.js';

export type MemoryContextIndexingPolicy = {
  toolName: string;
  requiresApproval: boolean;
  approvalBoundary: string;
  owner: string;
};

export type MemoryContextAssemblerInput = {
  connectedToolNames?: string[] | null;
  memoryPrompt?: string | null;
  compact?: boolean;
  metadata?: Record<string, unknown>;
};

export type MemoryContextSnapshot = {
  available: boolean;
  requiredTools: string[];
  cadence: string[];
  indexing: MemoryContextIndexingPolicy;
  cold: Pick<CanonicalColdContextInput, 'memoryPrompt' | 'metadata'>;
  metadata: Record<string, unknown>;
};

function normalizeToolNames(toolNames: string[] | null | undefined): string[] {
  return Array.from(new Set(
    (toolNames || [])
      .map((toolName) => String(toolName || '').trim())
      .filter(Boolean),
  ));
}

function normalizePrompt(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

export class MemoryContextAssembler {
  public assemble(input: MemoryContextAssemblerInput = {}): MemoryContextSnapshot {
    const connectedToolNames = normalizeToolNames(input.connectedToolNames);
    const available = isMnemosAvailable(connectedToolNames);
    const requiredTools = [...MNEMOS_CONTEXT_REQUIRED_TOOLS];
    const cadence = [...MNEMOS_CANONICAL_CADENCE];
    const indexing: MemoryContextIndexingPolicy = {
      toolName: MNEMOS_INDEX_FILE_TOOL,
      requiresApproval: true,
      approvalBoundary: MNEMOS_INDEXING_APPROVAL_BOUNDARY,
      owner: 'MnemosHumanInTheLoopService',
    };
    const memoryPrompt = normalizePrompt(input.memoryPrompt)
      || (available
        ? input.compact
          ? buildMnemosCognitiveInstructionCompact()
          : buildMnemosCognitiveInstruction()
        : null);
    const metadata: Record<string, unknown> = {
      ...(input.metadata || {}),
      source: 'MnemosCognitiveProtocol',
      mnemosAvailable: available,
      requiredTools,
      cadence,
      connectedToolNames,
      compact: input.compact === true,
      indexingTool: indexing.toolName,
      indexingRequiresApproval: indexing.requiresApproval,
      indexingApprovalBoundary: indexing.approvalBoundary,
      toolExposureGatedByMemoryContext: false,
    };

    return {
      available,
      requiredTools,
      cadence,
      indexing,
      cold: {
        memoryPrompt,
        metadata,
      },
      metadata,
    };
  }
}
