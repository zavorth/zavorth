import fs from 'fs';
import path from 'path';
import { applyPatch, createTwoFilesPatch } from 'diff';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceFsPolicy } from './WorkspaceFsPolicy.js';

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
  public readonly description = 'Aplica patch unificado dentro do escopo de escrita do workspace e retorna diff auditavel.';
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      filepath: {
        type: 'string',
        description: 'Caminho relativo dentro do escopo de escrita do workspace.',
      },
      patch: {
        type: 'string',
        description: 'Patch unificado a aplicar ao arquivo.',
      },
      dryRun: {
        type: 'boolean',
        description: 'Quando true, valida e retorna diff sem gravar o arquivo.',
      },
    },
    required: ['filepath', 'patch'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
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
    } catch {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Por seguranca, patches so podem alterar arquivos dentro do escopo output/ do workspace.',
      });
    }

    if (!fs.existsSync(resolved.absolutePath) || !fs.statSync(resolved.absolutePath).isFile()) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: `Arquivo alvo nao encontrado: ${filepath}`,
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
    } catch {
      proposedContent = false;
    }
    if (proposedContent === false) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Patch invalido ou incompativel com o conteudo atual. Nenhum arquivo foi alterado.',
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
    if (!dryRun && audit.changed) {
      fs.writeFileSync(resolved.absolutePath, proposedContent, 'utf8');
    }

    return JSON.stringify({
      success: true,
      applied: !dryRun && audit.changed,
      dryRun,
      path: resolved.absolutePath,
      policy: {
        access: resolved.access,
        scope: resolved.scope,
      },
      audit,
    });
  }
}
