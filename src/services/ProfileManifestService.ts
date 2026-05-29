import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION,
  ZAVORTH_PROFILE_BUNDLE_VERSION,
  ZAVORTH_PROFILE_MANIFEST_VERSION,
  ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION,
  ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION,
  type CognitiveContextBundle,
  type ProfileCompiledBundles,
  type ProfileManifest,
  type ProfileManifestLoadResult,
  type ProfileRuntimeBundle,
  type RuntimePolicyBundle,
  type SurfaceExperienceBundle,
} from '../contracts/ProfileManifestContract.js';

export type ProfileManifestServiceOptions = {
  profileDir?: string | null;
};

const ProfileManifestSchema = z.object({
  version: z.literal(ZAVORTH_PROFILE_MANIFEST_VERSION),
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  label: z.string().min(1),
  description: z.string().optional(),
  extends: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  tags: z.array(z.string()).optional(),
  cognitive: z.object({
    responseStyle: z.string().optional(),
    autonomy: z.enum(['manual', 'governed', 'speculative']).optional(),
    languagePolicy: z.enum(['match-user', 'configured', 'english']).optional(),
    planningDepth: z.enum(['brief', 'normal', 'deep']).optional(),
  }).optional(),
  runtime: z.object({
    trustMode: z.enum(['strict', 'balanced', 'trusted-local']).optional(),
    approvalMode: z.enum(['always', 'risk-based', 'minimal']).optional(),
    sandboxMode: z.enum(['required', 'preferred', 'optional']).optional(),
    maxToolRounds: z.number().int().positive().max(64).optional(),
    maxDeniedAttempts: z.number().int().positive().max(16).optional(),
  }).optional(),
  capabilities: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    requireApproval: z.array(z.string()).optional(),
    providerNativeTools: z.array(z.string()).optional(),
  }).optional(),
  surfaces: z.object({
    default: z.string().optional(),
    allowed: z.array(z.string()).optional(),
  }).optional(),
  memory: z.object({
    mode: z.enum(['off', 'working', 'episodic', 'semantic']).optional(),
    scanScopes: z.array(z.string()).optional(),
    learning: z.enum(['off', 'suggest', 'approved-only']).optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const DEFAULT_BUNDLE: Omit<
  ProfileRuntimeBundle,
  | 'id'
  | 'label'
  | 'description'
  | 'sourceIds'
  | 'sourcePaths'
  | 'tags'
  | 'cognitiveContextBundle'
  | 'runtimePolicyBundle'
  | 'surfaceExperienceBundle'
  | 'metadata'
  | 'checksum'
> = {
  version: ZAVORTH_PROFILE_BUNDLE_VERSION,
  cognitivePolicy: {
    responseStyle: 'clear',
    autonomy: 'governed',
    languagePolicy: 'match-user',
    planningDepth: 'normal',
  },
  runtimePolicy: {
    trustMode: 'balanced',
    approvalMode: 'risk-based',
    sandboxMode: 'preferred',
    maxToolRounds: 8,
    maxDeniedAttempts: 3,
  },
  capabilityPolicy: {
    allow: [],
    deny: [],
    requireApproval: [],
    providerNativeTools: [],
  },
  surfacePolicy: {
    default: 'cli',
    allowed: ['cli', 'zavorthControl', 'telegram', 'api'],
  },
  memoryPolicy: {
    mode: 'working',
    scanScopes: [],
    learning: 'approved-only',
  },
};

export class ProfileManifestService {
  private readonly profileDir: string;
  private cache: ProfileManifestLoadResult[] | null = null;

  constructor(options: ProfileManifestServiceOptions = {}) {
    this.profileDir = path.resolve(options.profileDir || path.join(process.cwd(), 'config', 'profile-manifests'));
  }

  public loadAll(): ProfileManifestLoadResult[] {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.profileDir)) {
      this.cache = [];
      return this.cache;
    }

    const manifests = fs.readdirSync(this.profileDir)
      .filter((entry) => /\.(json|ya?ml)$/i.test(entry))
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => this.loadFile(path.join(this.profileDir, entry)));
    this.cache = manifests;
    return manifests;
  }

  public compileProfileById(profileId: string | null | undefined): ProfileRuntimeBundle | null {
    const normalized = normalizeId(profileId);
    if (!normalized) return null;
    const manifests = this.loadAll();
    const byId = new Map(manifests.map((entry) => [entry.manifest.id.toLowerCase(), entry]));
    const selected = byId.get(normalized.toLowerCase()) || null;
    if (!selected) return null;
    return this.compileLoadedManifest(selected, byId);
  }

  public compileAll(): ProfileRuntimeBundle[] {
    const manifests = this.loadAll();
    const byId = new Map(manifests.map((entry) => [entry.manifest.id.toLowerCase(), entry]));
    return manifests.map((entry) => this.compileLoadedManifest(entry, byId));
  }

  public compileBundlesById(profileId: string | null | undefined): ProfileCompiledBundles | null {
    const profile = this.compileProfileById(profileId);
    if (!profile) return null;
    return {
      profile,
      cognitive: profile.cognitiveContextBundle,
      runtime: profile.runtimePolicyBundle,
      surface: profile.surfaceExperienceBundle,
    };
  }

  public loadFile(sourcePath: string): ProfileManifestLoadResult {
    const absolutePath = path.resolve(sourcePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = /\.json$/i.test(absolutePath)
      ? JSON.parse(raw)
      : yaml.load(raw);
    const manifest = ProfileManifestSchema.parse(parsed) as ProfileManifest;
    return { manifest, sourcePath: absolutePath };
  }

  private compileLoadedManifest(
    selected: ProfileManifestLoadResult,
    byId: Map<string, ProfileManifestLoadResult>,
  ): ProfileRuntimeBundle {
    const chain = this.resolveInheritanceChain(selected, byId);
    const merged = chain.reduce((acc, entry) => mergeManifest(acc, entry.manifest), emptyManifest());
    const metadata = Object.freeze({ ...(merged.metadata || {}) });
    const cognitivePolicy = {
      ...DEFAULT_BUNDLE.cognitivePolicy,
      ...(merged.cognitive || {}),
    };
    const runtimePolicy = {
      ...DEFAULT_BUNDLE.runtimePolicy,
      ...(merged.runtime || {}),
    };
    const capabilityPolicy = {
      allow: unique(chain.flatMap((entry) => entry.manifest.capabilities?.allow || [])),
      deny: unique(chain.flatMap((entry) => entry.manifest.capabilities?.deny || [])),
      requireApproval: unique(chain.flatMap((entry) => entry.manifest.capabilities?.requireApproval || [])),
      providerNativeTools: unique(chain.flatMap((entry) => entry.manifest.capabilities?.providerNativeTools || [])),
    };
    const explicitAllowedSurfaces = lastExplicitSurfaceAllowed(chain);
    const surfacePolicy = {
      ...DEFAULT_BUNDLE.surfacePolicy,
      ...(merged.surfaces || {}),
      allowed: explicitAllowedSurfaces.length > 0
        ? explicitAllowedSurfaces
        : DEFAULT_BUNDLE.surfacePolicy.allowed,
    };
    const memoryPolicy = {
      ...DEFAULT_BUNDLE.memoryPolicy,
      ...(merged.memory || {}),
      scanScopes: unique(chain.flatMap((entry) => entry.manifest.memory?.scanScopes || [])),
    };
    const cognitiveContextBundle = this.buildCognitiveContextBundle({
      id: merged.id,
      label: merged.label,
      cognitivePolicy,
      memoryPolicy,
      capabilityPolicy,
      metadata,
    });
    const runtimePolicyBundle = this.buildRuntimePolicyBundle({
      id: merged.id,
      runtimePolicy,
      capabilityPolicy,
      metadata,
    });
    const surfaceExperienceBundle = this.buildSurfaceExperienceBundle({
      id: merged.id,
      label: merged.label,
      description: merged.description || '',
      sourceIds: chain.map((entry) => entry.manifest.id),
      tags: unique(chain.flatMap((entry) => entry.manifest.tags || [])),
      surfacePolicy,
      metadata,
    });
    const bundleWithoutChecksum: Omit<ProfileRuntimeBundle, 'checksum'> = {
      version: ZAVORTH_PROFILE_BUNDLE_VERSION,
      id: merged.id,
      label: merged.label,
      description: merged.description || '',
      sourceIds: chain.map((entry) => entry.manifest.id),
      sourcePaths: chain.map((entry) => entry.sourcePath),
      tags: unique(chain.flatMap((entry) => entry.manifest.tags || [])),
      cognitivePolicy,
      runtimePolicy,
      capabilityPolicy,
      surfacePolicy,
      memoryPolicy,
      cognitiveContextBundle,
      runtimePolicyBundle,
      surfaceExperienceBundle,
      metadata,
    };
    return Object.freeze({
      ...bundleWithoutChecksum,
      checksum: checksum(bundleWithoutChecksum),
    });
  }

  private buildCognitiveContextBundle(input: {
    id: string;
    label: string;
    cognitivePolicy: ProfileRuntimeBundle['cognitivePolicy'];
    memoryPolicy: ProfileRuntimeBundle['memoryPolicy'];
    capabilityPolicy: ProfileRuntimeBundle['capabilityPolicy'];
    metadata: Readonly<Record<string, unknown>>;
  }): CognitiveContextBundle {
    const withoutChecksum: Omit<CognitiveContextBundle, 'checksum'> = {
      version: ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION,
      profileId: input.id,
      label: input.label,
      responseStyle: input.cognitivePolicy.responseStyle,
      autonomy: input.cognitivePolicy.autonomy,
      languagePolicy: input.cognitivePolicy.languagePolicy,
      planningDepth: input.cognitivePolicy.planningDepth,
      memoryMode: input.memoryPolicy.mode,
      memoryScanScopes: input.memoryPolicy.scanScopes,
      learning: input.memoryPolicy.learning,
      providerNativeTools: input.capabilityPolicy.providerNativeTools,
      metadata: input.metadata,
    };
    return Object.freeze({
      ...withoutChecksum,
      checksum: checksum(withoutChecksum),
    });
  }

  private buildRuntimePolicyBundle(input: {
    id: string;
    runtimePolicy: ProfileRuntimeBundle['runtimePolicy'];
    capabilityPolicy: ProfileRuntimeBundle['capabilityPolicy'];
    metadata: Readonly<Record<string, unknown>>;
  }): RuntimePolicyBundle {
    const withoutChecksum: Omit<RuntimePolicyBundle, 'checksum'> = {
      version: ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION,
      profileId: input.id,
      trustMode: input.runtimePolicy.trustMode,
      approvalMode: input.runtimePolicy.approvalMode,
      sandboxMode: input.runtimePolicy.sandboxMode,
      maxToolRounds: input.runtimePolicy.maxToolRounds,
      maxDeniedAttempts: input.runtimePolicy.maxDeniedAttempts,
      allow: input.capabilityPolicy.allow,
      deny: input.capabilityPolicy.deny,
      requireApproval: input.capabilityPolicy.requireApproval,
      metadata: input.metadata,
    };
    return Object.freeze({
      ...withoutChecksum,
      checksum: checksum(withoutChecksum),
    });
  }

  private buildSurfaceExperienceBundle(input: {
    id: string;
    label: string;
    description: string;
    sourceIds: string[];
    tags: string[];
    surfacePolicy: ProfileRuntimeBundle['surfacePolicy'];
    metadata: Readonly<Record<string, unknown>>;
  }): SurfaceExperienceBundle {
    const withoutChecksum: Omit<SurfaceExperienceBundle, 'checksum'> = {
      version: ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION,
      profileId: input.id,
      label: input.label,
      description: input.description,
      defaultSurface: input.surfacePolicy.default,
      allowedSurfaces: input.surfacePolicy.allowed,
      tags: input.tags,
      sourceIds: input.sourceIds,
      metadata: input.metadata,
    };
    return Object.freeze({
      ...withoutChecksum,
      checksum: checksum(withoutChecksum),
    });
  }

  private resolveInheritanceChain(
    selected: ProfileManifestLoadResult,
    byId: Map<string, ProfileManifestLoadResult>,
    seen: Set<string> = new Set(),
  ): ProfileManifestLoadResult[] {
    const selectedId = selected.manifest.id.toLowerCase();
    if (seen.has(selectedId)) {
      throw new Error(`Profile manifest inheritance cycle detected at ${selected.manifest.id}.`);
    }
    seen.add(selectedId);
    const parentIds = normalizeExtends(selected.manifest.extends);
    const parents = parentIds.flatMap((parentId) => {
      const parent = byId.get(parentId.toLowerCase());
      if (!parent) {
        throw new Error(`Profile manifest ${selected.manifest.id} extends missing profile ${parentId}.`);
      }
      return this.resolveInheritanceChain(parent, byId, new Set(seen));
    });
    return [...parents, selected];
  }
}

