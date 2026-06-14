import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { PtySessionApprovalService } from '../../services/PtySessionApprovalService.js';
import { PtyInputPolicyService } from '../../services/PtyInputPolicyService.js';
import { HostPowerModeService } from '../../services/HostPowerModeService.js';
import { SecurityAuditLogger } from '../../services/SecurityAuditLogger.js';
import { PtySessionService } from '../../services/PtySessionService.js';
import { LogRepository } from '../../storage/LogRepository.js';

export class PtySessionProposeTool extends BaseTool {
  public readonly name = 'workspace.pty.propose';
  public readonly description = 'Propose a new interactive PTY terminal session.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      shell: { type: 'string', description: 'The shell to execute (e.g., bash, powershell)' },
      cwd: { type: 'string', description: 'The working directory for the PTY session' },
      reason: { type: 'string', description: 'Reason for creating the session' }
    },
    required: ['shell', 'cwd', 'reason']
  };

  constructor(
    private ptyApprovalService: PtySessionApprovalService = new PtySessionApprovalService(undefined as any),
    private ptyPolicyService: PtyInputPolicyService = new PtyInputPolicyService(),
    private hostPowerModeService: HostPowerModeService = HostPowerModeService.getInstance(),
    private logger: SecurityAuditLogger = new SecurityAuditLogger(new LogRepository()),
    private ptySessionService: PtySessionService = PtySessionService.getInstance()
  ) {
    super();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const workspaceRoot = WorkspaceResolver.resolve(process.cwd());
    const workspaceId = path.basename(workspaceRoot);
    
    if (!this.hostPowerModeService.isHostPowerModeEnabled(workspaceId)) {
      return JSON.stringify({ success: false, error: 'Host Power Mode must be enabled.' });
    }

    try {
      const proposal = await this.ptyApprovalService.proposeSession(
        workspaceId,
        args.shell as string,
        args.cwd as string,
        'HIGH',
        args.reason as string
      );
      this.ptySessionService.registerPendingSession(proposal.sessionId, args.cwd as string, args.shell as string);
      return JSON.stringify({ success: true, status: 'PTY_APPROVAL_REQUIRED', sessionId: proposal.sessionId });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  }
}

