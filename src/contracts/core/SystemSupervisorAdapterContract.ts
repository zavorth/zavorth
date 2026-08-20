import type {
  SystemSupervisorActionRequest,
  SystemSupervisorActionRecord,
  SystemSupervisorCapabilityDecision,
} from './SystemSupervisorContract.js';

export type SystemSupervisorAdapterResult = {
  ok: boolean;
  stdout?: string | null;
  stderr?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rollbackAvailable?: boolean;
  metadata?: Record<string, unknown>;
};

export interface SystemSupervisorRuntimeAdapter {
  readonly id: string;
  readonly label: string;
  canHandle(
    request: SystemSupervisorActionRequest,
    decision: SystemSupervisorCapabilityDecision,
  ): boolean;
  execute(
    request: SystemSupervisorActionRequest,
    decision: SystemSupervisorCapabilityDecision,
  ): Promise<SystemSupervisorAdapterResult>;
  cancel?(
    actionId: string,
    reason?: string | null,
  ): Promise<SystemSupervisorAdapterResult>;
  rollback?(
    action: SystemSupervisorActionRecord,
    reason?: string | null,
  ): Promise<SystemSupervisorAdapterResult>;
}