function emptyManifest(): ProfileManifest {
  return {
    version: ZAVORTH_PROFILE_MANIFEST_VERSION,
    id: '',
    label: '',
  };
}

function mergeManifest(base: ProfileManifest, next: ProfileManifest): ProfileManifest {
  return {
    version: ZAVORTH_PROFILE_MANIFEST_VERSION,
    id: next.id || base.id,
    label: next.label || base.label,
    description: next.description || base.description,
    extends: next.extends || base.extends,
    tags: unique([...(base.tags || []), ...(next.tags || [])]),
    cognitive: { ...(base.cognitive || {}), ...(next.cognitive || {}) },
    runtime: { ...(base.runtime || {}), ...(next.runtime || {}) },
    capabilities: {
      allow: unique([...(base.capabilities?.allow || []), ...(next.capabilities?.allow || [])]),
      deny: unique([...(base.capabilities?.deny || []), ...(next.capabilities?.deny || [])]),
      requireApproval: unique([...(base.capabilities?.requireApproval || []), ...(next.capabilities?.requireApproval || [])]),
      providerNativeTools: unique([...(base.capabilities?.providerNativeTools || []), ...(next.capabilities?.providerNativeTools || [])]),
    },
    surfaces: {
      ...(base.surfaces || {}),
      ...(next.surfaces || {}),
      allowed: unique([...(base.surfaces?.allowed || []), ...(next.surfaces?.allowed || [])]),
    },
    memory: {
      ...(base.memory || {}),
      ...(next.memory || {}),
      scanScopes: unique([...(base.memory?.scanScopes || []), ...(next.memory?.scanScopes || [])]),
    },
    metadata: { ...(base.metadata || {}), ...(next.metadata || {}) },
  };
}

function normalizeExtends(value: ProfileManifest['extends']): string[] {
  if (Array.isArray(value)) return value.map(normalizeId).filter(Boolean);
  const normalized = normalizeId(value);
  return normalized ? [normalized] : [];
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function lastExplicitSurfaceAllowed(chain: ProfileManifestLoadResult[]): string[] {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const allowed = chain[index]?.manifest.surfaces?.allowed;
    if (Array.isArray(allowed) && allowed.length > 0) {
      return unique(allowed);
    }
  }
  return [];
}

function checksum(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}
