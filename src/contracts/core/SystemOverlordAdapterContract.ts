import type {
  SystemOverlordActionRequest,
  SystemOverlordActionRecord,
  SystemOverlordCapabilityDecision,
} from './SystemOverlordContract.js';

export type SystemOverlordAdapterResult = {
  ok: boolean;
  stdout?: string | null;
  stderr?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rollbackAvailable?: boolean;
  metadata?: Record<string, unknown>;
};

export interface SystemOverlordRuntimeAdapter {
  readonly id: string;
  readonly label: string;
  canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean;
  execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult>;
  cancel?(
    actionId: string,
    reason?: string | null,
  ): Promise<SystemOverlordAdapterResult>;
  rollback?(
    action: SystemOverlordActionRecord,
    reason?: string | null,
  ): Promise<SystemOverlordAdapterResult>;
}
