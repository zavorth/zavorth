import type { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';
import type { ToolHookPipelineService } from '../services/ToolHookPipelineService.js';
import type { TelemetryRuntimeService } from '../observability/telemetry/TelemetryRuntimeService.js';

export interface ServiceToken<T> {
  readonly id: symbol;
  readonly description: string;
}

export const ServiceTokens = {
  SecurityAuditLogger: {
    id: Symbol.for('zavorth.SecurityAuditLogger'),
    description: 'SecurityAuditLogger',
  } as ServiceToken<SecurityAuditLogger>,
  ToolHookPipelineService: {
    id: Symbol.for('zavorth.ToolHookPipelineService'),
    description: 'ToolHookPipelineService',
  } as ServiceToken<ToolHookPipelineService>,
  TelemetryRuntimeService: {
    id: Symbol.for('zavorth.TelemetryRuntimeService'),
    description: 'TelemetryRuntimeService',
  } as ServiceToken<TelemetryRuntimeService>,
} as const;
