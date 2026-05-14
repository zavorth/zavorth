/**
 * Context Engine barrel export.
 *
 * Exposes ContextEngine, skill loading, episodic memory, and the explicit
 * LegacyUnifiedGatewayAdapter compatibility fallback.
 */

export { ContextEngine, type ContextEvent, type ContextWindow, type ContextEngineDecision } from './ContextEngine.js';
export {
  LegacyUnifiedGatewayAdapter,
  type LegacyGatewayIncomingEvent,
  type LegacyGatewayResult,
  type GatewayIncomingEvent,
  type GatewayResult,
} from './LegacyUnifiedGatewayAdapter.js';
export { SkillScanner, type SkillManifest } from './SkillScanner.js';
export { SkillLoader, type SkillLoadResult } from './SkillLoader.js';
export { EpisodicMemoryBridge, type EpisodicMemoryBridgeConfig, type ConsolidatedEpisode, type RecallResult } from './EpisodicMemoryBridge.js';

