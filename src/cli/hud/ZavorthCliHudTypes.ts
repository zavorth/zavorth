import type { ZavorthCliApprovalDiffSnapshot } from '../approval-diff/ZavorthCliApprovalDiffTypes.js';
import type { ZavorthCliHomeSnapshot } from '../home/ZavorthCliHomeTypes.js';

export type ZavorthCliHudMode = 'snapshot' | 'interactive' | 'action' | 'review';

export type ZavorthCliHudShortcut = {
  key: string;
  label: string;
  command: string;
  requiresConfirmation: boolean;
  enabled: boolean;
  detail?: string;
};

export type ZavorthCliHudDecision = {
  attempted: boolean;
  key: string | null;
  status:
    | 'none'
    | 'armed'
    | 'approved'
    | 'rejected'
    | 'deferred'
    | 'selected'
    | 'opened'
    | 'shown'
    | 'quit'
    | 'unsupported'
    | 'missing_target';
  message: string;
  command?: string | null;
  receiptId?: string | null;
};

export type ZavorthCliHudSnapshot = {
  contractVersion: 'zavorth-cli-hud/1';
  generatedAt: string;
  projectRoot: string;
  mode: ZavorthCliHudMode;
  tty: boolean;
  home: ZavorthCliHomeSnapshot;
  approvals: ZavorthCliApprovalDiffSnapshot;
  selectedPlanId: string | null;
  selectedIndex: number | null;
  planQueue: Array<{
    index: number;
    id: string;
    title: string;
    status: string;
    riskLevel: string;
    diffCount: number;
  }>;
  shortcuts: ZavorthCliHudShortcut[];
  decision: ZavorthCliHudDecision;
  safety: {
    noHostApply: true;
    approvalRequiresDoubleConfirm: true;
    secretsRedacted: true;
    fallbackTextMode: boolean;
  };
};
