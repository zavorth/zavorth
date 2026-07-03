import type {
  RuntimeAdapterCommandHttpInvocationIntentKind,
} from './RuntimeAdapterCommandHttpInvocationEnvelopeBoundary.js';
import type {
  RuntimeAdapterCommandHttpPolicyPreflightDecision,
} from './RuntimeAdapterCommandHttpPolicyPreflightBoundary.js';

export type RuntimeAdapterCommandHttpObservabilityProjectionFixtureCase =
  | 'observability-projection-approval-required'
  | 'observability-projection-blocked-action'
  | 'observability-projection-proposed-invocation'
  | 'observability-projection-unavailable-source-runtime';

export type RuntimeAdapterCommandHttpObservabilityProjectionStatus =
  | 'approval-required'
  | 'blocked-action'
  | 'proposed'
  | 'unavailable-source-runtime';

export type RuntimeAdapterCommandHttpObservabilityProjectionLogSeverity =
  | 'danger'
  | 'info'
  | 'warning';

export type RuntimeAdapterCommandHttpObservabilityProjectionExecutionGate = {
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceToolsExecuted: false;
  sourceSetupCommandsExecuted: false;
  sourceQaRunnersExecuted: false;
  sourceHandlerLoaded: false;
  sourceRuntimeConnected: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  sourceCredentialsMigrated: false;
  executionAuthority: false;
  realAdapterCreated: false;
};

export type RuntimeAdapterCommandHttpObservabilityProjectionSourceRecord = {
  fixtureCase: RuntimeAdapterCommandHttpObservabilityProjectionFixtureCase;
  publicProjectionIdSeed: string;
  invocationEnvelopeId: string;
  policyPreflightId: string;
  intentKind: RuntimeAdapterCommandHttpInvocationIntentKind;
  decision: RuntimeAdapterCommandHttpPolicyPreflightDecision;
  requestedTools: string[];
  sourceRuntimeAvailable: boolean;
  sourceEvidenceHints: string[];
};

export type RuntimeAdapterCommandHttpObservabilityProjectionRow = {
  id: string;
  label: string;
  invocationEnvelopeId: string;
  policyPreflightId: string;
  intentKind: RuntimeAdapterCommandHttpInvocationIntentKind;
  status: RuntimeAdapterCommandHttpObservabilityProjectionStatus;
  requestedTools: string[];
  zavorthControl: {
    rowKind: RuntimeAdapterCommandHttpObservabilityProjectionStatus;
    readOnly: true;
    executableControlExposed: false;
    routeRegistrationControlExposed: false;
    gatewayDispatchControlExposed: false;
    serviceLaunchControlExposed: false;
    cliSpawnControlExposed: false;
    sourceToolExecutionControlExposed: false;
  };
  log: {
    id: string;
    severity: RuntimeAdapterCommandHttpObservabilityProjectionLogSeverity;
    source: 'zavorth';
    readOnly: true;
  };
  observability: {
    authority: 'zavorth-command-http-observability-projection';
    readOnly: true;
    sourceEvidenceStoredAsEvidenceOnly: true;
    sourceRuntimeStateStoredAsEvidenceOnly: true;
    sourceProjectionAuthority: false;
    executionAuthority: false;
  };
  sourceEvidenceStoredAsEvidenceOnly: true;
  sourceRuntimeUnavailableProjectedOnly: boolean;
  sourceHandlerLoaded: false;
  sourceRuntimeConnected: false;
  sourceCommandExecuted: false;
  sourceCliProcessSpawned: false;
  sourceHttpRouteRegistered: false;
  sourceGatewayMethodDispatched: false;
  sourceServiceLaunched: false;
  sourceToolExecuted: false;
  executionAuthority: false;
  sideEffectsBlocked: true;
  nativeContract: 'ZavorthCommandHttpObservabilityProjectionRow/v1';
};

export type RuntimeAdapterCommandHttpObservabilityProjectionBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterCommandHttpObservabilityProjectionSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterCommandHttpObservabilityProjectionExecutionGate;
};

export type RuntimeAdapterCommandHttpObservabilityProjectionBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthCommandHttpObservabilityProjectionBoundary/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  rows: RuntimeAdapterCommandHttpObservabilityProjectionRow[];
  proposedRows: string[];
  approvalRequiredRows: string[];
  blockedRows: string[];
  unavailableSourceRuntimeRows: string[];
  zavorthControl: {
    readOnly: true;
    rows: RuntimeAdapterCommandHttpObservabilityProjectionRow[];
    executableActionsExposed: false;
    routeRegistrationExposed: false;
    gatewayDispatchExposed: false;
    serviceLaunchExposed: false;
    cliSpawnExposed: false;
    sourceToolExecutionExposed: false;
  };
  logs: Array<RuntimeAdapterCommandHttpObservabilityProjectionRow['log']>;
  sourceEvidenceStoredAsEvidenceOnly: true;
  sourceProjectionAuthority: false;
  sourceHandlersLoaded: false;
  sourceRuntimeConnected: false;
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceToolsExecuted: false;
  executionAuthority: false;
  sideEffectsBlocked: true;
  executionGate: RuntimeAdapterCommandHttpObservabilityProjectionExecutionGate;
};

