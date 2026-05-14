import type { ZavorthGatewayControlApiSnapshot } from '../services/ZavorthGatewayRuntimeService.js';

type GatewayControlCliMode =
  | 'status'
  | 'providers'
  | 'models'
  | 'combos'
  | 'combo-test'
  | 'cache-stats'
  | 'rate-limits'
  | 'doctor';

type GatewayControlCliCommand = {
  mode: GatewayControlCliMode;
  comboName?: string | null;
};

export function resolveGatewayControlCliCommand(args: string): GatewayControlCliCommand | null {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const [first, second] = tokens;
  const normalized = String(first || '').trim().toLowerCase();
  if (normalized === 'status' || normalized === 'providers' || normalized === 'models') {
    return { mode: normalized };
  }
  if (normalized === 'combos') {
    return { mode: 'combos' };
  }
  if (normalized === 'combo' && String(second || '').trim().toLowerCase() === 'test') {
    return {
      mode: 'combo-test',
      comboName: tokens.slice(2).join(' '),
    };
  }
  if (normalized === 'cache' && String(second || '').trim().toLowerCase() === 'stats') {
    return { mode: 'cache-stats' };
  }
  if (normalized === 'rate-limits' || normalized === 'rate-limit' || normalized === 'ratelimits') {
    return { mode: 'rate-limits' };
  }
  if (normalized === 'doctor') {
    return { mode: 'doctor' };
  }
  return null;
}

export function buildGatewayControlCliPayload(
  snapshot: ZavorthGatewayControlApiSnapshot,
  command: GatewayControlCliCommand,
): Record<string, unknown> {
  const mode = command.mode;
  const base = {
    ok: snapshot.ok,
    mode: `gateway_control_${mode.replace(/-/g, '_')}`,
    contractVersion: snapshot.contractVersion,
    generatedAt: snapshot.generatedAt,
    resource: mode,
    warnings: snapshot.warnings,
  };

  if (mode === 'providers') {
    return {
      ...base,
      providers: snapshot.providers,
    };
  }

  if (mode === 'models') {
    return {
      ...base,
      models: snapshot.models,
    };
  }

  if (mode === 'combos') {
    return {
      ...base,
      combos: snapshot.combos,
      operations: snapshot.operations.filter((operation) => operation.id.startsWith('combos.')),
    };
  }

  if (mode === 'combo-test') {
    return buildGatewayControlComboTestPayload(snapshot, base, command.comboName);
  }

  if (mode === 'cache-stats') {
    return {
      ...base,
      resource: 'cache.stats',
      cache: snapshot.cache,
      operations: snapshot.operations.filter((operation) => operation.id.startsWith('cache.')),
    };
  }

  if (mode === 'rate-limits') {
    return {
      ...base,
      rateLimits: snapshot.rateLimits,
      operations: snapshot.operations.filter((operation) => operation.id.startsWith('rate-limits.')),
    };
  }

  if (mode === 'doctor') {
    return {
      ...base,
      health: snapshot.health,
      providers: {
        summary: snapshot.providers.summary,
        currentProvider: snapshot.providers.currentProvider,
        currentModel: snapshot.providers.currentModel,
      },
      cache: {
        status: snapshot.cache.status,
        sourceRoutes: snapshot.cache.sourceRoutes,
        warnings: snapshot.cache.warnings,
      },
      combos: {
        status: snapshot.combos.status,
        sourceRoutes: snapshot.combos.sourceRoutes,
        warnings: snapshot.combos.warnings,
      },
      rateLimits: {
        status: snapshot.rateLimits.status,
        sourceRoutes: snapshot.rateLimits.sourceRoutes,
        warnings: snapshot.rateLimits.warnings,
      },
      operations: snapshot.operations.filter((operation) =>
        operation.id === 'health.read'
        || operation.id === 'providers.list'
        || operation.id === 'models.list'
        || operation.id === 'combos.list'
        || operation.id === 'cache.stats'
        || operation.id === 'rate-limits.list',
      ),
    };
  }

  return {
    ...base,
    health: snapshot.health,
    providers: {
      summary: snapshot.providers.summary,
      currentProvider: snapshot.providers.currentProvider,
      currentModel: snapshot.providers.currentModel,
    },
    operations: snapshot.operations,
  };
}

