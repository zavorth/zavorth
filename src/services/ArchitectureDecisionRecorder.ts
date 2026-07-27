import type { AgentOsArchitectureDecisionDraft } from '../contracts/AgentOsContract.js';
import { safeAgentOsId, truncateAgentOsText } from './AgentOsTextSafety.js';

export class ArchitectureDecisionRecorder {
  public createDraft(input: {
    title: string;
    decision: string;
    alternatives?: string[] | null;
    consequences?: string[] | null;
  }): AgentOsArchitectureDecisionDraft {
    const title = truncateAgentOsText(input.title || 'Zavorth architecture decision', 120);
    return {
      source: 'ArchitectureDecisionRecorder',
      id: `adr-${safeAgentOsId(title, 'agent-os-decision')}`,
      title,
      status: 'draft',
      decision: truncateAgentOsText(input.decision || 'Record decision before applying significant impact.', 400),
      alternativesConsidered: (input.alternatives || ['keep current flow', 'apply minimal change', 'use governed transaction'])
        .slice(0, 5)
        .map((entry) => truncateAgentOsText(entry, 180)),
      consequences: (input.consequences || ['more traceability', 'clearer rollback', 'lower chance of silent regression'])
        .slice(0, 5)
        .map((entry) => truncateAgentOsText(entry, 180)),
      filesWritten: false,
      requiresTransactionRuntime: true,
      rawSecretsSerialized: false,
    };
  }
}
