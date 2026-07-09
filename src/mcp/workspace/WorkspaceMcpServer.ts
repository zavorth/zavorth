import { logger } from '../../logger.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { WorkspacePathGuard } from './WorkspacePathGuard.js';
import { SecurityAuditLogger } from '../../services/SecurityAuditLogger.js';
import { LogRepository } from '../../storage/LogRepository.js';
import { WorkspaceWriteApprovalService } from '../../services/WorkspaceWriteApprovalService.js';
import { Database } from '../../storage/Database.js';
import { asErrorLike, errorMessage } from '../../utils/errorLike.js';

const workspaceRootEnv = process.env.ZAVORTH_WORKSPACE_ROOT;
const sessionId = process.env.ZAVORTH_WORKSPACE_SESSION_ID;

if (!workspaceRootEnv) {
  logger.error('Error: ZAVORTH_WORKSPACE_ROOT environment variable is required.');
  process.exit(1);
}

const workspaceRoot: string = workspaceRootEnv;

if (!sessionId) {
  logger.error('Error: ZAVORTH_WORKSPACE_SESSION_ID environment variable is required.');
  process.exit(1);
}

let pathGuard: WorkspacePathGuard;
try {
  pathGuard = new WorkspacePathGuard(workspaceRoot);
} catch (error: unknown) { const err = asErrorLike(error); const e = err;
  logger.error(`Failed to initialize path guard: ${err.message}`);
  process.exit(1);
}

const logRepo = new LogRepository();
logRepo.init().catch((err) => { logger.warn('Failed to initialize log repository:', err); });
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
      {
        name: 'workspace.filesystem.write',
        description: 'Creates a new file or overwrites an existing file in the workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative path of the target file' },
            content: { type: 'string', description: 'Text content to write' },
            operationId: { type: 'string', description: 'The approved operation ID required for retries' },
          },
          required: ['file', 'content'],
        },
      },
      {
        name: 'workspace.filesystem.mkdir',
        description: 'Creates a directory in the workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Relative path of the directory' },
            operationId: { type: 'string', description: 'The approved operation ID required for retries' },
          },
          required: ['directory'],
        },
      },
    ],
  };
});

let approvalService: WorkspaceWriteApprovalService | undefined;
const getApprovalService = async (): Promise<WorkspaceWriteApprovalService> => {
  if (!approvalService) {
    const dbInstance = await Database.getInstance();
    approvalService = new WorkspaceWriteApprovalService(dbInstance, auditLogger);
  }
  return approvalService;
};

