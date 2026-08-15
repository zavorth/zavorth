import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import { logger } from '../logger.js';
import type {
ZavorthSkillCapabilityTag,
  ZavorthSkillEcosystemImporterSnapshot,
  ZavorthSkillManifest,
  ZavorthSkillPermissionProfileId,
  ZavorthSkillSecretRef,
  ZavorthSkillSmokeTestPrompt,
} from '../contracts/ZavorthSkillEcosystemPackContract.js';

type Runtime = {
  now?: () => Date;
  skillCatalogService?: Pick<SkillCatalogService, 'listEntries'> | null;
  catalogEntries?: SkillCatalogEntry[];
  maxWorkspaceCatalogManifests?: number;
};

type ManifestSpec = {
  id: string;
  name: string;
  description: string;
  sourceKind: ZavorthSkillManifest['sourceKind'];
  capabilityTags: ZavorthSkillCapabilityTag[];
  permissionProfileId: ZavorthSkillPermissionProfileId;
  requiredSecretRefs?: ZavorthSkillSecretRef[];
  mcpBridgeOptional?: boolean;
  acpBridgeOptional?: boolean;
  notes: string[];
};

const CURATED_MANIFESTS: ManifestSpec[] = [
  {
    id: 'skill.zavorth-pulse',
    name: 'Zavorth Pulse',
    description: 'Builds a local operational pulse from workspace notes, tasks and recent receipts.',
    sourceKind: 'zavorth-curated',
    capabilityTags: ['personal-productivity', 'workflow'],
    permissionProfileId: 'local-readonly',
    notes: ['Readonly and inspectable; useful as a personal productivity skill without connector setup.'],
  },
  {
    id: 'skill.document-research-summarizer',
    name: 'Document Research Summarizer',
    description: 'Turns local documents and references into artifact-first research summaries.',
    sourceKind: 'zavorth-curated',
    capabilityTags: ['document', 'research'],
    permissionProfileId: 'local-readonly',
    notes: ['Uses local document inspection only during smoke tests.'],
  },
  {
    id: 'skill.release-note-drafter',
    name: 'Release Note Drafter',
    description: 'Drafts release notes from local receipts, checks and package metadata.',
    sourceKind: 'zavorth-curated',
    capabilityTags: ['release', 'workflow'],
    permissionProfileId: 'workspace-write-approval',
    notes: ['Writes are approval-gated; smoke tests stay in dry-run.'],
  },
  {
    id: 'skill.qa-scenario-author',
    name: 'QA Scenario Author',
    description: 'Creates local QA scenario outlines from existing check receipts.',
    sourceKind: 'zavorth-curated',
    capabilityTags: ['workspace-qa', 'workflow'],
    permissionProfileId: 'workspace-write-approval',
    notes: ['Useful test prompt concepts are represented as dry-run smoke prompts.'],
  },
  {
    id: 'skill.security-review-assistant',
    name: 'Security Review Assistant',
    description: 'Inspects local manifests, permission profiles and receipts for risky behavior.',
    sourceKind: 'zavorth-curated',
    capabilityTags: ['security', 'workspace-qa'],
    permissionProfileId: 'local-readonly',
    notes: ['Readonly security skill that can be inspected and smoked without secrets.'],
  },
  {
    id: 'skill.web-research-reviewer',
    name: 'Web Research Reviewer',
    description: 'Plans web research with explicit network approval before any external read.',
    sourceKind: 'zavorth-curated',
    capabilityTags: ['research'],
    permissionProfileId: 'network-read-approval',
    notes: ['Network access is approval-gated and excluded from non-destructive smoke tests.'],
  },
  {
    id: 'skill.connector-calendar-brief',
    name: 'Calendar Brief Connector',
    description: 'Connector concept for producing a schedule brief from a configured calendar SecretRef.',
    sourceKind: 'connector-concept',
    capabilityTags: ['app-connector', 'personal-productivity'],
    permissionProfileId: 'connector-live-secretref',
    requiredSecretRefs: [secretRef('calendar.oauth')],
    mcpBridgeOptional: true,
    acpBridgeOptional: true,
    notes: ['Live execution requires owner approval and SecretRef calendar.oauth.'],
  },
  {
    id: 'skill.connector-email-draft',
    name: 'Email Draft Connector',
    description: 'Connector concept for drafting outbound email from local intent and approved mail SecretRef.',
    sourceKind: 'connector-concept',
    capabilityTags: ['app-connector', 'personal-productivity'],
    permissionProfileId: 'connector-live-secretref',
    requiredSecretRefs: [secretRef('mail.oauth')],
    mcpBridgeOptional: true,
    acpBridgeOptional: true,
    notes: ['Smoke tests prove denial without live mail credentials.'],
  },
  {
    id: 'skill.connector-issue-triage',
    name: 'Issue Triage Connector',
    description: 'Connector concept for summarizing issue queues through approved tool and SecretRef configuration.',
    sourceKind: 'connector-concept',
    capabilityTags: ['app-connector', 'workspace-qa'],
    permissionProfileId: 'tool-execution-approval',
    requiredSecretRefs: [secretRef('issues.token')],
    mcpBridgeOptional: true,
    acpBridgeOptional: true,
    notes: ['Tool execution and token access are denied until owner approval is attached.'],
  },
];

