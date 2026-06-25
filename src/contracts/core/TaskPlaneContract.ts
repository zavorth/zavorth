export type TaskPlaneStatus =
  | 'queued'
  | 'claimed'
  | 'running'
  | 'waiting_approval'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'cancelled';

export type TaskPlaneClaim = {
  owner: string;
  claimedAt: string;
  leaseUntil: string | null;
};

export type TaskPlaneItem = {
  contractVersion: 'task-plane-item/1';
  id: string;
  title: string;
  status: TaskPlaneStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
  claim: TaskPlaneClaim | null;
  approvalId: string | null;
  receiptId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  history: Array<{
    at: string;
    event: string;
    status: TaskPlaneStatus;
    actor: string;
    detail?: string;
  }>;
};

export type TaskPlaneSnapshot = {
  contractVersion: 'task-plane/1';
  generatedAt: string;
  storePath: string;
  summary: Record<TaskPlaneStatus, number>;
  items: TaskPlaneItem[];
  safety: {
    atomicClaims: true;
    noSilentMutation: true;
    retryIsExplicit: true;
    cancelIsAudited: true;
  };
};
