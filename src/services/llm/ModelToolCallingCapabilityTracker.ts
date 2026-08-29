/**
 * Behavioral capability tracker: learns whether a model emits native
 * tool_calls or needs emulated invocations by observing real responses.
 * No hardcoded model map, no name matching — purely evidence-driven.
 * Learned state is persisted to a lightweight JSON file so it survives
 * process restarts.
 */

import fs from 'fs';
import path from 'path';

export type ToolCallingTrack = 'native' | 'emulated' | 'unknown';

export type ToolCallingTrackMode = 'auto' | 'native' | 'emulated';

export type ToolCallingObservation = {
  providerName: string;
  modelName: string | null;
  hadNativeToolCalls: boolean;
  hadEmulatedToolCalls: boolean;
};

type TrackState = {
  nativeCount: number;
  emulatedCount: number;
  plainCount: number;
  lastObservedAt: number;
};

type PersistedState = Record<string, TrackState>;

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EMULATED_THRESHOLD = 1;
const DEFAULT_NATIVE_THRESHOLD = 1;
const STATE_FILE_RELATIVE = path.join('data', 'runtime', 'model-tool-calling-capabilities.json');

function findProjectRootCwd(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'data'))) {
    return cwd;
  }
  return path.resolve(cwd);
}

export class ModelToolCallingCapabilityTracker {
  private static instance: ModelToolCallingCapabilityTracker | null = null;

  private readonly states = new Map<string, TrackState>();
  private readonly ttlMs: number;
  private readonly nativeThreshold: number;
  private readonly emulatedThreshold: number;
  private readonly forcedMode: ToolCallingTrackMode;
  private readonly stateFilePath: string | null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(runtime: {
    ttlMs?: number;
    nativeThreshold?: number;
    emulatedThreshold?: number;
    forcedMode?: ToolCallingTrackMode;
    stateFilePath?: string | null;
  } = {}) {
    this.ttlMs = runtime.ttlMs ?? DEFAULT_TTL_MS;
    this.nativeThreshold = runtime.nativeThreshold ?? DEFAULT_NATIVE_THRESHOLD;
    this.emulatedThreshold = runtime.emulatedThreshold ?? DEFAULT_EMULATED_THRESHOLD;
    this.forcedMode = runtime.forcedMode ?? this.resolveForcedModeFromEnv();
    this.stateFilePath = runtime.stateFilePath === null
      ? null
      : runtime.stateFilePath || this.resolveDefaultStateFilePath();
    this.loadPersistedState();
  }

  public static getInstance(runtime?: {
    ttlMs?: number;
    nativeThreshold?: number;
    emulatedThreshold?: number;
    forcedMode?: ToolCallingTrackMode;
    stateFilePath?: string | null;
  }): ModelToolCallingCapabilityTracker {
    if (!ModelToolCallingCapabilityTracker.instance) {
      ModelToolCallingCapabilityTracker.instance = new ModelToolCallingCapabilityTracker(runtime);
    }
    return ModelToolCallingCapabilityTracker.instance;
  }

  public static resetForTests(): void {
    if (ModelToolCallingCapabilityTracker.instance?.persistTimer) {
      clearTimeout(ModelToolCallingCapabilityTracker.instance.persistTimer);
      ModelToolCallingCapabilityTracker.instance.persistTimer = null;
    }
    ModelToolCallingCapabilityTracker.instance = null;
  }

  private resolveDefaultStateFilePath(): string {
    if (process.env.ZAVORTH_CAPABILITY_STATE_FILE) {
      return path.resolve(process.env.ZAVORTH_CAPABILITY_STATE_FILE);
    }
    return path.join(findProjectRootCwd(), STATE_FILE_RELATIVE);
  }

  private resolveForcedModeFromEnv(): ToolCallingTrackMode {
    const raw = String(process.env.ZAVORTH_TOOL_CALLING_MODE || '').trim().toLowerCase();
    if (raw === 'native') return 'native';
    if (raw === 'emulated') return 'emulated';
    return 'auto';
  }

