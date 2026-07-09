
import fs from 'fs';
import path from 'path';
import { spawnCommand, spawnNativeCommand } from '../core/CommandSpawn.js';
import { config } from '../config/index.js';
import { ZavorthBridgeRemoteDoctorService, type ZavorthBridgeRemoteDoctorReport } from './ZavorthBridgeRemoteDoctorService.js';
import { TerminalSidecarService } from './TerminalSidecarService.js';
import { VendorReleaseIndexService } from './VendorReleaseIndexService.js';
import { logger } from '../logger.js';
import type {
  VendorDiffSummary,
  VendorLicenseDecision,
  VendorReleaseIndexEntry,
} from '../contracts/VendorPlaneContract.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';

export type ZavorthBridgeRemoteUpstreamSyncReport = {
  ok: boolean;
  action: 'sync' | 'promote' | 'rollback';
  status: 'inspected' | 'promoted' | 'rolled_back' | 'failed';
  startedAt: string;
  finishedAt: string;
  command: string;
  summary: string;
  output: string;
  doctor: ZavorthBridgeRemoteDoctorReport | null;
  rollbackApplied: boolean;
  statusFile: string;
  doctorFile: string;
  error: string | null;
  vendorIndex: VendorReleaseIndexEntry | null;
  diffSummary: VendorDiffSummary | null;
  diff: VendorDiffSummary | null;
  licenseDecision: VendorLicenseDecision | null;
};

type ZavorthBridgeRemoteUpstreamSyncRuntime = {
  sidecarService?: Pick<TerminalSidecarService, 'start' | 'stop'>;
  doctorService?: Pick<ZavorthBridgeRemoteDoctorService, 'run' | 'readLastReport'>;
  vendorReleaseIndexService?: Pick<VendorReleaseIndexService, 'getEntry' | 'getDiffSummary' | 'getLicenseDecision'>;
  spawn?: typeof spawnCommand;
};

export class ZavorthBridgeRemoteUpstreamSyncService {
  private readonly sidecarService: Pick<TerminalSidecarService, 'start' | 'stop'>;
  private readonly doctorService: Pick<ZavorthBridgeRemoteDoctorService, 'run' | 'readLastReport'>;
  private readonly vendorReleaseIndexService: Pick<VendorReleaseIndexService, 'getEntry' | 'getDiffSummary' | 'getLicenseDecision'>;
  private readonly spawnImpl: typeof spawnCommand;

  constructor(runtime: ZavorthBridgeRemoteUpstreamSyncRuntime = {}) {
    this.sidecarService = runtime.sidecarService || new TerminalSidecarService();
    this.doctorService = runtime.doctorService || new ZavorthBridgeRemoteDoctorService();
    this.vendorReleaseIndexService = runtime.vendorReleaseIndexService || new VendorReleaseIndexService();
    this.spawnImpl = runtime.spawn || spawnNativeCommand;
  }

