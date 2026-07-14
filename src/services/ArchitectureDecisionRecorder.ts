import type { AgentOsArchitectureDecisionDraft } from '../contracts/AgentOsContract.js';
import { safeAgentOsId, truncateAgentOsText } from './AgentOsTextSafety.js';

export class ArchitectureDecisionRecorder {
  public createDraft(input: {
    title: string;
    decision: string;
    alternatives?: string[] | null;
    consequences?: string[] | null;
  }): AgentOsArchitectureDecisionDraft {
    const title = truncateAgentOsText(input.title || 'Decisao arquitetural Zavorth', 120);
    return {
      source: 'ArchitectureDecisionRecorder',
      id: `adr-${safeAgentOsId(title, 'agent-os-decision')}`,
      title,
      status: 'draft',
      decision: truncateAgentOsText(input.decision || 'Registrar decisao antes de aplicar impacto relevante.', 400),
      alternativesConsidered: (input.alternatives || ['keep current flow', 'apply minimal change', 'use governed transaction'])
        .slice(0, 5)
        .map((entry) => truncateAgentOsText(entry, 180)),
      consequences: (input.consequences || ['mais rastreabilidade', 'rollback mais claro', 'menor chance de regressao silenciosa'])
        .slice(0, 5)
        .map((entry) => truncateAgentOsText(entry, 180)),
      filesWritten: false,
      requiresTransactionRuntime: true,
      rawSecretsSerialized: false,
    };
  }
}
