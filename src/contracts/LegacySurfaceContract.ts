export const LEGACY_SURFACE_CONTAINMENT_VERSION = 'legacy-surface-containment-v1' as const;

export type LegacySurfaceId = 'dashboard' | 'app' | 'classic';

export type LegacySurfaceRole = 'canonical' | 'legacy-operational' | 'legacy-observability';

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
  status: 'primary' | 'frozen';
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
  requiredDestination: Array<'gateway contract' | 'control plane' | 'dashboard' | 'legacy maintenance'>;
};

export type LegacySurfaceContainmentSnapshot = {
  contractVersion: typeof LEGACY_SURFACE_CONTAINMENT_VERSION;
  canonicalEntry: '/dashboard';
  frozenSurfaces: ['/app', '/classic'];
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
    legacyFeatureFreeze: boolean;
    compatibilityPreserved: boolean;
    fallbackPreserved: boolean;
  };
  links: {
    localDashboardUrl: string;
    localLegacyAppUrl: string;
    localClassicUrl: string;
    remoteDashboardUrl: string | null;
    remoteLegacyAppUrl: string | null;
    remoteClassicUrl: string | null;
  };
};
