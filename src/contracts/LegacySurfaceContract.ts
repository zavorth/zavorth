export const LEGACY_SURFACE_CONTAINMENT_VERSION = 'legacy-surface-containment-v1' as const;

export type LegacySurfaceId = 'dashboard' | 'app' | 'classic';

export type LegacySurfaceRole = 'canonical' | 'retired';

export type LegacySurfaceFeatureKind =
  | 'product-feature'
  | 'business-rule'
  | 'security-fix'
  | 'compatibility-fix'
  | 'bugfix'
  | 'observability-maintenance';

export type LegacySurfaceDescriptor = {
  id: LegacySurfaceId;
  role: LegacySurfaceRole;
  path: string;
  label: string;
  status: 'primary' | 'removed';
  summary: string;
  allowedUse: string[];
  blockedUse: string[];
};

export type LegacySurfaceFeatureDecision = {
  phase: 'P3-003';
  featureKind: LegacySurfaceFeatureKind;
  requestedPath: string;
  surface: LegacySurfaceDescriptor;
  allowed: boolean;
  reason: string;
  requiredDestination: Array<'gateway contract' | 'control plane' | 'dashboard'>;
};

export type LegacySurfaceContainmentSnapshot = {
  contractVersion: typeof LEGACY_SURFACE_CONTAINMENT_VERSION;
  canonicalEntry: '/dashboard';
  frozenSurfaces: [];
  retiredSurfaces: ['/app', '/classic'];
  generatedAt: string;
  summary: string;
  consolidation: {
    phase: 'P3-003';
    canonicalDocs: string[];
    rule: string;
  };
  surfaces: LegacySurfaceDescriptor[];
  policy: {
    productFeaturesMustLandIn: Array<'gateway contract' | 'control plane' | 'dashboard'>;
    legacyFeatureFreeze: false;
    legacyRoutesRetired: true;
    compatibilityPreserved: false;
    fallbackPreserved: false;
  };
  links: {
    localControlUrl: string;
    localDashboardUrl: string;
    localLegacyAppUrl: null;
    localClassicUrl: null;
    remoteControlUrl: string | null;
    remoteDashboardUrl: string | null;
    remoteLegacyAppUrl: null;
    remoteClassicUrl: null;
  };
};
