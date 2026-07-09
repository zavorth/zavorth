import fs from 'fs';
import path from 'path';
import { logger } from '../../../../../logger';
import {
EMPTY_RUNTIME_OFFICIAL_REMOTE_STATE,
  type RuntimeOfficialRemotePersistedState,
} from './RuntimeOfficialRemoteAccessTypes.js';type RuntimeOfficialRemoteAccessStateStoreDeps = {
  stateFilePath: string;
  existsSync: typeof fs.existsSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  mkdirSync: typeof fs.mkdirSync;
};

export class RuntimeOfficialRemoteAccessStateStore {
  private readonly stateFilePath: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(deps: RuntimeOfficialRemoteAccessStateStoreDeps) {
    this.stateFilePath = deps.stateFilePath;
    this.existsSync = deps.existsSync;
    this.readFileSync = deps.readFileSync;
    this.writeFileSync = deps.writeFileSync;
    this.mkdirSync = deps.mkdirSync;
  }

  public normalize(input: RuntimeOfficialRemotePersistedState): RuntimeOfficialRemotePersistedState {
    return {
      provider: input.provider || null,
      lastAction: input.lastAction || null,
      lastActionAt: input.lastActionAt || null,
      lastVerifiedAt: input.lastVerifiedAt || null,
      status: input.status || 'pending',
      appUrl: input.appUrl || null,
      baseUrl: input.baseUrl || null,
      issues: Array.from(new Set((input.issues || []).filter(Boolean))),
      summary: String(input.summary || '').trim(),
    };
  }

  public readState(): RuntimeOfficialRemotePersistedState {
    if (!this.existsSync(this.stateFilePath)) {
      return { ...EMPTY_RUNTIME_OFFICIAL_REMOTE_STATE };
    }

    try {
      const parsed = JSON.parse(String(this.readFileSync(this.stateFilePath, 'utf8') || '{}'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ...EMPTY_RUNTIME_OFFICIAL_REMOTE_STATE };
      }

      return this.normalize({
        ...EMPTY_RUNTIME_OFFICIAL_REMOTE_STATE,
        ...(parsed as Partial<RuntimeOfficialRemotePersistedState>),
      });
    } catch (error: unknown) {logger.warn('[Runtime Official Remote Access State Store] JSON parse failed', error);
    return { ...EMPTY_RUNTIME_OFFICIAL_REMOTE_STATE };
  }
  }

  public writeState(state: RuntimeOfficialRemotePersistedState): void {
    this.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    this.writeFileSync(this.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}
