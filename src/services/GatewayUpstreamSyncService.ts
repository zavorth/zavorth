import fs from 'fs';
import path from 'path';
import { spawnCommand, spawnNativeCommand } from '../core/CommandSpawn.js';
import { config } from '../config/index.js';
import type {
  VendorDiffSummary,
  VendorLicenseDecision,
  VendorReleaseIndexEntry,
} from '../contracts/VendorPlaneContract.js';
import { GatewayCompatibilityDoctorService, type AIGatewayCompatibilityDoctorReport } from './GatewayCompatibilityDoctorService.js';
import { AIGatewaySidecarService } from './AIGatewaySidecarService.js';
import { VendorReleaseIndexService } from './VendorReleaseIndexService.js';
import { logger } from '../logger.js';

export type AIGatewayUpstreamSyncReport = {
  ok: boolean;
  action: 'sync' | 'promote' | 'rollback';
  status: 'inspected' | 'promoted' | 'rolled_back' | 'failed';
  startedAt: string;
  finishedAt: string;
  command: string;
  summary: string;
  output: string;
  compat: AIGatewayCompatibilityDoctorReport | null;
  rollbackApplied: boolean;
  statusFile: string;
  compatFile: string;
  vendorIndex: VendorReleaseIndexEntry | null;
  diffSummary: VendorDiffSummary | null;
  licenseDecision: VendorLicenseDecision | null;
  error: string | null;
};

type AIGatewayUpstreamSyncRuntime = {
  sidecarService?: Pick<AIGatewaySidecarService, 'start' | 'stop'>;
  compatibilityDoctorService?: Pick<GatewayCompatibilityDoctorService, 'run' | 'readLastReport'>;
  vendorReleaseIndexService?: Pick<VendorReleaseIndexService, 'getEntry' | 'getDiffSummary' | 'getLicenseDecision'>;
  spawn?: typeof spawnCommand;
};

export class GatewayUpstreamSyncService {
  private readonly sidecarService: Pick<AIGatewaySidecarService, 'start' | 'stop'>;
  private readonly compatibilityDoctorService: Pick<GatewayCompatibilityDoctorService, 'run' | 'readLastReport'>;
  private readonly vendorReleaseIndexService: Pick<VendorReleaseIndexService, 'getEntry' | 'getDiffSummary' | 'getLicenseDecision'>;
  private readonly spawnImpl: typeof spawnCommand;

  constructor(runtime: AIGatewayUpstreamSyncRuntime = {}) {
    this.sidecarService = runtime.sidecarService || new AIGatewaySidecarService();
    this.compatibilityDoctorService = runtime.compatibilityDoctorService || new GatewayCompatibilityDoctorService();
    this.vendorReleaseIndexService = runtime.vendorReleaseIndexService || new VendorReleaseIndexService();
    this.spawnImpl = runtime.spawn || spawnNativeCommand;
  }

  public readLastReport(): AIGatewayUpstreamSyncReport {
    const fallback = this.buildFallback('sync');
    try {
      if (!fs.existsSync(config.AIGatewaySyncStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewaySyncStatusFile, 'utf8')) as Partial<AIGatewayUpstreamSyncReport>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error) { logger.warn('[way Upstream] JSON parse failed', error); return fallback; }
  }

  public async sync(): Promise<AIGatewayUpstreamSyncReport> {
    return this.runVendorAction('sync', ['status', '--target=AIGateway'], {
      status: 'inspected',
      successSummary: 'Estado do upstream AIGateway sincronizado por inspeção segura.',
      restartSidecar: false,
      runCompatDoctor: false,
    });
  }

  public async promote(options: { autoRollback?: boolean } = {}): Promise<AIGatewayUpstreamSyncReport> {
    return this.runVendorAction('promote', ['update', '--target=AIGateway'], {
      status: 'promoted',
      successSummary: 'Upstream AIGateway promovido com compatibilidade revalidada.',
      restartSidecar: true,
      runCompatDoctor: true,
      autoRollback: options.autoRollback !== false,
    });
  }

  public async rollback(): Promise<AIGatewayUpstreamSyncReport> {
    return this.runVendorAction('rollback', ['rollback', '--target=AIGateway'], {
      status: 'rolled_back',
      successSummary: 'AIGateway restaurado para o lock anterior e revalidado.',
      restartSidecar: true,
      runCompatDoctor: true,
      autoRollback: false,
    });
  }

