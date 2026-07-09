import type { IZavorthTool } from '../../../echo/types/IZavorthTool.js';
import { logger } from '../../../logger.js';
import type {
EchoCapabilityArtifactRecord,
  EchoCapabilityLifecycleRecord,
  EchoCapabilityPolicyRecord,
  EchoCapabilitySurfaceState,
} from '../../../echo/types/EchoTypes.js';

type ToolExecutionSurfaceProjection = {
  lifecycle: EchoCapabilityLifecycleRecord | null;
  artifact: EchoCapabilityArtifactRecord | null;
  policy: EchoCapabilityPolicyRecord | null;
};

type LifecycleCapableTool = IZavorthTool & {
  getLifecycleSnapshot?: () => unknown;
};

/**
 * Normalizes capability execution details and live lifecycle snapshots so every
 * surface can read the same contract without knowing tool-specific payloads.
 */
export class EchoCapabilitySurfaceStateService {
  public projectExecutionData(data: unknown): ToolExecutionSurfaceProjection {
    const record = this.asRecord(data);
    return {
      lifecycle: this.normalizeLifecycle(record?.lifecycle),
      artifact: this.normalizeArtifact(record?.artifact),
      policy: this.normalizePolicy(record?.policy),
    };
  }

  public buildCapabilityLifecycle(tools: IZavorthTool[]): EchoCapabilitySurfaceState[] {
    return tools
      .map((tool) => this.buildCapabilityState(tool))
      .filter((entry): entry is EchoCapabilitySurfaceState => Boolean(entry));
  }

  private buildCapabilityState(tool: IZavorthTool): EchoCapabilitySurfaceState | null {
    const lifecycle = this.readLifecycleFromTool(tool);
    if (!lifecycle) {
      return null;
    }
    return {
      capabilityId: `echo:${String(tool.name || '').trim()}`,
      toolName: String(tool.name || '').trim(),
      category: String(tool.category || '').trim().toLowerCase(),
      dangerLevel: String((tool as any).dangerLevel || '').trim() || null,
      requiresPermission: tool.requiresPermission === true,
      lifecycle,
    };
  }

  private readLifecycleFromTool(tool: IZavorthTool): EchoCapabilityLifecycleRecord | null {
    const capableTool = tool as LifecycleCapableTool;
    if (typeof capableTool.getLifecycleSnapshot !== 'function') {
      return null;
    }
    try {
      return this.normalizeLifecycle(capableTool.getLifecycleSnapshot());
    } catch (error: any) { const err = error; const e = error; logger.warn('[Capability Surface State] module import failed', error); return null; }
  }

  private normalizeLifecycle(value: unknown): EchoCapabilityLifecycleRecord | null {
    const record = this.asRecord(value);
    if (!record) {
      return null;
    }
    return {
      mode: this.optionalText(record.mode),
      status: this.optionalText(record.status),
      details: this.clone(record),
    };
  }

  private normalizeArtifact(value: unknown): EchoCapabilityArtifactRecord | null {
    const record = this.asRecord(value);
    if (!record) {
      return null;
    }
    return {
      id: this.optionalText(record.id),
      kind: this.optionalText(record.kind),
      source: this.optionalText(record.source),
      details: this.clone(record),
    };
  }

  private normalizePolicy(value: unknown): EchoCapabilityPolicyRecord | null {
    const record = this.asRecord(value);
    if (!record) {
      return null;
    }
    return {
      scope: this.optionalText(record.scope),
      details: this.clone(record),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private optionalText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value || {}));
  }
}
