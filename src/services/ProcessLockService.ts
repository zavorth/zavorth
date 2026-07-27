import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
type LockPayload = {
  pid: number;
  owner: string;
  startedAt: string;
};

type ProcessLockRuntime = {
  pid?: number;
  kill?: (pid: number, signal?: number | NodeJS.Signals) => void;
};

export const ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE = 75;

export class ZavorthProcessLockConflictError extends Error {
  public readonly code = 'ZAVORTH_PROCESS_LOCK_CONFLICT';

  constructor(public readonly existingPid: number) {
    super(
      `Outra instance do Zavorth already is rodando in this workspace (PID ${existingPid}). Finalize a instance anterior before iniciar outra.`,
    );
    this.name = 'ZavorthProcessLockConflictError';
  }
}

export class ProcessLockService {
  private acquired = false;
  private readonly currentPid: number;
  private readonly killFn: (pid: number, signal?: number | NodeJS.Signals) => void;

  constructor(
    private readonly lockFilePath: string,
    runtime: ProcessLockRuntime = {},
  ) {
    this.currentPid = runtime.pid ?? process.pid;
    this.killFn = runtime.kill ?? process.kill.bind(process);
  }

  public acquire(owner: string): void {
    fs.mkdirSync(path.dirname(this.lockFilePath), { recursive: true });
    this.releaseStaleLock();

    const payload: LockPayload = {
      pid: this.currentPid,
      owner,
      startedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(this.lockFilePath, JSON.stringify(payload, null, 2), {
        encoding: 'utf8',
        flag: 'wx',
      });
      this.acquired = true;
    } catch (error: unknown) {if (asErrorLike(error).code !== 'EEXIST') {
        throw error;
      }

      const activeLock = this.readLock();
      if (activeLock?.pid && this.isProcessAlive(activeLock.pid) && activeLock.pid !== this.currentPid) {
        throw new ZavorthProcessLockConflictError(activeLock.pid);
      }

      fs.writeFileSync(this.lockFilePath, JSON.stringify(payload, null, 2), {
        encoding: 'utf8',
        flag: 'w',
      });
      this.acquired = true;
    }
  }

  public release(): void {
    if (!this.acquired) {
      return;
    }

    const activeLock = this.readLock();
    if (!activeLock || activeLock.pid === this.currentPid) {
      try {
        this.removeLockFileSafely();
      } catch (error: unknown) {// Shutdown should not fail just because Windows kept the lock file busy.
      logger.warn('[Process Lock] delete operation failed', error);
    }
    }

    this.acquired = false;
  }

  public ensure(owner: string): void {
    if (!this.acquired) {
      return;
    }

    const activeLock = this.readLock();
    if (activeLock?.pid === this.currentPid && activeLock.owner === owner) {
      return;
    }

    const payload: LockPayload = {
      pid: this.currentPid,
      owner,
      startedAt: activeLock?.pid === this.currentPid && activeLock.startedAt
        ? activeLock.startedAt
        : new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(this.lockFilePath), { recursive: true });
    fs.writeFileSync(this.lockFilePath, JSON.stringify(payload, null, 2), {
      encoding: 'utf8',
      flag: 'w',
    });
  }

  private releaseStaleLock(): void {
    const activeLock = this.readLock();
    if (!activeLock) {
      return;
    }

    if (!activeLock.pid || !this.isProcessAlive(activeLock.pid)) {
      try {
        this.removeLockFileSafely();
      } catch (error: unknown) {// If Windows keeps the stale file locked, acquire() can still overwrite it safely later.
      logger.warn('[Process Lock] filesystem operation failed', error);
    }
    }
  }

  private removeLockFileSafely(): boolean {
    if (!fs.existsSync(this.lockFilePath)) {
      return true;
    }

    try {
      fs.rmSync(this.lockFilePath, { force: true });
      return true;
    } catch (error: unknown) {if (asErrorLike(error).code !== 'EPERM') {
        throw error;
      }
    }

    try {
      fs.chmodSync(this.lockFilePath, 0o666);
    } catch (error: unknown) {// Keep going; Windows may still allow deletion after a short rename.
      logger.warn('[Process Lock] filesystem operation failed', error);
    }

    try {
      fs.rmSync(this.lockFilePath, { force: true });
      return true;
    } catch (error: unknown) {if (asErrorLike(error).code !== 'EPERM') {
        throw error;
      }
    }

    const renamedPath = `${this.lockFilePath}.${Date.now()}.stale`;
    try {
      fs.renameSync(this.lockFilePath, renamedPath);
      try {
        fs.rmSync(renamedPath, { force: true });
      } catch (error: unknown) {// If cleanup fails after rename, the active lock path is still free for reuse.
      logger.warn('[Process Lock] operation failed', error);
    }
      return true;
    } catch (error: unknown) {logger.warn('[Process Lock] rename operation failed', error); return false; }
  }

  private readLock(): LockPayload | null {
    if (!fs.existsSync(this.lockFilePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8')) as LockPayload;
    } catch (error: unknown) {logger.warn('[Process Lock] JSON parse failed', error); return null; }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      this.killFn(pid, 0);
      return true;
    } catch (error: unknown) {logger.warn('[Process Lock] JSON parse failed', error); return asErrorLike(error).code !== 'ESRCH'; }
  }
}
