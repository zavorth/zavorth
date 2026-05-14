import { BaseTool } from './BaseTool.js';
import fs from 'fs';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';

/**
 * ListDirectoryTool — Permite ao agente listar arquivos e pastas num diretório local.
 */
export class ListDirectoryTool extends BaseTool {
  public readonly name = 'list_directory';
  public readonly description = 'Lista os arquivos e subdiretórios de um caminho local específico na máquina host. Retorna o conteúdo do diretório atual se o caminho estiver vazio.';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      dirPath: {
        type: 'string',
        description: 'O caminho absoluto ou relativo do diretório para listar (ex: "./src", "C:\\Teste"). Deixe vazio para listar o diretório atual.',
      }
    },
  };

  public async execute(args: any): Promise<string> {
    const rawDirPath = typeof args?.dirPath === 'string' && args.dirPath.trim()
      ? args.dirPath
      : undefined;
    let dirPath: string;
    try {
      dirPath = new WorkspaceFsPolicy().resolveListPath(rawDirPath).absolutePath;
    } catch {
      return 'Erro: Por seguranca, diretorios so podem ser listados dentro do workspace atual.';
    }

    try {
      if (!fs.existsSync(dirPath)) {
        return `Erro: O diretório "${dirPath}" não existe.`;
      }

      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return `Erro: O caminho "${dirPath}" não é um diretório.`;
      }

      console.log(`📁 [ListDirectory] Listando: ${dirPath}`);
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      let output = `Conteúdo do diretório: ${dirPath}\n\n`;
      let folders = [];
      let files = [];

      for (const item of items) {
        if (item.isDirectory()) folders.push(`[DIR]  ${item.name}`);
        else files.push(`[FILE] ${item.name}`);
      }

      output += folders.join('\n') + (folders.length > 0 ? '\n' : '');
      output += files.join('\n');

      if (items.length === 0) {
        output += '(Diretório vazio)';
      }

      return output.trim();
    } catch (error: any) {
      console.error(`❌ [ListDirectory] Erro ao listar:`, error.message);
      return `Erro ao ler diretório: ${error.message}`;
    }
  }
}
