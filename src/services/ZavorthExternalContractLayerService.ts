import {
  ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION,
  type ZavorthExternalRuntimeContractEnvelopeKind,
  type ZavorthExternalRuntimeContractErrorCode,
  type ZavorthExternalContractLayerSnapshot,
  type ZavorthExternalContractLayerStatus,
  type ZavorthExternalRuntimeContractRisk,
  type ZavorthExternalRuntimeContractTrustScope,
  type ZavorthExternalRuntimeEnvelopeSchema,
  type ZavorthExternalRuntimeExternalEnvelopeInput,
  type ZavorthExternalRuntimeExternalRuntimeDescriptor,
  type ZavorthExternalRuntimeNormalizationError,
  type ZavorthExternalRuntimeNormalizationReceipt,
} from '../contracts/ZavorthExternalContractLayerContract.js';
import type {
  ZavorthExternalCapabilityInventoryProbeRuntimeId,
  ZavorthExternalCapabilityInventoryStatus,
} from '../contracts/ZavorthExternalCapabilityInventoryContract.js';

type Runtime = {
  now?: () => Date;
  inventoryStatus?: ZavorthExternalCapabilityInventoryStatus;
};

type SnapshotInput = {
  inventoryStatus?: ZavorthExternalCapabilityInventoryStatus | null;
};

const SUPPORTED_RUNTIMES = new Set<ZavorthExternalCapabilityInventoryProbeRuntimeId>([
  'reference-runtime',
  'acp-compatible-sidecar',
  'acp-compatibility-fixture',
]);

