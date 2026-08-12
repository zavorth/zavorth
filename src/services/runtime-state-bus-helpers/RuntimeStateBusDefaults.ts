import {
  ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
  type ZavorthRuntimeModelSpec,
  type ZavorthRuntimeStateBusState,
  type ZavorthRuntimeStateReceipt,
} from '../../contracts/ZavorthRuntimeStateBusContract.js';

export const DEFAULT_MODEL_SPECS: ZavorthRuntimeModelSpec[] = [
  {
    id: 'daily',
    label: 'Daily',
    summary: 'Default governed everyday route for normal desktop work.',
    allowedProviderIds: ['zavorth', 'openai', 'google', 'local'],
    preferredModelIds: ['zavorth:core', 'zavorth:governed'],
    fallbackModelIds: ['zavorth:governed'],
    maxEffort: 'standard',
    estimatedCost: 'medium',
    allowedSkillIds: ['zavorth-workspace-scope', 'provider-doctor'],
    allowedSubagentIds: [],
  },
  {
    id: 'coding',
    label: 'Coding',
    summary: 'Code review, implementation and test-heavy work with stronger reasoning.',
    allowedProviderIds: ['zavorth', 'openai', 'anthropic', 'local'],
    preferredModelIds: ['openai:gpt-5', 'zavorth:core'],
    fallbackModelIds: ['zavorth:core', 'zavorth:governed'],
    maxEffort: 'ultra-code',
    estimatedCost: 'high',
    allowedSkillIds: ['zavorth-workspace-scope', 'zavorth-model-routing', 'agent-orchestrator'],
    allowedSubagentIds: ['code-review', 'implementation'],
  },
  {
    id: 'research',
    label: 'Research',
    summary: 'Comparison, synthesis and evidence collection with explicit source handling.',
    allowedProviderIds: ['zavorth', 'openai', 'google', 'openrouter'],
    preferredModelIds: ['zavorth:core', 'openai:gpt-5'],
    fallbackModelIds: ['zavorth:core'],
    maxEffort: 'high',
    estimatedCost: 'high',
    allowedSkillIds: ['zavorth-workspace-scope', 'provider-doctor', 'search-engine'],
    allowedSubagentIds: ['evidence-collector', 'synthesis'],
  },
];

export type PersistedStore = {
  contractVersion: typeof ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION;
  updatedAt: string;
  state: ZavorthRuntimeStateBusState;
  receipts: ZavorthRuntimeStateReceipt[];
  lastReplayAt: string | null;
};