export function formatGatewayControlCliPayload(
  payload: Record<string, unknown>,
  mode: GatewayControlCliMode,
): string {
  const lines = [
    'Gateway Control',
    formatGatewayControlStatusLine(payload),
    '',
  ];

  if (mode === 'providers') {
    lines.push('Providers');
    lines.push(...formatGatewayControlProviders(payload));
  } else if (mode === 'models') {
    lines.push('Models');
    lines.push(...formatGatewayControlModels(payload));
  } else if (mode === 'combos') {
    lines.push('Combos');
    lines.push(...formatGatewayControlCombos(payload));
  } else if (mode === 'combo-test') {
    lines.push('Combo test');
    lines.push(...formatGatewayControlComboTest(payload));
  } else if (mode === 'cache-stats') {
    lines.push('Cache stats');
    lines.push(...formatGatewayControlCacheStats(payload));
  } else if (mode === 'rate-limits') {
    lines.push('Rate limits');
    lines.push(...formatGatewayControlRateLimits(payload));
  } else if (mode === 'doctor') {
    lines.push('Doctor');
    lines.push(...formatGatewayControlDoctor(payload));
  } else {
    lines.push('Status');
    lines.push(...formatGatewayControlStatus(payload));
  }

  return lines.filter((line, index, all) => line || all[index - 1]).join('\n').trimEnd();
}

export function formatGatewayControlStatusLine(payload: Record<string, unknown>): string {
  const ok = payload.ok === true;
  return `- estado: ${ok ? 'ready' : 'attention'} | contrato: ${String(payload.contractVersion || 'unknown')}`;
}

export function formatGatewayControlStatus(payload: Record<string, unknown>): string[] {
  const health = asCliRecord(payload.health);
  const providers = asCliRecord(payload.providers);
  const providerSummary = asCliRecord(providers.summary);
  const operations = Array.isArray(payload.operations) ? payload.operations : [];

  return [
    `- saude: ${String(health.status || 'unknown')}`,
    `- provider atual: ${String(providers.currentProvider || 'nao configurado')}`,
    `- modelo atual: ${String(providers.currentModel || 'nao configurado')}`,
    `- providers prontos: ${String(providerSummary.ready || 0)}/${String(providerSummary.total || 0)}`,
    `- operacoes publicadas: ${String(operations.length)}`,
    '',
    'Faca agora',
    '- zavorth gateway providers --json',
    '- zavorth gateway models --json',
    '- zavorth gateway combos --json',
    '- zavorth gateway combo test <id> --json',
    '- zavorth gateway cache stats --json',
    '- zavorth gateway rate-limits --json',
    '- zavorth gateway doctor --json',
  ];
}

export function formatGatewayControlProviders(payload: Record<string, unknown>): string[] {
  const providers = asCliRecord(payload.providers);
  const entries = Array.isArray(providers.entries) ? providers.entries : [];
  if (entries.length === 0) {
    return ['- nenhum provider publicado pelo Gateway Control.'];
  }
  return entries.map((entry) => {
    const item = asCliRecord(entry);
    return [
      `- ${String(item.id || 'provider')}`,
      `readiness=${String(item.readiness || 'unknown')}`,
      `model=${String(item.currentModel || 'nao informado')}`,
    ].join(' | ');
  });
}

