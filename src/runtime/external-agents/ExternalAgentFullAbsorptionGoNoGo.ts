import type {
  ExternalAgentPublicProductHardeningReport,
} from './ExternalAgentPublicProductHardeningGate.js';

export type ExternalAgentAbsorptionImplementationDecision =
  | 'absorb'
  | 'adapt'
  | 'replace'
  | 'externalize'
  | 'reject';

export type ExternalAgentAbsorptionImplementationItem = {
  id: string;
  label: string;
  sourceArea: string;
  sourcePaths: string[];
  capability: string;
  decision: ExternalAgentAbsorptionImplementationDecision | null;
  risk: 'low' | 'medium' | 'high';
  owner: 'zavorth-runtime' | 'zavorth-command-center' | 'zavorth-security' | 'compatibility';
  zavorthContract: string;
  implementationPath: string;
  acceptanceCriteria: string[];
  testsOrSmokes: string[];
  commandCenterObservable: boolean;
  rollbackBoundary: string;
  status: 'ready' | 'blocked' | 'deferred';
  sourceModulesCopied?: boolean;
  sourceRuntimeRequired?: boolean;
  healthAndFailureModel?: string;
  rejectReason?: string;
};

export type ExternalAgentAbsorptionWave = {
  id: string;
  label: string;
  itemIds: string[];
  gate: string;
};

export type ExternalAgentFullAbsorptionGoNoGoInput = {
  items: ExternalAgentAbsorptionImplementationItem[];
  publicHardeningReport: ExternalAgentPublicProductHardeningReport;
  commandCenterIntegratedCapabilityState: boolean;
  sourceRuntimeOptionalByDefault: boolean;
  sourceModulesCopied: boolean;
  waves: ExternalAgentAbsorptionWave[];
};

export type ExternalAgentFullAbsorptionFinding = {
  itemId?: string;
  severity: 'blocker' | 'warning';
  reason: string;
};

export type ExternalAgentFullAbsorptionGoNoGoReport = {
  version: 'external-agent-full-absorption-go-no-go/v1';
  status: 'go' | 'blocked';
  generatedAt: string;
  summary: {
    totalItems: number;
    readyItems: number;
    blockedItems: number;
    deferredItems: number;
    waves: number;
  };
  guaranteeGate: {
    everyInventoryItemHasDecision: boolean;
    adoptedItemsHaveTestsOrSmokes: boolean;
    externalizedItemsHaveHealthModel: boolean;
    rejectedItemsHaveReason: boolean;
    publicCanonicalSurfacesZavorthNative: boolean;
    commandCenterCanShowIntegratedCapabilityState: boolean;
    sourceRuntimeOptionalByDefault: boolean;
    sourceModulesCopied: false;
  };
  findings: ExternalAgentFullAbsorptionFinding[];
  waves: ExternalAgentAbsorptionWave[];
};

function nowIso(now?: () => Date): string {
  return (now || (() => new Date()))().toISOString();
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function hasUsefulEntries(values: string[]): boolean {
  return values.some((value) => text(value).length > 0);
}

function isAdopted(decision: ExternalAgentAbsorptionImplementationDecision | null): boolean {
  return decision === 'absorb' || decision === 'adapt' || decision === 'replace';
}

function evaluateItem(item: ExternalAgentAbsorptionImplementationItem): ExternalAgentFullAbsorptionFinding[] {
  const findings: ExternalAgentFullAbsorptionFinding[] = [];
  if (!item.decision) {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Inventory item needs an absorption decision.',
    });
  }
  if (!hasUsefulEntries(item.sourcePaths)) {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Inventory item needs at least one source path.',
    });
  }
  if (item.status === 'blocked') {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Inventory item is still blocked.',
    });
  }
  if (item.sourceModulesCopied) {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Full absorption kickoff cannot include copied source modules.',
    });
  }
  if (item.sourceRuntimeRequired && item.decision !== 'externalize') {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Adopted or replaced items cannot require the source runtime by default.',
    });
  }
  if (isAdopted(item.decision)) {
    if (!text(item.zavorthContract)) {
      findings.push({
        itemId: item.id,
        severity: 'blocker',
        reason: 'Adopted item requires a Zavorth-native contract.',
      });
    }
    if (!text(item.implementationPath)) {
      findings.push({
        itemId: item.id,
        severity: 'blocker',
        reason: 'Adopted item requires a Zavorth-owned implementation path.',
      });
    }
    if (!hasUsefulEntries(item.acceptanceCriteria)) {
      findings.push({
        itemId: item.id,
        severity: 'blocker',
        reason: 'Adopted item requires acceptance criteria.',
      });
    }
    if (!hasUsefulEntries(item.testsOrSmokes)) {
      findings.push({
        itemId: item.id,
        severity: 'blocker',
        reason: 'Adopted item requires test or smoke coverage.',
      });
    }
  }
  if (item.decision === 'externalize' && !text(item.healthAndFailureModel)) {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Externalized item requires a health and failure model.',
    });
  }
  if (item.decision === 'reject' && !text(item.rejectReason)) {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'Rejected item requires a reason.',
    });
  }
  if (item.risk === 'high' && !text(item.rollbackBoundary)) {
    findings.push({
      itemId: item.id,
      severity: 'blocker',
      reason: 'High-risk item requires rollback or compatibility boundary.',
    });
  }
  return findings;
}

