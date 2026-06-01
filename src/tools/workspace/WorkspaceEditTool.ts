import fs from 'fs';
import { createTwoFilesPatch } from 'diff';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { DiskMutationGateService } from '../../services/DiskMutationGateService.js';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceFsPolicy } from './WorkspaceFsPolicy.js';

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

export class WorkspaceEditTool extends BaseTool {
  public readonly name = 'workspace.edit';
  public readonly description = 'Prepara edicao de arquivo no workspace por substituicao exata via Disk Mutation Gate; apply exige approval e receipt.';
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      filepath: {
        type: 'string',
        description: 'Caminho relativo dentro do escopo de escrita do workspace.',
      },
      search: {
        type: 'string',
        description: 'Trecho exato que deve existir no arquivo.',
      },
      replace: {
        type: 'string',
        description: 'Trecho que substituira o valor encontrado.',
      },
      replaceAll: {
        type: 'boolean',
        description: 'Quando true, substitui todas as ocorrencias.',
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
          approvedBy: readString(args.approvedBy) || 'workspace.edit',
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
        return JSON.stringify({
          success: false,
          applied: false,
          approvalRequired: true,
          error: error?.message || 'Falha ao aplicar preview pelo Disk Mutation Gate.',
        });
      }
    }

    const filepath = readString(args.filepath || args.filePath);
    const search = String(args.search ?? '');
    const replacement = String(args.replace ?? args.replacement ?? '');
    const replaceAll = Boolean(args.replaceAll);
    const dryRun = Boolean(args.dryRun);

    if (!filepath || !search) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Parametros "filepath" e "search" sao obrigatorios.',
      });
    }

    let resolved: ReturnType<WorkspaceFsPolicy['resolveEditPath']>;
    try {
      resolved = new WorkspaceFsPolicy().resolveEditPath(filepath);
    } catch {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Por seguranca, edicoes so podem alterar arquivos dentro do escopo output/ do workspace.',
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
    if (!currentContent.includes(search)) {
      return JSON.stringify({
        success: false,
        applied: false,
        error: 'Trecho de busca nao encontrado. Nenhum arquivo foi alterado.',
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

    const proposedContent = replaceAll
      ? currentContent.split(search).join(replacement)
      : currentContent.replace(search, replacement);
    const audit = {
      changed: currentContent !== proposedContent,
      diffPatch: buildDiff(filepath, currentContent, proposedContent),
      bytesBefore: Buffer.byteLength(currentContent, 'utf8'),
      bytesAfter: Buffer.byteLength(proposedContent, 'utf8'),
    };
    const preview = gate.createPreview({
      workspaceRoot: process.cwd(),
      operations: [
        {
          kind: 'write_file',
          path: resolved.absolutePath,
          content: proposedContent,
          reason: 'workspace.edit exact replacement',
        },
      ],
      requestedBy: readString(args.requestedBy) || 'workspace.edit',
      sourceSurface: 'tool:workspace.edit',
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
