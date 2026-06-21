import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { PtySessionService } from '../../services/PtySessionService.js';

export class PtyTerminateTool extends BaseTool {
  public readonly name = 'workspace.pty.terminate';
  public readonly description = 'Terminates an active interactive PTY terminal session.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'Session ID' }
    },
    required: ['sessionId']
  };

  constructor(private ptySessionService: PtySessionService = PtySessionService.getInstance()) {
    super();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const workspaceRoot = WorkspaceResolver.resolve(process.cwd());
    const workspaceId = path.basename(workspaceRoot);
    const sessionId = args.sessionId as string;
    
    try {
      await this.ptySessionService.terminateSession(sessionId, workspaceId);
      return JSON.stringify({ success: true });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  }
}

