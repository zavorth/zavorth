import {
  ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION,
  type ZavorthCapabilityProviderAvailability,
  type ZavorthCapabilityProviderCommandCenterProjection,
  type ZavorthCapabilityProviderManifestImportReceipt,
  type ZavorthCapabilityProviderNormalizedCapability,
  type ZavorthCapabilityProviderPolicyDecision,
  type ZavorthCapabilityProviderPolicyEnvelope,
  type ZavorthCapabilityProviderRegistrySnapshot,
  type ZavorthCapabilityProviderRegistryStatus,
  type ZavorthCapabilityProviderSkillManifestInput,
  type ZavorthCapabilityProviderSourceCapability,
  type ZavorthCapabilityProviderToolBinding,
  type ZavorthCapabilityProviderToolRiskReceipt,
  type ZavorthCapabilityProviderUnavailableReceipt,
} from '../contracts/ZavorthCapabilityProviderRegistryContract.js';
import type {
  ZavorthExternalSidecarAdapterStatus,
  ZavorthExternalSidecarRisk,
} from '../contracts/ZavorthExternalSidecarAdapterContract.js';

type Runtime = {
  now?: () => Date;
  sidecarAdapterStatus?: ZavorthExternalSidecarAdapterStatus;
};

type SnapshotInput = {
  sidecarAdapterStatus?: ZavorthExternalSidecarAdapterStatus | null;
};

const DEFAULT_SOURCE_CAPABILITIES: ZavorthCapabilityProviderSourceCapability[] = [
  sourceCapability('skill.error-recovery', 'reference-runtime-a', 'Error recovery routine', 'Classifies operational failures and proposes safe recovery strategy receipts.', 'skill', ['error', 'recovery'], 'available', 'medium'),
  sourceCapability('tool.message-send', 'reference-runtime-a', 'message.send', 'Sends a message through an external chat surface.', 'tool', ['message', 'send', 'outbound'], 'degraded', 'medium', false, ['message.send']),
  sourceCapability('tool.delete-files', 'reference-runtime-b', 'delete.files', 'Deletes files from a workspace when invoked by a source runtime.', 'tool', ['delete', 'filesystem', 'dangerous'], 'available', 'critical', false, ['delete.files']),
  sourceCapability('plugin.webhook-sync', 'reference-runtime-b', 'webhook.sync', 'Synchronizes webhook events from an external source plugin.', 'plugin', ['webhook', 'sync'], 'unavailable', 'medium'),
  sourceCapability('tool.worker-launch', 'reference-runtime-b', 'worker.launch', 'Launches delegated workers from a source runtime pool.', 'tool', ['worker', 'launch'], 'available', 'high', true, ['worker.launch']),
];

const DEFAULT_SKILL_MANIFEST: ZavorthCapabilityProviderSkillManifestInput = {
  manifestId: 'manifest.channel-routing',
  sourceRuntimeId: 'reference-runtime-a',
  name: 'Channel routing manifest',
  description: 'Maps external channel events into governed Zavorth capability requests.',
  entrypoint: 'skills/channel-routing/manifest.json',
  tools: ['read.session', 'message.send'],
  tags: ['channel', 'routing', 'manifest'],
};