function evaluateWaves(
  waves: ExternalAgentAbsorptionWave[],
  items: ExternalAgentAbsorptionImplementationItem[],
): ExternalAgentFullAbsorptionFinding[] {
  const itemIds = new Set(items.map((item) => item.id));
  const assignedIds = new Set<string>();
  const findings: ExternalAgentFullAbsorptionFinding[] = [];
  waves.forEach((wave) => {
    if (!text(wave.gate)) {
      findings.push({
        severity: 'blocker',
        reason: `Wave ${wave.id} requires an exit gate.`,
      });
    }
    wave.itemIds.forEach((itemId) => {
      if (!itemIds.has(itemId)) {
        findings.push({
          itemId,
          severity: 'blocker',
          reason: `Wave ${wave.id} references an unknown inventory item.`,
        });
      }
      assignedIds.add(itemId);
    });
  });
  items
    .filter((item) => item.status === 'ready')
    .forEach((item) => {
      if (!assignedIds.has(item.id)) {
        findings.push({
          itemId: item.id,
          severity: 'blocker',
          reason: 'Ready item must be assigned to an implementation wave.',
        });
      }
    });
  return findings;
}

export function evaluateExternalAgentFullAbsorptionGoNoGo(
  input: ExternalAgentFullAbsorptionGoNoGoInput,
  options: { now?: () => Date } = {},
): ExternalAgentFullAbsorptionGoNoGoReport {
  const itemFindings = input.items.flatMap(evaluateItem);
  const waveFindings = evaluateWaves(input.waves, input.items);
  const globalFindings: ExternalAgentFullAbsorptionFinding[] = [];
  if (input.publicHardeningReport.status !== 'pass') {
    globalFindings.push({
      severity: 'blocker',
      reason: 'Public product hardening report must pass before full absorption starts.',
    });
  }
  if (!input.commandCenterIntegratedCapabilityState) {
    globalFindings.push({
      severity: 'blocker',
      reason: 'Command Center must show integrated capability state before full absorption starts.',
    });
  }
  if (!input.sourceRuntimeOptionalByDefault) {
    globalFindings.push({
      severity: 'blocker',
      reason: 'Zavorth must be able to operate without the source runtime by default.',
    });
  }
  if (input.sourceModulesCopied) {
    globalFindings.push({
      severity: 'blocker',
      reason: 'Full absorption kickoff cannot begin from copied source modules.',
    });
  }
  const findings = [...itemFindings, ...waveFindings, ...globalFindings];
  const guaranteeGate = {
    everyInventoryItemHasDecision: input.items.every((item) => Boolean(item.decision)),
    adoptedItemsHaveTestsOrSmokes: input.items
      .filter((item) => isAdopted(item.decision))
      .every((item) => hasUsefulEntries(item.testsOrSmokes)),
    externalizedItemsHaveHealthModel: input.items
      .filter((item) => item.decision === 'externalize')
      .every((item) => Boolean(text(item.healthAndFailureModel))),
    rejectedItemsHaveReason: input.items
      .filter((item) => item.decision === 'reject')
      .every((item) => Boolean(text(item.rejectReason))),
    publicCanonicalSurfacesZavorthNative: input.publicHardeningReport.guarantee.publicCanonicalSurfacesZavorthNative,
    commandCenterCanShowIntegratedCapabilityState: input.commandCenterIntegratedCapabilityState,
    sourceRuntimeOptionalByDefault: input.sourceRuntimeOptionalByDefault,
    sourceModulesCopied: false as const,
  };
  const status = findings.some((finding) => finding.severity === 'blocker') ? 'blocked' : 'go';

  return {
    version: 'external-agent-full-absorption-go-no-go/v1',
    status,
    generatedAt: nowIso(options.now),
    summary: {
      totalItems: input.items.length,
      readyItems: input.items.filter((item) => item.status === 'ready').length,
      blockedItems: input.items.filter((item) => item.status === 'blocked').length,
      deferredItems: input.items.filter((item) => item.status === 'deferred').length,
      waves: input.waves.length,
    },
    guaranteeGate,
    findings,
    waves: input.waves,
  };
}
