import { asErrorLike } from '../utils/errorLike';
﻿import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../logger.js';
export type CleanupResult = {
  ok: boolean;
  killed: string[];
  skipped: string[];
  wslShutdown: boolean;
  message: string;
  warnings: string[];
};

/**
 * Processos que NUNCA devem ser encerrados.
 * Inclui o próprio Zavorth (node), processos do sistema Windows,
 * e processos essenciais para a sessão.
 */
const PROTECTED_PROCESSES = new Set([
  // Sistema Windows
  'system', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe',
  'lsass.exe', 'svchost.exe', 'dwm.exe', 'fontdrvhost.exe',
  'winlogon.exe', 'explorer.exe', 'taskhostw.exe', 'runtimebroker.exe',
  'searchhost.exe', 'startmenuexperiencehost.exe', 'shellexperiencehost.exe',
  'textinputhost.exe', 'ctfmon.exe', 'sihost.exe', 'dllhost.exe',
  'conhost.exe', 'wudfhost.exe', 'audiodg.exe',
  // Zavorth / Node
  'node.exe', 'powershell.exe', 'cmd.exe',
  // Segurança
  'msmpeng.exe', 'nissrv.exe', 'securityhealthservice.exe',
  'mpcmdrun.exe', 'smartscreen.exe',
  // WSL
  'wsl.exe', 'wslservice.exe', 'wslhost.exe',
]);

export class SystemCleanupService {
  private readonly powershellPath: string;

  constructor() {
    this.powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  }

  /**
   * Mata todos os processos não-essenciais e opcionalmente desliga o WSL.
   */
  public async cleanup(options: { shutdownWsl?: boolean } = {}): Promise<CleanupResult> {
    const warnings: string[] = [];
    const killed: string[] = [];
    const skipped: string[] = [];

    try {
      // 1. Listar todos os processos do usuário
      const processes = await this.getUserProcesses();

      // 2. Filtrar e matar
      for (const proc of processes) {
        const lowerName = proc.name.toLowerCase();

        if (PROTECTED_PROCESSES.has(lowerName)) {
          skipped.push(proc.name);
          continue;
        }

        try {
          await this.killProcess(proc.pid);
          killed.push(`${proc.name} (PID: ${proc.pid})`);
        } catch (error: unknown) { const err = asErrorLike(error); warnings.push(`Falha ao matar ${proc.name} (${proc.pid}): ${err.message}`);
        }
      }

      // 3. Desligar WSL se solicitado
      let wslShutdown = false;
      if (options.shutdownWsl !== false) {
        try {
          await this.shutdownWsl();
          wslShutdown = true;
        } catch (error: unknown) { const err = asErrorLike(error); warnings.push(`Falha ao desligar WSL: ${err.message}`);
        }
      }

      // 4. Limpar arquivos temporários sujos (.part, .ytdl)
      let artifactsCleaned = 0;
      try {
        artifactsCleaned = await this.cleanTempArtifacts();
      } catch (error: unknown) { const err = asErrorLike(error); warnings.push(`Falha ao limpar temp artifacts: ${err.message}`);
      }

      const message = killed.length > 0 || artifactsCleaned > 0
        ? `Limpeza concluida. ${killed.length} processo(s) encerrado(s). ${artifactsCleaned} artefato(s) removido(s).${wslShutdown ? ' WSL desligado.' : ''}`
        : `Nenhum processo nao-essencial ou artefato encontrado.${wslShutdown ? ' WSL desligado.' : ''}`;

      return { ok: true, killed, skipped, wslShutdown, message, warnings };
    } catch (error: unknown) {
      logger.warn('[System Cleanup] operation failed', error);
    return {
        ok: false,
        killed,
        skipped,
        wslShutdown: false,
        message: `Erro na limpeza: ${error.message}`,
        warnings,
      };
  }
  }

  private async cleanTempArtifacts(): Promise<number> {
    const targets = [
      path.join(os.tmpdir(), 'zavorth-ytdlp'),
      path.join(process.cwd(), 'tmp'),
      os.tmpdir()
    ];
    let removedCounts = 0;

    for (const dir of targets) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.part') || file.endsWith('.ytdl')) {
            try {
              fs.unlinkSync(path.join(dir, file));
              removedCounts++;
            } catch (error: unknown) {// Ignore lock errors
      logger.warn('[System Cleanup] file cleanup failed', error);
    }
          }
        }
      } catch (error: unknown) {// Ignorar erros de leitura de diretorio
      logger.warn('[System Cleanup] file cleanup failed', error);
    }
    }
    return removedCounts;
  }

  private async getUserProcesses(): Promise<Array<{ name: string; pid: number }>> {
    const script = `
      Get-Process | Where-Object {
        $_.SessionId -eq (Get-Process -Id $PID).SessionId -and
        $_.Id -ne $PID
      } | Select-Object ProcessName, Id |
      ConvertTo-Json -Compress
    `;

    const stdout = await this.runPowershell(script);
    const parsed = JSON.parse(stdout.trim() || '[]');
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items
      .filter((p: any) => p && p.ProcessName)
      .map((p: any) => ({
        name: `${p.ProcessName}.exe`.toLowerCase() === p.ProcessName.toLowerCase()
          ? p.ProcessName
          : `${p.ProcessName}.exe`,
        pid: p.Id,
      }));
  }

  private async killProcess(pid: number): Promise<void> {
    await this.runPowershell(`Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`);
  }

  private async shutdownWsl(): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        'C:\\Windows\\System32\\wsl.exe',
        ['--shutdown'],
        { windowsHide: true, timeout: 30_000 },
        (error) => {
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve();
          }
        },
      );
    });
  }

  private runPowershell(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.powershellPath,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        {
          windowsHide: true,
          maxBuffer: 5 * 1024 * 1024,
          timeout: 60_000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}
