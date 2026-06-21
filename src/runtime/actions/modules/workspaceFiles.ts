import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createTwoFilesPatch } from 'diff';
import { WorkspaceFsPolicy } from '../../../tools/workspace/WorkspaceFsPolicy.js';
import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';

const CAPABILITY_ID = 'workspace-files';
const TEST_REFS = [
  'tests/runtime/actions/ZavorthActionHarness.test.ts',
  'tests/cli/ZavorthActionHarnessCommand.test.ts',
];
const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

function block(input: ZavorthActionHandlerInput, summary: string, lines: string[] = [], data?: Record<string, unknown>): ZavorthActionResult {
  return result({
    ok: false,
    actionId: input.actionId,
    operation: input.operation,
    status: 'blocked',
    summary,
    lines: lines.length ? lines : [summary],
    data,
  });
}

function policy(root: string): WorkspaceFsPolicy {
  return new WorkspaceFsPolicy({
    workspaceRoot: root,
    writeRoot: path.join(root, 'output'),
  });
}

function normalizeRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).replace(/\\/g, '/') || '.';
}

function isSensitiveName(name: string): boolean {
  const basename = path.basename(name).toLowerCase();
  return basename === '.env'
    || basename.startsWith('.env.')
    || basename === '.npmrc'
    || basename === 'credentials'
    || basename === 'credentials.json'
    || basename === 'secrets.json'
    || /\.(pem|key|p12|pfx|kubeconfig)$/iu.test(basename)
    || /(^|[-_.])(secret|token|credential|private-key)([-_.]|$)/iu.test(basename);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

async function workspaceReadFile(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const filePath = text(input.args.filepath || input.args.path);
  if (!filePath) return block(input, 'Missing file path.', ['Provide args.filepath.']);
  try {
    const resolved = policy(input.root).resolveReadPath(filePath);
    const content = await fsp.readFile(resolved.absolutePath, 'utf8');
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `Read ${normalizeRelative(resolved.root, resolved.absolutePath)}.`,
      lines: content.split(/\r?\n/u).slice(0, 80),
      data: { filepath: normalizeRelative(resolved.root, resolved.absolutePath), content },
    });
  } catch (error) {
    return block(input, 'Read blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

async function workspaceListDirectory(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const dirPath = text(input.args.dirpath || input.args.path, '.');
  try {
    const resolved = policy(input.root).resolveListPath(dirPath);
    const entries = await fsp.readdir(resolved.absolutePath, { withFileTypes: true });
    const visible = entries
      .filter((entry) => !isSensitiveName(entry.name))
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        path: normalizeRelative(resolved.root, path.join(resolved.absolutePath, entry.name)),
      }));
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `Listed ${visible.length} entries.`,
      lines: visible.map((entry) => `${entry.type}: ${entry.path}`),
      data: { dirpath: normalizeRelative(resolved.root, resolved.absolutePath), entries: visible },
    });
  } catch (error) {
    return block(input, 'List directory blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

async function workspaceSearchFiles(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const query = text(input.args.query || input.args.pattern);
  const dirPath = text(input.args.dirpath || input.args.path, '.');
  const maxResults = Math.max(1, Math.min(Number(input.args.maxResults || input.args.limit || 50), 200));
  if (!query) return block(input, 'Missing search query.', ['Provide args.query.']);
  try {
    const resolved = policy(input.root).resolveListPath(dirPath);
    const matches: Array<{ filepath: string; line: number; text: string }> = [];
    async function walk(dir: string): Promise<void> {
      if (matches.length >= maxResults) return;
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxResults || isSensitiveName(entry.name)) continue;
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute);
          continue;
        }
        if (!entry.isFile()) continue;
        const read = policy(input.root).resolveReadPath(normalizeRelative(input.root, absolute));
        const content = await fsp.readFile(read.absolutePath, 'utf8').catch(() => '');
        const lines = content.split(/\r?\n/u);
        for (let index = 0; index < lines.length && matches.length < maxResults; index += 1) {
          if (lines[index].toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              filepath: normalizeRelative(input.root, read.absolutePath),
              line: index + 1,
              text: lines[index],
            });
          }
        }
      }
    }
    await walk(resolved.absolutePath);
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `Found ${matches.length} match(es).`,
      lines: matches.map((match) => `${match.filepath}:${match.line}: ${match.text}`),
      data: { query, matches },
    });
  } catch (error) {
    return block(input, 'Search blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

async function workspaceCreateFile(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const filePath = text(input.args.filepath || input.args.path);
  const content = String(input.args.content ?? '');
  if (!filePath) return block(input, 'Missing file path.', ['Provide args.filepath.']);
  try {
    const resolved = policy(input.root).resolveWritePath(filePath);
    if (await exists(resolved.absolutePath)) {
      return block(input, 'Create file refused because target already exists.', ['Use workspace.write_file with explicit overwrite instead.']);
    }
    if (input.operation === 'action.preview') {
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: 'preview',
        summary: `Preview create ${normalizeRelative(resolved.root, resolved.absolutePath)}.`,
        lines: ['Preview only. No file was written.', `Bytes: ${Buffer.byteLength(content, 'utf8')}`],
        data: { filepath: normalizeRelative(resolved.root, resolved.absolutePath), bytes: Buffer.byteLength(content, 'utf8') },
      });
    }
    if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
    await fsp.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
    await fsp.writeFile(resolved.absolutePath, content, 'utf8');
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Created ${normalizeRelative(resolved.root, resolved.absolutePath)}.`,
      lines: [`Wrote ${Buffer.byteLength(content, 'utf8')} bytes.`],
      data: { filepath: normalizeRelative(resolved.root, resolved.absolutePath), bytes: Buffer.byteLength(content, 'utf8') },
    });
  } catch (error) {
    return block(input, 'Create file blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

async function workspaceDiffFile(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const filePath = text(input.args.filepath || input.args.path);
  const nextContent = String(input.args.content ?? input.args.nextContent ?? '');
  if (!filePath) return block(input, 'Missing file path.', ['Provide args.filepath.']);
  try {
    const resolved = policy(input.root).resolveEditPath(filePath);
    const previous = await fsp.readFile(resolved.absolutePath, 'utf8').catch(() => '');
    const relative = normalizeRelative(resolved.root, resolved.absolutePath);
    const diff = createTwoFilesPatch(relative, relative, previous, nextContent, 'current', 'next');
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Generated diff for ${relative}.`,
      lines: diff.split(/\r?\n/u).slice(0, 120),
      data: { filepath: relative, diff },
    });
  } catch (error) {
    return block(input, 'Diff blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

async function workspaceWriteFile(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const filePath = text(input.args.filepath || input.args.path);
  const content = String(input.args.content ?? '');
  const overwrite = bool(input.args.overwrite);
  if (!filePath) return block(input, 'Missing file path.', ['Provide args.filepath.']);
  try {
    const resolved = policy(input.root).resolveEditPath(filePath);
    const existed = await exists(resolved.absolutePath);
    if (existed && !overwrite) return block(input, 'Write refused because target exists and overwrite is false.', ['Set overwrite=true after reviewing preview.']);
    if (input.operation === 'action.preview') {
      const previous = existed ? await fsp.readFile(resolved.absolutePath, 'utf8').catch(() => '') : '';
      const relative = normalizeRelative(resolved.root, resolved.absolutePath);
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: 'preview',
        summary: `Preview write ${relative}.`,
        lines: createTwoFilesPatch(relative, relative, previous, content, 'current', 'next').split(/\r?\n/u).slice(0, 120),
        data: { filepath: relative, existed, overwrite, bytes: Buffer.byteLength(content, 'utf8') },
      });
    }
    if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
    await fsp.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
    await fsp.writeFile(resolved.absolutePath, content, 'utf8');
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Wrote ${normalizeRelative(resolved.root, resolved.absolutePath)}.`,
      lines: [`Wrote ${Buffer.byteLength(content, 'utf8')} bytes.`],
      data: { filepath: normalizeRelative(resolved.root, resolved.absolutePath), existed, overwrite },
    });
  } catch (error) {
    return block(input, 'Write file blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

async function workspacePatchFile(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const filePath = text(input.args.filepath || input.args.path);
  const search = String(input.args.search ?? '');
  const replace = String(input.args.replace ?? '');
  if (!filePath || !search) return block(input, 'Missing patch input.', ['Provide args.filepath and args.search.']);
  try {
    const resolved = policy(input.root).resolveApplyPatchPath(filePath);
    const previous = await fsp.readFile(resolved.absolutePath, 'utf8');
    if (!previous.includes(search)) return block(input, 'Patch search text was not found.', ['No file was changed.']);
    const next = previous.replace(search, replace);
    const relative = normalizeRelative(resolved.root, resolved.absolutePath);
    if (input.operation === 'action.preview') {
      const diff = createTwoFilesPatch(relative, relative, previous, next, 'current', 'next');
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: 'preview',
        summary: `Preview patch ${relative}.`,
        lines: diff.split(/\r?\n/u).slice(0, 120),
        data: { filepath: relative, diff },
      });
    }
    if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
    await fsp.writeFile(resolved.absolutePath, next, 'utf8');
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Patched ${relative}.`,
      lines: ['Replaced first matching block.'],
      data: { filepath: relative },
    });
  } catch (error) {
    return block(input, 'Patch file blocked by workspace policy.', [error instanceof Error ? error.message : String(error)]);
  }
}

