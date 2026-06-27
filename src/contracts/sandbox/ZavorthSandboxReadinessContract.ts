import type {
  SandboxHostReadinessSnapshot,
  SandboxHostTierId,
} from '../../services/SandboxHostReadinessService.js';

export type ZavorthSandboxReadinessStatus = 'ready' | 'fallback' | 'blocked';
export type ZavorthSandboxMutationMode = 'sandbox' | 'dry-run' | 'blocked';

export type ZavorthSandboxReadinessContract = {
  schemaVersion: 1;
  surface: 'sandbox-readiness';
  generatedAt: string;
  status: ZavorthSandboxReadinessStatus;
  mutationMode: ZavorthSandboxMutationMode;
  readOnlyAllowed: boolean;
  previewAllowed: boolean;
  strongSandboxAvailable: boolean;
  preferredStrongTier: SandboxHostTierId | null;
  readyTiers: SandboxHostTierId[];
  defaultPolicy: {
    liveMutationsAllowed: boolean;
    liveMutationsRequire: 'strong-sandbox-and-approval';
    safeWithoutStrongSandbox: Array<'read-only' | 'preview' | 'doctor' | 'receipt'>;
    blockedWithoutStrongSandbox: Array<'workspace-write' | 'host-command' | 'network-write' | 'channel-send' | 'live-skill-apply'>;
    explanation: string;
  };
  fallback: {
    active: boolean;
    reason: string;
    mutatingActions: 'dry-run-only' | 'sandboxed' | 'blocked';
    userAction: string;
  };
  doctor: {
    headline: string;
    summary: string;
    simpleStatus: 'ready' | 'needs_sandbox' | 'blocked';
    recommendedCommand: 'zavorth doctor --advanced';
    safeDefault: string;
  };
  blockers: string[];
  host: SandboxHostReadinessSnapshot;
};
