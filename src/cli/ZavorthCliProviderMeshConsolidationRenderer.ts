import {
  AgentRunService,
  ProviderMeshConsolidationService,
  type ProviderMeshConsolidationSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveProviderMeshConsolidationCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:provider-mesh|providers-mesh|model-picker|picker|mesh|run|status|latest|preview)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildProviderMeshConsolidationCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ProviderMeshConsolidationSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:43:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'choose the best model for coding and reasoning',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {
      requestedCapability: 'coding',
      providerRouteBudgetCorrelation: {
        providerName: 'aigateway',
        modelName: 'gpt-5.4',
        routingPolicy: 'gateway',
        fallbackAllowed: true,
        modelPicker: {
          source: 'cli-fixture',
          providerName: 'aigateway',
          providerLabel: 'AI Gateway',
          modelName: 'gpt-5.4',
          modelLabel: 'GPT-5.4',
          ready: true,
        },
      },
    },
  });
  run.summary = 'Provider Mesh consolidado without run provider.';
  return buildProviderMeshConsolidationSnapshotFromRun(run);
}

export function buildProviderMeshConsolidationSnapshotFromRun(
  run: UniversalAgentRun,
): ProviderMeshConsolidationSnapshot {
  return new ProviderMeshConsolidationService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatProviderMeshConsolidationSnapshot(
  snapshot: ProviderMeshConsolidationSnapshot,
): string {
  const lines = [
    'Provider Mesh / Model Picker Consolidation - Channel mesh3',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- manifests: ${snapshot.summary.manifestCount}`,
    `- families: ${snapshot.summary.familyCount}`,
    `- routes: ${snapshot.summary.readyRouteCount}/${snapshot.summary.routeCount} ready`,
    `- models: ${snapshot.summary.modelCount}`,
    `- selected: ${snapshot.selected.providerLabel}/${snapshot.selected.modelLabel} (${snapshot.selected.ready ? 'ready' : 'pending'})`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'P0-extra',
  ];

  for (const [key, value] of Object.entries(snapshot.p0ExtraCoverage)) {
    lines.push(`- ${key}: ${value ? 'ok' : 'pending'}`);
  }

  lines.push('', 'Families');
  for (const family of snapshot.families.slice(0, 8)) {
    lines.push(
      `- ${family.label}: ${family.readyRouteCount}/${family.routeCount} routes ready`,
      `  caps: ${family.capabilities.slice(0, 6).join(', ') || 'n/a'}${family.selected ? ' ? selecionada' : ''}`,
    );
  }

  lines.push('', 'Rotas');
  for (const route of snapshot.routes.slice(0, 8)) {
    lines.push(
      `- ${route.label}: ${route.readiness}${route.ready ? ' ready' : ' pending'} [${route.runtime.adapterKind}]`,
      `  models: ${route.modelCount}; factory: ${route.runtime.runtimeSupported ? 'supported' : 'not supported'}; fallback: ${route.fallbackRouteIds.join(', ') || 'n/a'}`,
    );
  }

  lines.push('', 'Onboarding');
  lines.push(`- status: ${snapshot.onboarding.status}`);
  lines.push(`- capability selecionada: ${snapshot.onboarding.selectedCapability || 'n/a'}`);
  lines.push(`- surfaces: ${snapshot.onboarding.consumers.join(', ')}`);

  lines.push('', 'Politica');
  lines.push('- no provider was executed');
  lines.push('- ModelPickerContract e a source de verdade');
  lines.push('- ProviderFactory usa SelectedModelProfile');
  lines.push('- no legacy provider switch was made');
  lines.push('- secrets were not serialized');

  lines.push('', 'surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Picker: ${snapshot.surface.pickerHint}`);

  return lines.join('\n');
}