export class ZavorthCapabilityProviderRegistryService {
  private readonly now: () => Date;
  private readonly defaultSidecarAdapterStatus: ZavorthExternalSidecarAdapterStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultSidecarAdapterStatus = runtime.sidecarAdapterStatus || 'sidecar-adapter-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthCapabilityProviderRegistrySnapshot {
    const previousSidecarAdapterStatus = input.sidecarAdapterStatus || this.defaultSidecarAdapterStatus;
    const manifestImportReceipts = [this.importSkillManifest(DEFAULT_SKILL_MANIFEST)];
    const normalizedCapabilities = [
      ...DEFAULT_SOURCE_CAPABILITIES.map((entry) => this.normalizeCapability(entry)),
      this.normalizeCapability(manifestToSourceCapability(DEFAULT_SKILL_MANIFEST), DEFAULT_SKILL_MANIFEST.manifestId),
    ];
    const toolRiskReceipts = uniqueToolRiskReceipts([
      ...normalizedCapabilities.flatMap((entry) => entry.toolBindings.map((binding) => this.classifyToolRisk({ toolName: binding.toolName }))),
      ...manifestImportReceipts.flatMap((entry) => entry.toolRiskReceipts),
    ]);
    const unavailableReceipts = normalizedCapabilities
      .filter((entry) => entry.availability === 'unavailable')
      .map((entry) => this.buildUnavailableReceipt(entry));
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousSidecarAdapterStatus,
      normalizedCapabilities,
      manifestImportReceipts,
      toolRiskReceipts,
      unavailableReceipts,
    );
    const status = resolveStatus(previousSidecarAdapterStatus, acceptanceMatrix);
    const commandCenterProjection = this.buildCommandCenterProjection({
      status,
      normalizedCapabilities,
      manifestImportReceipts,
      toolRiskReceipts,
      unavailableReceipts,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION,
      status,
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-4-capability-providers',
      previousSidecarAdapterStatus,
      normalizedCapabilities,
      manifestImportReceipts,
      toolRiskReceipts,
      unavailableReceipts,
      commandCenterProjection,
      acceptanceMatrix,
      summary: {
        providers: new Set(normalizedCapabilities.map((entry) => entry.sourceRuntimeId)).size,
        normalizedCapabilities: normalizedCapabilities.length,
        importedSkillManifests: manifestImportReceipts.filter((entry) => entry.status === 'import-ready').length,
        classifiedTools: toolRiskReceipts.length,
        approvalRequiredCapabilities: normalizedCapabilities.filter((entry) => entry.policy.approvalRequired).length,
        quarantinedCapabilities: normalizedCapabilities.filter((entry) => entry.availability === 'quarantined').length,
        unavailableCapabilities: normalizedCapabilities.filter((entry) => entry.availability === 'unavailable').length,
        directToolExposureAllowed: 0,
        dangerousCapabilitiesApprovalGated: normalizedCapabilities
          .filter((entry) => isDangerousRisk(entry.risk) && entry.policy.approvalRequired).length,
        unavailableCapabilitiesFailHonestly: unavailableReceipts.length,
        sourceRuntimeCodeExecuted: false,
        toolExecutionPerformed: false,
        skillMutationPerformed: false,
      },
      safety: {
        registryOnly: true,
        noSourceRuntimeCodeExecuted: true,
        noToolExposurePerformed: true,
        noToolExecutionPerformed: true,
        noSkillMutationPerformed: true,
        noProviderCallPerformed: true,
        approvalBypassAllowed: false,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:capability-provider-registry',
        inspectJson: 'npm run zavorth:capability-provider-registry:json',
        check: 'npm run zavorth:capability-provider-registry:check --silent',
        nextPhase: '291 Phase 5 - Channels And Messaging',
      },
    };
  }

  public normalizeCapability(
    source: ZavorthCapabilityProviderSourceCapability,
    manifestRef: string | null = null,
  ): ZavorthCapabilityProviderNormalizedCapability {
    const toolNames = source.kind === 'tool' && (!source.toolNames || source.toolNames.length === 0)
      ? [source.name]
      : source.toolNames || [];
    const toolRiskReceipts = toolNames.map((toolName) => this.classifyToolRisk({ toolName }));
    const risk = highestRisk([
      source.riskHint || 'low',
      ...toolRiskReceipts.map((entry) => entry.risk),
    ]);
    const availability = source.quarantined ? 'quarantined' : source.availability;
    const policy = buildPolicyEnvelope(source.kind, availability, risk, toolRiskReceipts);

    return {
      capabilityId: `zavorth.capability.${safeId(source.sourceCapabilityId)}`,
      sourceCapabilityId: source.sourceCapabilityId,
      sourceRuntimeId: source.sourceRuntimeId,
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      kind: source.kind,
      name: normalizeDisplayName(source.name),
      description: source.description.trim(),
      tags: Array.from(new Set(source.tags.map((entry) => safeId(entry)).filter(Boolean))),
      availability,
      risk,
      manifestRef,
      toolBindings: toolRiskReceipts.map((receipt) => toolBinding(receipt)),
      policy,
    };
  }

  public importSkillManifest(
    manifest: ZavorthCapabilityProviderSkillManifestInput,
  ): ZavorthCapabilityProviderManifestImportReceipt {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!manifest.manifestId.trim()) errors.push('missing-manifest-id');
    if (!manifest.name.trim()) errors.push('missing-name');
    if (!manifest.description.trim()) errors.push('missing-description');
    if (!manifest.entrypoint.trim()) errors.push('missing-entrypoint');
    if (manifest.tools.length === 0) warnings.push('manifest-has-no-tools');

    const toolRiskReceipts = manifest.tools.map((toolName) => this.classifyToolRisk({ toolName }));

    return {
      status: errors.length === 0 ? 'import-ready' : 'blocked',
      manifestId: manifest.manifestId || 'missing-manifest',
      capabilityId: errors.length === 0 ? `zavorth.capability.${safeId(manifest.manifestId)}` : null,
      importedName: normalizeDisplayName(manifest.name || 'Unnamed manifest'),
      warnings,
      errors,
      toolRiskReceipts,
      safety: {
        noSkillMutationPerformed: true,
        noToolExposurePerformed: true,
        noSourceRuntimeCodeExecuted: true,
        approvalRequiredBeforeActivation: true,
      },
    };
  }

  public classifyToolRisk(input: { toolName: string }): ZavorthCapabilityProviderToolRiskReceipt {
    const toolName = String(input.toolName || '').trim();
    const signals: string[] = [];
    let risk: ZavorthExternalSidecarRisk = 'low';
    let requiredDecision: ZavorthCapabilityProviderPolicyDecision = 'preview-only';
    let approvalRequired = false;
    let quarantineRequired = false;
    let reason = 'Tool is metadata-only and can be previewed without execution.';

    if (/\b(delete|remove|rm|drop|wipe|format|filesystem\.write|files?\.delete)\b/i.test(toolName)) {
      signals.push('destructive-filesystem-intent');
      risk = 'critical';
      requiredDecision = 'approval-required';
      approvalRequired = true;
      reason = 'Destructive tool intent requires an explicit Zavorth approval envelope.';
    } else if (/\b(worker\.launch|spawn|exec|shell|command|process)\b/i.test(toolName)) {
      signals.push('worker-or-process-launch');
      risk = 'high';
      requiredDecision = 'approval-required';
      approvalRequired = true;
      reason = 'Worker or process launch cannot run without approval.';
    } else if (/\b(send|publish|post|message|reply|webhook)\b/i.test(toolName)) {
      signals.push('outbound-io');
      risk = 'medium';
      requiredDecision = 'approval-required';
      approvalRequired = true;
      reason = 'Outbound IO must stay behind ReplyPipeline and approval policy.';
    }

    if (/\b(secret|token|credential|key)\b/i.test(toolName)) {
      signals.push('credential-surface');
      risk = highestRisk([risk, 'high']);
      requiredDecision = 'approval-required';
      approvalRequired = true;
      reason = 'Credential-related tools require secret-boundary review before activation.';
    }

    if (/\b(untrusted|raw|unsafe)\b/i.test(toolName)) {
      signals.push('quarantine-signal');
      risk = highestRisk([risk, 'high']);
      requiredDecision = 'quarantine';
      approvalRequired = true;
      quarantineRequired = true;
      reason = 'Quarantine signal detected in tool metadata.';
    }

    return {
      toolName: toolName || 'unnamed-tool',
      risk,
      requiredDecision,
      approvalRequired,
      quarantineRequired,
      reason,
      signals: signals.length > 0 ? signals : ['metadata-only'],
      safety: {
        noToolExecution: true,
        noDirectExposure: true,
        noApprovalBypass: true,
      },
    };
  }

  public buildUnavailableReceipt(
    capability: ZavorthCapabilityProviderNormalizedCapability,
  ): ZavorthCapabilityProviderUnavailableReceipt {
    return {
      capabilityId: capability.capabilityId,
      status: 'honest-unavailable',
      userVisibleMessage: `${capability.name} is unavailable in the current provider registry.`,
      retryHint: 'Retry only after the provider reports available or degraded status through a read-only probe.',
      fallbackAllowed: false,
      safety: {
        noSilentFallback: true,
        noToolExecution: true,
        noProviderCall: true,
      },
    };
  }

  public buildCommandCenterProjection(input: {
    status: ZavorthCapabilityProviderRegistryStatus;
    normalizedCapabilities: ZavorthCapabilityProviderNormalizedCapability[];
    manifestImportReceipts: ZavorthCapabilityProviderManifestImportReceipt[];
    toolRiskReceipts: ZavorthCapabilityProviderToolRiskReceipt[];
    unavailableReceipts: ZavorthCapabilityProviderUnavailableReceipt[];
  }): ZavorthCapabilityProviderCommandCenterProjection {
    const quarantined = input.normalizedCapabilities.filter((entry) => entry.availability === 'quarantined').length;
    const approvalRequired = input.normalizedCapabilities.filter((entry) => entry.policy.approvalRequired).length;
    return {
      title: 'Capability Provider Registry',
      status: input.status,
      tone: input.status === 'capability-provider-registry-ready' ? 'ready' : input.status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('capabilities', 'Capabilities', String(input.normalizedCapabilities.length), 'External skills, tools, and plugins normalized as Zavorth capabilities'),
        card('manifests', 'Skill Manifests', String(input.manifestImportReceipts.length), 'Manifest imports are dry-run receipts, not skill mutations'),
        card('tools', 'Tool Risks', String(input.toolRiskReceipts.length), 'Tools classified before exposure or execution'),
        card('approval', 'Approval Required', String(approvalRequired), 'Dangerous or outbound capabilities require approval'),
        card('quarantine', 'Quarantined', String(quarantined), 'Quarantined capabilities cannot expose tools'),
        card('unavailable', 'Unavailable', String(input.unavailableReceipts.length), 'Unavailable capabilities fail honestly'),
        card('direct-tools', 'Direct Tool Exposure', '0', 'Phase 4 publishes registry metadata only'),
      ],
      policyPills: [
        'metadata normalization',
        'skill manifest dry-run',
        'tool risk classification',
        'approval-gated danger',
        'honest unavailable',
        'no direct tool exposure',
      ],
      nextSafeAction: input.status === 'capability-provider-registry-ready'
        ? 'Proceed to 291 Phase 5 - Channels And Messaging.'
        : 'Fix failed capability provider gates before channel activation.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthCapabilityProviderRegistrySnapshot): string {
    const lines = [
      'Zavorth Capability Provider Registry - Phase 4',
      '',
      `Status: ${snapshot.status}`,
      `Previous sidecar adapter: ${snapshot.previousSidecarAdapterStatus}`,
      `Capabilities: ${snapshot.summary.normalizedCapabilities}`,
      `Skill manifests imported: ${snapshot.summary.importedSkillManifests}`,
      `Classified tools: ${snapshot.summary.classifiedTools}`,
      `Approval-required capabilities: ${snapshot.summary.approvalRequiredCapabilities}`,
      `Quarantined capabilities: ${snapshot.summary.quarantinedCapabilities}`,
      `Unavailable capabilities: ${snapshot.summary.unavailableCapabilities}`,
      `Direct tool exposure allowed: ${snapshot.summary.directToolExposureAllowed}`,
      `Tool execution performed: ${snapshot.safety.noToolExecutionPerformed === true ? 'false' : 'true'}`,
      `Skill mutation performed: ${snapshot.safety.noSkillMutationPerformed === true ? 'false' : 'true'}`,
      '',
      'Command Center:',
      ...snapshot.commandCenterProjection.cards.map((entry) => `- ${entry.label}: ${entry.value} (${entry.detail})`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Next: ${snapshot.commands.nextPhase}`,
    ];
    return lines.join('\n');
  }
}

function sourceCapability(
  sourceCapabilityId: string,
  sourceRuntimeId: string,
  name: string,
  description: string,
  kind: ZavorthCapabilityProviderSourceCapability['kind'],
  tags: string[],
  availability: ZavorthCapabilityProviderSourceCapability['availability'],
  riskHint: ZavorthExternalSidecarRisk,
  quarantined = false,
  toolNames: string[] = [],
): ZavorthCapabilityProviderSourceCapability {
  return {
    sourceCapabilityId,
    sourceRuntimeId,
    name,
    description,
    kind,
    tags,
    availability,
    riskHint,
    quarantined,
    toolNames,
  };
}

function manifestToSourceCapability(
  manifest: ZavorthCapabilityProviderSkillManifestInput,
): ZavorthCapabilityProviderSourceCapability {
  return {
    sourceCapabilityId: manifest.manifestId,
    sourceRuntimeId: manifest.sourceRuntimeId,
    name: manifest.name,
    description: manifest.description,
    kind: 'skill',
    tags: manifest.tags,
    availability: 'available',
    riskHint: 'low',
    quarantined: false,
    toolNames: manifest.tools,
  };
}

function buildPolicyEnvelope(
  kind: ZavorthCapabilityProviderSourceCapability['kind'],
  availability: ZavorthCapabilityProviderAvailability,
  risk: ZavorthExternalSidecarRisk,
  toolRiskReceipts: ZavorthCapabilityProviderToolRiskReceipt[],
): ZavorthCapabilityProviderPolicyEnvelope {
  const hasQuarantineTool = toolRiskReceipts.some((entry) => entry.quarantineRequired);
  const hasApprovalTool = toolRiskReceipts.some((entry) => entry.approvalRequired);

  if (availability === 'unavailable') {
    return policy('unavailable', false, false, false, 'honest-unavailable', 'Capability is unavailable and must fail honestly.');
  }
  if (availability === 'quarantined' || hasQuarantineTool) {
    return policy('quarantine', true, false, false, 'quarantine-review', 'Capability is quarantined and cannot expose tools.');
  }
  if (isDangerousRisk(risk) || hasApprovalTool) {
    return policy('approval-required', true, false, false, 'approval-required', 'Capability requires approval before any live activation.');
  }
  if (kind === 'tool') {
    return policy('preview-only', false, false, false, 'none', 'Tool metadata can be previewed, but direct exposure is disabled in Phase 4.');
  }
  return policy('allow', false, false, true, 'none', 'Capability metadata is allowed in the governed registry.');
}

function policy(
  requiredDecision: ZavorthCapabilityProviderPolicyDecision,
  approvalRequired: boolean,
  canExposeTool: boolean,
  canRunWithoutApproval: boolean,
  failureMode: ZavorthCapabilityProviderPolicyEnvelope['failureMode'],
  reason: string,
): ZavorthCapabilityProviderPolicyEnvelope {
  return {
    requiredDecision,
    approvalRequired,
    canExposeTool,
    canRunWithoutApproval,
    failureMode,
    reason,
  };
}

function toolBinding(receipt: ZavorthCapabilityProviderToolRiskReceipt): ZavorthCapabilityProviderToolBinding {
  return {
    toolId: `zavorth.tool.${safeId(receipt.toolName)}`,
    toolName: receipt.toolName,
    risk: receipt.risk,
    directExposureAllowed: false,
    previewAllowed: receipt.requiredDecision !== 'quarantine' && receipt.requiredDecision !== 'unavailable',
    approvalRequired: receipt.approvalRequired,
    requiredDecision: receipt.requiredDecision,
  };
}

function buildAcceptanceMatrix(
  previousSidecarAdapterStatus: ZavorthExternalSidecarAdapterStatus,
  normalizedCapabilities: ZavorthCapabilityProviderNormalizedCapability[],
  manifestImportReceipts: ZavorthCapabilityProviderManifestImportReceipt[],
  toolRiskReceipts: ZavorthCapabilityProviderToolRiskReceipt[],
  unavailableReceipts: ZavorthCapabilityProviderUnavailableReceipt[],
): ZavorthCapabilityProviderRegistrySnapshot['acceptanceMatrix'] {
  const dangerousCapabilities = normalizedCapabilities.filter((entry) => isDangerousRisk(entry.risk));
  const quarantinedCapabilities = normalizedCapabilities.filter((entry) => entry.availability === 'quarantined');
  const unavailableCapabilities = normalizedCapabilities.filter((entry) => entry.availability === 'unavailable');
  const directToolExposureCount = normalizedCapabilities.flatMap((entry) => entry.toolBindings)
    .filter((binding) => binding.directExposureAllowed).length;

  return [
    acceptance('phase-3-sidecar-adapter-ready', previousSidecarAdapterStatus === 'sidecar-adapter-ready', `previousSidecarAdapterStatus=${previousSidecarAdapterStatus}`),
    acceptance('capability-metadata-normalized', normalizedCapabilities.length >= 5
      && normalizedCapabilities.every((entry) => entry.capabilityId.startsWith('zavorth.capability.') && entry.publicName === 'Zavorth' && entry.sourceRuntimeDiagnosticsOnly), `${normalizedCapabilities.length} normalized capability(ies)`),
    acceptance('skill-manifest-import-dry-run', manifestImportReceipts.some((entry) => entry.status === 'import-ready')
      && manifestImportReceipts.every((entry) => entry.safety.noSkillMutationPerformed && entry.safety.noToolExposurePerformed), `${manifestImportReceipts.length} manifest receipt(s)`),
    acceptance('tool-risk-classification-ready', toolRiskReceipts.length >= 3
      && toolRiskReceipts.every((entry) => entry.safety.noToolExecution && entry.safety.noDirectExposure), `${toolRiskReceipts.length} classified tool(s)`),
    acceptance('policy-integration-attached', normalizedCapabilities.every((entry) => !!entry.policy.requiredDecision)
      && directToolExposureCount === 0, `${directToolExposureCount} direct tool exposure(s)`),
    acceptance('dangerous-capabilities-require-approval', dangerousCapabilities.length > 0
      && dangerousCapabilities.every((entry) => entry.policy.approvalRequired && !entry.policy.canRunWithoutApproval), `${dangerousCapabilities.length} dangerous capability(ies)`),
    acceptance('quarantined-capabilities-cannot-expose-tools', quarantinedCapabilities.length > 0
      && quarantinedCapabilities.every((entry) => !entry.policy.canExposeTool && entry.toolBindings.every((binding) => !binding.directExposureAllowed)), `${quarantinedCapabilities.length} quarantined capability(ies)`),
    acceptance('unavailable-capabilities-fail-honestly', unavailableCapabilities.length > 0
      && unavailableReceipts.length === unavailableCapabilities.length
      && unavailableReceipts.every((entry) => entry.status === 'honest-unavailable' && entry.safety.noSilentFallback), `${unavailableReceipts.length} unavailable receipt(s)`),
  ];
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthCapabilityProviderRegistrySnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function resolveStatus(
  previousSidecarAdapterStatus: ZavorthExternalSidecarAdapterStatus,
  acceptanceMatrix: ZavorthCapabilityProviderRegistrySnapshot['acceptanceMatrix'],
): ZavorthCapabilityProviderRegistryStatus {
  if (previousSidecarAdapterStatus !== 'sidecar-adapter-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'capability-provider-registry-ready';
}

function uniqueToolRiskReceipts(
  receipts: ZavorthCapabilityProviderToolRiskReceipt[],
): ZavorthCapabilityProviderToolRiskReceipt[] {
  const seen = new Set<string>();
  const unique: ZavorthCapabilityProviderToolRiskReceipt[] = [];
  for (const receipt of receipts) {
    const key = safeId(receipt.toolName);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(receipt);
  }
  return unique;
}

function isDangerousRisk(risk: ZavorthExternalSidecarRisk): boolean {
  return risk === 'high' || risk === 'critical';
}

function highestRisk(risks: ZavorthExternalSidecarRisk[]): ZavorthExternalSidecarRisk {
  const order: Record<ZavorthExternalSidecarRisk, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return risks.reduce((highest, next) => (order[next] > order[highest] ? next : highest), 'low');
}

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ') || 'Unnamed capability';
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthCapabilityProviderCommandCenterProjection['cards'][number] {
  return { id, label, value, detail };
}
