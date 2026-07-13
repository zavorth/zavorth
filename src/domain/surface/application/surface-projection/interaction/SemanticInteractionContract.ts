/**
 * F4 — Unified surface interaction events.
 * Button clicks, slash commands, CLI args, API choices → one semantic event.
 */

import type { AgentPermissionChoice } from '../../../../../contracts/permission/AgentPermissionContract.js';

export const SEMANTIC_INTERACTION_CONTRACT_VERSION = 'semantic-interaction/v1' as const;

export type SemanticInteractionKind =
  | 'callback'
  | 'slash'
  | 'command'
  | 'numbered_reply'
  | 'api_choice'
  | 'reaction'
  | 'voice'
  | 'unknown';

export type SemanticInteractionAction =
  | 'approve'
  | 'reject'
  | 'undo'
  | 'unknown';

export type SemanticInteractionEvent = {
  version: typeof SEMANTIC_INTERACTION_CONTRACT_VERSION;
  surface: string;
  kind: SemanticInteractionKind;
  /** Semantic control id when known (e.g. agent-permission-choices). */
  controlId: string | null;
  /** Option id when known (e.g. agent-perm-once or once). */
  optionId: string | null;
  approvalId: string | null;
  /** Normalized permission choice when applicable. */
  choice: AgentPermissionChoice | null;
  action: SemanticInteractionAction;
  raw: string;
  actorId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ParseSurfaceInteractionInput = {
  surface: string;
  raw: string;
  kindHint?: 'callback' | 'text' | 'api' | 'reaction' | 'voice' | 'auto';
  actorId?: string | null;
  sessionId?: string | null;
  /** Optional ordered option ids for numbered replies (1-based). */
  numberedOptions?: string[] | null;
  /** When kindHint is reaction (or raw is emoji), optional high-risk gate. */
  highRisk?: boolean;
  /** Profile for affordance gating (reactions / voice_reply). */
  profile?: import('../../surface-affordance/index.js').SurfaceProfile | null;
  metadata?: Record<string, unknown>;
};
