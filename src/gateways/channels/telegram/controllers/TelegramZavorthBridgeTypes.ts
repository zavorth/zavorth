import { ZavorthBridgeWindowAutomator } from '../../../../agents/ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from '../../../../agents/ZavorthBridgeCompanionBridge.js';
import { AgentBridgeManager } from '../../../../orchestrator/AgentBridgeManager.js';

export type ZavorthBridgeWindowAutomatorLike = Pick<
  ZavorthBridgeWindowAutomator,
  | 'focusWindow'
  | 'approveVisibleStep'
  | 'pasteAndSubmit'
  | 'resetVisibleConversation'
  | 'ensureConversationSurface'
  | 'readLatestResponse'
  | 'captureWindow'
  | 'waitForPermissionPromptToClear'
>;

export type ZavorthBridgeCompanionBridgeLike = Pick<
  ZavorthBridgeCompanionBridge,
  | 'acceptStep'
  | 'closeAllEditors'
  | 'executeCommand'
  | 'isOnline'
  | 'openHandoff'
  | 'readStatus'
  | 'resetSession'
  | 'sendAgentPrompt'
  | 'startNewConversation'
  | 'syncPendingHandoffs'
>;

export type AgentBridgeManagerLike = Pick<AgentBridgeManager, 'listPendingSessions' | 'saveSession'>;

export type LiveBridgeSnapshot = {
  targetInstanceId?: string;
  capabilities: Record<string, boolean>;
  status: Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>>;
};
