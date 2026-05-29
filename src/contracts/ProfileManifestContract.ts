export const ZAVORTH_PROFILE_MANIFEST_VERSION = 'zavorth.profile/1' as const;
export const ZAVORTH_PROFILE_BUNDLE_VERSION = 'zavorth.profile.bundle/1' as const;
export const ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION = 'zavorth.cognitive-context.bundle/1' as const;
export const ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION = 'zavorth.runtime-policy.bundle/1' as const;
export const ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION = 'zavorth.surface-experience.bundle/1' as const;
export const ZAVORTH_PROFILE_ENFORCEMENT_RECEIPT_VERSION = 'zavorth.profile-enforcement.receipt/1' as const;

export type ProfileManifestVersion = typeof ZAVORTH_PROFILE_MANIFEST_VERSION;
export type ProfileRuntimeBundleVersion = typeof ZAVORTH_PROFILE_BUNDLE_VERSION;
export type CognitiveContextBundleVersion = typeof ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION;
export type RuntimePolicyBundleVersion = typeof ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION;
export type SurfaceExperienceBundleVersion = typeof ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION;
export type ProfileEnforcementReceiptVersion = typeof ZAVORTH_PROFILE_ENFORCEMENT_RECEIPT_VERSION;

export type ProfileManifest = {
  version: ProfileManifestVersion;
  id: string;
  label: string;
  description?: string;
  extends?: string | string[] | null;
  tags?: string[];
  cognitive?: {
    responseStyle?: string;
    autonomy?: 'manual' | 'governed' | 'speculative';
    languagePolicy?: 'match-user' | 'configured' | 'english';
    planningDepth?: 'brief' | 'normal' | 'deep';
  };
  runtime?: {
    trustMode?: 'strict' | 'balanced' | 'trusted-local';
    approvalMode?: 'always' | 'risk-based' | 'minimal';
    sandboxMode?: 'required' | 'preferred' | 'optional';
    maxToolRounds?: number;
    maxDeniedAttempts?: number;
  };
  capabilities?: {
    allow?: string[];
    deny?: string[];
    requireApproval?: string[];
    providerNativeTools?: string[];
  };
  surfaces?: {
    default?: string;
    allowed?: string[];
  };
  memory?: {
    mode?: 'off' | 'working' | 'episodic' | 'semantic';
    scanScopes?: string[];
    learning?: 'off' | 'suggest' | 'approved-only';
  };
  metadata?: Record<string, unknown>;
};

export type ProfileRuntimeBundle = {
  version: ProfileRuntimeBundleVersion;
  id: string;
  label: string;
  description: string;
  sourceIds: string[];
  sourcePaths: string[];
  tags: string[];
  cognitivePolicy: Required<NonNullable<ProfileManifest['cognitive']>>;
  runtimePolicy: Required<NonNullable<ProfileManifest['runtime']>>;
  capabilityPolicy: {
    allow: string[];
    deny: string[];
    requireApproval: string[];
    providerNativeTools: string[];
  };
  surfacePolicy: {
    default: string;
    allowed: string[];
  };
  memoryPolicy: Required<NonNullable<ProfileManifest['memory']>>;
  cognitiveContextBundle: CognitiveContextBundle;
  runtimePolicyBundle: RuntimePolicyBundle;
  surfaceExperienceBundle: SurfaceExperienceBundle;
  metadata: Readonly<Record<string, unknown>>;
  checksum: string;
};

export type CognitiveContextBundle = {
  version: CognitiveContextBundleVersion;
  profileId: string;
  label: string;
  responseStyle: string;
  autonomy: 'manual' | 'governed' | 'speculative';
  languagePolicy: 'match-user' | 'configured' | 'english';
  planningDepth: 'brief' | 'normal' | 'deep';
  memoryMode: 'off' | 'working' | 'episodic' | 'semantic';
  memoryScanScopes: string[];
  learning: 'off' | 'suggest' | 'approved-only';
  providerNativeTools: string[];
  metadata: Readonly<Record<string, unknown>>;
  checksum: string;
};

export type RuntimePolicyBundle = {
  version: RuntimePolicyBundleVersion;
  profileId: string;
  trustMode: 'strict' | 'balanced' | 'trusted-local';
  approvalMode: 'always' | 'risk-based' | 'minimal';
  sandboxMode: 'required' | 'preferred' | 'optional';
  maxToolRounds: number;
  maxDeniedAttempts: number;
  allow: string[];
  deny: string[];
  requireApproval: string[];
  metadata: Readonly<Record<string, unknown>>;
  checksum: string;
};

export type SurfaceExperienceBundle = {
  version: SurfaceExperienceBundleVersion;
  profileId: string;
  label: string;
  description: string;
  defaultSurface: string;
  allowedSurfaces: string[];
  tags: string[];
  sourceIds: string[];
  metadata: Readonly<Record<string, unknown>>;
  checksum: string;
};

export type SurfaceExperienceProjection = {
  contractVersion: 'SurfaceExperienceProjection/v1';
  profileId: string;
  label: string;
  description: string;
  activeSurface: string;
  defaultSurface: string;
  allowedSurfaces: string[];
  surfaceAllowed: boolean;
  headline: string;
  guidance: string;
  navigationHints: Array<{
    id: string;
    label: string;
    surface: string;
    primary: boolean;
  }>;
  tags: string[];
  checksum: string;
  profileEnforcementReceipt?: ProfileEnforcementReceipt;
};

export type ProfileEnforcementReceiptKind =
  | 'surface_projection'
  | 'tool_exposure'
  | 'runtime_limit'
  | 'approval_gate'
  | 'policy_denial_limit';

export type ProfileEnforcementReceiptDecision =
  | 'applied'
  | 'allowed'
  | 'blocked'
  | 'hidden'
  | 'limited'
  | 'requires_approval';

export type ProfileEnforcementReceipt = {
  contractVersion: ProfileEnforcementReceiptVersion;
  id: string;
  profileId: string;
  bundleChecksum: string;
  kind: ProfileEnforcementReceiptKind;
  subject: string;
  decision: ProfileEnforcementReceiptDecision;
  summary: string;
  surface?: string | null;
  details: Readonly<Record<string, unknown>>;
  createdAt: string;
};

export type ProfileCompiledBundles = {
  profile: ProfileRuntimeBundle;
  cognitive: CognitiveContextBundle;
  runtime: RuntimePolicyBundle;
  surface: SurfaceExperienceBundle;
};

export type ProfileManifestLoadResult = {
  manifest: ProfileManifest;
  sourcePath: string;
};