function publicProjectionId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function projectionStatus(
  record: RuntimeAdapterCommandHttpObservabilityProjectionSourceRecord,
): RuntimeAdapterCommandHttpObservabilityProjectionStatus {
  if (!record.sourceRuntimeAvailable) {
    return 'unavailable-source-runtime';
  }

  if (record.decision === 'blocked') {
    return 'blocked-action';
  }

  if (record.decision === 'approval_required') {
    return 'approval-required';
  }

  return 'proposed';
}

function projectionSeverity(
  status: RuntimeAdapterCommandHttpObservabilityProjectionStatus,
): RuntimeAdapterCommandHttpObservabilityProjectionLogSeverity {
  if (status === 'blocked-action') {
    return 'danger';
  }

  if (status === 'approval-required' || status === 'unavailable-source-runtime') {
    return 'warning';
  }

  return 'info';
}

function projectionLabel(index: number, status: RuntimeAdapterCommandHttpObservabilityProjectionStatus): string {
  return `Command/http observability ${index + 1} ${status}`;
}

export function normalizeRuntimeAdapterCommandHttpObservabilityProjection<TRuntimeId extends string>(
  options: RuntimeAdapterCommandHttpObservabilityProjectionBoundaryOptions<TRuntimeId>,
): RuntimeAdapterCommandHttpObservabilityProjectionBoundaryNormalization<TRuntimeId> {
  const rows = options.records.map((record, index): RuntimeAdapterCommandHttpObservabilityProjectionRow => {
    const status = projectionStatus(record);
    const id = publicProjectionId(options.idPrefix, record.publicProjectionIdSeed, index);

    return {
      id,
      label: projectionLabel(index, status),
      invocationEnvelopeId: record.invocationEnvelopeId,
      policyPreflightId: record.policyPreflightId,
      intentKind: record.intentKind,
      status,
      requestedTools: record.requestedTools,
      zavorthControl: {
        rowKind: status,
        readOnly: true,
        executableControlExposed: false,
        routeRegistrationControlExposed: false,
        gatewayDispatchControlExposed: false,
        serviceLaunchControlExposed: false,
        cliSpawnControlExposed: false,
        sourceToolExecutionControlExposed: false,
      },
      log: {
        id: `${id}:log`,
        severity: projectionSeverity(status),
        source: 'zavorth',
        readOnly: true,
      },
      observability: {
        authority: 'zavorth-command-http-observability-projection',
        readOnly: true,
        sourceEvidenceStoredAsEvidenceOnly: true,
        sourceRuntimeStateStoredAsEvidenceOnly: true,
        sourceProjectionAuthority: false,
        executionAuthority: false,
      },
      sourceEvidenceStoredAsEvidenceOnly: true,
      sourceRuntimeUnavailableProjectedOnly: status === 'unavailable-source-runtime',
      sourceHandlerLoaded: false,
      sourceRuntimeConnected: false,
      sourceCommandExecuted: false,
      sourceCliProcessSpawned: false,
      sourceHttpRouteRegistered: false,
      sourceGatewayMethodDispatched: false,
      sourceServiceLaunched: false,
      sourceToolExecuted: false,
      executionAuthority: false,
      sideEffectsBlocked: true,
      nativeContract: 'ZavorthCommandHttpObservabilityProjectionRow/v1',
    };
  });

  return {
    nativeContract: 'ZavorthCommandHttpObservabilityProjectionBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    rows,
    proposedRows: rows.filter((row) => row.status === 'proposed').map((row) => row.id),
    approvalRequiredRows: rows.filter((row) => row.status === 'approval-required').map((row) => row.id),
    blockedRows: rows.filter((row) => row.status === 'blocked-action').map((row) => row.id),
    unavailableSourceRuntimeRows: rows
      .filter((row) => row.status === 'unavailable-source-runtime')
      .map((row) => row.id),
    zavorthControl: {
      readOnly: true,
      rows,
      executableActionsExposed: false,
      routeRegistrationExposed: false,
      gatewayDispatchExposed: false,
      serviceLaunchExposed: false,
      cliSpawnExposed: false,
      sourceToolExecutionExposed: false,
    },
    logs: rows.map((row) => row.log),
    sourceEvidenceStoredAsEvidenceOnly: true,
    sourceProjectionAuthority: false,
    sourceHandlersLoaded: false,
    sourceRuntimeConnected: false,
    sourceCommandsExecuted: false,
    sourceCliProcessesSpawned: false,
    sourceHttpRoutesRegistered: false,
    sourceGatewayMethodsDispatched: false,
    sourceServicesLaunched: false,
    sourceToolsExecuted: false,
    executionAuthority: false,
    sideEffectsBlocked: true,
    executionGate: options.executionGate,
  };
}