function action(input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>): ZavorthActionDefinition {
  return {
    ...input,
    capabilityId: CAPABILITY_ID,
    verificationStatus: 'verified',
    surface: SURFACE,
    testRefs: TEST_REFS,
  };
}

export function createWorkspaceFilesActionModule(): ZavorthActionModule {
  return {
    id: CAPABILITY_ID,
    manifestId: 'workspace-files',
    actions: [
      action({
        id: 'workspace.read_file',
        title: 'Read workspace file',
        description: 'Read a non-sensitive file inside the workspace.',
        aliases: ['read_file', 'ler arquivo', 'workspace read file'],
        domains: ['workspace', 'files'],
        risk: 'safe',
        effects: ['read'],
        scope: 'workspace',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: { filepath: { type: 'string' } }, required: ['filepath'] },
        outputSchema,
        handler: workspaceReadFile,
      }),
      action({
        id: 'workspace.list_directory',
        title: 'List workspace directory',
        description: 'List non-sensitive entries inside a workspace directory.',
        aliases: ['list_directory', 'ls workspace', 'listar diretorio'],
        domains: ['workspace', 'files'],
        risk: 'safe',
        effects: ['read'],
        scope: 'workspace',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: { dirpath: { type: 'string' } } },
        outputSchema,
        handler: workspaceListDirectory,
      }),
      action({
        id: 'workspace.search_files',
        title: 'Search workspace files',
        description: 'Search non-sensitive workspace files for text.',
        aliases: ['search_files', 'buscar arquivos', 'grep workspace'],
        domains: ['workspace', 'files', 'search'],
        risk: 'safe',
        effects: ['read'],
        scope: 'workspace',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, dirpath: { type: 'string' } }, required: ['query'] },
        outputSchema,
        handler: workspaceSearchFiles,
      }),
      action({
        id: 'workspace.diff_file',
        title: 'Diff workspace file',
        description: 'Generate a diff for a proposed workspace output file change without mutating files.',
        aliases: ['diff_file', 'diff workspace'],
        domains: ['workspace', 'files', 'diff'],
        risk: 'safe',
        effects: ['read'],
        scope: 'workspace_output',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: { filepath: { type: 'string' }, content: { type: 'string' } }, required: ['filepath', 'content'] },
        outputSchema,
        handler: workspaceDiffFile,
      }),
      action({
        id: 'workspace.create_file',
        title: 'Create workspace output file',
        description: 'Create a new file under the governed workspace output directory.',
        aliases: ['create_file', 'criar arquivo'],
        domains: ['workspace', 'files'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'workspace_output',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: { type: 'object', properties: { filepath: { type: 'string' }, content: { type: 'string' } }, required: ['filepath', 'content'] },
        outputSchema,
        handler: workspaceCreateFile,
      }),
      action({
        id: 'workspace.write_file',
        title: 'Write workspace output file',
        description: 'Write file content under the governed workspace output directory with explicit overwrite.',
        aliases: ['write_file', 'escrever arquivo'],
        domains: ['workspace', 'files'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'workspace_output',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: { type: 'object', properties: { filepath: { type: 'string' }, content: { type: 'string' }, overwrite: { type: 'boolean' } }, required: ['filepath', 'content'] },
        outputSchema,
        handler: workspaceWriteFile,
      }),
      action({
        id: 'workspace.patch_file',
        title: 'Patch workspace output file',
        description: 'Patch an existing file under the governed workspace output directory.',
        aliases: ['patch_file', 'aplicar patch'],
        domains: ['workspace', 'files', 'patch'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'workspace_output',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: { type: 'object', properties: { filepath: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' } }, required: ['filepath', 'search'] },
        outputSchema,
        handler: workspacePatchFile,
      }),
    ],
  };
}
