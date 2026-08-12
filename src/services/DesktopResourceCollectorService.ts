import { WslControlService } from './WslControlService.js';

import os from 'os';
import { execFile } from 'child_process';
import type {
  DesktopDockerDesktopSample,
  DesktopResourceCollection,
  DesktopResourceProcessSample,
  DesktopResourceWslDistroSample,
} from '../contracts/DesktopResourceContract.js';

import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type ExecLike = (
  file: string,
  args: string[],
  options?: {
    timeoutMs?: number;
  },
) => Promise<string>;

type DesktopResourceCollectorRuntime = {
  now?: () => Date;
  powershellPath?: string;
  dockerPath?: string;
  exec?: ExecLike;
  wslControl?: Pick<WslControlService, 'status'>;
};

type RawProcessPayload = {
  pid?: number;
  processName?: string;
  executablePath?: string | null;
  commandLine?: string | null;
  cpuSeconds?: number;
  workingSetMb?: number;
  pagedMemoryMb?: number;
  privateMemoryMb?: number;
  readTransferMb?: number;
  writeTransferMb?: number;
  mainWindowTitle?: string | null;
  startTime?: string | null;
  responding?: boolean | null;
};

type RawProcessReport = {
  generatedAt?: string;
  host?: {
    totalVisibleMemoryMb?: number;
    freePhysicalMemoryMb?: number;
    totalPhysicalMemoryMb?: number;
    memoryLoadPercent?: number | null;
  };
  processes?: RawProcessPayload[];
};

export class DesktopResourceCollectorService {
  private readonly now: () => Date;
  private readonly powershellPath: string;
  private readonly dockerPath: string;
  private readonly exec: ExecLike;
  private readonly wslControl: Pick<WslControlService, 'status'>;

  constructor(runtime: DesktopResourceCollectorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.powershellPath = runtime.powershellPath || 'powershell.exe';
    this.dockerPath = runtime.dockerPath || 'docker';
    this.exec = runtime.exec || this.execFileAsync.bind(this);
    this.wslControl = runtime.wslControl || new WslControlService();
  }

  public async collect(): Promise<DesktopResourceCollection> {
    const [processReport, wsl, docker] = await Promise.all([
      this.collectWindowsProcesses(),
      this.collectWsl(),
      this.collectDocker(),
    ]);

    const generatedAt = processReport.generatedAt || this.now().toISOString();
    const host = processReport.host || {
      totalVisibleMemoryMb: 0,
      freePhysicalMemoryMb: 0,
      totalPhysicalMemoryMb: 0,
      memoryLoadPercent: null,
    };

    return {
      generatedAt,
      host: {
        hostname: os.hostname(),
        platform: process.platform,
        totalVisibleMemoryMb: this.round(host.totalVisibleMemoryMb),
        freePhysicalMemoryMb: this.round(host.freePhysicalMemoryMb),
        totalPhysicalMemoryMb: this.round(host.totalPhysicalMemoryMb),
        memoryLoadPercent:
          typeof host.memoryLoadPercent === 'number' && Number.isFinite(host.memoryLoadPercent)
            ? Math.max(0, Math.min(100, Math.round(host.memoryLoadPercent)))
            : null,
      },
      processes: Array.isArray(processReport.processes)
        ? processReport.processes.map((entry) => this.normalizeProcess(entry))
        : [],
      wsl,
      docker,
    };
  }

