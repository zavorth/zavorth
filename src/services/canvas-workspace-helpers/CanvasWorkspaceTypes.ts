export type CanvasEntityKind =
  | 'chat'
  | 'file'
  | 'diff'
  | 'diagram'
  | 'task'
  | 'node'
  | 'automation'
  | 'approval'
  | 'artifact'
  | 'eval';

export type CanvasAttachmentKind = 'screenshot' | 'replay' | 'artifact' | 'diff' | 'file';

export type CanvasEntityPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasSourceRef = {
  plane: string;
  id: string | null;
  kind: string;
  path: string | null;
  command: string | null;
  live: boolean;
};

export type CanvasAttachment = {
  id: string;
  entityId: string;
  kind: CanvasAttachmentKind;
  ref: string;
  title: string;
  status: 'waiting_approval' | 'approved' | 'revoked';
  mutationPlanId: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type CanvasEntity = {
  id: string;
  kind: CanvasEntityKind;
  title: string;
  summary: string;
  status: 'healthy' | 'attention' | 'critical' | 'idle' | 'waiting_approval' | 'blocked';
  position: CanvasEntityPosition;
  compact: boolean;
  mutable: boolean;
  sourceRef: CanvasSourceRef;
  metadata: Record<string, unknown>;
  attachments: CanvasAttachment[];
  actions: Array<{
    id: string;
    label: string;
    command: string | null;
    mutationRequired: boolean;
  }>;
};

export type CanvasLock = {
  entityId: string;
  owner: string;
  acquiredAt: string;
  expiresAt: string;
  mutationPlanId: string | null;
};

export type CanvasHistoryEvent = {
  id: string;
  at: string;
  actor: string | null;
  entityId: string | null;
  event: string;
  summary: string;
  mutationPlanId: string | null;
};

export type CanvasWorkspaceDocument = {
  version: 1;
  updatedAt: string | null;
  layout: {
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
    entityOverrides: Record<string, Partial<CanvasEntityPosition> & {
      collapsed?: boolean;
    }>;
  };
  locks: CanvasLock[];
  attachments: CanvasAttachment[];
  history: CanvasHistoryEvent[];
};

export type CanvasWorkspaceSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    entities: number;
    compactPersisted: true;
    heavyRuntimesStarted: false;
    locks: number;
    expiredLocks: number;
    attachments: number;
    pendingAttachments: number;
    approvals: number;
    pendingApprovals: number;
    diagrams: number;
    fallbackAvailable: true;
  };
  policy: {
    projectionOnly: true;
    canonicalSource: 'control-planes';
    mutableActionsCreateMutationPlan: true;
    watchModeStartsAutomatically: false;
    nodesStartAutomatically: false;
    automationsStartAutomatically: false;
    cliFallbackCommands: string[];
  };
  entities: CanvasEntity[];
  locks: CanvasLock[];
  history: CanvasHistoryEvent[];
  diagrams: Array<{
    id: string;
    title: string;
    kind: 'flowchart' | 'sequence';
    mermaid: string;
    sourceRefs: CanvasSourceRef[];
  }>;
  sourceHealth: Array<{
    plane: string;
    status: 'healthy' | 'attention' | 'critical' | 'unavailable';
    summary: string;
    command: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
