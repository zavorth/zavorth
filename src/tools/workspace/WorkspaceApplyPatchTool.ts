import fs from 'fs';
import path from 'path';
import { applyPatch, createTwoFilesPatch } from 'diff';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { DiskMutationGateService } from '../../services/DiskMutationGateService.js';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceFsPolicy } from './WorkspaceFsPolicy.js';
import { logger } from '../../logger.js';

type WorkspacePatchAudit = {
  changed: boolean;
  diffPatch: string;
  bytesBefore: number;
  bytesAfter: number;
};

function readString(value: unknown): string {
  return String(value ?? '').trim();
}

function buildDiff(filePath: string, before: string, after: string): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    before,
    after,
    'current',
    'proposed',
    { context: 3 },
  );
}

function buildAudit(filePath: string, before: string, after: string): WorkspacePatchAudit {
  return {
    changed: before !== after,
    diffPatch: buildDiff(filePath, before, after),
    bytesBefore: Buffer.byteLength(before, 'utf8'),
    bytesAfter: Buffer.byteLength(after, 'utf8'),
  };
}

export class WorkspaceApplyPatchTool extends BaseTool {
  public readonly name = 'workspace.apply_patch';
  public readonly description = 'Prepara patch unificado no workspace via Disk Mutation Gate; apply exige approval e receipt.';
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      filepath: {
        type: 'string',
        description: 'Caminho relativo dentro do escopo de escrita do workspace.',
      },
      patch: {
        type: 'string',
        description: 'Unified patch to apply to the file.',
      },
      dryRun: {
        type: 'boolean',
        description: 'Mantido por compatibilidade; o gate sempre retorna preview sem gravar antes do approval.',
      },
      previewId: {
        type: 'string',
        description: 'ID de preview gerado pelo Disk Mutation Gate para aplicar apos approval.',
      },
      approvalPhrase: {
        type: 'string',
        description: 'Frase exata de approval exigida pelo Disk Mutation Gate.',
      },
    },
    required: [],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const gate = new DiskMutationGateService();
    const previewId = readString(args.previewId);
    const approvalPhrase = String(args.approvalPhrase ?? '');
    if (previewId) {
      try {
        const result = gate.applyPreview({
          workspaceRoot: process.cwd(),
          previewId,
          approvalPhrase,
          approvedBy: readString(args.approvedBy) || 'workspace.apply_patch',
        });
        return JSON.stringify({
          success: true,
          applied: result.status === 'applied',
          approvalRequired: false,
          path: result.receipt.operations.map((operation) => operation.absolutePath),
          preview: result.preview,
          receipt: result.receipt,
        });
      } catch (error: any) {
    logger.warn('[Workspace Apply Patch] serialization failed', error);
    return JSON.stringify({
          success: false,
          applied: false,
          approvalRequired: true,
          error: error?.message || 'Falha ao aplicar preview pelo Disk Mutation Gate.',
        });
  }
    }

    const filepath = readString(args.filepath || args.filePath);
    const patch = String(args.patch ?? '');
    const dryRun = Boolean(args.dryRun);

    if (!filepath || !patch.trim()) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Parametros "filepath" e "patch" sao obrigatorios.',
      });
    }

    let resolved: ReturnType<WorkspaceFsPolicy['resolveApplyPatchPath']>;
    try {
      resolved = new WorkspaceFsPolicy().resolveApplyPatchPath(filepath);
    } catch (error: any) {
    logger.warn('[Workspace Apply Patch] serialization failed', error);
    return JSON.stringify({
        success: false,
        applied: false,
        error: 'For security, patches can only modify files inside the workspace output/ scope.',
      });
  }

    if (!fs.existsSync(resolved.absolutePath) || !fs.statSync(resolved.absolutePath).isFile()) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: `Target file not found: ${filepath}`,
        policy: {
          access: resolved.access,
          scope: resolved.scope,
        },
      });
    }

    const currentContent = fs.readFileSync(resolved.absolutePath, 'utf8');
    let proposedContent: string | false;
    try {
      proposedContent = applyPatch(currentContent, patch);
    } catch (error: any) {
    logger.warn('[Workspace Apply Patch] filesystem operation failed', error);
    proposedContent = false;
  }
    if (proposedContent === false) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Invalid patch or incompatible with current content. No file was changed.',
        policy: {
          access: resolved.access,
          scope: resolved.scope,
        },
        audit: {
          changed: false,
          diffPatch: '',
          bytesBefore: Buffer.byteLength(currentContent, 'utf8'),
          bytesAfter: Buffer.byteLength(currentContent, 'utf8'),
        },
      });
    }

    const audit = buildAudit(filepath, currentContent, proposedContent);
    const preview = gate.createPreview({
      workspaceRoot: process.cwd(),
      operations: [
        {
          kind: 'write_file',
          path: resolved.absolutePath,
          content: proposedContent,
          reason: 'workspace.apply_patch unified patch',
        },
      ],
      requestedBy: readString(args.requestedBy) || 'workspace.apply_patch',
      sourceSurface: 'tool:workspace.apply_patch',
    });

    return JSON.stringify({
      success: preview.status !== 'blocked',
      applied: false,
      dryRun,
      path: resolved.absolutePath,
      approvalRequired: preview.status === 'preview_ready',
      preview,
      policy: {
        access: resolved.access,
        scope: resolved.scope,
      },
      audit,
    });
  }
}
