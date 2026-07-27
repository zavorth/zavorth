import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';export enum OperationalMode {
  READ_ONLY = 'READ_ONLY',
  WORKSPACE = 'WORKSPACE',
  BUILD = 'BUILD',
  PRIVILEGED = 'PRIVILEGED',
}

export interface ModePermissions {
  canRead: boolean;
  canWrite: boolean;
  canExecuteCommands: boolean;
  canDelete: boolean;
  canAccessNetwork: boolean;
  canUseSudo: boolean;
  requiresConfirmation: boolean;
}

const MODE_PERMISSIONS: Record<OperationalMode, ModePermissions> = {
  [OperationalMode.READ_ONLY]: {
    canRead: true,
    canWrite: false,
    canExecuteCommands: false,
    canDelete: false,
    canAccessNetwork: false,
    canUseSudo: false,
    requiresConfirmation: false,
  },
  [OperationalMode.WORKSPACE]: {
    canRead: true,
    canWrite: true,
    canExecuteCommands: false,
    canDelete: false,
    canAccessNetwork: false,
    canUseSudo: false,
    requiresConfirmation: false,
  },
  [OperationalMode.BUILD]: {
    canRead: true,
    canWrite: true,
    canExecuteCommands: true,
    canDelete: false,
    canAccessNetwork: true,
    canUseSudo: false,
    requiresConfirmation: false,
  },
  [OperationalMode.PRIVILEGED]: {
    canRead: true,
    canWrite: true,
    canExecuteCommands: true,
    canDelete: true,
    canAccessNetwork: true,
    canUseSudo: true,
    requiresConfirmation: true,
  },
};

export class ModeManager {
  private currentMode: OperationalMode;
  private readonly persistencePath: string | null;

  constructor(initialMode: OperationalMode = OperationalMode.WORKSPACE, persistencePath?: string | null) {
    this.persistencePath = persistencePath || null;
    this.currentMode = this.loadPersistedMode(initialMode);
  }

  public getMode(): OperationalMode {
    return this.currentMode;
  }

  public setMode(mode: OperationalMode): void {
    this.currentMode = mode;
    this.persistMode();
  }

  public getPermissions(): ModePermissions {
    return { ...MODE_PERMISSIONS[this.currentMode] };
  }

  public isAllowed(action: keyof ModePermissions): boolean {
    return MODE_PERMISSIONS[this.currentMode][action] as boolean;
  }

  public static minimumModeFor(operationType: string): OperationalMode {
    switch (operationType) {
      case 'read':
      case 'list':
      case 'search':
      case 'analyze':
        return OperationalMode.READ_ONLY;
      case 'write_file':
      case 'create_file':
      case 'edit_file':
      case 'mkdir':
        return OperationalMode.WORKSPACE;
      case 'exec':
      case 'build':
      case 'npm':
      case 'install':
      case 'script':
        return OperationalMode.BUILD;
      case 'delete':
      case 'overwrite':
      case 'sudo':
      case 'network':
      case 'rm':
      case 'format':
        return OperationalMode.PRIVILEGED;
      default:
        return OperationalMode.PRIVILEGED;
    }
  }

  public isSufficientFor(operationType: string): boolean {
    const required = ModeManager.minimumModeFor(operationType);
    const modeOrder = [
      OperationalMode.READ_ONLY,
      OperationalMode.WORKSPACE,
      OperationalMode.BUILD,
      OperationalMode.PRIVILEGED,
    ];

    const currentIndex = modeOrder.indexOf(this.currentMode);
    const requiredIndex = modeOrder.indexOf(required);
    return currentIndex >= requiredIndex;
  }

  private loadPersistedMode(fallbackMode: OperationalMode): OperationalMode {
    if (!this.persistencePath || !fs.existsSync(this.persistencePath)) {
      return fallbackMode;
    }

    try {
      const raw = fs.readFileSync(this.persistencePath, 'utf8');
      const parsed = JSON.parse(raw) as { mode?: string };
      const persistedMode = String(parsed.mode || '').trim().toUpperCase();

      return this.isOperationalMode(persistedMode)
        ? (persistedMode as OperationalMode)
        : fallbackMode;
    } catch (error: unknown) {logger.warn('[Operational Mode] JSON parse failed', error); return fallbackMode; }
  }

  private persistMode(): void {
    if (!this.persistencePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true });
      fs.writeFileSync(
        this.persistencePath,
        JSON.stringify(
          {
            mode: this.currentMode,
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );
    } catch (error: unknown) {// Ignore persistence failures and keep the in-memory mode active.
      logger.warn('[Operational Mode] filesystem operation failed', error);
    }
  }

  private isOperationalMode(value: string): value is OperationalMode {
    return value === OperationalMode.READ_ONLY
      || value === OperationalMode.WORKSPACE
      || value === OperationalMode.BUILD
      || value === OperationalMode.PRIVILEGED;
  }
}
