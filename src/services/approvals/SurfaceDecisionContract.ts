/**
 * Single decision contract for every surface (telegram/discord/web/future):
 * one request shape, one choice vocabulary, one receipt any transport can
 * react to. Decision engines stay surface-specific behind ports; this file
 * only fixes the shared vocabulary.
 */

export type SurfaceDecisionChoice = 'once' | 'session' | 'always' | 'deny';

export type SurfaceDecisionType = 'task' | 'permission' | 'tool-runtime' | 'agent-run';

export const SURFACE_DECISION_TYPES: readonly SurfaceDecisionType[] = [
  'task',
  'permission',
  'tool-runtime',
  'agent-run',
] as const;

export interface SurfaceDecisionRequest {
  decisionType: SurfaceDecisionType;
  decisionRef: string;
  surface: string;
  chatId: string;
  sessionId?: string | null;
  userId?: string | null;
  title?: string | null;
  reason?: string | null;
  risk?: string | null;
}

export type SurfaceDecisionScopeMemory = {
  recorded: boolean;
  choice?: SurfaceDecisionChoice;
  expiresAt?: string | null;
};

/**
 * Cross-surface presenter retirement produced by the approval coordinator:
 * transports edit or follow up on those chats so stale prompts never linger.
 */
export type SurfaceDecisionDismissal = {
  surface: string;
  chatId: string;
  resolvedRefs: string[];
  promptMessageId?: string | null;
};

export interface SurfaceDecisionReceipt {
  resolved: boolean;
  receiptText: string | null;
  decidedBy: 'operator' | 'smart-advisor' | 'coalesced-follower';
  scopeMemory?: SurfaceDecisionScopeMemory;
  dismissals: SurfaceDecisionDismissal[];
}

export type SurfaceDecisionAccessGateInput = {
  userId: string | null;
};

export type SurfaceDecisionAccessGateResult = {
  allowed: boolean;
  reason?: string;
};
