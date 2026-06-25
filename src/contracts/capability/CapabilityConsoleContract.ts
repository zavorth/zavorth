import type { CapabilityHubSnapshot } from './CapabilityHubContract.js';
import type {
  CapabilityPackReadinessInput,
  CapabilityPackReadinessSnapshot,
} from './CapabilityPackReadinessContract.js';
import type {
  CapabilityPackCatalogSnapshot,
  CapabilityPackCategory,
} from './CapabilityPackCatalogContract.js';
import type {
  CapabilitySetupQueueSnapshot,
  CapabilitySetupQueueTicketStatus,
} from './CapabilitySetupQueueContract.js';
import type { CapabilitySetupExecutorSnapshot } from './CapabilitySetupExecutorContract.js';

export const CAPABILITY_CONSOLE_CONTRACT_VERSION = 'zavorth-capability-console/v1';

export type CapabilityConsoleView =
  | 'overview'
  | 'catalog'
  | 'packs'
  | 'readiness'
  | 'queue'
  | 'requests';

export type CapabilityConsoleInput = CapabilityPackReadinessInput & {
  view?: CapabilityConsoleView;
  query?: string | null;
  category?: CapabilityPackCategory | null;
  status?: CapabilitySetupQueueTicketStatus | 'open' | 'closed' | null;
  limit?: number | null;
  includeItems?: boolean;
  includeReadiness?: boolean;
};

export type CapabilityConsoleCommandHint = {
  id: string;
  label: string;
  command: string;
  destructive: false;
  requiresOwnerApproval: boolean;
};

export type CapabilityConsoleSnapshot = {
  contractVersion: typeof CAPABILITY_CONSOLE_CONTRACT_VERSION;
  generatedAt: string;
  view: CapabilityConsoleView;
  policy: {
    canonicalRoot: 'zavorth-core/Zavorth';
    singleUserSurface: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    ownerApprovalBeforeLive: true;
    externalRootsAllowed: false;
  };
  summary: {
    visibleCatalogItems: number;
    totalCatalogItems: number;
    packs: number;
    packItems: number;
    openTickets: number;
    readyTickets: number;
    activationRequests: number;
    readinessReady: number;
    readinessBlocked: number;
  };
  hub: CapabilityHubSnapshot;
  packs: CapabilityPackCatalogSnapshot;
  readiness: CapabilityPackReadinessSnapshot | null;
  queue: CapabilitySetupQueueSnapshot;
  requests: CapabilitySetupExecutorSnapshot;
  commandHints: CapabilityConsoleCommandHint[];
  approvalSurface: {
    diffPreviewSupported: true;
    runObservatoryCommand: string;
    approveApplyInstruction: string;
    rollbackInstruction: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
