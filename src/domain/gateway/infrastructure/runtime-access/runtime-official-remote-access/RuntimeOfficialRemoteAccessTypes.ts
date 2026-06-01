import type { RuntimeOfficialAccessReport } from '../RuntimeOfficialAccessService.js';

export type RuntimeOfficialRemoteAccessOptions = {
  dryRun?: boolean;
  autoTrustLocal?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  requireMutableAccess?: boolean;
};

export type RuntimeOfficialRemoteRolloutCandidateId = 'local-cloudflare' | 'oracle-cloudflare';
export type RuntimeOfficialRemoteRolloutStateStatus = 'pending' | 'provisioning' | 'ready' | 'failed';
export type RuntimeOfficialRemoteAccessAction = 'apply' | 'verify' | 'rollback' | 'go';

export type RuntimeOfficialRemoteRolloutCandidate = {
  id: RuntimeOfficialRemoteRolloutCandidateId;
  label: string;
  ready: boolean;
  summary: string;
  command: string;
  guide: string;
  doneSteps: number;
  totalSteps: number;
  pendingHighlights: string[];
};

export type RuntimeOfficialRemoteRolloutState = {
  provider: RuntimeOfficialRemoteRolloutCandidateId | null;
  status: RuntimeOfficialRemoteRolloutStateStatus;
  lastAction: RuntimeOfficialRemoteAccessAction | null;
  lastActionAt: string | null;
  lastVerifiedAt: string | null;
  appUrl: string | null;
  baseUrl: string | null;
  issues: string[];
  summary: string;
};

export type RuntimeOfficialRemoteAccessReport = {
  generatedAt: string;
  summary: string;
  official: RuntimeOfficialAccessReport;
  recommendedPathId: 'official' | RuntimeOfficialRemoteRolloutCandidateId | null;
  recommendedPathReason: string;
  paths: Array<{
    id: 'official' | RuntimeOfficialRemoteRolloutCandidateId;
    label: string;
    status: 'ready' | 'rollout-ready' | 'pending';
    summary: string;
    command: string;
    steps: Array<{
      id: string;
      title: string;
      status: 'done' | 'pending';
      detail: string;
      command: string;
    }>;
  }>;
  remote: {
    configured: boolean;
    baseUrl: string | null;
    appUrl: string | null;
    shareUrl: string | null;
    ready: boolean;
    issues: string[];
  };
  rollout: {
    activeId: RuntimeOfficialRemoteRolloutCandidateId | null;
    recommendedId: RuntimeOfficialRemoteRolloutCandidateId | null;
    candidates: RuntimeOfficialRemoteRolloutCandidate[];
  };
  state: RuntimeOfficialRemoteRolloutState;
  actions: {
    canGo: boolean;
    canApply: boolean;
    canVerify: boolean;
    canRollback: boolean;
    recommendedAction: RuntimeOfficialRemoteAccessAction | null;
    recommendedProvider: RuntimeOfficialRemoteRolloutCandidateId | null;
    go?: Record<string, unknown>;
    apply?: Record<string, unknown>;
    verify?: Record<string, unknown>;
    rollback?: Record<string, unknown>;
    open?: Record<string, unknown>;
    copy?: Record<string, unknown>;
    connect?: Record<string, unknown>;
    'focus-token'?: Record<string, unknown>;
  };
  nextSteps: string[];
};

export type RuntimeOfficialRemoteActionOptions = RuntimeOfficialRemoteAccessOptions & {
  provider?: RuntimeOfficialRemoteRolloutCandidateId | null;
};

export type RuntimeOfficialRemotePersistedState = {
  provider: RuntimeOfficialRemoteRolloutCandidateId | null;
  lastAction: RuntimeOfficialRemoteAccessAction | null;
  lastActionAt: string | null;
  lastVerifiedAt: string | null;
  status: RuntimeOfficialRemoteRolloutStateStatus | null;
  appUrl: string | null;
  baseUrl: string | null;
  issues: string[];
  summary: string;
};

export type RuntimeOfficialRemoteAccessCacheEntry = {
  key: string;
  expiresAt: number;
  report: RuntimeOfficialRemoteAccessReport;
};

export const EMPTY_RUNTIME_OFFICIAL_REMOTE_STATE: RuntimeOfficialRemotePersistedState = {
  provider: null,
  lastAction: null,
  lastActionAt: null,
  lastVerifiedAt: null,
  status: null,
  appUrl: null,
  baseUrl: null,
  issues: [],
  summary: '',
};
