import * as fs from 'fs';
import * as path from 'path';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';
const logger = {
  info: (message: string) => logger.info(message),
  warn: (message: string) => logger.warn(message),
  error: (message: string) => logger.error(message),
};

type ProcessStatus = boolean | 'access_denied';

function isProcessRunning(pid: number): ProcessStatus {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    const code = error instanceof Error && 'code' in error ? String((error as NodeJS.ErrnoException).code || '') : '';
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ESRCH') {
      return false;
    }
    if (code === 'EPERM' || /access denied|operation not permitted/i.test(message)) {
      logger.warn(`isProcessRunning: access denied while checking PID ${pid}.`);
      return 'access_denied';
    }
    return false;
  }
}

async function attemptToKillProcess(pid: number, type: string, timeoutMs = 1000): Promise<boolean> {
  logger.info(`Attempting to terminate ${type} process with PID ${pid}.`);
  try {
    process.kill(pid, 'SIGTERM');

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (isProcessRunning(pid) === false) {
        logger.info(`${type} process with PID ${pid} terminated successfully.`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const finalStatus = isProcessRunning(pid);
    if (finalStatus === true) {
      logger.warn(`${type} process with PID ${pid} stayed alive after termination attempt.`);
      return false;
    }
    if (finalStatus === 'access_denied') {
      logger.warn(
        `Could not verify final status for ${type} process with PID ${pid} after termination attempt because access was denied. Assuming termination failed.`,
      );
      return false;
    }

    logger.info(`${type} process with PID ${pid} was already dead or exited shortly after timeout.`);
    return true;
  } catch (error: unknown) {
    const code = error instanceof Error && 'code' in error ? String((error as NodeJS.ErrnoException).code || '') : '';
    if (code === 'ESRCH') {
      logger.info(`${type} process with PID ${pid} was already dead.`);
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to signal ${type} process with PID ${pid}: ${message}`);
    return false;
  }
}

export async function cleanupOrphanProcesses(lockDirPath: string): Promise<void> {
  logger.info(`Starting orphan process and lock file cleanup in ${lockDirPath}.`);

  const processesFailedToTerminate = new Set<number>();
  const initialKnownPidsToTerminate: Array<{ pid: number; type: string }> = [];

  for (const { pid, type } of initialKnownPidsToTerminate) {
    const terminated = await attemptToKillProcess(pid, type);
    if (!terminated) {
      processesFailedToTerminate.add(pid);
    }
  }

  try {
    const lockFiles = await fs.promises.readdir(lockDirPath);

    for (const file of lockFiles) {
      if (!file.endsWith('.lock')) {
        continue;
      }

      const lockFilePath = path.join(lockDirPath, file);
      let pidFromLock: number | null = null;

      try {
        const content = await fs.promises.readFile(lockFilePath, 'utf8');
        pidFromLock = safeParseInt(content.trim(), NaN);
        if (Number.isNaN(pidFromLock)) {
          logger.warn(`Invalid lock file '${file}': PID is not a number. Removing it.`);
          await fs.promises.unlink(lockFilePath);
          continue;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Could not read lock file '${file}': ${message}. Removing it.`);
        await fs.promises.unlink(lockFilePath);
        continue;
      }

      logger.info(`Processing lock file '${file}' pointing to PID ${pidFromLock}.`);

      if (processesFailedToTerminate.has(pidFromLock)) {
        logger.error(
          `Lock file '${file}' points to PID ${pidFromLock}, which explicitly failed to terminate. ` +
            'The lock file will be kept to prevent inconsistent state and multiple instances. Manual intervention may be required.',
        );
        continue;
      }

      const processStatus = isProcessRunning(pidFromLock);
      if (processStatus === false) {
        logger.info(`Lock file '${file}' points to dead PID ${pidFromLock}. Removing it.`);
        await fs.promises.unlink(lockFilePath);
        continue;
      }

      if (processStatus === 'access_denied') {
        logger.error(
          `Lock file '${file}' for PID ${pidFromLock} was kept because process status could not be verified due to access denial. ` +
            'Keeping the lock avoids removing a file that may still point to an active but inaccessible process. Manual intervention may be required.',
        );
        continue;
      }

      logger.info(`Lock file '${file}' points to active PID ${pidFromLock}. Keeping it.`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to list or process lock files in ${lockDirPath}: ${message}`);
    logger.error('Critical error during lock file cleanup. Boot may be compromised and may require manual intervention.');
    throw error;
  }

  logger.info('Orphan process cleanup completed.');
}
