import type { CapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import type { InternalControlPlaneApiService } from '../api/internal/InternalControlPlaneApiService.js';
import type { ZavorthProactivePermissionService } from './ZavorthProactivePermissionService.js';
import type { EchoExecutionBoundaryService } from '../domain/execution/infrastructure/ExecutionBoundaryService.js';
import type { EchoExecutionLedgerService } from '../domain/execution/infrastructure/EchoExecutionLedgerService.js';
import type { EchoPendingExecutionStoreService } from '../domain/execution/infrastructure/EchoPendingExecutionStoreService.js';
import type { EchoVoiceTelemetryService } from '../domain/observability/infrastructure/EchoVoiceTelemetryService.js';
import type { EchoCapabilitySurfaceStateService } from '../domain/platform-ecosystem/application/EchoCapabilitySurfaceStateService.js';
import type { EchoSpeechSynthesisService } from '../domain/surface/application/EchoSpeechSynthesisService.js';
import type { ZavorthWatchModeControlPlaneService } from './ZavorthWatchModeControlPlaneService.js';
import type { GeminiVoiceService } from '../providers/GeminiVoiceService.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';
import type { ToolCategory } from '../tool-runtime/types/IZavorthTool.js';
import type { EchoToolCall } from '../tool-runtime/types/EchoTypes.js';

export type EchoSurfaceOptions = {
  category?: ToolCategory;
  sessionId?: string;
  requestedBy?: string;
  surface?: string;
};

export type NormalizedEchoSurfaceOptions = {
  category?: ToolCategory;
  sessionId: string;
  requestedBy: string;
  surface: string;
};

export type ZavorthEchoRuntime = {
  llmProvider?: string;
  llmFallbackOrder?: string[];
  permissionService?: ZavorthProactivePermissionService;
  pendingExecutionStore?: EchoPendingExecutionStoreService;
  executionBoundary?: EchoExecutionBoundaryService;
  executionLedger?: EchoExecutionLedgerService;
  voiceTelemetry?: EchoVoiceTelemetryService;
  geminiVoiceService?: Pick<GeminiVoiceService, 'isConfigured' | 'synthesizeDetailed' | 'cleanup'>;
  speechSynthesisService?: Pick<EchoSpeechSynthesisService, 'synthesize'>;
  capabilityRegistry?: CapabilityRegistry;
  capabilitySurfaceState?: EchoCapabilitySurfaceStateService;
  controlPlaneApi?: InternalControlPlaneApiService;
  watchModeControlPlane?: Pick<ZavorthWatchModeControlPlaneService, 'buildSnapshot'>;
};

export type ToolExecutionTrace = {
  toolCall: EchoToolCall;
  inlineData?: ChatMessage['inlineData'];
};
