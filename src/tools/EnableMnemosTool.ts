import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { execFile } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFilePromise = util.promisify(execFile);

export class EnableMnemosTool extends BaseTool {
  readonly name = 'enable_mnemos';
  readonly description = 'Use esta ferramenta quando o usuário solicitar para ativar, ligar ou instalar o Mnemos (o motor de memória local). Ela automatiza o build do container Docker e a configuração inicial do .env.';
  readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      vault_dir: {
        type: 'string',
        description: 'O caminho absoluto para uma pasta que servirá como cofre principal de memória (onde novos arquivos serão indexados/copiados). IMPORTANTE: Você NÃO deve inventar essa pasta. Se o usuário não especificar explicitamente na conversa, pare a execução e PERGUNTE onde ele deseja salvar seus arquivos confidenciais.',
      },
      scan_dirs: {
        type: 'string',
        description: 'Caminhos absolutos das pastas onde o Mnemos poderá vasculhar (separados por ponto e vírgula). Se o usuário não disser, avise que você usará a pasta raiz deste projeto ou pergunte qual ele prefere (ex: pasta Downloads).',
      },
      wide_scope_confirmed: {
        type: 'boolean',
        description: 'Obrigatorio como true quando scan_dirs aponta para o PC inteiro, raiz do disco, /, C:\\ ou outro escopo amplo. Use somente depois de mostrar aviso e receber confirmacao explicita.',
      },
    },
    required: ['vault_dir', 'scan_dirs'],
  };

  /**
   * Tenta resolver um caminho de forma 'inteligente' para usuários leigos.
   * Se o usuário disser 'Downloads', resolve para a pasta de downloads do sistema.
   * Se disser o nome do projeto, resolve para a raiz.
   */
  private resolveSmartPath(inputPath: string): string {
    const trimmed = inputPath.trim();
    if (!trimmed) return '';

    // Se já for um caminho absoluto (C:\ ou /...), retorna direto
    if (path.isAbsolute(trimmed)) return trimmed;

    const lower = trimmed.toLowerCase();
    const home = os.homedir();

    // 1. Mapeamento de pastas comuns do Windows/Unix
    const commonFolders: Record<string, string> = {
      'downloads': path.join(home, 'Downloads'),
      'documentos': path.join(home, 'Documents'),
      'documents': path.join(home, 'Documents'),
      'desktop': path.join(home, 'Desktop'),
      'area de trabalho': path.join(home, 'Desktop'),
      'imagens': path.join(home, 'Pictures'),
      'pictures': path.join(home, 'Pictures'),
    };

    if (commonFolders[lower]) {
      return commonFolders[lower];
    }

    // 2. Verificar se o usuário mencionou o nome da pasta do projeto atual
    const projectRoot = process.cwd();
    const projectName = path.basename(projectRoot).toLowerCase();
    if (lower === projectName || lower === 'projeto' || lower === 'raiz') {
      return projectRoot;
    }

    // 3. Tentar encontrar a pasta dentro da raiz do projeto
    const internalPath = path.resolve(projectRoot, trimmed);
    if (fs.existsSync(internalPath) && fs.statSync(internalPath).isDirectory()) {
      return internalPath;
    }

    // 4. Fallback padrão: resolve relativo ao CWD
    return path.resolve(projectRoot, trimmed);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const rawVaultDir = String(args.vault_dir || '').trim();
    const rawScanDirs = String(args.scan_dirs || '').trim();
    const wideScopeConfirmed = args.wide_scope_confirmed === true
      || String(args.wide_scope_confirmed || '').trim().toLowerCase() === 'true';

    const vaultDir = rawVaultDir
      ? this.resolveSmartPath(rawVaultDir)
      : path.resolve(process.cwd(), 'data', 'mnemos_vault');

    const scanDirList = rawScanDirs
      ? rawScanDirs.split(';').map(d => this.resolveSmartPath(d)).filter(Boolean)
      : [];
    const scanDirs = scanDirList.join(';');
    const dbDir = path.resolve(process.cwd(), 'data', 'mnemos_db');

    const output: string[] = [];
    output.push('Iniciando rotina de ativação do Mnemos...');

    if (scanDirList.length === 0) {
      return [
        'Erro: informe pelo menos uma pasta autorizada em scan_dirs.',
        'Exemplo: Downloads ou C:\\Users\\ermys\\Downloads',
      ].join('\n');
    }

    const wideScopeDirs = scanDirList.filter((entry) => this.isWideScopePath(entry));
    if (wideScopeDirs.length > 0 && !wideScopeConfirmed) {
      return [
        'BLOQUEADO: o escopo solicitado permite busca ampla demais pelo computador.',
        `Escopo amplo detectado: ${wideScopeDirs.join('; ')}`,
        '',
        'Isso pode expor documentos pessoais, credenciais, exports de navegador, fotos, arquivos financeiros e dados de projetos sem relacao com a pergunta.',
        'Mostre esse aviso ao usuario e so execute novamente com wide_scope_confirmed=true se ele confirmar explicitamente.',
      ].join('\n');
    }

    const missingScanDirs = scanDirList.filter((entry) => !fs.existsSync(entry) || !fs.statSync(entry).isDirectory());
    if (missingScanDirs.length > 0) {
      return `Erro: pasta(s) de scan não encontrada(s): ${missingScanDirs.join('; ')}`;
    }

    // 1. Verificar/criar as pastas
    try {
      if (!fs.existsSync(vaultDir)) {
        fs.mkdirSync(vaultDir, { recursive: true });
        output.push(`[OK] Diretório do cofre criado em: ${vaultDir}`);
      } else {
        output.push(`[OK] Diretório do cofre validado em: ${vaultDir}`);
      }
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        output.push(`[OK] Diretório do banco vetorial criado em: ${dbDir}`);
      } else {
        output.push(`[OK] Diretório do banco vetorial validado em: ${dbDir}`);
      }
    } catch (err: any) {
      return `Erro ao processar as pastas do Mnemos: ${err.message}`;
    }

    // 2. Atualizar o .env no raiz se existir, ou orientar o usuário
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      try {
        let envContent = fs.readFileSync(envPath, 'utf8');

        let changed = false;
        if (!envContent.includes('MNEMOS_VAULT_DIR')) {
          envContent += `\n\n# Mnemos Cognitive Engine\nMNEMOS_VAULT_DIR="${vaultDir}"\nMNEMOS_SCAN_DIRS="${scanDirs}"\nMNEMOS_DB_DIR="${dbDir}"\nMNEMOS_EMBEDDING_MODEL="all-MiniLM-L6-v2"\n`;
          changed = true;
        } else {
          // Apenas ajusta se necessário ou substitui
          envContent = envContent.replace(/MNEMOS_VAULT_DIR=.*/, `MNEMOS_VAULT_DIR="${vaultDir}"`);
          envContent = envContent.replace(/MNEMOS_SCAN_DIRS=.*/, `MNEMOS_SCAN_DIRS="${scanDirs}"`);
          envContent = envContent.replace(/MNEMOS_DB_DIR=.*/, `MNEMOS_DB_DIR="${dbDir}"`);
          changed = true;
        }

        if (changed) {
          fs.writeFileSync(envPath, envContent, 'utf8');
          output.push('[OK] Arquivo .env atualizado com as configurações do Mnemos.');
        }
      } catch (err: any) {
        output.push(`[AVISO] Não foi possível atualizar o .env automaticamente: ${err.message}`);
      }
    }

    // 3. Rebuild da imagem Docker
    output.push('Iniciando o build da imagem Docker (isso pode levar alguns minutos)...');
    try {
      const dockerContextPath = path.resolve(process.cwd(), 'apps', 'mnemos');
      await execFilePromise('docker', ['build', '-t', 'mnemos-cognitive-engine:latest', dockerContextPath], {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 10 * 60 * 1000,
        maxBuffer: 1024 * 1024,
      });
      output.push(`[OK] Imagem Docker compilada com sucesso.`);
    } catch (err: any) {
      output.push(`[ERRO DOCKER] Falha ao compilar a imagem. Verifique se o Docker Daemon (Docker Desktop) está em execução. Log de erro:\n${err.message}`);
      return output.join('\n');
    }

    output.push('[SUCESSO] O Mnemos foi instalado e configurado! Reinicie o Zavorth ou recarregue o servidor MCP "mnemos" para conectar as ferramentas.');

    return output.join('\n');
  }

  private isWideScopePath(inputPath: string): boolean {
    const resolved = path.resolve(inputPath);
    const root = path.parse(resolved).root;
    if (root && resolved.toLowerCase() === root.toLowerCase()) {
      return true;
    }
    const normalized = resolved.replace(/[\\/]+$/g, '').toLowerCase();
    const home = os.homedir().replace(/[\\/]+$/g, '').toLowerCase();
    return normalized === home;
  }
}
