export const ZAVORTH_APPS_SATELLITE_NODES_CONTRACT_VERSION =
  '2026-05-24.apps-satellite-nodes-phase-7' as const;

export type ZavorthAppsSatelliteAction =
  | 'apps.status'
  | 'pairing.plan'
  | 'pairing.qr'
  | 'queue.status'
  | 'push.plan'
  | 'mobile.spec'
  | 'tray.spec'
  | 'health';

export type ZavorthAppsSatelliteNodeKind =
  | 'satellite-pwa'
  | 'mobile-companion'
  | 'desktop-tray'
  | 'desktop-companion'
  | 'node-host'
  | 'approval-companion';

export type ZavorthAppsSatelliteStatus =
  | 'ready'
  | 'needs-configuration'
  | 'approval-required'
  | 'preview'
  | 'blocked'
  | 'planned';

export type ZavorthAppsSatelliteReceipt = {
  id: string;
  kind: 'health' | 'pairing' | 'offline-queue' | 'push' | 'mobile-spec' | 'tray-spec' | 'policy';
  status: 'done' | 'planned' | 'needs-configuration' | 'approval-required' | 'blocked';
  summary: string;
  rawSecretSerialized: false;
};

export type ZavorthAppsSatelliteSurface = {
  id: ZavorthAppsSatelliteNodeKind;
  label: string;
  status: Exclude<ZavorthAppsSatelliteStatus, 'approval-required' | 'preview'>;
  liveClaim: 'live-ready' | 'configurable' | 'spec-ready' | 'planned';
  capabilities: string[];
  setupCommand: string;
  healthCommand: string;
  limitations: string[];
};

export type ZavorthAppsSatellitePairing = {
  status: 'preview' | 'approval-required' | 'materialized';
  nodeKind: ZavorthAppsSatelliteNodeKind;
  label: string;
  setupCode: string;
  qrPayload: string;
  expiresAt: string;
  ttlSeconds: number;
  materialized: boolean;
  approvalRequired: boolean;
  allowlistRequired: boolean;
  receiptRequired: boolean;
  noRawTokenSerialized: true;
  materializeCommand: string;
  claimCommand: string;
};

export type ZavorthAppsSatelliteHealth = {
  status: 'ready' | 'attention';
  gatewayReachable: boolean;
  satellitePwaReady: boolean;
  nodeHostReady: boolean;
  companionPackReady: boolean;
  approvalCompanionReady: boolean;
  warnings: string[];
};

export type ZavorthAppsSatelliteOfflineQueue = {
  status: 'ready' | 'needs-configuration';
  available: boolean;
  durable: boolean;
  pending: number;
  deadLetter: number;
  maxItems: number;
  retryPolicy: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  receiptRequired: true;
  storage: {
    kind: 'local-state';
    pathRedacted: string;
  };
};

export type ZavorthAppsSatellitePush = {
  status: 'ready' | 'needs-configuration' | 'approval-required';
  channels: Array<{
    id: 'web-push' | 'mobile-push' | 'desktop-tray' | 'telegram-fallback';
    label: string;
    status: 'ready' | 'needs-configuration' | 'approval-required';
    requiredEnv: string[];
    consentRequired: boolean;
    liveSendPerformed: false;
  }>;
  consentRequired: true;
  credentialsRequired: boolean;
  liveSendPerformed: false;
  planCommand: string;
};

export type ZavorthAppsSatelliteMobileSpec = {
  status: 'spec-ready' | 'needs-configuration';
  ios: {
    status: 'spec-ready';
    capabilities: string[];
    storeBinaryClaimed: false;
  };
  android: {
    status: 'spec-ready';
    capabilities: string[];
    storeBinaryClaimed: false;
  };
  pwa: {
    status: 'ready' | 'needs-configuration';
    capabilities: string[];
  };
  requirements: string[];
  setupCommand: string;
};

export type ZavorthAppsSatelliteDesktopTraySpec = {
  status: 'spec-ready' | 'ready' | 'needs-configuration';
  platforms: Array<'windows' | 'macos' | 'linux'>;
  capabilities: string[];
  enabled: boolean;
  binaryClaimed: false;
  setupCommand: string;
  openCommand: string;
};

export type ZavorthAppsSatelliteInput = {
  action?: ZavorthAppsSatelliteAction | 'status' | 'pair' | 'qr' | 'queue' | 'push' | 'mobile' | 'tray' | null;
  nodeKind?: ZavorthAppsSatelliteNodeKind | null;
  label?: string | null;
  actorId?: string | null;
  workspace?: string | null;
  ttlSeconds?: number | null;
  materialize?: boolean;
  approvalId?: string | null;
  consentId?: string | null;
  sourceSurface?: string | null;
};

export type ZavorthAppsSatelliteSnapshot = {
  contractVersion: typeof ZAVORTH_APPS_SATELLITE_NODES_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthAppsSatelliteNodesService';
  action: ZavorthAppsSatelliteAction;
  status: ZavorthAppsSatelliteStatus;
  workspace: string;
  pairing: ZavorthAppsSatellitePairing;
  health: ZavorthAppsSatelliteHealth;
  offlineQueue: ZavorthAppsSatelliteOfflineQueue;
  push: ZavorthAppsSatellitePush;
  mobileCompanionSpec: ZavorthAppsSatelliteMobileSpec;
  desktopTraySpec: ZavorthAppsSatelliteDesktopTraySpec;
  surfaces: ZavorthAppsSatelliteSurface[];
  receipts: ZavorthAppsSatelliteReceipt[];
  safety: {
    noRawPairingSecretsSerialized: true;
    qrPayloadUsesOpaqueShortLivedCode: true;
    pairingMaterializationRequiresApproval: true;
    pushRequiresConsentAndConfiguredProvider: true;
    offlineQueueReceiptsRequired: true;
    mobileAndTraySpecsDoNotClaimAppStoreBinaries: true;
    satelliteNodesStayLeastPrivilege: true;
  };
  commands: {
    status: 'zavorth apps';
    pairingQr: 'zavorth apps --action pairing.qr';
    materializePairing: 'zavorth apps --action pairing.qr --materialize --approval-id <id>';
    pushPlan: 'zavorth apps --action push.plan';
    check: 'npm run zavorth:apps-satellite-nodes:check --silent';
  };
  nextSafeAction: string;
};
