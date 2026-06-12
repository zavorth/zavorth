import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import path from 'path';
import { WorkspacePathGuard } from './WorkspacePathGuard.js';
import { SecurityAuditLogger } from '../../services/SecurityAuditLogger.js';
import { LogRepository } from '../../storage/LogRepository.js';

const workspaceRoot = process.env.ZAVORTH_WORKSPACE_ROOT;
const sessionId = process.env.ZAVORTH_WORKSPACE_SESSION_ID;

if (!workspaceRoot) {
  console.error('Error: ZAVORTH_WORKSPACE_ROOT environment variable is required.');
  process.exit(1);
}

if (!sessionId) {
  console.error('Error: ZAVORTH_WORKSPACE_SESSION_ID environment variable is required.');
  process.exit(1);
}

let pathGuard: WorkspacePathGuard;
try {
  pathGuard = new WorkspacePathGuard(workspaceRoot);
} catch (e: any) {
  console.error(`Failed to initialize path guard: ${e.message}`);
  process.exit(1);
}

const logRepo = new LogRepository();
logRepo.init().catch(() => {});
const auditLogger = new SecurityAuditLogger(logRepo);

const server = new Server(
  {
    name: 'zavorth-workspace-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd: pathGuard.getRoot(),
        shell: false,
        env: {
          PATH: process.env.PATH,
          GIT_TERMINAL_PROMPT: '0',
        },
        maxBuffer: 50 * 1024, // 50KB limit
      },
      (error, stdout, stderr) => {
        if (error) {
          const errMsg = stderr.trim() || stdout.trim() || error.message;
          reject(new Error(errMsg));
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'workspace.git.status',
        description: 'Shows the working tree status (run git status --porcelain)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'workspace.git.diff',
        description: 'Shows changes in the working tree (run git diff)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Optional path of the file to diff' },
          },
        },
      },
      {
        name: 'workspace.git.log',
        description: 'Shows git commit logs (run git log)',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of commits to list (default 10, max 50)' },
            file: { type: 'string', description: 'Optional path of the file to show log for' },
          },
        },
      },
      {
        name: 'workspace.git.branch',
        description: 'Lists branches (run git branch -a)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const params = request.params.arguments || {};

  try {
    if (toolName === 'workspace.git.status') {
      auditLogger.logWorkspaceEvent({
        event: 'workspace_git_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'git-status',
      });

      const output = await runGit(['status', '--porcelain']);
      return {
        content: [{ type: 'text', text: output || 'Working tree clean.' }],
      };
    }

    if (toolName === 'workspace.git.diff') {
      const gitArgs = ['diff'];
      let targetPath: string | undefined;

      if (params.file !== undefined) {
        if (typeof params.file !== 'string') {
          throw new Error('Argument "file" must be a string.');
        }
        const resolved = pathGuard.resolve(params.file);
        targetPath = resolved;
        const relative = path.relative(pathGuard.getRoot(), resolved);
        gitArgs.push('--', relative);
      }

      auditLogger.logWorkspaceEvent({
        event: 'workspace_git_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'git-diff',
        path: targetPath,
      });

      const output = await runGit(gitArgs);
      return {
        content: [{ type: 'text', text: output || 'No differences found.' }],
      };
    }

    if (toolName === 'workspace.git.log') {
      let limit = 10;
      if (params.limit !== undefined) {
        if (typeof params.limit !== 'number' || !Number.isFinite(params.limit) || !Number.isInteger(params.limit)) {
          throw new Error('Argument "limit" must be a finite integer.');
        }
        limit = Math.min(Math.max(params.limit, 1), 50);
      }
      const gitArgs = ['log', `-n`, String(limit), '--oneline'];
      let targetPath: string | undefined;

      if (params.file !== undefined) {
        if (typeof params.file !== 'string') {
          throw new Error('Argument "file" must be a string.');
        }
        const resolved = pathGuard.resolve(params.file);
        targetPath = resolved;
        const relative = path.relative(pathGuard.getRoot(), resolved);
        gitArgs.push('--', relative);
      }

      auditLogger.logWorkspaceEvent({
        event: 'workspace_git_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'git-log',
        path: targetPath,
      });

      const output = await runGit(gitArgs);
      return {
        content: [{ type: 'text', text: output || 'No commits found.' }],
      };
    }

    if (toolName === 'workspace.git.branch') {
      auditLogger.logWorkspaceEvent({
        event: 'workspace_git_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'git-branch',
      });

      const output = await runGit(['branch', '-a']);
      return {
        content: [{ type: 'text', text: output || 'No branches found.' }],
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error: any) {
    let msg = error.message;
    if (msg.includes('not a git repository')) {
      msg = 'Error: The workspace directory is not a Git repository.';
    }
    return {
      isError: true,
      content: [{ type: 'text', text: msg }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((error) => {
  console.error('Fatal error running workspace MCP server:', error);
  process.exit(1);
});