  public record(observation: ToolCallingObservation): ToolCallingTrack {
    const key = this.keyFor(observation.providerName, observation.modelName);
    const now = Date.now();
    const current = this.states.get(key) || {
      nativeCount: 0,
      emulatedCount: 0,
      plainCount: 0,
      lastObservedAt: now,
    };
    const fresh = now - current.lastObservedAt <= this.ttlMs;
    const next: TrackState = fresh
      ? {
          nativeCount: current.nativeCount + (observation.hadNativeToolCalls ? 1 : 0),
          emulatedCount: current.emulatedCount + (observation.hadEmulatedToolCalls ? 1 : 0),
          plainCount: current.plainCount + (!observation.hadNativeToolCalls && !observation.hadEmulatedToolCalls ? 1 : 0),
          lastObservedAt: now,
        }
      : {
          nativeCount: observation.hadNativeToolCalls ? 1 : 0,
          emulatedCount: observation.hadEmulatedToolCalls ? 1 : 0,
          plainCount: !observation.hadNativeToolCalls && !observation.hadEmulatedToolCalls ? 1 : 0,
          lastObservedAt: now,
        };
    this.states.set(key, next);
    this.schedulePersist();
    return this.resolveTrackFromState(next);
  }

  public getTrack(providerName: string, modelName?: string | null): ToolCallingTrack {
    if (this.forcedMode !== 'auto') {
      return this.forcedMode;
    }
    const key = this.keyFor(providerName, modelName || null);
    const state = this.states.get(key);
    if (!state || Date.now() - state.lastObservedAt > this.ttlMs) {
      return 'unknown';
    }
    return this.resolveTrackFromState(state);
  }

  public shouldInjectEmulationPrompt(providerName: string, modelName?: string | null): boolean {
    return this.getTrack(providerName, modelName) === 'emulated';
  }

  public shouldInjectMinimalHint(providerName: string, modelName?: string | null): boolean {
    return this.getTrack(providerName, modelName) === 'unknown';
  }

  private resolveTrackFromState(state: TrackState): ToolCallingTrack {
    if (state.nativeCount >= this.nativeThreshold && state.emulatedCount === 0) {
      return 'native';
    }
    if (state.emulatedCount >= this.emulatedThreshold && state.nativeCount === 0) {
      return 'emulated';
    }
    if (state.nativeCount > 0 && state.emulatedCount > 0) {
      return state.nativeCount >= state.emulatedCount ? 'native' : 'emulated';
    }
    return 'unknown';
  }

  private keyFor(providerName: string, modelName: string | null): string {
    return `${providerName.toLowerCase()}:${String(modelName || '').toLowerCase() || 'default'}`;
  }

  private schedulePersist(): void {
    if (!this.stateFilePath) {
      return;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistToDisk();
    }, 300);
  }

  private persistToDisk(): void {
    if (!this.stateFilePath) {
      return;
    }
    try {
      const payload: PersistedState = {};
      for (const [key, state] of this.states.entries()) {
        payload[key] = { ...state };
      }
      const dir = path.dirname(this.stateFilePath);
      fs.mkdirSync(dir, { recursive: true });
      const tempPath = `${this.stateFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tempPath, this.stateFilePath);
    } catch {
      // Persistence is best-effort; the in-memory tracker keeps working.
    }
  }

  private loadPersistedState(): void {
    if (!this.stateFilePath || !fs.existsSync(this.stateFilePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.stateFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      for (const [key, state] of Object.entries(parsed)) {
        if (state && typeof state === 'object' && typeof state.nativeCount === 'number') {
          this.states.set(key, {
            nativeCount: state.nativeCount,
            emulatedCount: state.emulatedCount || 0,
            plainCount: state.plainCount || 0,
            lastObservedAt: state.lastObservedAt || Date.now(),
          });
        }
      }
    } catch {
      // Corrupt or missing file is ignored; tracker starts fresh.
    }
  }
}
