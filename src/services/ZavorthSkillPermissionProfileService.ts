import type {
  ZavorthSkillManifest,
  ZavorthSkillPermissionEvaluation,
  ZavorthSkillPermissionProfile,
  ZavorthSkillPermissionProfileId,
  ZavorthSkillPermissionProfileSnapshot,
} from '../contracts/ZavorthSkillEcosystemPackContract.js';

type Runtime = {
  now?: () => Date;
};

const PROFILES: ZavorthSkillPermissionProfile[] = [
  {
    id: 'local-readonly',
    label: 'local readonly',
    readWorkspace: true,
    writeWorkspace: false,
    network: 'none',
    secrets: 'none',
    toolExecution: 'non-destructive',
    ownerApprovalRequired: false,
    enabledByDefault: false,
    liveExternalIoAllowedByDefault: false,
    notes: ['Inspection, summarization and dry-run prompts can use this profile.'],
  },
  {
    id: 'workspace-write-approval',
    label: 'Workspace write with approval',
    readWorkspace: true,
    writeWorkspace: true,
    network: 'none',
    secrets: 'none',
    toolExecution: 'approval-required',
    ownerApprovalRequired: true,
    enabledByDefault: false,
    liveExternalIoAllowedByDefault: false,
    notes: ['Any write action requires an explicit Zavorth approval receipt.'],
  },
  {
    id: 'network-read-approval',
    label: 'Network read with approval',
    readWorkspace: true,
    writeWorkspace: false,
    network: 'read',
    secrets: 'none',
    toolExecution: 'approval-required',
    ownerApprovalRequired: true,
    enabledByDefault: false,
    liveExternalIoAllowedByDefault: false,
    notes: ['Network reads are never part of smoke tests and require owner approval.'],
  },
  {
    id: 'connector-live-secretref',
    label: 'Connector live SecretRef',
    readWorkspace: true,
    writeWorkspace: false,
    network: 'live-api',
    secrets: 'secret-ref-required',
    toolExecution: 'approval-required',
    ownerApprovalRequired: true,
    enabledByDefault: false,
    liveExternalIoAllowedByDefault: false,
    notes: ['Live connector skills require owner approval and configured SecretRef entries.'],
  },
  {
    id: 'tool-execution-approval',
    label: 'Tool execution with approval',
    readWorkspace: true,
    writeWorkspace: true,
    network: 'read',
    secrets: 'secret-ref-required',
    toolExecution: 'approval-required',
    ownerApprovalRequired: true,
    enabledByDefault: false,
    liveExternalIoAllowedByDefault: false,
    notes: ['Higher-risk tools are inspectable and smoke-testable, but execution is denied without approvals.'],
  },
];

export class ZavorthSkillPermissionProfileService {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildProfiles(): ZavorthSkillPermissionProfile[] {
    return PROFILES.map((profile) => ({
      ...profile,
      notes: profile.notes.slice(),
    }));
  }

  public resolveProfile(profileId: ZavorthSkillPermissionProfileId): ZavorthSkillPermissionProfile {
    const profile = PROFILES.find((entry) => entry.id === profileId);
    if (!profile) {
      throw new Error(`Skill permission profile not found: ${profileId}`);
    }
    return {
      ...profile,
      notes: profile.notes.slice(),
    };
  }

  public buildSnapshot(manifests: ZavorthSkillManifest[]): ZavorthSkillPermissionProfileSnapshot {
    const evaluations = manifests.map((manifest) => this.evaluateManifest(manifest));
    const enablementsDenied = evaluations.filter((entry) => entry.denialRequired).length;
    const liveSkills = manifests.filter((manifest) => this.resolveProfile(manifest.permissionProfileId).network === 'live-api');

    return {
      status: evaluations.every((entry) => entry.status !== 'fail') ? 'pass' : 'fail',
      profiles: this.buildProfiles(),
      evaluations,
      enablementsAllowed: evaluations.filter((entry) => entry.enableAllowed).length,
      enablementsDenied,
      liveSkillsRequiringOwnerApproval: liveSkills
        .filter((manifest) => manifest.ownerApprovalRequiredForEnablement)
        .length,
      liveSkillsMissingSecretRefs: evaluations
        .filter((entry) => entry.profileId === 'connector-live-secretref' && entry.missingSecretRefs.length > 0)
        .length,
      enabledByDefault: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  public evaluateManifest(manifest: ZavorthSkillManifest): ZavorthSkillPermissionEvaluation {
    const profile = this.resolveProfile(manifest.permissionProfileId);
    const missingSecretRefs = profile.secrets === 'secret-ref-required'
      ? manifest.requiredSecretRefs
        .filter((secretRef) => !secretRef.configured)
        .map((secretRef) => secretRef.id)
      : [];
    const ownerApprovalRequired = profile.ownerApprovalRequired || manifest.ownerApprovalRequiredForEnablement;
    const enableAllowed = !ownerApprovalRequired && missingSecretRefs.length === 0;
    const executeAllowed = enableAllowed && profile.toolExecution !== 'approval-required';
    const denialRequired = !enableAllowed || !executeAllowed || profile.network === 'live-api';

    return {
      manifestId: manifest.id,
      profileId: manifest.permissionProfileId,
      status: denialRequired ? 'deny' : 'pass',
      inspectAllowed: true,
      enableAllowed,
      executeAllowed,
      denialRequired,
      reason: denialRequired
        ? this.denialReason({ ownerApprovalRequired, missingSecretRefs, profile })
        : 'Skill is local, readonly and can be inspected or dry-run without live secrets.',
      requiredSecretRefs: manifest.requiredSecretRefs.map((secretRef) => secretRef.id),
      missingSecretRefs,
      ownerApprovalRequired,
      enabledByDefault: false,
      liveExternalIoAllowedByDefault: false,
      secretValuesSerialized: false,
    };
  }

  public buildReceiptId(manifestId: string, action: string): string {
    return `zavorth.zavorthControl-controls.skill-permission.${safeId(manifestId)}.${safeId(action)}.${this.now().getTime()}.receipt`;
  }

  private denialReason(input: {
    ownerApprovalRequired: boolean;
    missingSecretRefs: string[];
    profile: ZavorthSkillPermissionProfile;
  }): string {
    const reasons = [];
    if (input.ownerApprovalRequired) {
      reasons.push('owner approval required');
    }
    if (input.missingSecretRefs.length > 0) {
      reasons.push(`missing SecretRef ${input.missingSecretRefs.join(', ')}`);
    }
    if (input.profile.network === 'live-api') {
      reasons.push('live connector profile');
    }
    if (input.profile.toolExecution === 'approval-required') {
      reasons.push('tool execution approval required');
    }
    return reasons.join('; ') || 'permission profile denies execution by default';
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}
