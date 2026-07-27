import { executeViaWsl, getWslStatus } from './firecracker-runtime/FirecrackerSandboxWslBridge.js';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger.js';
import { config } from '../../config/index.js';
import { spawnNativeCommand } from '../../core/CommandSpawn.js';
import { FirecrackerSandboxPayloadSupport } from './FirecrackerSandboxPayloadSupport.js';
import {
  buildDisabledFirecrackerStatus,
  buildDirectUnsupportedStatus,
  buildFirecrackerBinaryUnavailableStatus,
  buildKernelUnavailableStatus,
  buildKvmUnavailableStatus,
  buildReadyFirecrackerStatus,
  buildRootfsUnavailableStatus,
  checkFirecrackerBinary,
  checkKvmAccess,
  type FirecrackerSandboxStatus,
} from './firecracker-runtime/FirecrackerSandboxEnvironment.js';

import type {
  ISandboxRuntime,
  SandboxLanguage,
  SandboxRequest,
  SandboxResult,
} from './ISandboxRuntime.js';

export type { FirecrackerSandboxStatus } from './firecracker-runtime/FirecrackerSandboxEnvironment.js';

/**
 * FirecrackerSandboxRuntime - executa code em MicroVMs efemeras do Firecracker.
 *
 * Security hierarchy:
 *   local-jail < container (gVisor) < microvm (Firecracker)
 */
export class FirecrackerSandboxRuntime implements ISandboxRuntime {
  public readonly securityLevel = 'microvm' as const;

  private readonly tempBasePath: string;
  private readonly wslProjectRoot: string | null;
  private readonly payloadSupport: FirecrackerSandboxPayloadSupport;

  constructor(basePath?: string) {
    this.tempBasePath = basePath || path.join(os.tmpdir(), 'zavorth_firecracker_vms');
    this.wslProjectRoot = this.toWslPath(config.projectRoot);
    this.payloadSupport = new FirecrackerSandboxPayloadSupport(this);
  }

  public isAvailable(): boolean {
    return this.getStatus().canRun;
  }

  public getStatus(): FirecrackerSandboxStatus {
    if (!config.firecrackerEnabled) {
      return buildDisabledFirecrackerStatus(this.usesWslBridge() ? 'wsl' : 'direct');
    }

    if (this.usesWslBridge()) {
      return getWslStatus(this.wslProjectRoot);
    }

    if (process.platform !== 'linux') {
      return buildDirectUnsupportedStatus(process.platform);
    }

    if (!checkKvmAccess()) {
      return buildKvmUnavailableStatus();
    }

    if (!checkFirecrackerBinary(config.firecrackerBinPath)) {
      return buildFirecrackerBinaryUnavailableStatus(config.firecrackerBinPath);
    }

    if (!fs.existsSync(config.firecrackerKernelPath)) {
      return buildKernelUnavailableStatus(config.firecrackerKernelPath);
    }

    if (!fs.existsSync(config.firecrackerRootfsPath)) {
      return buildRootfsUnavailableStatus(config.firecrackerRootfsPath);
    }

    return buildReadyFirecrackerStatus();
  }

  public async execute(request: SandboxRequest): Promise<SandboxResult> {
    const status = this.getStatus();
    if (!status.canRun) {
      throw new Error(`[FirecrackerSandbox] Inavailable: ${status.detail}`);
    }

    if (this.usesWslBridge()) {
      return executeViaWsl(request, this.wslProjectRoot);
    }

    const vmId = `fc_${uuidv4().slice(0, 8)}`;
    const vmDir = path.join(this.tempBasePath, vmId);
    fs.mkdirSync(vmDir, { recursive: true });

    const socketPath = path.join(vmDir, 'firecracker.sock');
    const payloadDrivePath = path.join(vmDir, 'payload.ext4');
    const vmRootfs = path.join(vmDir, 'rootfs.ext4');
    const startedAt = Date.now();
    let firecrackerProcess: ReturnType<typeof spawnNativeCommand> | null = null;

    try {
      this.buildPayloadDrive(request.language, request.code, vmDir, payloadDrivePath);
      fs.copyFileSync(config.firecrackerRootfsPath, vmRootfs);

      firecrackerProcess = spawnNativeCommand(
        config.firecrackerBinPath,
        ['--api-sock', socketPath, '--level', 'Warning'],
        { stdio: ['ignore', 'ignore', 'ignore'], detached: true },
      );

      await this.waitForSocket(socketPath, 5000);
      await this.configureVm(socketPath, vmRootfs, payloadDrivePath);

      await this.firecrackerApiCall(socketPath, 'PUT', '/actions', {
        action_type: 'InstanceStart',
      });

      const result = await this.waitForResults(
        vmDir,
        payloadDrivePath,
        request.timeoutMs || config.firecrackerExecutionTimeoutMs,
      );

      return {
        ...result,
        executionTimeMs: Date.now() - startedAt,
        securityLevel: this.securityLevel,
        runtime: 'FirecrackerSandboxRuntime',
      };
    } finally {
      this.destroyVm(firecrackerProcess, socketPath, vmDir);
    }
  }

