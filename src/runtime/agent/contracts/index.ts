import type { AgentRunExecutionOptions } from '../AgentRunService.js';
import type { ZavorthAgentGatewaySnapshot as ZavorthAgentGatewaySnapshotSource } from '../ZavorthAgentGateway.js';
import type { ToolExposurePolicyInput } from '../ToolExposurePolicy.js';
import type {
  CanonicalSessionContextSnapshot,
  McpContextSnapshot,
  McpSnapshotEntry,
  SkillSnapshot,
  SkillSnapshotEntry,
} from '../context/index.js';
import type {
  UniversalAgentRequest,
  UniversalAgentChannel,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalReplyPacket,
  UniversalReplyPort,
  UniversalToolExposureProfile,
} from '../UniversalAgentRuntimeTypes.js';
import type {
  ZavorthToolFamilySnapshot,
  ZavorthToolSurfaceSnapshot,
} from '../../../services/ZavorthToolSurfaceService.js';

export type ZavorthAgentRequest = UniversalAgentRequest;
export type ZavorthReplyPort = UniversalReplyPort;
export type ZavorthAgentRunResult = UniversalAgentRunResult;
export type ZavorthContextSnapshot = CanonicalSessionContextSnapshot;
export type ZavorthToolExposureProfile = UniversalToolExposureProfile;
export type ZavorthAgentGatewaySnapshot = ZavorthAgentGatewaySnapshotSource;

export type NormalizedInboundMessage = UniversalAgentRequest;
export type InboundAdapterSurface = UniversalAgentChannel | 'external-runtime';
export type InboundAdapterNormalizationResult =
  | {
      ok: true;
      message: NormalizedInboundMessage;
      evidence?: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: string;
      evidence?: Record<string, unknown>;
    };
export type InboundAdapterContract = {
  readonly id: string;
  readonly surface: InboundAdapterSurface;
  normalize(input: unknown): InboundAdapterNormalizationResult;
};
export type AgentReplyPort = UniversalReplyPort;
export type AgentReplyPacket = UniversalReplyPacket;
export type AgentRunResult = UniversalAgentRunResult;
export type AgentRunOptions = AgentRunExecutionOptions;
export type AgentRunSnapshot = UniversalAgentRun;
export type AgentGatewaySnapshot = ZavorthAgentGatewaySnapshotSource;
export type ToolExposureProfile = UniversalToolExposureProfile;
export type ToolExposurePolicyContractInput = ToolExposurePolicyInput;
export type PublicSkillSnapshot = SkillSnapshot;
export type PublicSkillSnapshotEntry = SkillSnapshotEntry;
export type PublicMcpCapabilitySnapshot = McpContextSnapshot;
export type PublicMcpCapabilityEntry = McpSnapshotEntry;
export type PublicToolSurfaceSnapshot = ZavorthToolSurfaceSnapshot;
export type PublicToolFamilySnapshot = ZavorthToolFamilySnapshot;

