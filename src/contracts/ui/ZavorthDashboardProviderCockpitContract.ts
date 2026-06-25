import type {
  ZavorthProviderReadinessMatrixSnapshot,
  ZavorthProviderReadinessStatus,
  ZavorthProviderProbeStatus,
} from './ZavorthProviderReadinessMatrixContract.js';

export const ZAVORTH_COMMAND_CENTER_PROVIDER_COCKPIT_CONTRACT_VERSION = '2026-05-13.checkpoint-6' as const;

export type ZavorthDashboardProviderCockpitStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthDashboardProviderCockpitAction = {
  id: string;
  label: string;
  command: string;
  kind: 'read' | 'probe_packet' | 'live_probe' | 'configure' | 'select';
  providerId: string | null;
  risk: 'read' | 'sensitive';
  requiresApproval: boolean;
  dashboardCanExecute: false;
  summary: string;
};

export type ZavorthDashboardProviderCockpitCard = {
  id: string;
  providerId: string;
  title: string;
  status: ZavorthProviderReadinessStatus;
  liveStatus: ZavorthProviderProbeStatus;
  priority: 'primary' | 'normal' | 'blocked';
  model: string | null;
  summary: string;
  evidence: {
    liveNetworkUsed: boolean;
    target: string | null;
    httpStatus: number | null;
    durationMs: number | null;
    modelCount: number | null;
    evidenceHash: string | null;
  };
  actions: ZavorthDashboardProviderCockpitAction[];
};

export type ZavorthDashboardProviderCockpitProjection = {
  contractVersion: typeof ZAVORTH_COMMAND_CENTER_PROVIDER_COCKPIT_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'dashboard-provider-cockpit';
  generatedAt: string;
  status: ZavorthDashboardProviderCockpitStatus;
  sourceMatrixContractVersion: ZavorthProviderReadinessMatrixSnapshot['contractVersion'];
  visualMutationApplied: false;
  executionAuthority: false;
  selectedProviderId: string | null;
  summary: {
    totalProviders: number;
    readyProviders: number;
    livePassed: number;
    liveFailed: number;
    liveBlocked: number;
    missingAuth: number;
    missingBaseUrl: number;
    needsProbe: number;
  };
  cards: ZavorthDashboardProviderCockpitCard[];
  actions: ZavorthDashboardProviderCockpitAction[];
  healthChecks: Array<{
    id: string;
    label: string;
    status: ZavorthDashboardProviderCockpitStatus;
    detail: string;
  }>;
  receipts: Array<{
    id: string;
    kind: 'matrix' | 'live-evidence' | 'safety';
    status: 'recorded' | 'not-run' | 'blocked';
    providerId: string | null;
    detail: string;
    evidenceHash: string | null;
  }>;
  dashboardProjection: {
    route: '/dashboard';
    endpoint: '/api/providers/readiness';
    renderMode: 'projection-only';
    visualApprovalRequired: true;
    canRenderCardsAfterApproval: true;
  };
  safety: {
    noRawProviderSecrets: true;
    normalRenderMakesNoNetworkCalls: true;
    liveProbeRequiresExplicitOperatorAction: true;
    dashboardCannotExecuteProviderCalls: true;
  };
  nextAction: string;
};
