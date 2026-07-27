import os from 'os';
import { logger } from '../logger.js';
import { RuntimeArtifactMaintenanceService } from '../services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../services/RuntimeLogMaintenanceService.js';
import type { BootstrapSupervisor } from './bootstrapTypes.js';export function printBootstrapBanner(): void {
  logger.info('===========================================');
  logger.info('  Zavorth v2.0 - Overhaul Arquitetural');
  logger.info('===========================================\n');
}

export function runInitialRuntimeMaintenance(
  runtimeArtifactMaintenanceService: RuntimeArtifactMaintenanceService,
  runtimeLogMaintenanceService: RuntimeLogMaintenanceService,
): void {
  runtimeLogMaintenanceService.rotateOversizedLogs();
  const visualSmokeCleanup = runtimeArtifactMaintenanceService.cleanupVisualSmokeProfiles();
  if (visualSmokeCleanup.deletedEntries <= 0) {
    return;
  }

  logger.info(
    `[runtime-maintenance] Cleaned ${visualSmokeCleanup.deletedEntries} visual-smoke profile(s) and recovered ${(visualSmokeCleanup.freedBytes / 1024 / 1024).toFixed(1)} MB.`,
  );
}

export function createBootstrapSupervisor(): BootstrapSupervisor {
  const supervisedIpcEnabled = process.env.ZAVORTH_SUPERVISED === 'true' && typeof process.send === 'function';
  let bootProgressStage = 'bootstrap-start';
  let bootProgressTimer: ReturnType<typeof setInterval> | null = null;
  let supervisorHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const sendSupervisorMessage = (message: Record<string, unknown>) => {
    if (!supervisedIpcEnabled || typeof process.send !== 'function') {
      return;
    }

    try {
      process.send(message);
    } catch (error: unknown) {// The main bootstrap should not fail because of a supervisor IPC error.
    }
  };

  const clearBootProgressTimer = () => {
    if (!bootProgressTimer) {
      return;
    }

    clearInterval(bootProgressTimer);
    bootProgressTimer = null;
  };

  const clearSupervisorHeartbeatTimer = () => {
    if (!supervisorHeartbeatTimer) {
      return;
    }

    clearInterval(supervisorHeartbeatTimer);
    supervisorHeartbeatTimer = null;
  };

  const updateProgress = (stage: string) => {
    bootProgressStage = stage;
    sendSupervisorMessage({ type: 'boot_progress', stage });
  };

  const markBootReady = () => {
    if (!supervisedIpcEnabled || typeof process.send !== 'function' || supervisorHeartbeatTimer) {
      return;
    }

    clearBootProgressTimer();
    sendSupervisorMessage({ type: 'boot_success' });

    let lastCpuUsage = process.cpuUsage();
    let lastCpuTimestamp = Date.now();
    const sendHeartbeat = () => {
      const currentCpu = process.cpuUsage();
      const elapsedMs = Math.max(1, Date.now() - lastCpuTimestamp);
      const deltaUser = currentCpu.user - lastCpuUsage.user;
      const deltaSystem = currentCpu.system - lastCpuUsage.system;
      const cpuPercent = ((deltaUser + deltaSystem) / 1000 / elapsedMs) / Math.max(1, os.cpus().length) * 100;
      const memoryUsage = process.memoryUsage();
      sendSupervisorMessage({
        type: 'heartbeat',
        stats: {
          rssMb: memoryUsage.rss / 1024 / 1024,
          heapUsedMb: memoryUsage.heapUsed / 1024 / 1024,
          cpuPercent,
          uptimeSec: process.uptime(),
        },
      });
      lastCpuUsage = currentCpu;
      lastCpuTimestamp = Date.now();
    };

    sendHeartbeat();
    supervisorHeartbeatTimer = setInterval(sendHeartbeat, 20_000);
    supervisorHeartbeatTimer.unref?.();
  };

  if (supervisedIpcEnabled) {
    updateProgress('platform-capabilities');
    bootProgressTimer = setInterval(() => {
      sendSupervisorMessage({ type: 'boot_progress', stage: bootProgressStage });
    }, 10_000);
    bootProgressTimer.unref?.();
  }

  return {
    supervisedIpcEnabled,
    updateProgress,
    markBootReady,
    clear() {
      clearBootProgressTimer();
      clearSupervisorHeartbeatTimer();
    },
    async isHttpHealthy(url: string) {
      try {
        const response = await fetch(url, { method: 'GET' });
        return response.ok;
      } catch (error: unknown) {return false;
      }
    },
  };
}
