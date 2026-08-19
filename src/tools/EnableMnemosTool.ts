import { asErrorLike } from '../utils/errorLike';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { execFile } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../logger.js';

const execFilePromise = util.promisify(execFile);

export class EnableMnemosTool extends BaseTool {
  readonly name = 'enable_mnemos';
  readonly description = 'Use this tool when the user asks to activate, enable, or install Mnemos, the local memory engine. It automates Docker container build and initial .env configuration.';
  readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      vault_dir: {
        type: 'string',
        description: 'Absolute path to the main memory vault folder where new files will be indexed/copied. Important: do not invent this folder. If the user did not explicitly specify it in the conversation, stop and ask where they want to save confidential files.',
      },
      scan_dirs: {
        type: 'string',
        description: 'Absolute paths of folders Mnemos may scan, separated by semicolons. If the user did not specify them, say that you will use the project root or ask which folder they prefer, such as Downloads.',
      },
      wide_scope_confirmed: {
        type: 'boolean',
        description: 'Required as true when scan_dirs points to the whole PC, drive root, /, C:\\, or another broad scope. Use only after showing a warning and receiving explicit confirmation.',
      },
    },
    required: ['vault_dir', 'scan_dirs'],
  };

  /**
   * Resolves a user-friendly path such as "Downloads" into a system path.
   */
  private resolveSmartPath(inputPath: string): string {
    const trimmed = inputPath.trim();
    if (!trimmed) return '';

    if (path.isAbsolute(trimmed)) return trimmed;

    const lower = trimmed.toLowerCase();
    const home = os.homedir();

    const commonFolders: Record<string, string> = {
      downloads: path.join(home, 'Downloads'),
      documentos: path.join(home, 'Documents'),
      documents: path.join(home, 'Documents'),
      desktop: path.join(home, 'Desktop'),
      imagens: path.join(home, 'Pictures'),
      pictures: path.join(home, 'Pictures'),
    };

    if (commonFolders[lower]) {
      return commonFolders[lower];
    }

    const projectRoot = process.cwd();
    const projectName = path.basename(projectRoot).toLowerCase();
    if (lower === projectName || lower === 'project' || lower === 'root' || lower === 'projeto' || lower === 'raiz') {
      return projectRoot;
    }

    const internalPath = path.resolve(projectRoot, trimmed);
    if (fs.existsSync(internalPath) && fs.statSync(internalPath).isDirectory()) {
      return internalPath;
    }

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
    output.push('Starting Mnemos activation routine...');

    if (scanDirList.length === 0) {
      return [
        'Error: provide at least one authorized folder in scan_dirs.',
        'Example: Downloads or C:\\Users\\ermys\\Downloads',
      ].join('\n');
    }

    const wideScopeDirs = scanDirList.filter((entry) => this.isWideScopePath(entry));
    if (wideScopeDirs.length > 0 && !wideScopeConfirmed) {
      return [
        'BLOCKED: the requested scope allows overly broad computer search.',
        `Broad scope detected: ${wideScopeDirs.join('; ')}`,
        '',
        'This may expose personal documents, credentials, browser exports, photos, financial files, and unrelated project data.',
        'Show this warning to the user and run again with wide_scope_confirmed=true only if they explicitly confirm.',
      ].join('\n');
    }

    const missingScanDirs = scanDirList.filter((entry) => !fs.existsSync(entry) || !fs.statSync(entry).isDirectory());
    if (missingScanDirs.length > 0) {
      return `Error: scan folder(s) not found: ${missingScanDirs.join('; ')}`;
    }

    try {
      if (!fs.existsSync(vaultDir)) {
        fs.mkdirSync(vaultDir, { recursive: true });
        output.push(`[OK] Vault directory created at: ${vaultDir}`);
      } else {
        output.push(`[OK] Vault directory validated at: ${vaultDir}`);
      }
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        output.push(`[OK] Vector database directory created at: ${dbDir}`);
      } else {
        output.push(`[OK] Vector database directory validated at: ${dbDir}`);
      }
    } catch (error: unknown) {logger.warn('[Enable Mnemos] filesystem operation failed', error); return ''; }

    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      try {
        let envContent = fs.readFileSync(envPath, 'utf8');

        let changed = false;
        if (!envContent.includes('MNEMOS_VAULT_DIR')) {
          envContent += `\n\n# Mnemos Cognitive Engine\nMNEMOS_VAULT_DIR="${vaultDir}"\nMNEMOS_SCAN_DIRS="${scanDirs}"\nMNEMOS_DB_DIR="${dbDir}"\nMNEMOS_EMBEDDING_MODEL="all-MiniLM-L6-v2"\n`;
          changed = true;
        } else {
          envContent = envContent.replace(/MNEMOS_VAULT_DIR=.*/, `MNEMOS_VAULT_DIR="${vaultDir}"`);
          envContent = envContent.replace(/MNEMOS_SCAN_DIRS=.*/, `MNEMOS_SCAN_DIRS="${scanDirs}"`);
          envContent = envContent.replace(/MNEMOS_DB_DIR=.*/, `MNEMOS_DB_DIR="${dbDir}"`);
          changed = true;
        }

        if (changed) {
          fs.writeFileSync(envPath, envContent, 'utf8');
          output.push('[OK] .env file updated with Mnemos settings.');
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        output.push(`[WARNING] Could not update .env automatically: ${err.message}`);
      }
    }

    output.push('Starting Docker image build. This can take a few minutes...');
    try {
      const dockerContextPath = path.resolve(process.cwd(), 'apps', 'mnemos');
      await execFilePromise('docker', ['build', '-t', 'mnemos-cognitive-engine:latest', dockerContextPath], {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 10 * 60 * 1000,
        maxBuffer: 1024 * 1024,
      });
      output.push('[OK] Docker image built successfully.');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      output.push(`[DOCKER ERROR] Failed to build the image. Check whether Docker Daemon (Docker Desktop) is running. Error log:\n${err.message}`);
      return output.join('\n');
    }

    output.push('[SUCCESS] Mnemos was installed and configured. Restart Zavorth or reload the "mnemos" MCP server to connect the tools.');

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
