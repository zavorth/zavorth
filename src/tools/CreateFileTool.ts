import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';

/**
 * CreateFileTool - Cria arquivos no filesystem local.
 * Valida que o path esta dentro de diretorios seguros.
 */
export class CreateFileTool extends BaseTool {
  readonly name = 'create_file';
  readonly description = 'Cria um arquivo no sistema de arquivos local com o conteudo especificado. Use para gerar documentos, specs, codigo ou qualquer arquivo de texto.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      filepath: {
        type: 'string',
        description: 'Caminho relativo do arquivo a ser criado (ex: output/meu-documento.md)',
      },
      content: {
        type: 'string',
        description: 'Conteudo do arquivo a ser criado',
      },
    },
    required: ['filepath', 'content'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const filepath = args.filepath as string;
    const content = args.content as string;

    if (!filepath || content === undefined) {
      return JSON.stringify({ error: 'Parametros "filepath" e "content" sao obrigatorios.' });
    }

    const policy = new WorkspaceFsPolicy();
    let fullPath: string;
    let resolvedPolicy: ReturnType<WorkspaceFsPolicy['resolveWritePath']>;

    try {
      resolvedPolicy = policy.resolveWritePath(filepath);
      fullPath = resolvedPolicy.absolutePath;
    } catch {
      return JSON.stringify({ error: 'Por seguranca, arquivos so podem ser criados dentro da pasta output/.' });
    }

    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf-8');

      return JSON.stringify({
        success: true,
        message: `Arquivo criado com sucesso: ${filepath}`,
        path: fullPath,
        size: `${Buffer.byteLength(content, 'utf-8')} bytes`,
        policy: {
          access: resolvedPolicy.access,
          scope: resolvedPolicy.scope,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `Falha ao criar arquivo: ${errorMessage}` });
    }
  }
}
