export const LEGACY_SURFACE_CONTAINMENT_VERSION = 'legacy-surface-containment-v1' as const;

export type LegacySurfaceId = 'zavorthControl' | 'app' | 'classic';

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
  phase: 'legacy-contained';
  featureKind: LegacySurfaceFeatureKind;
  requestedPath: string;
  surface: LegacySurfaceDescriptor;
  allowed: boolean;
  reason: string;
  requiredDestination: Array<'gateway contract' | 'control plane' | 'zavorthControl'>;
};

export type LegacySurfaceContainmentSnapshot = {
  contractVersion: typeof LEGACY_SURFACE_CONTAINMENT_VERSION;
  canonicalEntry: '/zavorthControl';
  frozenSurfaces: [];
  retiredSurfaces: ['/app', '/classic'];
  generatedAt: string;
  summary: string;
  consolidation: {
    phase: 'legacy-contained';
    canonicalDocs: string[];
    rule: string;
  };
  surfaces: LegacySurfaceDescriptor[];
  policy: {
    productFeaturesMustLandIn: Array<'gateway contract' | 'control plane' | 'zavorthControl'>;
    legacyFeatureFreeze: false;
    legacyRoutesRetired: true;
    compatibilityPreserved: false;
    fallbackPreserved: false;
  };
  links: {
    localControlUrl: string;
    localZavorthControlUrl: string;
    localLegacyAppUrl: null;
    localClassicUrl: null;
    remoteControlUrl: string | null;
    remoteZavorthControlUrl: string | null;
    remoteLegacyAppUrl: null;
    remoteClassicUrl: null;
  };
};
