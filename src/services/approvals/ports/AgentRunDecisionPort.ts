import type { ApprovalCoordinatorGatewayPort } from '../ApprovalCoordinator.js';
import type { SurfaceDecisionReceipt } from '../SurfaceDecisionContract.js';
import type { SurfaceDecisionPort, SurfaceDecisionPortDecideInput } from '../SurfaceDecisionPort.js';

export type AgentRunDecisionGateway = Pick<
  ApprovalCoordinatorGatewayPort,
  'findPendingApproval' | 'approve' | 'reject'
>;

/**
 * Thin adapter over the existing agent-run gateway decision shape
 * (findPendingApproval + approve/reject), mirroring the port the approval
 * coordinator already consumes.
 */
export class AgentRunDecisionPort implements SurfaceDecisionPort {
  constructor(private readonly gateway: AgentRunDecisionGateway) {}

  public findPending(ref: string): boolean {
    return this.gateway.findPendingApproval(ref) !== null;
  }

  public async decide(input: SurfaceDecisionPortDecideInput): Promise<SurfaceDecisionReceipt> {
    if (input.choice === 'deny') {
      const rejected = await this.gateway.reject(input.ref);
      return {
        resolved: rejected != null,
        receiptText: rejected != null ? `Agent run ${input.ref} denied.` : null,
        decidedBy: 'operator',
        dismissals: [],
      };
    }
    const approved = await this.gateway.approve(input.ref, {
      choice: input.choice,
      surface: input.surface,
      sessionId: input.sessionId ?? null,
    });
    return {
      resolved: approved != null,
      receiptText: approved != null ? `Agent run ${input.ref} allowed (${input.choice}).` : null,
      decidedBy: 'operator',
      dismissals: [],
    };
  }
}
