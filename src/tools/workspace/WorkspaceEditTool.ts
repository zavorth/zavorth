import fs from 'fs';
import { createTwoFilesPatch } from 'diff';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
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
  public readonly description = 'Edita arquivo dentro do escopo de escrita do workspace por substituicao exata e retorna diff auditavel.';
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
        description: 'Quando true, retorna diff sem gravar o arquivo.',
      },
    },
    required: ['filepath', 'search', 'replace'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
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