  private async collectWindowsProcesses(): Promise<RawProcessReport> {
    const script = `
$ErrorActionPreference = 'Stop'
$procDetails = @{}
Get-CimInstance Win32_Process | ForEach-Object {
  $procDetails[[string]$_.ProcessId] = $_
}
$osInfo = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$processes = Get-Process | ForEach-Object {
  $detail = $procDetails[[string]$_.Id]
  $startTime = $null
  try {
    $startTime = $_.StartTime.ToString('o')
  } catch (error: unknown) {$startTime = $null
  }
  $responding = $null
  try {
    $responding = [bool]$_.Responding
  } catch (error: unknown) {$responding = $null
  }
  [PSCustomObject]@{
    pid = $_.Id
    processName = $_.ProcessName
    executablePath = if ($detail) { $detail.ExecutablePath } else { $null }
    commandLine = if ($detail) { $detail.CommandLine } else { $null }
    cpuSeconds = if ($null -ne $_.CPU) { [math]::Round([double]$_.CPU, 2) } else { 0 }
    workingSetMb = if ($null -ne $_.WorkingSet64) { [math]::Round($_.WorkingSet64 / 1MB, 2) } else { 0 }
    pagedMemoryMb = if ($null -ne $_.PagedMemorySize64) { [math]::Round($_.PagedMemorySize64 / 1MB, 2) } else { 0 }
    privateMemoryMb = if ($null -ne $_.PrivateMemorySize64) { [math]::Round($_.PrivateMemorySize64 / 1MB, 2) } else { 0 }
    readTransferMb = if ($null -ne $_.ReadTransferCount) { [math]::Round($_.ReadTransferCount / 1MB, 2) } else { 0 }
    writeTransferMb = if ($null -ne $_.WriteTransferCount) { [math]::Round($_.WriteTransferCount / 1MB, 2) } else { 0 }
    mainWindowTitle = if ($_.MainWindowTitle) { $_.MainWindowTitle } else { $null }
    startTime = $startTime
    responding = $responding
  }
}
$totalVisibleMemoryMb = if ($osInfo.TotalVisibleMemorySize) { [math]::Round($osInfo.TotalVisibleMemorySize / 1024, 2) } else { 0 }
$freePhysicalMemoryMb = if ($osInfo.FreePhysicalMemory) { [math]::Round($osInfo.FreePhysicalMemory / 1024, 2) } else { 0 }
$totalPhysicalMemoryMb = if ($computer.TotalPhysicalMemory) { [math]::Round($computer.TotalPhysicalMemory / 1MB, 2) } else { 0 }
$memoryLoadPercent = if ($totalVisibleMemoryMb -gt 0) {
  [math]::Round((($totalVisibleMemoryMb - $freePhysicalMemoryMb) / $totalVisibleMemoryMb) * 100, 2)
} else {
  $null
}
[PSCustomObject]@{
  generatedAt = (Get-Date).ToString('o')
  host = [PSCustomObject]@{
    totalVisibleMemoryMb = $totalVisibleMemoryMb
    freePhysicalMemoryMb = $freePhysicalMemoryMb
    totalPhysicalMemoryMb = $totalPhysicalMemoryMb
    memoryLoadPercent = $memoryLoadPercent
  }
  processes = @($processes)
} | ConvertTo-Json -Depth 5 -Compress
`.trim();

    try {
      const stdout = await this.exec(this.powershellPath, ['-NoProfile', '-Command', script], { timeoutMs: 30_000 });
      return JSON.parse(stdout) as RawProcessReport;
    } catch (error: unknown) {const totalVisibleMemoryMb = this.round(os.totalmem() / 1024 / 1024);
      const freePhysicalMemoryMb = this.round(os.freemem() / 1024 / 1024);
      return {
        generatedAt: this.now().toISOString(),
        host: {
          totalVisibleMemoryMb,
          freePhysicalMemoryMb,
          totalPhysicalMemoryMb: totalVisibleMemoryMb,
          memoryLoadPercent: totalVisibleMemoryMb > 0
            ? this.round(((totalVisibleMemoryMb - freePhysicalMemoryMb) / totalVisibleMemoryMb) * 100)
            : null,
        },
        processes: [],
      };
    }
  }

  private async collectWsl(): Promise<DesktopResourceCollection['wsl']> {
    try {
      const status = await this.wslControl.status();
      return {
        ok: status.ok,
        message: status.message,
        warnings: Array.isArray(status.warnings) ? status.warnings : [],
        distros: Array.isArray(status.distros)
          ? status.distros.map((entry) => ({
              name: entry.name,
              state: entry.state,
              version: entry.version,
              isDefault: entry.isDefault,
            }))
          : [],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Desktop Resource Collector] filesystem check failed', error);
    return {
        ok: false,
        message: `Failed to collect WSL: ${error instanceof Error ? err.message : String(error)}`,
        warnings: [],
        distros: [],
      };
  }
  }

  private async collectDocker(): Promise<DesktopDockerDesktopSample> {
    try {
      const [psOutput, contextOutput] = await Promise.all([
        this.exec(this.dockerPath, ['ps', '-q'], { timeoutMs: 10_000 }),
        this.exec(this.dockerPath, ['context', 'show'], { timeoutMs: 10_000 }).catch(() => ''),
      ]);
      const runningContainerCount = psOutput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .length;
      return {
        detected: true,
        status: runningContainerCount > 0 ? 'running' : 'idle',
        runningContainerCount,
        contextName: String(contextOutput || '').trim() || null,
        warnings: [],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Desktop Resource Collector] filesystem check failed', error);
    return {
        detected: false,
        status: 'unavailable',
        runningContainerCount: null,
        contextName: null,
        warnings: [
          error instanceof Error
            ? err.message
            : String(error),
        ],
      };
  }
  }

  private normalizeProcess(input: RawProcessPayload): DesktopResourceProcessSample {
    return {
      pid: Math.max(0, Number(input.pid || 0) || 0),
      processName: String(input.processName || 'unknown').trim() || 'unknown',
      executablePath: this.normalizeText(input.executablePath),
      commandLine: this.normalizeText(input.commandLine),
      cpuSeconds: this.round(input.cpuSeconds),
      workingSetMb: this.round(input.workingSetMb),
      pagedMemoryMb: this.round(input.pagedMemoryMb),
      privateMemoryMb: this.round(input.privateMemoryMb),
      readTransferMb: this.round(input.readTransferMb),
      writeTransferMb: this.round(input.writeTransferMb),
      mainWindowTitle: this.normalizeText(input.mainWindowTitle),
      startTime: this.normalizeText(input.startTime),
      responding: typeof input.responding === 'boolean' ? input.responding : null,
    };
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private round(value: unknown): number {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.round(numeric * 100) / 100;
  }

  private execFileAsync(
    file: string,
    args: string[],
    options: {
      timeoutMs?: number;
    } = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        {
          windowsHide: true,
          maxBuffer: 12 * 1024 * 1024,
          timeout: options.timeoutMs || 15_000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(String(stderr || error.message || 'Failed to run coleta local.').trim()));
            return;
          }
          resolve(String(stdout || '').trim());
        },
      );
    });
  }
}
