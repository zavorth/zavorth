import fs from 'fs';
import { execNativeCommandSync } from '../../../core/CommandSpawn.js';
import { logger } from '../../../logger.js';

export type FirecrackerSandboxStatus = {
  enabled: boolean;
  transport?: 'direct' | 'wsl';
  bridgeReady?: boolean;
  firecrackerReachable: boolean;
  kvmAvailable: boolean;
  kernelPresent: boolean;
  rootfsPresent: boolean;
  canRun: boolean;
  detail: string;
};

type FirecrackerSandboxStatusInput = Omit<FirecrackerSandboxStatus, 'detail'> & {
  detail: string;
};

export function createFirecrackerStatus(
  input: FirecrackerSandboxStatusInput,
): FirecrackerSandboxStatus {
  return input;
}

export function buildDisabledFirecrackerStatus(
  transport: 'direct' | 'wsl',
): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: false,
    transport,
    firecrackerReachable: false,
    kvmAvailable: false,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail: 'Firecracker MicroVM disabled by configuration (ZAVORTH_FIRECRACKER_ENABLED).',
  });
}

export function buildDirectUnsupportedStatus(platform: string): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'direct',
    firecrackerReachable: false,
    kvmAvailable: false,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail: `Firecracker requer Linux com KVM. Plataforma current: ${platform}.`,
  });
}

export function buildKvmUnavailableStatus(): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'direct',
    firecrackerReachable: false,
    kvmAvailable: false,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail:
      'KVM is unavailable (/dev/kvm). Check sudo chmod 666 /dev/kvm or enable nested virtualization.',
  });
}

export function buildFirecrackerBinaryUnavailableStatus(binPath: string): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'direct',
    firecrackerReachable: false,
    kvmAvailable: true,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail: `Firecracker binary not found at "${binPath}". Install through: https://github.com/firecracker-microvm/firecracker/releases`,
  });
}

export function buildKernelUnavailableStatus(kernelPath: string): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'direct',
    firecrackerReachable: true,
    kvmAvailable: true,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail: `Kernel vmlinux not found at "${kernelPath}". Download a precompiled kernel from the Firecracker repository.`,
  });
}

export function buildRootfsUnavailableStatus(rootfsPath: string): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'direct',
    firecrackerReachable: true,
    kvmAvailable: true,
    kernelPresent: true,
    rootfsPresent: false,
    canRun: false,
    detail: `Rootfs not found at "${rootfsPath}". Create it with: scripts/firecracker-build-rootfs.sh`,
  });
}

export function buildReadyFirecrackerStatus(): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'direct',
    firecrackerReachable: true,
    kvmAvailable: true,
    kernelPresent: true,
    rootfsPresent: true,
    canRun: true,
    detail: 'Firecracker MicroVM ready for safe code execution.',
  });
}

export function buildWslUnavailableStatus(detail: string): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'wsl',
    bridgeReady: false,
    firecrackerReachable: false,
    kvmAvailable: false,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail,
  });
}

export function buildWslReadyStatus(detail: string): FirecrackerSandboxStatus {
  return createFirecrackerStatus({
    enabled: true,
    transport: 'wsl',
    bridgeReady: true,
    firecrackerReachable: true,
    kvmAvailable: true,
    kernelPresent: true,
    rootfsPresent: true,
    canRun: true,
    detail,
  });
}

export function checkKvmAccess(): boolean {
  try {
    fs.accessSync('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (error: unknown) {logger.warn('[Firecracker Sandbox Environment] creation failed', error); return false; }
}

export function checkFirecrackerBinary(binPath: string): boolean {
  try {
    if (!fs.existsSync(binPath)) return false;
    execNativeCommandSync(binPath, ['--version'], {
      timeout: 5000,
      encoding: 'utf8',
    });
    return true;
  } catch (error: unknown) {logger.warn('[Firecracker Sandbox Environment] process execution failed', error); return false; }
}

export function toWslPath(targetPath: string): string | null {
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

export function toRequiredWslPath(targetPath: string, label: string): string {
  const converted = toWslPath(targetPath);
  if (!converted) {
    throw new Error(`Could not convert the path for ${label} to WSL: ${targetPath}`);
  }
  return converted;
}

export function quoteForBash(value: string): string {
  return `'${String(value || '').replace(/'/g, `'\"'\"'`)}'`;
}

export function getWslExecutable(): string {
  return process.platform === 'win32' ? `${process.env.WINDIR || 'C:\\Windows'}\\System32\\wsl.exe`
    : 'wsl';
}

export function getWslFirecrackerBinPath(configuredBinPath: string): string {
  const configured = String(configuredBinPath || '').trim();
  if (configured.startsWith('/')) {
    return configured;
  }
  return '/usr/local/bin/firecracker';
}

export function buildWslEnvParts(options: {
  binPath: string;
  kernelPath: string;
  rootfsPath: string;
}): string[] {
  return [
    `ZAVORTH_FIRECRACKER_ENABLED='true'`,
    `ZAVORTH_FIRECRACKER_BIN_PATH=${quoteForBash(options.binPath)}`,
    `ZAVORTH_FIRECRACKER_KERNEL_PATH=${quoteForBash(options.kernelPath)}`,
    `ZAVORTH_FIRECRACKER_ROOTFS_PATH=${quoteForBash(options.rootfsPath)}`,
  ];
}

export function buildWslBaseArgs(distro: string, user: string | null | undefined, command: string): string[] {
  const args = ['-d', distro];
  if (user) {
    args.push('-u', user);
  }
  args.push('--', 'bash', '-lc', command);
  return args;
}