export class ZavorthSkillEcosystemImporterService {
  private readonly now: () => Date;
  private readonly skillCatalogService: Pick<SkillCatalogService, 'listEntries'> | null;
  private readonly catalogEntries: SkillCatalogEntry[] | null;
  private readonly maxWorkspaceCatalogManifests: number;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalogService = runtime.skillCatalogService === undefined
      ? new SkillCatalogService()
      : runtime.skillCatalogService;
    this.catalogEntries = runtime.catalogEntries || null;
    this.maxWorkspaceCatalogManifests = runtime.maxWorkspaceCatalogManifests ?? 4;
  }

  public buildSnapshot(): ZavorthSkillEcosystemImporterSnapshot {
    const workspaceCatalogManifests = this.buildWorkspaceCatalogManifests();
    const manifests = [
      ...CURATED_MANIFESTS.map((manifest) => this.materializeManifest(manifest)),
      ...workspaceCatalogManifests,
    ];

    return {
      status: manifests.length >= CURATED_MANIFESTS.length ? 'pass' : 'warn',
      manifests,
      selectedSkills: manifests.length,
      connectorConcepts: manifests.filter((manifest) => manifest.sourceKind === 'connector-concept').length,
      workspaceCatalogInputs: workspaceCatalogManifests.length,
      enabledByDefault: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  public inspectManifest(manifestId: string): ZavorthSkillManifest | null {
    return this.buildSnapshot().manifests.find((manifest) => manifest.id === manifestId) || null;
  }

  private buildWorkspaceCatalogManifests(): ZavorthSkillManifest[] {
    const entries = this.loadCatalogEntries()
      .filter((entry) => entry.name && entry.description)
      .slice(0, this.maxWorkspaceCatalogManifests);

    return entries.map((entry) => this.materializeManifest({
      id: `skill.catalog.${safeId(entry.name)}`,
      name: entry.name,
      description: entry.description,
      sourceKind: 'workspace-catalog',
      capabilityTags: this.tagsFromCatalogEntry(entry),
      permissionProfileId: entry.sourceTrust === 'trusted' ? 'local-readonly' : 'workspace-write-approval',
      notes: [
        `Workspace catalog source: ${entry.sourceLabel || entry.sourceId || 'local'}.`,
        'Imported as optional manifest metadata, not as core runtime behavior.',
      ],
    }));
  }

  private loadCatalogEntries(): SkillCatalogEntry[] {
    if (this.catalogEntries) {
      return this.catalogEntries;
    }
    if (!this.skillCatalogService) {
      return [];
    }
    try {
      return this.skillCatalogService.listEntries();
    } catch (error: unknown) {logger.warn('[Zavorth Skill Ecosystem Importer] load operation failed', error); return []; }
  }

  private materializeManifest(spec: ManifestSpec): ZavorthSkillManifest {
    const ownerApprovalRequiredForEnablement = spec.permissionProfileId !== 'local-readonly';
    const requiredSecretRefs = (spec.requiredSecretRefs || []).map((secret) => ({
      ...secret,
      secretValueSerialized: false as const,
    }));

    return {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      version: '0.1.0',
      sourceKind: spec.sourceKind,
      optional: true,
      enabledByDefault: false,
      inspectableBeforeEnablement: true,
      ownerApprovalRequiredForEnablement,
      capabilityTags: spec.capabilityTags.slice(),
      permissionProfileId: spec.permissionProfileId,
      requiredSecretRefs,
      smokeTests: this.buildSmokeTests(spec, requiredSecretRefs.length > 0),
      testPrompts: [
        `Inspect ${spec.name} and explain required permissions without enabling it.`,
        `Run a non-destructive dry-run for ${spec.name} and emit a receipt.`,
      ],
      mcpBridgeOptional: spec.mcpBridgeOptional === true,
      acpBridgeOptional: spec.acpBridgeOptional === true,
      liveExternalIoAllowedByDefault: false,
      secretValuesSerialized: false,
      notes: spec.notes.slice(),
    };
  }

  private buildSmokeTests(spec: ManifestSpec, requiresLiveSecret: boolean): ZavorthSkillSmokeTestPrompt[] {
    return [
      {
        id: `${safeId(spec.id)}.inspect`,
        prompt: `Inspect manifest ${spec.name} without enabling tools or secrets.`,
        destructive: false,
        requiresLiveSecret: false,
        expectedReceipt: 'inspect',
      },
      {
        id: `${safeId(spec.id)}.dry-run-or-deny`,
        prompt: `Run the safe smoke path for ${spec.name} with no live secrets.`,
        destructive: false,
        requiresLiveSecret,
        expectedReceipt: requiresLiveSecret || spec.permissionProfileId !== 'local-readonly' ? 'deny' : 'dry-run',
      },
    ];
  }

  private tagsFromCatalogEntry(_entry: SkillCatalogEntry): ZavorthSkillCapabilityTag[] {
    const tags = new Set<ZavorthSkillCapabilityTag>();
    if (tags.size === 0) tags.add('workflow');
    return Array.from(tags.values());
  }
}

function secretRef(id: string): ZavorthSkillSecretRef {
  return {
    id,
    provider: id.includes('oauth') ? 'oauth' : 'token',
    configured: false,
    secretValueSerialized: false,
  };
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'skill';
}
