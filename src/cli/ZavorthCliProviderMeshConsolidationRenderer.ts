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
    text: input.text || 'escolha o melhor modelo para coding e reasoning',
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
  run.summary = 'Provider Mesh consolidado sem executar provider.';
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
    'Provider Mesh / Model Picker Consolidation - Wave 43',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- manifests: ${snapshot.summary.manifestCount}`,
    `- familias: ${snapshot.summary.familyCount}`,
    `- rotas: ${snapshot.summary.readyRouteCount}/${snapshot.summary.routeCount} prontas`,
    `- modelos: ${snapshot.summary.modelCount}`,
    `- selected: ${snapshot.selected.providerLabel}/${snapshot.selected.modelLabel} (${snapshot.selected.ready ? 'ready' : 'pendente'})`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'P0-extra',
  ];

  for (const [key, value] of Object.entries(snapshot.p0ExtraCoverage)) {
    lines.push(`- ${key}: ${value ? 'ok' : 'pendente'}`);
  }

  lines.push('', 'Familias');
  for (const family of snapshot.families.slice(0, 8)) {
    lines.push(
      `- ${family.label}: ${family.readyRouteCount}/${family.routeCount} rotas prontas`,
      `  caps: ${family.capabilities.slice(0, 6).join(', ') || 'n/a'}${family.selected ? ' - selecionada' : ''}`,
    );
  }

  lines.push('', 'Rotas');
  for (const route of snapshot.routes.slice(0, 8)) {
    lines.push(
      `- ${route.label}: ${route.readiness}${route.ready ? ' ready' : ' pendente'} [${route.runtime.adapterKind}]`,
      `  modelos: ${route.modelCount}; factory: ${route.runtime.runtimeSupported ? 'suportado' : 'nao suportado'}; fallback: ${route.fallbackRouteIds.join(', ') || 'n/a'}`,
    );
  }

  lines.push('', 'Onboarding');
  lines.push(`- status: ${snapshot.onboarding.status}`);
  lines.push(`- capability selecionada: ${snapshot.onboarding.selectedCapability || 'n/a'}`);
  lines.push(`- surfaces: ${snapshot.onboarding.consumers.join(', ')}`);

  lines.push('', 'Politica');
  lines.push('- nenhum provider foi executado');
  lines.push('- ModelPickerContract e a fonte de verdade');
  lines.push('- ProviderFactory usa SelectedModelProfile');
  lines.push('- nenhuma troca legada de provider foi feita');
  lines.push('- secrets nao foram serializados');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Picker: ${snapshot.surface.pickerHint}`);

  return lines.join('\n');
}