  private async runVendorAction(
    action: AIGatewayUpstreamSyncReport['action'],
    toolkitArgs: string[],
    options: {
      status: AIGatewayUpstreamSyncReport['status'];
      successSummary: string;
      restartSidecar: boolean;
      runCompatDoctor: boolean;
      autoRollback?: boolean;
    },
  ): Promise<AIGatewayUpstreamSyncReport> {
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
      let compat: AIGatewayCompatibilityDoctorReport | null = null;
      if (options.runCompatDoctor) {
        compat = await this.compatibilityDoctorService.run();
        if (!compat.ok && options.autoRollback) {
          rollbackApplied = true;
          await this.sidecarService.stop();
          const rollbackOutput = await this.runToolkit(['rollback', '--target=AIGateway']);
          await this.sidecarService.start();
          compat = await this.compatibilityDoctorService.run();
          return this.persist(this.decorateVendorMetadata({
            ok: compat.ok,
            action,
            status: compat.ok ? 'rolled_back' : 'failed',
            startedAt,
            finishedAt: new Date().toISOString(),
            command: this.renderCommand(toolkitArgs),
            summary: compat.ok
              ? 'Promocao falhou na compatibilidade; rollback automatico aplicado e ambiente revalidado.'
              : 'Promocao falhou na compatibilidade e o rollback automatico nao restaurou um estado saudavel.',
            output: `${output}\n\n[auto-rollback]\n${rollbackOutput}`.trim(),
            compat,
            rollbackApplied,
            statusFile: config.AIGatewaySyncStatusFile,
            compatFile: config.AIGatewayCompatibilityStatusFile,
            vendorIndex: null,
            diffSummary: null,
            licenseDecision: null,
            error: compat.ok ? null : compat.error || compat.summary,
          }));
        }
      }

      return this.persist(this.decorateVendorMetadata({
        ok: compat ? compat.ok : true,
        action,
        status: compat && !compat.ok ? 'failed' : options.status,
        startedAt,
        finishedAt: new Date().toISOString(),
        command: this.renderCommand(toolkitArgs),
        summary: compat && !compat.ok ? compat.summary : options.successSummary,
        output,
        compat,
        rollbackApplied,
        statusFile: config.AIGatewaySyncStatusFile,
        compatFile: config.AIGatewayCompatibilityStatusFile,
        vendorIndex: null,
        diffSummary: null,
        licenseDecision: null,
        error: compat && !compat.ok ? compat.error || compat.summary : null,
      }));
    } catch (error) {
    logger.warn('[way Upstream] filesystem check failed', error);
    return this.persist(this.decorateVendorMetadata({
        ok: false,
        action,
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        command: this.renderCommand(toolkitArgs),
        summary: `Falha ao ${action === 'sync' ? 'inspecionar' : action === 'promote' ? 'promover' : 'restaurar'} o upstream AIGateway.`,
        output: '',
        compat: null,
        rollbackApplied,
        statusFile: config.AIGatewaySyncStatusFile,
        compatFile: config.AIGatewayCompatibilityStatusFile,
        vendorIndex: null,
        diffSummary: null,
        licenseDecision: null,
        error: error?.message || String(error),
      }));
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

  private buildFallback(action: AIGatewayUpstreamSyncReport['action']): AIGatewayUpstreamSyncReport {
    return this.decorateVendorMetadata({
      ok: false,
      action,
      status: 'failed',
      startedAt: '',
      finishedAt: '',
      command: this.renderCommand(['status', '--target=AIGateway']),
      summary: 'Ainda nao existe relatorio de sync do AIGateway neste host.',
      output: '',
      compat: null,
      rollbackApplied: false,
      statusFile: config.AIGatewaySyncStatusFile,
      compatFile: config.AIGatewayCompatibilityStatusFile,
      vendorIndex: null,
      diffSummary: null,
      licenseDecision: null,
      error: null,
    });
  }

  private persist(report: AIGatewayUpstreamSyncReport): AIGatewayUpstreamSyncReport {
    fs.mkdirSync(path.dirname(config.AIGatewaySyncStatusFile), { recursive: true });
    fs.writeFileSync(config.AIGatewaySyncStatusFile, JSON.stringify(report, null, 2), 'utf8');
    return report;
  }

  private decorateVendorMetadata(report: AIGatewayUpstreamSyncReport): AIGatewayUpstreamSyncReport {
    return {
      ...report,
      vendorIndex: this.vendorReleaseIndexService.getEntry('AIGateway'),
      diffSummary: this.vendorReleaseIndexService.getDiffSummary('AIGateway'),
      licenseDecision: this.vendorReleaseIndexService.getLicenseDecision('AIGateway'),
    };
  }

  private renderCommand(args: string[]): string {
    const scriptPath = path.resolve(config.projectRoot, 'scripts', 'vendor-toolkit.mjs');
    return `"${process.execPath}" "${scriptPath}" ${args.join(' ')}`.trim();
  }
}
