import type { ZavorthCrossSurfaceProjectionSurface } from './ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type {
  ZavorthScheduledTaskPersistenceAction,
  ZavorthScheduledTaskPersistenceSnapshot,
} from './ZavorthScheduledTaskPersistenceContract.js';

export const ZAVORTH_SCHEDULED_TASK_SURFACE_CONTRACT_VERSION =
  '2026-05-12.governed-scheduled-task-surfaces-phase-4' as const;

export type ZavorthScheduledTaskSurfaceAction =
  | 'preview'
  | 'register'
  | 'list'
  | 'pause'
  | 'resume'
  | 'revoke'
  | 'reapprove';

export type ZavorthScheduledTaskSurfaceStatus =
  | 'ready'
  | 'completed'
  | 'waiting_approval'
  | 'blocked'
  | 'empty';

export type ZavorthScheduledTaskSurfaceRegisterInput = {
  intent: string;
  command: string;
  schedule: string;
  requestedBy: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  delivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  deliveryTarget?: string | null;
  workspace?: string | null;
  approvalId?: string | null;
  approvedBy?: string | null;
  ttlMs?: number | null;
  allowedTools?: string[] | null;
  maxMutations?: number | null;
  maxCommands?: number | null;
  maxNetworkRequests?: number | null;
};

export type ZavorthScheduledTaskSurfaceLifecycleInput = {
  action: Extract<ZavorthScheduledTaskPersistenceAction, 'pause' | 'resume' | 'revoke' | 'reapprove'>;
  taskId: string;
  requestedBy: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  approvalId?: string | null;
  approvedBy?: string | null;
  ttlMs?: number | null;
};

export type ZavorthScheduledTaskSurfaceTaskCard = {
  id: string;
  shortId: string;
  command: string;
  schedule: string;
  status: string;
  nextRun: string | null;
  lastRun: string | null;
  governed: boolean;
  approvalId: string | null;
  surface: string | null;
};

export type ZavorthScheduledTaskSurfaceResult = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULED_TASK_SURFACE_CONTRACT_VERSION;
  source: 'ZavorthScheduledTaskSurfaceService';
  phase: 'phase-4-governed-scheduled-task-surfaces';
  action: ZavorthScheduledTaskSurfaceAction;
  status: ZavorthScheduledTaskSurfaceStatus;
  ok: boolean;
  summary: string;
  details: string[];
  task: ZavorthScheduledTaskSurfaceTaskCard | null;
  tasks: ZavorthScheduledTaskSurfaceTaskCard[];
  persistence: ZavorthScheduledTaskPersistenceSnapshot | null;
  safety: {
    usesPersistenceService: true;
    noLegacyDirectSchedulerMutation: true;
    noDirectWorkloadExecution: true;
    approvalEnvelopeRequiredForMutation: true;
    rawSecretsSerialized: false;
  };
  commands: {
    list: '/schedules';
    register: '/schedule every 1h /status';
    revoke: '/unschedule <id>';
    automations: '/automations <pedido natural>';
  };
};
