type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function array(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.map((entry) => record(entry)) : [];
}

export function normalizeStatus(value: unknown): string {
  const status = String(value || '').trim();
  return status || 'unknown';
}

export function normalizeActionKind(value: unknown): string {
  const kind = String(value || '').trim();
  return kind || 'readiness';
}

export function buildOperatorWorkbench(input: AnyRecord = {}): AnyRecord | null {
  const workbench = record(input.operatorWorkbench || input.nexusWorkbench || input.runtime?.operatorWorkbench || input.runtime?.nexusWorkbench);
  if (!Object.keys(workbench).length) {
    return null;
  }

  return {
    ...workbench,
    canonicalApiPath: '/api/v2/nexus/workbench',
    status: normalizeStatus(workbench.status || (workbench.ok === false ? 'degraded' : 'ready')),
    headline: workbench.headline || (input.operatorWorkbench ? 'Operator Workbench ready through the main runtime.' : 'Nexus ready through the main runtime.'),
    runtime: {
      ...record(workbench.runtime),
      primaryLabel: workbench.runtime?.primary === 'ZavorthAgentGateway'
        ? 'Runtime principal'
        : workbench.runtime?.primaryLabel || workbench.runtime?.primary,
    },
    operatorExperience: {
      statusLabel: workbench.operatorExperience?.statusLabel || 'Operator Workbench',
      cards: array(workbench.operatorExperience?.cards),
      ...record(workbench.operatorExperience),
    },
    capabilities: {
      safe_execution: true,
      nextAction: workbench.capabilities?.nextAction || 'Abrir readiness completo',
      ...record(workbench.capabilities),
      lifecycleCount: array(workbench.capabilities?.lifecycle).length,
      maturityCount: array(workbench.capabilities?.maturity).length,
    },
    echoExperience: {
      ...record(workbench.echoExperience),
      online: workbench.echoExperience?.online ?? workbench.echoExperience?.provider?.online,
      providerName: workbench.echoExperience?.providerName || workbench.echoExperience?.provider?.providerName,
      model: workbench.echoExperience?.model || workbench.echoExperience?.provider?.model,
      recentExecutions: workbench.echoExperience?.recentExecutions ?? workbench.echoExperience?.fallback?.recentExecutions,
      voiceRequests: workbench.echoExperience?.voiceRequests ?? workbench.echoExperience?.voice?.totalRequests,
    },
    actions: array(workbench.actions).map((action) => ({
      ...action,
      kind: normalizeActionKind(action.kind),
    })),
  };
}

export const buildNexusWorkbench = buildOperatorWorkbench;
