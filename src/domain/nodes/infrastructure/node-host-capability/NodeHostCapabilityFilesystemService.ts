import fs from 'fs';
import path from 'path';
import type { NodeHostCapabilityRuntime, NodeHostExecutionResult } from './NodeHostCapabilityTypes.js';
import { buildScopeViolationResult, resolveAllowedPath } from './NodeHostCapabilityPathPolicy.js';
import { normalizeTimeout } from './NodeHostCapabilityExecutionHelpers.js';
import { logger } from '../../../../logger.js';
import { asErrorLike } from '../../../../utils/errorLike';

export class NodeHostCapabilityFilesystemService {
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly platform: NodeJS.Platform;
  private readonly allowedRoots: string[];
  private readonly now: () => Date;

  constructor(runtime: NodeHostCapabilityRuntime) {
    this.workspaceRoot = path.resolve(runtime.workspaceRoot || process.cwd());
    this.tempRoot = runtime.tempRoot
      ? path.resolve(runtime.tempRoot)
      : path.resolve(this.workspaceRoot, 'data', 'runtime', 'node-host');
    this.platform = runtime.platform || process.platform;
    this.allowedRoots = runtime.allowedRoots ? runtime.allowedRoots.map((entry) => path.resolve(entry)) : [this.workspaceRoot, this.tempRoot];
    this.now = runtime.now || (() => new Date());
  }