export function buildGatewayControlComboTestPayload(
  snapshot: ZavorthGatewayControlApiSnapshot,
  base: Record<string, unknown>,
  comboName: unknown,
): Record<string, unknown> {
  const normalizedComboName = String(comboName || '').trim();
  const operation = snapshot.operations.find((entry) => entry.id === 'combos.validate') || null;
  const combo = findGatewayControlCombo(snapshot.combos.entries, normalizedComboName);
  const warnings = [
    ...snapshot.combos.warnings,
    'Teste preparado pela CLI; execucao real depende de approval pela Gateway Control API.',
  ];

  if (!normalizedComboName) {
    return {
      ...base,
      ok: false,
      resource: 'combos.validate',
      status: 'invalid',
      comboName: null,
      operation,
      errors: ['Uso: zavorth gateway combo test <id>.'],
      warnings,
    };
  }

  return {
    ...base,
    resource: 'combos.validate',
    status: operation?.requiresApproval ? 'approval_required' : 'ready',
    comboName: normalizedComboName,
    combo,
    request: {
      comboName: normalizedComboName,
    },
    operation,
    approval: {
      required: operation?.requiresApproval !== false,
      satisfied: false,
    },
    equivalentRoutes: snapshot.combos.sourceRoutes,
    warnings,
  };
}

export function formatGatewayControlModels(payload: Record<string, unknown>): string[] {
  const models = asCliRecord(payload.models);
  const entries = Array.isArray(models.entries) ? models.entries : [];
  if (entries.length === 0) {
    return ['- nenhum modelo publicado pelo Gateway Control.'];
  }
  return entries.map((entry) => {
    const item = asCliRecord(entry);
    return [
      `- ${String(item.model || 'modelo')}`,
      `provider=${String(item.providerId || 'unknown')}`,
      `ready=${String(item.ready === true)}`,
    ].join(' | ');
  });
}

export function formatGatewayControlCombos(payload: Record<string, unknown>): string[] {
  const combos = asCliRecord(payload.combos);
  const entries = Array.isArray(combos.entries) ? combos.entries : [];
  const operations = Array.isArray(payload.operations) ? payload.operations : [];
  const warnings = Array.isArray(combos.warnings) ? combos.warnings : [];
  const lines = [
    `- status: ${String(combos.status || 'unknown')}`,
    `- entradas: ${String(entries.length)}`,
    `- rotas equivalentes: ${formatGatewayControlRouteList(combos.sourceRoutes)}`,
    `- operacoes: ${formatGatewayControlOperationList(operations)}`,
  ];

  if (entries.length === 0) {
    lines.push('- nenhum combo publicado pelo Gateway Control.');
  } else {
    lines.push(...entries.map((entry) => formatGatewayControlComboEntry(entry)));
  }

  return [
    ...lines,
    ...formatGatewayControlWarnings(warnings),
  ];
}

export function formatGatewayControlComboTest(payload: Record<string, unknown>): string[] {
  const operation = asCliRecord(payload.operation);
  const approval = asCliRecord(payload.approval);
  const errors = Array.isArray(payload.errors) ? payload.errors.map(String) : [];
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const status = String(payload.status || 'unknown');
  const comboName = String(payload.comboName || 'nao informado');

  return [
    `- combo: ${comboName}`,
    `- status: ${status}`,
    `- operacao: ${String(operation.id || 'combos.validate')}`,
    `- approval: ${approval.required === false ? 'nao requerido' : 'requerido'} | satisfied=${String(approval.satisfied === true)}`,
    `- rota controlada: ${String(operation.path || '/api/gateway-control/combos/validate')}`,
    `- equivalente atual: ${formatGatewayControlRouteList(payload.equivalentRoutes)}`,
    ...errors.map((error) => `- erro: ${error}`),
    ...formatGatewayControlWarnings(warnings),
  ];
}

export function formatGatewayControlCacheStats(payload: Record<string, unknown>): string[] {
  const cache = asCliRecord(payload.cache);
  const operations = Array.isArray(payload.operations) ? payload.operations : [];
  const semanticStats = cache.semanticStats;
  const warnings = Array.isArray(cache.warnings) ? cache.warnings : [];

  return [
    `- status: ${String(cache.status || 'unknown')}`,
    `- rotas equivalentes: ${formatGatewayControlRouteList(cache.sourceRoutes)}`,
    `- semantic stats: ${semanticStats ? 'publicado' : 'nao publicado pelo snapshot'}`,
    `- operacoes: ${formatGatewayControlOperationList(operations)}`,
    ...formatGatewayControlWarnings(warnings),
  ];
}