function resolveAndValidatePathForMcp(
  inputPath: string,
  operation: 'filesystem.read' | 'filesystem.write' | 'filesystem.mkdir'
): { resolved: string; bypassApproval: boolean } {
  try {
    const resolved = operation === 'filesystem.read'
      ? pathGuard.resolveExisting(inputPath)
      : pathGuard.resolveForWrite(inputPath);
    return { resolved, bypassApproval: false };
  } catch (error: unknown) { const err = asErrorLike(error); const e = err;
    if (err.message.includes('Access to sensitive file') || err.message.includes('Access to Git metadata directory')) {
      throw err;
    }

    const targetPath = path.resolve(workspaceRoot, inputPath);

    let realTarget: string;
    if (fs.existsSync(targetPath)) {
      realTarget = fs.realpathSync(targetPath);
    } else {
      let current = targetPath;
      let parent = path.dirname(current);
      while (parent !== current && !fs.existsSync(parent)) {
        current = parent;
        parent = path.dirname(current);
      }
      const realParent = fs.realpathSync(parent);
      realTarget = path.join(realParent, path.relative(parent, targetPath));
    }

    const checkBlocklist = (p: string) => {
      const filename = path.basename(p).toLowerCase();
      if (
        filename === '.env' ||
        filename.includes('.env.') ||
        filename.endsWith('.pem') ||
        filename.endsWith('.key') ||
        filename === 'id_rsa' ||
        filename === 'id_dsa' ||
        filename === 'credentials.json'
      ) {
        throw new Error(`Access to sensitive file "${filename}" is blocked.`);
      }
      const parts = p.replace(/\\/g, '/').toLowerCase().split('/');
      if (parts.includes('.git')) {
        throw new Error('Access to Git metadata directory is blocked.');
      }
    };

    checkBlocklist(targetPath);
    checkBlocklist(realTarget);

    const { TemporaryDirectoryTrustService } = require('../../services/TemporaryDirectoryTrustService.js');
    const tmpTrustService = TemporaryDirectoryTrustService.getInstance();
    const checkResult = tmpTrustService.checkPathAccess(sessionId, workspaceRoot, realTarget, operation);

    if (checkResult.allowed) {
      return { resolved: realTarget, bypassApproval: true };
    }

    if (checkResult.mandateViolation) {
      throw new Error(`Blocked: Task Mandate scope violation. ${checkResult.reason}`);
    }

    throw err;
  }
}

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
      const { resolved } = resolveAndValidatePathForMcp(params.file, 'filesystem.read');

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
        } catch (readErr: unknown) {logger.warn(`Failed to read directory ${currentDir}: ${readErr}`);
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

    if (toolName === 'workspace.filesystem.write') {
      if (typeof params.file !== 'string') {
        throw new Error('Argument "file" must be a string.');
      }
      if (typeof params.content !== 'string') {
        throw new Error('Argument "content" must be a string.');
      }
      if (params.content.length > 256 * 1024) {
        throw new Error('Content exceeds maximum limit of 256KB.');
      }
      if (params.content.includes('\x00')) {
        throw new Error('Binary content is not allowed.');
      }

      const { resolved, bypassApproval: trustBypass } = resolveAndValidatePathForMcp(params.file, 'filesystem.write');

      // Parent directory must exist
      const parentDir = path.dirname(resolved);
      if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
        throw new Error('Parent directory does not exist.');
      }

      const service = await getApprovalService();

      const { WorkspaceTaskMandateService } = await import('../../services/WorkspaceTaskMandateService.js');
      const mandateService = WorkspaceTaskMandateService.getInstance();
      const activeMandate = mandateService.getActiveMandate(sessionId);
      let bypassApproval = trustBypass;

      if (!bypassApproval && activeMandate) {
        const checkResult = mandateService.checkWriteApproval(sessionId, workspaceRoot, resolved, 'filesystem.write');
        if (checkResult.allowed) {
          bypassApproval = true;
        }
      }

      if (!bypassApproval && params.operationId === undefined) {
        // First phase: request approval
        const operationId = await service.requestApproval(sessionId, toolName, resolved, params);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'WRITE_APPROVAL_REQUIRED',
              operationId,
              pathSuffix: path.extname(resolved) || path.basename(resolved),
            })
          }],
          isError: true,
        };
      }

      if (!bypassApproval) {
        // If operationId is provided, consume it
        if (typeof params.operationId !== 'string') {
          throw new Error('Argument "operationId" must be a string.');
        }

        const consumed = await service.consumeApproval(sessionId, toolName, resolved, params, params.operationId);
        if (!consumed) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'WRITE_APPROVAL_EXPIRED',
                message: 'Write approval has expired or is invalid.'
              })
            }]
          };
        }
      }

      // Atomic Write logic:
      // temp file inside the same directory: .<basename>.zavorth-write-<operationId>.tmp
      const basename = path.basename(resolved);
      const tempFile = path.join(parentDir, `.${basename}.zavorth-write-${params.operationId}.tmp`);

      try {
        // Write to temp file with 'wx' flag (create exclusive)
        fs.writeFileSync(tempFile, params.content, { flag: 'wx', encoding: 'utf8' });
        // Atomic rename
        fs.renameSync(tempFile, resolved);
      } catch (writeError: unknown) {// Cleanup temp file if it exists
        if (fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanupError: unknown) {logger.warn(`Failed to cleanup temp file ${tempFile}: ${errorMessage(cleanupError)}`);
          }
        }
        throw writeError;
      }

      // Log success
      auditLogger.logWorkspaceEvent({
        event: 'workspace_filesystem_write',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'write-file',
        path: resolved,
      });

      return {
        content: [{ type: 'text', text: 'File written successfully.' }],
      };
    }

    if (toolName === 'workspace.filesystem.mkdir') {
      if (typeof params.directory !== 'string') {
        throw new Error('Argument "directory" must be a string.');
      }

      const { resolved, bypassApproval: trustBypass } = resolveAndValidatePathForMcp(params.directory, 'filesystem.mkdir');

      // Target path must not exist
      if (fs.existsSync(resolved)) {
        throw new Error('Target path already exists.');
      }

      // No recursive creation: parent must exist
      const parentDir = path.dirname(resolved);
      if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
        throw new Error('Parent directory does not exist.');
      }

      const service = await getApprovalService();

      const { WorkspaceTaskMandateService } = await import('../../services/WorkspaceTaskMandateService.js');
      const mandateService = WorkspaceTaskMandateService.getInstance();
      const activeMandate = mandateService.getActiveMandate(sessionId);
      let bypassApproval = trustBypass;

      if (!bypassApproval && activeMandate) {
        const checkResult = mandateService.checkWriteApproval(sessionId, workspaceRoot, resolved, 'filesystem.mkdir');
        if (checkResult.allowed) {
          bypassApproval = true;
        }
      }

      if (!bypassApproval && params.operationId === undefined) {
        // First phase: request approval
        const operationId = await service.requestApproval(sessionId, toolName, resolved, params);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'WRITE_APPROVAL_REQUIRED',
              operationId,
              pathSuffix: path.extname(resolved) || path.basename(resolved),
            })
          }],
          isError: true,
        };
      }

      if (!bypassApproval) {
        // If operationId is provided, consume it
        if (typeof params.operationId !== 'string') {
          throw new Error('Argument "operationId" must be a string.');
        }

        const consumed = await service.consumeApproval(sessionId, toolName, resolved, params, params.operationId);
        if (!consumed) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'WRITE_APPROVAL_EXPIRED',
                message: 'Write approval has expired or is invalid.'
              })
            }]
          };
        }
      }

      // Create the directory
      fs.mkdirSync(resolved, { recursive: false });

      // Log success
      auditLogger.logWorkspaceEvent({
        event: 'workspace_filesystem_write',
        workspaceId: sessionId,
        rootPath: workspaceRoot,
        toolName,
        operation: 'create-directory',
        path: resolved,
      });

      return {
        content: [{ type: 'text', text: 'Directory created successfully.' }],
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error: unknown) { const err = asErrorLike(error); const e = err;
    let msg = err.message;
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
  logger.error('Fatal error running workspace MCP server:', error);
  process.exit(1);
});