export type AssembledAgentContext = {
  sessionId?: string | null;
  continuityPrompt?: string | null;
  workspacePrompt?: string | null;
  memoryPrompt?: string | null;
  summaryPrompt?: string | null;
  canonicalSessionPrompt?: string | null;
  skillPrompt?: string | null;
  mcpSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type PublicEcosystemContractArea =
  | 'channel'
  | 'runtime'
  | 'tool'
  | 'skill'
  | 'surface';

export type PublicEcosystemContractStability = 'stable' | 'experimental';

export type PublicEcosystemContractDescriptor = {
  name: string;
  area: PublicEcosystemContractArea;
  stability: PublicEcosystemContractStability;
  sourceModule: string;
  sourceType: string;
  notes: string[];
};

export const PUBLIC_ECOSYSTEM_CONTRACT_VERSION = '2026-05-02.z0-z1';

export const PUBLIC_ECOSYSTEM_CONTRACTS = [
  {
    name: 'ZavorthAgentRequest',
    area: 'channel',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalAgentRequest',
    notes: ['Canonical Zavorth inbound request; legacy names must adapt to this shape.'],
  },
  {
    name: 'ZavorthReplyPort',
    area: 'channel',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalReplyPort',
    notes: ['Canonical Zavorth outbound reply port for CLI, Web, Telegram and API surfaces.'],
  },
  {
    name: 'ZavorthAgentRunResult',
    area: 'runtime',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalAgentRunResult',
    notes: ['Canonical Zavorth run result envelope; do not create surface-specific result shapes.'],
  },
  {
    name: 'ZavorthContextSnapshot',
    area: 'runtime',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/context/CanonicalSessionContextAssembler.ts',
    sourceType: 'CanonicalSessionContextSnapshot',
    notes: ['Canonical hot, warm and cold context snapshot for a run.'],
  },
  {
    name: 'ZavorthToolExposureProfile',
    area: 'tool',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalToolExposureProfile',
    notes: ['Canonical Zavorth tool visibility profile after runtime policy.'],
  },
  {
    name: 'ZavorthAgentGatewaySnapshot',
    area: 'runtime',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/ZavorthAgentGateway.ts',
    sourceType: 'ZavorthAgentGatewaySnapshot',
    notes: ['Canonical gateway observability snapshot for Dashboard and diagnostics.'],
  },
  {
    name: 'NormalizedInboundMessage',
    area: 'channel',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalAgentRequest',
    notes: ['Canonical inbound shape for channel adapters.'],
  },
  {
    name: 'InboundAdapterContract',
    area: 'channel',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/contracts/index.ts',
    sourceType: 'InboundAdapterContract',
    notes: ['Adapter-facing normalization contract; adapters produce NormalizedInboundMessage and do not dispatch work directly.'],
  },
  {
    name: 'AgentReplyPort',
    area: 'channel',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalReplyPort',
    notes: ['Canonical outbound port descriptor for web, CLI, Telegram and API replies.'],
  },
  {
    name: 'AgentReplyPacket',
    area: 'channel',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalReplyPacket',
    notes: ['Canonical reply packet emitted by the reply pipeline.'],
  },
  {
    name: 'AgentRunResult',
    area: 'runtime',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalAgentRunResult',
    notes: ['Public result envelope for a universal agent run.'],
  },
  {
    name: 'AgentRunSnapshot',
    area: 'runtime',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalAgentRun',
    notes: ['Observable run snapshot; callers must treat metadata as additive.'],
  },
  {
    name: 'AgentGatewaySnapshot',
    area: 'runtime',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/ZavorthAgentGateway.ts',
    sourceType: 'ZavorthAgentGatewaySnapshot',
    notes: ['Gateway observability snapshot; not a mutation API.'],
  },
  {
    name: 'ToolExposureProfile',
    area: 'tool',
    stability: 'stable',
    sourceModule: 'src/runtime/agent/UniversalAgentRuntimeTypes.ts',
    sourceType: 'UniversalToolExposureProfile',
    notes: ['Canonical tool exposure result after runtime policy.'],
  },
  {
    name: 'ToolExposurePolicyContractInput',
    area: 'tool',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/ToolExposurePolicy.ts',
    sourceType: 'ToolExposurePolicyInput',
    notes: ['Policy input is public for conformance tests, but policy internals remain private.'],
  },
  {
    name: 'PublicSkillSnapshot',
    area: 'skill',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/context/SkillSnapshotAssembler.ts',
    sourceType: 'SkillSnapshot',
    notes: ['Skill discovery snapshot for ecosystem surfaces; execution still goes through policy.'],
  },
  {
    name: 'PublicMcpCapabilitySnapshot',
    area: 'skill',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/context/McpSnapshotAssembler.ts',
    sourceType: 'McpContextSnapshot',
    notes: ['MCP capability snapshot for ecosystem surfaces; quarantined entries must stay gated.'],
  },
  {
    name: 'PublicToolSurfaceSnapshot',
    area: 'surface',
    stability: 'experimental',
    sourceModule: 'src/services/ZavorthToolSurfaceService.ts',
    sourceType: 'ZavorthToolSurfaceSnapshot',
    notes: ['Read-only surface snapshot for tool families and catalog visibility.'],
  },
  {
    name: 'AssembledAgentContext',
    area: 'surface',
    stability: 'experimental',
    sourceModule: 'src/runtime/agent/contracts/index.ts',
    sourceType: 'AssembledAgentContext',
    notes: ['Portable context envelope assembled from canonical hot, warm and cold context.'],
  },
] as const satisfies readonly PublicEcosystemContractDescriptor[];