export function formatGatewayControlRateLimits(payload: Record<string, unknown>): string[] {
  const rateLimits = asCliRecord(payload.rateLimits);
  const entries = Array.isArray(rateLimits.entries) ? rateLimits.entries : [];
  const operations = Array.isArray(payload.operations) ? payload.operations : [];
  const warnings = Array.isArray(rateLimits.warnings) ? rateLimits.warnings : [];

  return [
    `- status: ${String(rateLimits.status || 'unknown')}`,
    `- entradas: ${String(entries.length)}`,
    `- rotas equivalentes: ${formatGatewayControlRouteList(rateLimits.sourceRoutes)}`,
    `- operacoes: ${formatGatewayControlOperationList(operations)}`,
    ...formatGatewayControlWarnings(warnings),
  ];
}

export function formatGatewayControlDoctor(payload: Record<string, unknown>): string[] {
  const health = asCliRecord(payload.health);
  const providers = asCliRecord(payload.providers);
  const providerSummary = asCliRecord(providers.summary);
  const aiGateway = asCliRecord(health.AIGateway);
  const cache = asCliRecord(payload.cache);
  const combos = asCliRecord(payload.combos);
  const rateLimits = asCliRecord(payload.rateLimits);
  const issues = Array.isArray(health.issues) ? health.issues : [];
  const operations = Array.isArray(payload.operations) ? payload.operations : [];

  return [
    `- saude: ${String(health.status || 'unknown')}`,
    `- provider control plane: ${health.providerControlPlaneAttached ? 'anexado' : 'ausente'}`,
    `- AIGateway: ${aiGateway.ready ? 'ready' : 'attention'} | running=${String(aiGateway.running === true)}`,
    `- ultimo provider saudavel: ${String(health.lastHealthyProvider || 'nenhum')}`,
    `- providers prontos: ${String(providerSummary.ready || 0)}/${String(providerSummary.total || 0)}`,
    `- combos: ${String(combos.status || 'unknown')}`,
    `- cache: ${String(cache.status || 'unknown')}`,
    `- rate limits: ${String(rateLimits.status || 'unknown')}`,
    `- operacoes read-only: ${formatGatewayControlOperationList(operations)}`,
    `- issues: ${issues.length > 0 ? issues.join('; ') : 'nenhum'}`,
  ];
}

export function formatGatewayControlRouteList(value: unknown): string {
  const entries = Array.isArray(value) ? value : [];
  return entries.length > 0 ? entries.map(String).join(', ') : 'nenhuma';
}

export function formatGatewayControlOperationList(value: unknown[]): string {
  const entries = value
    .map((entry) => asCliRecord(entry).id)
    .filter(Boolean)
    .map(String);
  return entries.length > 0 ? entries.join(', ') : 'nenhuma';
}

export function formatGatewayControlComboEntry(value: unknown): string {
  const item = asCliRecord(value);
  const name = resolveGatewayControlComboName(item) || 'combo';
  const strategy = item.strategy || item.routingStrategy || item.mode || 'estrategia nao informada';
  const providers = Array.isArray(item.providers)
    ? item.providers.map(String).join(',')
    : String(item.provider || item.primaryProvider || 'provider nao informado');
  return `- ${name} | strategy=${String(strategy)} | providers=${providers}`;
}

export function findGatewayControlCombo(entries: unknown[], comboName: string): Record<string, unknown> | null {
  if (!comboName) {
    return null;
  }
  const normalized = comboName.toLowerCase();
  for (const entry of entries) {
    const item = asCliRecord(entry);
    const candidate = resolveGatewayControlComboName(item).toLowerCase();
    if (candidate && candidate === normalized) {
      return item;
    }
  }
  return null;
}

export function resolveGatewayControlComboName(item: Record<string, unknown>): string {
  return String(
    item.id
    || item.name
    || item.comboName
    || item.label
    || '',
  ).trim();
}

export function formatGatewayControlWarnings(value: unknown[]): string[] {
  const entries = value.map(String).filter(Boolean);
  if (entries.length === 0) {
    return [];
  }
  return ['- avisos:', ...entries.map((entry) => `  - ${entry}`)];
}

export function asCliRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
