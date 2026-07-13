import fs from 'fs';
import path from 'path';
import { logger } from '../../../../logger';
import { errorMessage } from '../../../../utils/errorLike.js';
type WarnLogger = (message: string) => void;

export type ZavorthControlRuntimeStateWriteInput = {
  filePath: string;
  host: string;
  port: number;
  url: string;
  pid: number;
};

export class ZavorthControlRuntimeStateService {
  constructor(private readonly warn: WarnLogger = () => {}) {}

  public write(input: ZavorthControlRuntimeStateWriteInput): void {
    try {
      fs.mkdirSync(path.dirname(input.filePath), { recursive: true });
      fs.writeFileSync(
        input.filePath,
        JSON.stringify(
          {
            pid: input.pid,
            host: input.host,
            port: input.port,
            url: input.url,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );
    } catch (error: unknown) {this.warn(`Could not persist Control state: ${errorMessage(error)}`);
    }
  }

  public clear(filePath: string, currentPid: number): void {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      const pid = Number(parsed.pid || 0) || null;
      if (pid && pid !== currentPid) {
        return;
      }

      fs.rmSync(filePath, { force: true });
    } catch (error: unknown) {// Ignora limpeza falha de estado; o readiness vai filtrar snapshots mortos.
      logger.warn('[Zavorth Control Runtime State] JSON parse failed', error);
    }
  }
}

