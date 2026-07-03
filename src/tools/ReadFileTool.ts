import { BaseTool } from './BaseTool.js';
import fs from 'fs';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';

/**
 * ReadFileTool — Permite ao agente ler o conteúdo de um arquivo.
 */
export class ReadFileTool extends BaseTool {
  public readonly name = 'read_file';
  public readonly description = 'Lê o conteúdo completo de um arquivo de texto local na máquina host. Retorna o conteúdo como string.';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string',
        description: 'O caminho absoluto ou relativo do arquivo para ler (ex: "package.json", "./src/index.ts").',
      }
    },
    required: ['filePath'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const rawFilePath = String(args.filePath || '').trim();
    if (!rawFilePath) {
      return 'Erro: O parametro "filePath" e obrigatorio.';
    }

    let filePath: string;
    try {
      filePath = new WorkspaceFsPolicy().resolveReadPath(rawFilePath).absolutePath;
    } catch {
      return 'Erro: Por seguranca, arquivos so podem ser lidos dentro do workspace atual.';
    }

    try {
      if (!fs.existsSync(filePath)) {
        return `Erro: O arquivo "${filePath}" não existe.`;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return `Erro: O caminho "${filePath}" não aponta para um arquivo válido.`;
      }

      // Evita ler arquivos gigantescos (max ~1MB texto, limitamos os primeiros 20k chars da string por segurança)
      if (stats.size > 2 * 1024 * 1024) {
        return `Erro: O arquivo é maior que 2MB e não pode ser lido inteiramente na janela de contexto atual.`;
      }

      console.log(`📄 [ReadFile] Lendo arquivo: ${filePath}`);
      let content = fs.readFileSync(filePath, 'utf-8');

      if (content.length > 15000) {
        content = content.substring(0, 15000) + '\n\n...[Conteúdo Truncado por exceder o limite de 15 mil caracteres]';
      }

      return content.trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ [ReadFile] Erro ao ler:`, message);
      return `Erro ao ler o arquivo: ${message}`;
    }
  }
}