  public readLastReport(): ZavorthBridgeRemoteUpstreamSyncReport {
    const fallback = this.buildFallback('sync');
    try {
      if (!fs.existsSync(config.ZavorthTerminalSyncStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(
        fs.readFileSync(config.ZavorthTerminalSyncStatusFile, 'utf8'),
      ) as Partial<ZavorthBridgeRemoteUpstreamSyncReport>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Upstream] JSON parse failed', error); return fallback; }
  }

  public async sync(): Promise<ZavorthBridgeRemoteUpstreamSyncReport> {
    return this.runVendorAction('sync', ['status', '--target=zavorth-terminal'], {
      status: 'inspected',
      successSummary: 'Estado do upstream ZavorthBridge Remote sincronizado por inspecao segura.',
      restartSidecar: false,
      runDoctor: false,
    });
  }

  public async promote(options: { autoRollback?: boolean } = {}): Promise<ZavorthBridgeRemoteUpstreamSyncReport> {
    return this.runVendorAction('promote', ['update', '--target=zavorth-terminal'], {
      status: 'promoted',
      successSummary: 'Upstream ZavorthBridge Remote promovido com doctor revalidado.',
      restartSidecar: true,
      runDoctor: true,
      autoRollback: options.autoRollback !== false,
    });
  }

  public async rollback(): Promise<ZavorthBridgeRemoteUpstreamSyncReport> {
    return this.runVendorAction('rollback', ['rollback', '--target=zavorth-terminal'], {
      status: 'rolled_back',
      successSummary: 'ZavorthBridge Remote restaurado para o lock anterior e revalidado.',
      restartSidecar: true,
      runDoctor: true,
      autoRollback: false,
    });
  }

  private async runVendorAction(
    action: ZavorthBridgeRemoteUpstreamSyncReport['action'],
    toolkitArgs: string[],
    options: {
      status: ZavorthBridgeRemoteUpstreamSyncReport['status'];
      successSummary: string;
      restartSidecar: boolean;
      runDoctor: boolean;
      autoRollback?: boolean;
    },
  ): Promise<ZavorthBridgeRemoteUpstreamSyncReport> {
    const startedAt = new Date().toISOString();
    let rollbackApplied = false;
    try {
      if (options.restartSidecar) {
        await this.sidecarService.stop();
      }
      const output = await this.runToolkit(toolkitArgs);
      if (options.restartSidecar) {
        await this.sidecarService.start();
      }
      let doctor: ZavorthBridgeRemoteDoctorReport | null = null;
      if (options.runDoctor) {
        doctor = await this.doctorService.run(false, false);
        if (!doctor.readyAfter && options.autoRollback) {
          rollbackApplied = true;
          await this.sidecarService.stop();
          const rollbackOutput = await this.runToolkit(['rollback', '--target=zavorth-terminal']);
          await this.sidecarService.start();
          doctor = await this.doctorService.run(false, false);
          return this.persist({
            ok: doctor.readyAfter,
            action,
            status: doctor.readyAfter ? 'rolled_back' : 'failed',
            startedAt,
            finishedAt: new Date().toISOString(),
            command: this.renderCommand(toolkitArgs),
            summary: doctor.readyAfter
              ? 'Promocao falhou no doctor do ZavorthBridge Remote; rollback automatico aplicado e ambiente revalidado.'
              : 'Promocao falhou no doctor do ZavorthBridge Remote e o rollback automatico nao restaurou um estado pronto.',
            output: `${output}\n\n[auto-rollback]\n${rollbackOutput}`.trim(),
            doctor,
            rollbackApplied,
            statusFile: config.ZavorthTerminalSyncStatusFile,
            doctorFile: config.zavorthBridgeRemoteDoctorReportFile,
            error: doctor.readyAfter ? null : doctor.summary,
            ...this.buildMetadata(),
          });
        }
      }

      return this.persist({
        ok: doctor ? doctor.readyAfter : true,
        action,
        status: doctor && !doctor.readyAfter ? 'failed' : options.status,
        startedAt,
        finishedAt: new Date().toISOString(),
        command: this.renderCommand(toolkitArgs),
        summary: doctor && !doctor.readyAfter ? doctor.summary : options.successSummary,
        output,
        doctor,
        rollbackApplied,
        statusFile: config.ZavorthTerminalSyncStatusFile,
        doctorFile: config.zavorthBridgeRemoteDoctorReportFile,
        error: doctor && !doctor.readyAfter ? doctor.summary : null,
        ...this.buildMetadata(),
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Bridge Remote Upstream] creation failed', error);
    return this.persist({
        ok: false,
        action,
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        command: this.renderCommand(toolkitArgs),
        summary: `Falha ao ${action === 'sync' ? 'inspecionar' : action === 'promote' ? 'promover' : 'restaurar'} o upstream ZavorthBridge Remote.`,
        output: '',
        doctor: null,
        rollbackApplied,
        statusFile: config.ZavorthTerminalSyncStatusFile,
        doctorFile: config.zavorthBridgeRemoteDoctorReportFile,
        error: errorMessage(error),
        ...this.buildMetadata(),
      });
  }
  }

  private async runToolkit(args: string[]): Promise<string> {
    const nodeCommand = process.execPath;
    const scriptPath = path.resolve(config.projectRoot, 'scripts', 'vendor-toolkit.mjs');
    const spawned = this.spawnImpl(nodeCommand, [scriptPath, ...args], {
      cwd: config.projectRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    spawned.stdout?.on('data', (chunk) => stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    spawned.stderr?.on('data', (chunk) => stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

    const exitCode = await new Promise<number>((resolve, reject) => {
      spawned.once('error', reject);
      spawned.once('exit', (code) => resolve(typeof code === 'number' ? code : 1));
    });

    const output = `${Buffer.concat(stdout).toString('utf8')}${Buffer.concat(stderr).toString('utf8')}`.trim();
    if (exitCode !== 0) {
      throw new Error(output || `vendor-toolkit saiu com codigo ${exitCode}`);
    }
    return output;
  }

  private buildFallback(action: ZavorthBridgeRemoteUpstreamSyncReport['action']): ZavorthBridgeRemoteUpstreamSyncReport {
    return {
      ok: false,
      action,
      status: 'failed',
      startedAt: '',
      finishedAt: '',
      command: this.renderCommand(['status', '--target=zavorth-terminal']),
      summary: 'Ainda nao existe relatorio de sync do ZavorthBridge Remote neste host.',
      output: '',
      doctor: null,
      rollbackApplied: false,
      statusFile: config.ZavorthTerminalSyncStatusFile,
      doctorFile: config.zavorthBridgeRemoteDoctorReportFile,
      error: null,
      ...this.buildMetadata(),
    };
  }

  private buildMetadata(): {
    vendorIndex: VendorReleaseIndexEntry | null;
    diffSummary: VendorDiffSummary | null;
    diff: VendorDiffSummary | null;
    licenseDecision: VendorLicenseDecision | null;
  } {
    const entry = this.vendorReleaseIndexService.getEntry('zavorth-terminal');
    const diffSummary = this.vendorReleaseIndexService.getDiffSummary('zavorth-terminal') || entry?.diff || null;
    const licenseDecision =
      this.vendorReleaseIndexService.getLicenseDecision('zavorth-terminal')
      || entry?.licenseDecision
      || null;
    return {
      vendorIndex: entry || null,
      diffSummary,
      diff: diffSummary,
      licenseDecision,
    };
  }

  private persist(report: ZavorthBridgeRemoteUpstreamSyncReport): ZavorthBridgeRemoteUpstreamSyncReport {
    fs.mkdirSync(path.dirname(config.ZavorthTerminalSyncStatusFile), { recursive: true });
    fs.writeFileSync(config.ZavorthTerminalSyncStatusFile, JSON.stringify(report, null, 2), 'utf8');
    return report;
  }

  private renderCommand(args: string[]): string {
    const scriptPath = path.resolve(config.projectRoot, 'scripts', 'vendor-toolkit.mjs');
    return `"${process.execPath}" "${scriptPath}" ${args.join(' ')}`.trim();
  }
}
