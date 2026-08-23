import type { MessageChannel } from './PlatformContract.js';
import type { MessageTransportKind } from './IMessageBroker.js';

export type SurfaceApprovalDecisionAction = 'approve' | 'deny';

export type SurfaceApprovalDecisionScope = 'once' | 'session' | 'always';

export type SurfaceApprovalDecisionRequest = {
  platform: MessageChannel;
  chatId: string;
  userId: string;
  ref: string;
  action: SurfaceApprovalDecisionAction;
  scope?: SurfaceApprovalDecisionScope | null;
  isGroup?: boolean;
  channelId?: string | null;
  threadId?: string | null;
  messageId?: string | null;
  transport?: MessageTransportKind;
  reply: (text: string) => Promise<void>;
  editMessage?: (messageId: string, text: string) => Promise<void>;
};

export type SurfaceApprovalDecisionStatus = 'executed' | 'blocked' | 'boundary-unavailable';

export type SurfaceApprovalDecisionOutcome = {
  status: SurfaceApprovalDecisionStatus;
  action: SurfaceApprovalDecisionAction;
  ref: string;
  scope: SurfaceApprovalDecisionScope | null;
  replies: string[];
  reason: string | null;
};

/**
 * Broker capability for first-class surface approval decisions. Implementations
 * must run the same gate sequence a typed `/approve` / `/reject` message would
 * experience and delegate to the same approval spine, so receipts and error
 * semantics stay byte-identical across tap and typed ingress.
 */
export type SurfaceApprovalDecisionBroker = {
  resolveSurfaceApprovalDecision(
    request: SurfaceApprovalDecisionRequest,
  ): Promise<SurfaceApprovalDecisionOutcome>;
};

export function supportsSurfaceApprovalDecisions(broker: unknown): broker is SurfaceApprovalDecisionBroker {
  return (
    typeof (broker as SurfaceApprovalDecisionBroker | null | undefined)?.resolveSurfaceApprovalDecision ===
    'function'
  );
}
