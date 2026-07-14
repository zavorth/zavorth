import type { AgentHealthDiagnostic, AgentHealthSnapshot, AgentHealthStatus } from '../contracts/runtime/AgentRuntimeGovernanceContract.js';

export type AgentHealthProvider = {
  id: string;
  label: string;
  read: () => Promise<Omit<AgentHealthDiagnostic, 'id' | 'label' | 'checkedAt'> | null> | Omit<AgentHealthDiagnostic, 'id' | 'label' | 'checkedAt'> | null;
};

export class AgentUnifiedHealthService {
  public constructor(private readonly runtime: { workspaceId: string; providers: AgentHealthProvider[]; now?: () => Date }) {
    if (!runtime.workspaceId.trim()) throw new TypeError('workspaceId is required.');
  }

  public async readSnapshot(): Promise<AgentHealthSnapshot> {
    const now = (this.runtime.now ?? (() => new Date()))().toISOString();
    const diagnostics = await Promise.all(this.runtime.providers.map(async (provider): Promise<AgentHealthDiagnostic> => {
      try {
        const result = await provider.read();
        return result
          ? { id: provider.id, label: provider.label, checkedAt: now, ...result }
          : unavailable(provider, now, 'No diagnostic snapshot is available.');
      } catch (error: unknown) {
        return unavailable(provider, now, error instanceof Error ? error.message : 'The diagnostic provider failed.');
      }
    }));
    const status = aggregate(diagnostics.map((entry) => entry.status));
    const attention = diagnostics.filter((entry) => entry.status !== 'healthy').length;
    return {
      workspaceId: this.runtime.workspaceId,
      generatedAt: now,
      status,
      diagnostics,
      summary: attention === 0 ? 'All agent diagnostics are healthy.' : `${attention} agent diagnostic(s) require attention.`,
    };
  }
}

function unavailable(provider: AgentHealthProvider, checkedAt: string, summary: string): AgentHealthDiagnostic {
  return { id: provider.id, label: provider.label, status: 'unavailable', summary, checkedAt, recommendedAction: null };
}

function aggregate(statuses: AgentHealthStatus[]): AgentHealthSnapshot['status'] {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.some((status) => status === 'attention' || status === 'unavailable')) return 'attention';
  return 'healthy';
}
