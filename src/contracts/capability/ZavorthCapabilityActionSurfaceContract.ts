import type { ZavorthCapabilityActionExposureReceipt } from './ZavorthCapabilityActionExposureContract.js';

export const ZAVORTH_CAPABILITY_ACTION_SURFACE_CONTRACT_VERSION = '2026-06-02.capability-action-surface.v1' as const;

export type ZavorthCapabilityActionSurfaceItem = {
  id: string;
  actionId: string;
  title: string;
  status: 'available';
  verificationId: string;
  detail: string;
  previewCommand: string;
  receiptsCommand: string;
  nextSafeAction: string;
};

export type ZavorthCapabilityActionSurfaceSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ACTION_SURFACE_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-action-surface';
  status: 'ready' | 'available' | 'attention';
  summary: {
    exposed: number;
    blocked: number;
    receipts: number;
    visibleSurfaces: 3;
  };
  items: ZavorthCapabilityActionSurfaceItem[];
  receipts: ZavorthCapabilityActionExposureReceipt[];
  placement: {
    dashboard: {
      visible: true;
      sectionId: 'operations-capabilities';
      apiPath: '/api/operations/capabilities';
    };
    tui: {
      visible: true;
      panelTitle: 'Capability actions';
    };
    setup: {
      visible: true;
      sectionTitle: 'Capability actions';
    };
  };
  commands: {
    status: string;
    preview: string;
    receipts: string;
    nextStage: string;
  };
  safety: {
    readOnlyProjection: true;
    verifiedAdaptersOnly: true;
    previewRequired: true;
    approvalRequired: true;
    noToolExecution: true;
    noLiveActivation: true;
    secretsRedacted: true;
  };
};
