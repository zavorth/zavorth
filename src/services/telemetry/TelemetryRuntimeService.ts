import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { redactSensitiveText } from '../../security/SensitiveDataGuard.js';
import { logger } from '../../logger.js';

export type TelemetryEvent = {
  timestamp: string;
  traceId: string;
  source: string;
  eventType: string;
  status?: string;
  payload?: Record<string, unknown>;
};

export class TelemetryRuntimeService {
  constructor(private readonly outputFile: string = config.telemetryEventsFile) {}

  public async record(event: Omit<TelemetryEvent, 'timestamp'>): Promise<void> {
    const payload: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      ...this.redactEvent(event),
    };

    await fs.promises.mkdir(path.dirname(this.outputFile), { recursive: true });
    await this.rotateIfNeeded();
    await fs.promises.appendFile(this.outputFile, `${JSON.stringify(payload)}\n`, 'utf8');
  }

  private redactEvent(event: Omit<TelemetryEvent, 'timestamp'>): Omit<TelemetryEvent, 'timestamp'> {
    return {
      ...event,
      payload: this.redactValue(event.payload || {}) as Record<string, unknown>,
    };
  }

  private redactValue(value: unknown, key = ''): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.redactValue(entry, key));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
          childKey,
          this.redactValue(childValue, childKey),
        ]),
      );
    }
    if (/(token|secret|password|pass|api[_-]?key|credential|authorization)/i.test(key) && value !== undefined && value !== null) {
      return '***';
    }
    if (typeof value === 'string') {
      return redactSensitiveText(value);
    }
    return value;
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.outputFile).catch(() => null);
      if (!stats || stats.size < config.runtimeLogRotationMaxBytes) {
        return;
      }
      const maxFiles = Math.max(1, Number(config.runtimeLogRotationMaxFiles || 5));
      for (let index = maxFiles - 1; index >= 1; index -= 1) {
        const source = `${this.outputFile}.${index}`;
        const target = `${this.outputFile}.${index + 1}`;
        if (await this.exists(source)) {
          await fs.promises.rename(source, target).catch(() => undefined);
        }
      }
      await fs.promises.rename(this.outputFile, `${this.outputFile}.1`).catch(() => undefined);
    } catch (error: unknown) {// Telemetria nao pode derrubar o runtime principal.
      logger.warn('[Telemetry Runtime] operation failed', error);
    }
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch (error: unknown) {logger.warn('[Telemetry Runtime] filesystem check failed', error); return false; }
  }
}