const ENVELOPE_SCHEMAS: ZavorthExternalRuntimeEnvelopeSchema[] = [
  schema('runtime', 'ZavorthExternalRuntimeDescriptorContract', 'ZavorthExternalRuntimeDescriptorService', 'ZavorthControlExternalRuntimeDescriptor', ['kind', 'sourceRuntimeId', 'sourceRef'], 'capability-discovery', 'medium', false, true, ['source_identity_leak', 'missing_provenance']),
  schema('capability', 'ZavorthExternalCapabilityEnvelopeContract', 'ZavorthExternalCapabilityEnvelopeService', 'ZavorthControlExternalCapabilityEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'capability-discovery', 'medium', false, true, ['source_identity_leak', 'missing_provenance']),
  schema('skill', 'ZavorthExternalSkillEnvelopeContract', 'ZavorthExternalSkillEnvelopeService', 'ZavorthControlExternalSkillEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'capability-discovery', 'high', true, true, ['direct_tool_exposure', 'live_execution_requested', 'missing_provenance']),
  schema('tool', 'ZavorthExternalToolEnvelopeContract', 'ZavorthExternalToolEnvelopeService', 'ZavorthControlExternalToolEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'tool-preview', 'high', true, true, ['direct_tool_exposure', 'raw_secret_value', 'live_execution_requested']),
  schema('channel', 'ZavorthExternalChannelEnvelopeContract', 'ZavorthExternalChannelEnvelopeService', 'ZavorthControlExternalChannelEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'capability-discovery', 'high', true, true, ['source_identity_leak', 'raw_secret_value', 'live_execution_requested']),
  schema('session', 'ZavorthExternalSessionEnvelopeContract', 'ZavorthExternalSessionEnvelopeService', 'ZavorthControlExternalSessionEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'memory-recall', 'medium', false, true, ['source_identity_leak', 'missing_provenance']),
  schema('event', 'ZavorthExternalEventEnvelopeContract', 'ZavorthExternalEventEnvelopeService', 'ZavorthControlExternalEventEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'governed-execution', 'medium', false, true, ['missing_provenance', 'live_execution_requested']),
  schema('artifact', 'ZavorthExternalArtifactEnvelopeContract', 'ZavorthExternalArtifactEnvelopeService', 'ZavorthControlExternalArtifactEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'memory-recall', 'low', false, true, ['missing_provenance', 'raw_secret_value']),
  schema('approval', 'ZavorthExternalApprovalEnvelopeContract', 'ZavorthExternalApprovalEnvelopeService', 'ZavorthControlExternalApprovalEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'approval-proposal', 'high', true, true, ['source_identity_leak', 'live_execution_requested']),
  schema('health', 'ZavorthExternalHealthEnvelopeContract', 'ZavorthExternalHealthEnvelopeService', 'ZavorthControlExternalHealthEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef'], 'capability-discovery', 'low', false, false, ['source_identity_leak']),
  schema('worker', 'ZavorthExternalWorkerEnvelopeContract', 'ZavorthExternalWorkerEnvelopeService', 'ZavorthControlExternalWorkerEnvelope', ['kind', 'sourceRuntimeId', 'sourceRef', 'provenance.evidence'], 'governed-execution', 'high', true, true, ['direct_tool_exposure', 'live_execution_requested', 'missing_provenance']),
];

export class ZavorthExternalContractLayerService {
  private readonly now: () => Date;
  private readonly defaultInventoryStatus: ZavorthExternalCapabilityInventoryStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultInventoryStatus = runtime.inventoryStatus || 'inventory-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthExternalContractLayerSnapshot {
    const previousInventoryStatus = input.inventoryStatus || this.defaultInventoryStatus;
    const runtimeDescriptors = buildRuntimeDescriptors();
    const normalizationFixtures = buildFixtureInputs().map((fixture) => this.normalizeExternalEnvelope(fixture));
    const acceptanceMatrix = buildAcceptanceMatrix(previousInventoryStatus, runtimeDescriptors, ENVELOPE_SCHEMAS, normalizationFixtures);
    const status = resolveStatus(previousInventoryStatus, acceptanceMatrix);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION,
      status,
      planId: 'Zavorth External Runtime Integration',
      gate: 'contract-layer',
      previousInventoryStatus,
      runtimeDescriptors,
      envelopeSchemas: ENVELOPE_SCHEMAS,
      normalizationFixtures,
      namingQuarantinePolicy: {
        publicAgentName: 'Zavorth',
        externalNamesDiagnosticsOnly: true,
        noSourceNameAsCanonicalField: true,
        zavorthControlMayShowAdapterDetailsOnly: true,
        replyPipelineMayNotUseSourceIdentity: true,
      },
      acceptanceMatrix,
      summary: {
        runtimeDescriptors: runtimeDescriptors.length,
        envelopeSchemas: ENVELOPE_SCHEMAS.length,
        normalizedFixtures: normalizationFixtures.filter((receipt) => receipt.status === 'normalized').length,
        blockedFixtures: normalizationFixtures.filter((receipt) => receipt.status === 'blocked').length,
        structuredErrors: normalizationFixtures.reduce((total, receipt) => total + receipt.errors.length, 0),
        approvalRequiredSchemas: ENVELOPE_SCHEMAS.filter((entry) => entry.approvalRequiredForLive).length,
        publicIdentityLeaksAllowed: 0,
        liveExecutionPerformed: false,
        sourceRuntimeCodeExecuted: false,
      },
      safety: {
        sourceRuntimeCodeExecuted: false,
        liveExecutionPerformed: false,
        dependencyInstallPerformed: false,
        sidecarsStarted: false,
        toolsExposed: false,
        publicIdentityLeak: false,
      },
      commands: {
        inspect: 'npm run zavorth:external-contract-layer',
        inspectJson: 'npm run zavorth:external-contract-layer:json',
        check: 'npm run zavorth:external-contract-layer:check --silent',
        nextStage: '291 Preview engine - Native Engine Absorption',
      },
    };
  }

  public normalizeExternalEnvelope(input: ZavorthExternalRuntimeExternalEnvelopeInput): ZavorthExternalRuntimeNormalizationReceipt {
    const generatedAt = this.now().toISOString();
    const errors: ZavorthExternalRuntimeNormalizationError[] = [];
    const warnings: ZavorthExternalRuntimeNormalizationError[] = [];
    const kind = parseKind(input.kind);
    const schemaForKind = kind ? ENVELOPE_SCHEMAS.find((entry) => entry.kind === kind) || null : null;
    const sourceRuntimeId = parseSourceRuntimeId(input.sourceRuntimeId);
    const evidence = input.provenance?.evidence?.filter((entry): entry is string => Boolean(entry && entry.trim())) || [];

    if (!kind) {
      errors.push(error('unsupported_envelope_kind', 'kind', `Unsupported external envelope kind: ${input.kind || '<missing>'}`, 'Map source data to one of the Zavorth Intent model envelope kinds.'));
    }
    if (!sourceRuntimeId) {
      errors.push(error('missing_required_field', 'sourceRuntimeId', 'Missing or unsupported source runtime id.', 'Use reference-runtime, acp-compatible-sidecar, or acp-compatibility-fixture as diagnostic source ids.'));
    }
    if (!input.sourceRef?.trim()) {
      errors.push(error('missing_required_field', 'sourceRef', 'Missing source reference.', 'Provide a stable source reference before normalization.'));
    }
    if (schemaForKind?.provenanceRequired && evidence.length === 0) {
      errors.push(error('missing_provenance', 'provenance.evidence', 'Missing provenance evidence for external data.', 'Attach source path, audit doc, or inventory item evidence.'));
    }
    if (input.publicName && input.publicName !== 'Zavorth') {
      errors.push(error('source_identity_leak', 'publicName', 'External runtime name cannot become public identity.', 'Keep external names in diagnostics and expose public identity as Zavorth.'));
    }
    if (input.rawSecretValue) {
      errors.push(error('raw_secret_value', 'rawSecretValue', 'Raw secret values cannot enter Intent model envelopes.', 'Pass a secret reference handled by Zavorth ports instead.'));
    }
    if (input.directToolExposure) {
      errors.push(error('direct_tool_exposure', 'directToolExposure', 'External tools cannot be exposed directly.', 'Represent the tool as metadata and route live invocation through Zavorth policy.'));
    }
    if (input.requestedLiveAction) {
      errors.push(error('live_execution_requested', 'requestedLiveAction', 'Intent model does not allow live source actions.', 'Create an advisory envelope or an approval proposal for a later phase.'));
    }

    if (errors.some((entry) => entry.severity === 'error') || !schemaForKind || !sourceRuntimeId || !input.sourceRef?.trim()) {
      return receipt(generatedAt, input.kind || null, null, errors, warnings);
    }

    const risk = input.risk || schemaForKind.risk;
    const approvalRequiredForLive = schemaForKind.approvalRequiredForLive || risk === 'high';
    return receipt(generatedAt, input.kind || null, {
      envelopeId: `zavorth.external.${schemaForKind.kind}.${safeId(input.sourceRef)}`,
      kind: schemaForKind.kind,
      sourceRuntimeId,
      sourceRef: input.sourceRef.trim(),
      sourcePath: input.sourcePath || null,
      diagnosticLabel: input.sourceLabel || sourceRuntimeId,
      publicName: 'Zavorth',
      naturalFirstRoute: schemaForKind.naturalFirstRoute,
      trustScope: chooseTrustScope(schemaForKind.kind, risk, approvalRequiredForLive),
      risk,
      approvalRequiredForLive,
      payloadClassification: choosePayloadClassification(schemaForKind.kind, approvalRequiredForLive),
      provenance: {
        required: schemaForKind.provenanceRequired,
        observedAt: input.provenance?.observedAt || generatedAt,
        evidence,
      },
      policy: {
        noRuntimeMixing: true,
        noSourceRuntimeCodeExecution: true,
        noDirectToolExposure: true,
        noDirectUserReply: true,
        noRawSecrets: true,
        sourceNamesDiagnosticsOnly: true,
      },
    }, errors, warnings);
  }

  public formatSnapshotText(snapshot: ZavorthExternalContractLayerSnapshot): string {
    const lines = [
      'Zavorth External Runtime Intent model Contract Layer',
      '',
      `Status: ${snapshot.status}`,
      `Previous inventory: ${snapshot.previousInventoryStatus}`,
      `Runtime descriptors: ${snapshot.summary.runtimeDescriptors}`,
      `Envelope schemas: ${snapshot.summary.envelopeSchemas}`,
      `Fixtures: normalized=${snapshot.summary.normalizedFixtures} | blocked=${snapshot.summary.blockedFixtures} | structuredErrors=${snapshot.summary.structuredErrors}`,
      `Live execution performed: ${snapshot.safety.liveExecutionPerformed}`,
      '',
      'Envelope schemas:',
      ...snapshot.envelopeSchemas.map((entry) => `- ${entry.kind}: ${entry.contractName} -> ${entry.zavorthOwnerService}`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ];

    return lines.join('\n');
  }
}

function schema(
  kind: ZavorthExternalRuntimeContractEnvelopeKind,
  contractName: string,
  zavorthOwnerService: string,
  zavorthControlProjection: string,
  requiredFields: string[],
  naturalFirstRoute: ZavorthExternalRuntimeEnvelopeSchema['naturalFirstRoute'],
  risk: ZavorthExternalRuntimeContractRisk,
  approvalRequiredForLive: boolean,
  provenanceRequired: boolean,
  invalidDataErrors: ZavorthExternalRuntimeContractErrorCode[],
): ZavorthExternalRuntimeEnvelopeSchema {
  return {
    kind,
    contractName,
    zavorthOwnerService,
    zavorthControlProjection,
    requiredFields,
    naturalFirstRoute,
    risk,
    approvalRequiredForLive,
    provenanceRequired,
    invalidDataErrors,
  };
}

function buildRuntimeDescriptors(): ZavorthExternalRuntimeExternalRuntimeDescriptor[] {
  return [
    runtimeDescriptor('reference-runtime', 'Reference runtime fixture', 'architecture-reference', 'diagnostic-only'),
    runtimeDescriptor('acp-compatible-sidecar', 'ACP-compatible sidecar fixture', 'acp-compatible-sidecar', 'quarantined-advisory'),
    runtimeDescriptor('acp-compatibility-fixture', 'ACP compatibility fixture clone', 'compatibility-fixture', 'quarantined-advisory'),
  ];
}

function runtimeDescriptor(
  id: ZavorthExternalCapabilityInventoryProbeRuntimeId,
  diagnosticLabel: string,
  role: ZavorthExternalRuntimeExternalRuntimeDescriptor['role'],
  trustScope: ZavorthExternalRuntimeContractTrustScope,
): ZavorthExternalRuntimeExternalRuntimeDescriptor {
  return {
    id,
    diagnosticLabel,
    publicName: 'Zavorth',
    sourceNameQuarantined: true,
    role,
    trustScope,
    enabledByDefault: false,
    liveExecutionAllowed: false,
    credentialPolicy: {
      secretRefsOnly: true,
      rawSecretValuesAccepted: false,
      credentialsStayBehindPorts: true,
    },
    ingressPolicy: {
      freeTextEntrypoint: 'ZavorthAgentGateway',
      noDirectLlmEntry: true,
      noDirectUserReply: true,
    },
  };
}

function buildFixtureInputs(): ZavorthExternalRuntimeExternalEnvelopeInput[] {
  return [
    {
      kind: 'capability',
      sourceRuntimeId: 'acp-compatible-sidecar',
      sourceRef: 'extensions/telegram',
      sourcePath: 'extensions/telegram',
      sourceLabel: 'ACP-compatible Telegram channel fixture',
      publicName: 'Zavorth',
      provenance: { observedAt: '2026-05-11T00:00:00.000Z', evidence: ['docs/product-direction.md'] },
    },
    {
      kind: 'worker',
      sourceRuntimeId: 'reference-runtime',
      sourceRef: 'run_agent.py',
      sourcePath: 'run_agent.py',
      sourceLabel: 'Reference run loop',
      publicName: 'Zavorth',
      risk: 'high',
      provenance: { evidence: ['docs/product-direction.md'] },
    },
    {
      kind: 'tool',
      sourceRuntimeId: 'acp-compatibility-fixture',
      sourceRef: 'packages/plugin-sdk/tool',
      publicName: 'Zavorth',
      directToolExposure: true,
      requestedLiveAction: true,
      rawSecretValue: 'sk-redacted-example',
      provenance: { evidence: ['docs/product-direction.md'] },
    },
    {
      kind: 'channel',
      sourceRuntimeId: 'acp-compatible-sidecar',
      sourceRef: 'extensions/discord',
      publicName: 'ACP-compatible sidecar',
      provenance: { evidence: ['docs/product-direction.md'] },
    },
    {
      kind: 'session',
      sourceRuntimeId: 'reference-runtime',
      publicName: 'Zavorth',
      provenance: { evidence: [] },
    },
  ];
}

function buildAcceptanceMatrix(
  previousInventoryStatus: ZavorthExternalCapabilityInventoryStatus,
  runtimeDescriptors: ZavorthExternalRuntimeExternalRuntimeDescriptor[],
  schemas: ZavorthExternalRuntimeEnvelopeSchema[],
  receipts: ZavorthExternalRuntimeNormalizationReceipt[],
): ZavorthExternalContractLayerSnapshot['acceptanceMatrix'] {
  const kindSet = new Set(schemas.map((entry) => entry.kind));
  const blockedReceipts = receipts.filter((entry) => entry.status === 'blocked');
  const structuredErrors = receipts.flatMap((entry) => entry.errors);
  const noIdentityLeak = receipts.every((entry) => !entry.envelope || entry.envelope.publicName === 'Zavorth');
  return [
    acceptance('inventory-ready', previousInventoryStatus === 'inventory-ready', `previousInventoryStatus=${previousInventoryStatus}`),
    acceptance('all-envelope-kinds-represented', kindSet.size === 11, `${kindSet.size}/11 envelope kind(s)`),
    acceptance('runtime-descriptors-quarantined', runtimeDescriptors.every((entry) => entry.sourceNameQuarantined && !entry.enabledByDefault && !entry.liveExecutionAllowed), `${runtimeDescriptors.length} descriptor(s) quarantined`),
    acceptance('invalid-data-structured-errors', blockedReceipts.length >= 3 && structuredErrors.length >= 4, `${blockedReceipts.length} blocked fixture(s), ${structuredErrors.length} structured error(s)`),
    acceptance('no-source-identity-leak', noIdentityLeak, 'normalized publicName remains Zavorth'),
    acceptance('approval-gated-live-boundaries', schemas.filter((entry) => entry.approvalRequiredForLive).length >= 5, `${schemas.filter((entry) => entry.approvalRequiredForLive).length} approval-gated schema(s)`),
  ];
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthExternalContractLayerSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function resolveStatus(
  previousInventoryStatus: ZavorthExternalCapabilityInventoryStatus,
  acceptanceMatrix: ZavorthExternalContractLayerSnapshot['acceptanceMatrix'],
): ZavorthExternalContractLayerStatus {
  if (previousInventoryStatus !== 'inventory-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'contract-layer-ready';
}

function parseKind(kind: string | undefined): ZavorthExternalRuntimeContractEnvelopeKind | null {
  return ENVELOPE_SCHEMAS.some((entry) => entry.kind === kind) ? kind as ZavorthExternalRuntimeContractEnvelopeKind : null;
}

function parseSourceRuntimeId(runtimeId: string | undefined): ZavorthExternalCapabilityInventoryProbeRuntimeId | null {
  return SUPPORTED_RUNTIMES.has(runtimeId as ZavorthExternalCapabilityInventoryProbeRuntimeId)
    ? runtimeId as ZavorthExternalCapabilityInventoryProbeRuntimeId
    : null;
}

function chooseTrustScope(
  kind: ZavorthExternalRuntimeContractEnvelopeKind,
  risk: ZavorthExternalRuntimeContractRisk,
  approvalRequiredForLive: boolean,
): ZavorthExternalRuntimeContractTrustScope {
  if (kind === 'runtime' || kind === 'health') return 'diagnostic-only';
  if (approvalRequiredForLive || risk === 'high') return 'approval-gated';
  return 'policy-gated';
}

function choosePayloadClassification(
  kind: ZavorthExternalRuntimeContractEnvelopeKind,
  approvalRequiredForLive: boolean,
): 'metadata-only' | 'advisory-data' | 'approval-gated-intent' {
  if (kind === 'runtime' || kind === 'health') return 'metadata-only';
  if (approvalRequiredForLive) return 'approval-gated-intent';
  return 'advisory-data';
}

function receipt(
  generatedAt: string,
  inputKind: string | null,
  envelope: ZavorthExternalRuntimeNormalizationReceipt['envelope'],
  errors: ZavorthExternalRuntimeNormalizationError[],
  warnings: ZavorthExternalRuntimeNormalizationError[],
): ZavorthExternalRuntimeNormalizationReceipt {
  return {
    generatedAt,
    contractVersion: ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION,
    status: errors.some((entry) => entry.severity === 'error') ? 'blocked' : 'normalized',
    inputKind,
    envelope,
    errors,
    warnings,
    safety: {
      sourceRuntimeCodeExecuted: false,
      liveExecutionPerformed: false,
      directToolExposureAllowed: false,
      rawSecretSerialized: false,
      publicIdentityLeakAllowed: false,
    },
  };
}

function error(
  code: ZavorthExternalRuntimeContractErrorCode,
  fieldPath: string,
  message: string,
  remediation: string,
): ZavorthExternalRuntimeNormalizationError {
  return {
    code,
    severity: 'error',
    fieldPath,
    message,
    remediation,
  };
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'source-ref';
}