  private buildPayloadDrive(
    language: SandboxLanguage,
    code: string,
    vmDir: string,
    drivePath: string,
  ): void {
    this.payloadSupport.buildPayloadDrive(language, code, vmDir, drivePath);
  }

  private extractResultsFromDrive(
    drivePath: string,
    vmDir: string,
  ): { stdout: string; stderr: string; exitCode: number | null } {
    return this.payloadSupport.extractResultsFromDrive(drivePath, vmDir);
  }

  private async configureVm(
    socketPath: string,
    rootfsPath: string,
    payloadDrivePath: string,
  ): Promise<void> {
    await this.firecrackerApiCall(socketPath, 'PUT', '/boot-source', {
      kernel_image_path: config.firecrackerKernelPath,
      boot_args:
        'console=ttyS0 reboot=k panic=1 pci=off quiet loglevel=1 init=/sbin/zavorth-init',
    });

    await this.firecrackerApiCall(socketPath, 'PUT', '/drives/rootfs', {
      drive_id: 'rootfs',
      path_on_host: rootfsPath,
      is_root_device: true,
      is_read_only: false,
    });

    await this.firecrackerApiCall(socketPath, 'PUT', '/drives/payload', {
      drive_id: 'payload',
      path_on_host: payloadDrivePath,
      is_root_device: false,
      is_read_only: false,
    });

    await this.firecrackerApiCall(socketPath, 'PUT', '/machine-config', {
      vcpu_count: config.firecrackerVcpuCount,
      mem_size_mib: config.firecrackerMemSizeMib,
    });
  }

  private async waitForResults(
    vmDir: string,
    payloadDrivePath: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return this.payloadSupport.waitForResults(vmDir, payloadDrivePath, timeoutMs);
  }

  private firecrackerApiCall(
    socketPath: string,
    method: string,
    urlPath: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);

      const req = http.request(
        {
          socketPath,
          path: urlPath,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 0, body: data });
          });
        },
      );

      req.on('error', (err) => {
        reject(new Error(`[FirecrackerAPI] ${method} ${urlPath} failed: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  private getCodeFilename(language: SandboxLanguage): string {
    if (language === 'javascript') return 'code.js';
    if (language === 'python') return 'code.py';
    return 'code.sh';
  }

  private getInterpreter(language: SandboxLanguage): string {
    if (language === 'javascript') return 'node';
    if (language === 'python') return 'python3';
    return 'bash';
  }

  private waitForSocket(socketPath: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const poll = (): void => {
        if (fs.existsSync(socketPath)) {
          resolve();
          return;
        }

        if (Date.now() >= deadline) {
          reject(new Error(`[FirecrackerSandbox] Socket ${socketPath} did not appear within ${timeoutMs}ms.`));
          return;
        }

        setTimeout(poll, 100);
      };

      poll();
    });
  }

  private destroyVm(
    firecrackerProcess: ReturnType<typeof spawnNativeCommand> | null,
    socketPath: string,
    vmDir: string,
  ): void {
    try {
      this.firecrackerApiCall(socketPath, 'PUT', '/actions', {
        action_type: 'SendCtrlAltDel',
      }).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
    } catch (error: unknown) {// ignore
      logger.warn('[Firecracker Sandbox Runtime] process execution failed', error);
    }

    if (firecrackerProcess) {
      try {
        firecrackerProcess.kill('SIGKILL');
      } catch (error: unknown) {// ignore
      logger.warn('[Firecracker Sandbox Runtime] operation failed', error);
    }
    }

    try {
      fs.rmSync(vmDir, { recursive: true, force: true });
    } catch (error: unknown) {// ignore
      logger.warn('[Firecracker Sandbox Runtime] operation failed', error);
    }
  }

  private usesWslBridge(): boolean {
    return process.platform === 'win32' && config.firecrackerTransport === 'wsl';
  }

  private toWslPath(targetPath: string): string | null {
    const normalized = String(targetPath || '').trim();
    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('/')) {
      return normalized.replace(/\\/g, '/');
    }

    const windowsLike = normalized.replace(/\\/g, '/');
    const match = windowsLike.match(/^([A-Za-z]):\/(.*)$/);
    if (!match) {
      return null;
    }

    const drive = match[1].toLowerCase();
    const rest = match[2].replace(/\/+/g, '/');
    return `/mnt/${drive}/${rest}`;
  }
}