  public async readFileFromHost(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const rawTargetPath = String(payload?.path || payload?.filePath || '').trim();
    if (!rawTargetPath) {
      return {
        ok: false,
        resultSummary: 'files.read requires payload.path.',
        stdout: null,
        stderr: 'payload.path missing',
        exitCode: null,
        data: null,
      };
    }
    let targetPath: string;
    try {
      targetPath = resolveAllowedPath({
        targetPath: rawTargetPath,
        capabilityId: 'files.read',
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    } catch (error: unknown) {logger.warn('[Node Host Capability Filesystem] load operation failed', error);
    return buildScopeViolationResult({
        capabilityId: 'files.read',
        targetPath: rawTargetPath,
        error,
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
  }

    if (!fs.existsSync(targetPath)) {
      return {
        ok: false,
        resultSummary: 'Requested file does not exist on the node host.',
        stdout: null,
        stderr: `ENOENT: ${targetPath}`,
        exitCode: null,
        data: {
          path: targetPath,
        },
      };
    }

    const maxBytes = Math.max(128, Math.min(512 * 1024, Number(payload?.maxBytes || 16384) || 16384));
    const encoding = String(payload?.encoding || 'utf8').trim() || 'utf8';
    const buffer = fs.readFileSync(targetPath);
    const preview = buffer.subarray(0, Math.min(buffer.length, maxBytes));
    const looksBinary = preview.includes(0);

    return {
      ok: true,
      resultSummary: 'File read from the node host.',
      stdout: looksBinary ? null : preview.toString(encoding as BufferEncoding),
      stderr: null,
      exitCode: 0,
      data: {
        path: targetPath,
        bytesRead: preview.length,
        totalBytes: buffer.length,
        truncated: buffer.length > preview.length,
        encoding: looksBinary ? 'base64' : encoding,
        contentBase64: looksBinary ? preview.toString('base64') : null,
      },
    };
  }

  public async writeFileToHost(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const rawTargetPath = String(payload?.path || payload?.filePath || '').trim();
    if (!rawTargetPath) {
      return {
        ok: false,
        resultSummary: 'files.write requires payload.path.',
        stdout: null,
        stderr: 'payload.path missing',
        exitCode: null,
        data: null,
      };
    }

    let targetPath: string;
    try {
      targetPath = resolveAllowedPath({
        targetPath: rawTargetPath,
        capabilityId: 'files.write',
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    } catch (error: unknown) {logger.warn('[Node Host Capability Filesystem] load operation failed', error);
    return buildScopeViolationResult({
        capabilityId: 'files.write',
        targetPath: rawTargetPath,
        error,
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
  }
    const requestedMode = String(
      payload?.mode || (payload?.append === true ? 'append' : (payload?.overwrite === true ? 'overwrite' : 'create')),
    )
      .trim()
      .toLowerCase();
    const writeMode = requestedMode || 'create';
    const encoding = String(payload?.encoding || 'utf8').trim() || 'utf8';
    const hasBase64 = typeof payload?.contentBase64 === 'string' && String(payload.contentBase64).trim().length > 0;
    const hasTextContent = typeof payload?.content === 'string' || typeof payload?.text === 'string';
    const contentText = typeof payload?.content === 'string'
      ? String(payload.content)
      : typeof payload?.text === 'string'
        ? String(payload.text)
        : '';

    if (!['create', 'append', 'overwrite'].includes(writeMode)) {
      return {
        ok: false,
        resultSummary: 'files.write received an invalid mode.',
        stdout: null,
        stderr: `invalid mode: ${writeMode}`,
        exitCode: null,
        data: {
          path: targetPath,
          mode: writeMode,
        },
      };
    }

    if (!hasBase64 && !hasTextContent) {
      return {
        ok: false,
        resultSummary: 'files.write requires payload.content or payload.contentBase64.',
        stdout: null,
        stderr: 'payload.content missing',
        exitCode: null,
        data: {
          path: targetPath,
        },
      };
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      return {
        ok: false,
        resultSummary: 'The specified path points to a directory, not a file.',
        stdout: null,
        stderr: `EISDIR: ${targetPath}`,
        exitCode: null,
        data: {
          path: targetPath,
        },
      };
    }

    const buffer = hasBase64
      ? Buffer.from(String(payload?.contentBase64 || '').trim(), 'base64')
      : Buffer.from(contentText, encoding as BufferEncoding);
    const maxBytes = Math.max(256, Math.min(1024 * 1024, Number(payload?.maxBytes || 262144) || 262144));

    if (buffer.length > maxBytes) {
      return {
        ok: false,
        resultSummary: `files.write blocked a payload exceeding ${maxBytes} byte(s).`,
        stdout: null,
        stderr: `payload exceeds safe limit of ${maxBytes} byte(s)`,
        exitCode: null,
        data: {
          path: targetPath,
          bytes: buffer.length,
          maxBytes,
        },
      };
    }

    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });

    if (writeMode === 'create' && fs.existsSync(targetPath)) {
      return {
        ok: false,
        resultSummary: 'files.write refused to overwrite an existing file without explicit confirmation.',
        stdout: null,
        stderr: `EEXIST: ${targetPath}`,
        exitCode: null,
        data: {
          path: targetPath,
          mode: writeMode,
        },
      };
    }

    if (writeMode === 'append') {
      fs.appendFileSync(targetPath, buffer);
    } else {
      fs.writeFileSync(targetPath, buffer);
    }

    const stats = fs.statSync(targetPath);
    return {
      ok: true,
      resultSummary: `File written to the node host at ${targetPath}.`,
      stdout: null,
      stderr: null,
      exitCode: 0,
      data: {
        path: targetPath,
        mode: writeMode,
        bytesWritten: buffer.length,
        totalBytes: stats.size,
        encoding: hasBase64 ? 'base64' : encoding,
      },
    };
  }

  public async watchFilesFromHost(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const rawTargetPath = String(payload?.path || payload?.filePath || '').trim();
    if (!rawTargetPath) {
      return {
        ok: false,
        resultSummary: 'files.watch requires payload.path.',
        stdout: null,
        stderr: 'payload.path missing',
        exitCode: null,
        data: null,
      };
    }

    let targetPath: string;
    try {
      targetPath = resolveAllowedPath({
        targetPath: rawTargetPath,
        capabilityId: 'files.watch',
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    } catch (error: unknown) {logger.warn('[Node Host Capability Filesystem] load operation failed', error);
    return buildScopeViolationResult({
        capabilityId: 'files.watch',
        targetPath: rawTargetPath,
        error,
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
  }

    if (!fs.existsSync(targetPath)) {
      return {
        ok: false,
        resultSummary: 'Observed file or directory does not exist on the node host.',
        stdout: null,
        stderr: `ENOENT: ${targetPath}`,
        exitCode: null,
        data: {
          path: targetPath,
        },
      };
    }

    const timeoutMs = normalizeTimeout(payload?.timeoutMs, 5000);
    const recursive = Boolean(payload?.recursive);
    const stats = fs.statSync(targetPath);

    return await new Promise((resolve) => {
      const changes: Array<{ eventType: string; filename: string | null; detectedAt: string }> = [];
      let settled = false;
      let watcher: fs.FSWatcher | null = null;

      const finish = (result: Omit<NodeHostExecutionResult, 'invocationId'>): void => {
        if (settled) {
          return;
        }
        settled = true;
        try {
          watcher?.close();
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn("[auto-fix] Empty catch block", err); }
        resolve(result);
      };

      const timeout = setTimeout(() => {
        finish({
          ok: true,
          resultSummary: `No change observed at ${targetPath} within ${timeoutMs} ms.`,
          stdout: null,
          stderr: null,
          exitCode: 0,
          data: {
            path: targetPath,
            recursive,
            timeoutMs,
            idle: true,
            isDirectory: stats.isDirectory(),
            changes,
          },
        });
      }, timeoutMs);

      const cleanupAndFinish = (result: Omit<NodeHostExecutionResult, 'invocationId'>): void => {
        clearTimeout(timeout);
        finish(result);
      };

      try {
        watcher = fs.watch(targetPath, {
          recursive: recursive && this.platform === 'win32' && stats.isDirectory(),
        }, (eventType, filename) => {
          changes.push({
            eventType: String(eventType || 'change').trim() || 'change',
            filename: filename ? String(filename) : null,
            detectedAt: this.now().toISOString(),
          });
          cleanupAndFinish({
            ok: true,
            resultSummary: `Change observed em ${targetPath}.`,
            stdout: null,
            stderr: null,
            exitCode: 0,
            data: {
              path: targetPath,
              recursive,
              timeoutMs,
              idle: false,
              isDirectory: stats.isDirectory(),
              changes,
            },
          });
        });
        watcher.on('error', (error) => {
          cleanupAndFinish({
            ok: false,
            resultSummary: `Failed to observe ${targetPath}.`,
            stdout: null,
            stderr: error instanceof Error ? error.message : String(error || 'watch failed'),
            exitCode: null,
            data: {
              path: targetPath,
              recursive,
              timeoutMs,
            },
          });
        });
      } catch (error: unknown) {
        const err = asErrorLike(error);
        cleanupAndFinish({
          ok: false,
          resultSummary: `Failed to start observation em ${targetPath}.`,
          stdout: null,
          stderr: error instanceof Error ? err.message : String(error || 'watch failed'),
          exitCode: null,
          data: {
            path: targetPath,
            recursive,
            timeoutMs,
          },
        });
      }
    });
  }
}
