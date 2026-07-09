import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { PtySessionService } from '../../services/PtySessionService.js';
import { PtyInputPolicyService } from '../../services/PtyInputPolicyService.js';
import { PtyInputApprovalService } from '../../services/PtyInputApprovalService.js';
import { HostPowerModeService } from '../../services/HostPowerModeService.js';
import { logger } from '../../logger.js';

export class PtyWriteTool extends BaseTool {
  public readonly name = 'workspace.pty.write';
  public readonly description = 'Writes input to an active interactive PTY terminal session. Governed by PtyInputPolicyService.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'Session ID' },
      input: { type: 'string', description: 'Input text' }
    },
    required: ['sessionId', 'input']
  };

  constructor(
    private ptySessionService: PtySessionService = PtySessionService.getInstance(),
    private ptyPolicyService: PtyInputPolicyService = new PtyInputPolicyService(undefined as any),
    private ptyInputApprovalService: PtyInputApprovalService = new PtyInputApprovalService(undefined as any),
    private hostPowerModeService: HostPowerModeService = HostPowerModeService.getInstance()
  ) {
    super();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const workspaceRoot = WorkspaceResolver.resolve(process.cwd());
    const workspaceId = path.basename(workspaceRoot);
    const sessionId = args.sessionId as string;
    const input = args.input as string;
    
    if (!this.ptySessionService.getIsAvailable()) {
      return JSON.stringify({ success: false, error: 'PTY_UNAVAILABLE' });
    }
    if (!this.hostPowerModeService.isHostPowerModeEnabled(workspaceId)) {
      return JSON.stringify({ success: false, error: 'Host Power Mode must be enabled.' });
    }

    const policy = this.ptyPolicyService.classifyInput(workspaceId, input, true, '');
    if (policy.blocked && policy.riskLevel !== 'CRITICAL') {
      return JSON.stringify({ success: false, error: "PTY input blocked: " + policy.blockReason });
    }
    if (policy.riskLevel === 'HIGH' || policy.riskLevel === 'CRITICAL') {
      const isApproved = await this.ptyInputApprovalService.consumeApprovedInputHash(workspaceId, sessionId, input);
      if (!isApproved) {
        if (policy.blocked && policy.riskLevel === 'CRITICAL' && !policy.strongConfirmationRequired) {
             return JSON.stringify({ success: false, error: 'PTY input blocked: ' + policy.blockReason });
        }
        const proposal = await this.ptyInputApprovalService.proposeInput(
          workspaceId, sessionId, input, policy.sanitizedInput, policy.riskLevel, policy.strongConfirmationRequired
        );
        return JSON.stringify({ success: true, status: 'PTY_INPUT_APPROVAL_REQUIRED', operationId: proposal.operationId, message: policy.riskLevel === 'CRITICAL' ? 'Requires explicit RUN' : 'Approval required' });
      }
    }

    try {
      await this.ptySessionService.write(sessionId, workspaceId, input);
      return JSON.stringify({ success: true });
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Pty Write] serialization failed', error);
    return JSON.stringify({ success: false, error: err.message });
  }
  }
}


