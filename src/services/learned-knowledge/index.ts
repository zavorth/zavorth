/**
 * Learned Knowledge Plane — Zavorth-native composition entry (Phases 0–7).
 * Pillars: Workflows · Conversation recall · About you · Knowledge (Mnemos).
 */

export {
  resolveLearnedKnowledgeFlags,
  isLearnedKnowledgeEnabled,
  isContinuumCaptureEnabled,
  isUserModelEnabled,
  type LearnedKnowledgeFlags,
} from './LearnedKnowledgeFlags.js';

export {
  AboutYouService,
  formatAboutYouInject,
  type AboutYouSnapshot,
  type AboutYouFact,
  type AboutYouProposeInput,
} from './AboutYouService.js';

export {
  captureConversationTurn,
  recallConversations,
  formatConversationRecallLines,
  getConversationContinuum,
  resetConversationContinuumCache,
  redactConversationText,
  continuumBackendLabel,
  type CaptureConversationTurnInput,
  type ConversationRecallInput,
} from './ConversationContinuumCapture.js';

export {
  queryKnowledgeFacts,
  formatKnowledgeFactsLines,
  previewKnowledgeConsolidate,
  knowledgeWikiPresent,
  type KnowledgeFactsQueryInput,
  type KnowledgeFactsQueryResult,
  type KnowledgeConsolidatePreview,
} from './KnowledgeFactsRecall.js';

export {
  LearnedKnowledgePlaneService,
  buildLearnedKnowledgeInject,
  scoreLearnedKnowledgeIntent,
  equalPillarWeights,
  type LearnedKnowledgePack,
  type LearnedKnowledgePackInput,
  type LearnedKnowledgeHit,
  type LearnedKnowledgePillar,
} from './LearnedKnowledgePlaneService.js';

export {
  buildLearnedKnowledgeHub,
  type LearnedKnowledgeHubSnapshot,
  type LearnedKnowledgeHubCard,
  type LearnedKnowledgeStoryPreview,
} from './LearnedKnowledgeHub.js';

export {
  buildLearnedKnowledgeStory,
  type LearnedKnowledgeStoryEvent,
  type LearnedKnowledgeStorySnapshot,
} from './LearnedKnowledgeStoryService.js';

export {
  buildLearnedKnowledgeAdvanced,
  scanVaultInventory,
  type LearnedKnowledgeAdvancedStatus,
  type LearnedKnowledgeFileIndexStatus,
  type LearnedKnowledgeDreamCycleStatus,
} from './LearnedKnowledgeAdvanced.js';

export {
  dreamLastPreviewPath,
  readDreamLastPreview,
  writeDreamLastPreview,
  type DreamLastPreviewReceipt,
} from './LearnedKnowledgeDreamReceipt.js';

export {
  isPathInside,
  toPublicPath,
  safeRealpath,
} from './LearnedKnowledgePathSafety.js';

export {
  formatKnowledgeHomeReport,
  formatKnowledgeHomeReportFromHub,
} from './LearnedKnowledgeHomeReport.js';

export {
  resolveTenantPathMatrix,
  assertTenantPathsSafe,
  tenantStoreExists,
  wrapUntrustedLearnedKnowledge,
  emitKnowledgeTelemetry,
  forgetLearnedKnowledge,
  isPathInsideProject,
  type TenantPathMatrix,
  type ForgetPillarResult,
  type KnowledgeTelemetryEvent,
} from './LearnedKnowledgeSafety.js';
