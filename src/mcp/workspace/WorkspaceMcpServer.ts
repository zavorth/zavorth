import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import fs from 'fs';
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
      {
        name: 'workspace.filesystem.read',
        description: 'Reads the content of an existing file in the workspace (max 1MB, text only)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'The relative path of the file to read' },
          },
          required: ['file'],
        },
      },
      {
        name: 'workspace.filesystem.list',
        description: 'Lists contents of a directory in the workspace (prunes node_modules, .git, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Optional directory path relative to workspace root' },
          },
        },
      },
      {
        name: 'workspace.filesystem.search',
        description: 'Searches for files matching a query string in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The case-insensitive substring to search for (max 128 chars)' },
            directory: { type: 'string', description: 'Optional starting directory path relative to workspace root' },
          },
          required: ['query'],
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

    if (toolName === 'workspace.filesystem.read') {
      if (typeof params.file !== 'string') {
        throw new Error('Argument "file" must be a string.');
      }
      const resolved = pathGuard.resolveExisting(params.file);

      auditLogger.logWorkspaceEvent({
        event: 'workspace_filesystem_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'read-file',
        path: resolved,
      });

      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        throw new Error('Path is not a file.');
      }

      if (stat.size > 1024 * 1024) {
        throw new Error('File size exceeds maximum limit of 1MB.');
      }

      const buffer = fs.readFileSync(resolved);
      if (buffer.includes(0)) {
        throw new Error('Binary files are not allowed.');
      }

      const text = buffer.toString('utf8');
      return {
        content: [{ type: 'text', text }],
      };
    }

    if (toolName === 'workspace.filesystem.list') {
      const dirParam = params.directory;
      if (dirParam !== undefined && typeof dirParam !== 'string') {
        throw new Error('Argument "directory" must be a string.');
      }

      const resolved = pathGuard.resolveExisting(dirParam || '.');

      auditLogger.logWorkspaceEvent({
        event: 'workspace_filesystem_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'list-directory',
        path: resolved,
      });

      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory.');
      }

      const items = fs.readdirSync(resolved, { withFileTypes: true });
      const root = pathGuard.getRoot();
      const relativeDir = path.relative(root, resolved);

      const listOutput: { path: string; type: 'dir' | 'file' }[] = [];
      for (const item of items) {
        const itemRelative = relativeDir ? path.join(relativeDir, item.name) : item.name;
        const normalizedRelative = itemRelative.replace(/\\/g, '/');
        if (pathGuard.shouldPrune(normalizedRelative)) {
          continue;
        }
        const isDir = item.isDirectory();
        listOutput.push({
          path: normalizedRelative,
          type: isDir ? 'dir' : 'file',
        });
      }

      const sliced = listOutput.slice(0, 500);
      const lines = sliced.map(entry => {
        const prefix = entry.type === 'dir' ? '[DIR] ' : '[FILE]';
        return `${prefix} ${entry.path}`;
      });

      return {
        content: [{ type: 'text', text: lines.join('\n') || '(Directory empty)' }],
      };
    }

    if (toolName === 'workspace.filesystem.search') {
      const query = params.query;
      const dirParam = params.directory;

      if (typeof query !== 'string') {
        throw new Error('Argument "query" must be a string.');
      }
      if (query.length === 0) {
        throw new Error('Argument "query" cannot be empty.');
      }
      if (query.length > 128) {
        throw new Error('Argument "query" exceeds maximum length of 128 characters.');
      }
      if (dirParam !== undefined && typeof dirParam !== 'string') {
        throw new Error('Argument "directory" must be a string.');
      }

      const resolved = pathGuard.resolveExisting(dirParam || '.');

      auditLogger.logWorkspaceEvent({
        event: 'workspace_filesystem_read',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'search-files',
        path: resolved,
      });

      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory.');
      }

      const results: string[] = [];
      const visitedCount = { count: 0 };

      const searchDirectory = (currentDir: string, depth: number) => {
        if (depth > 20 || results.length >= 100 || visitedCount.count >= 5000) {
          return;
        }

        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (results.length >= 100 || visitedCount.count >= 5000) {
            return;
          }

          visitedCount.count++;

          const entryPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(pathGuard.getRoot(), entryPath).replace(/\\/g, '/');

          if (pathGuard.shouldPrune(relativePath)) {
            continue;
          }

          const lowerRelative = relativePath.toLowerCase();
          const lowerQuery = query.toLowerCase();
          if (lowerRelative.includes(lowerQuery)) {
            results.push(relativePath);
          }

          if (entry.isDirectory()) {
            searchDirectory(entryPath, depth + 1);
          }
        }
      };

      searchDirectory(resolved, 0);

      const searchRes = results.map(r => `[FOUND] ${r}`).join('\n');
      return {
        content: [{ type: 'text', text: searchRes || 'No matches found.' }],
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
