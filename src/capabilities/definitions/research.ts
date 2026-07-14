import { CapabilityDefinition } from '../../contracts/CapabilityContract.js';

export const RESEARCH_CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'command-research',
    label: 'Pesquisa',
    type: 'research',
    description: 'Enfileira uma pesquisa web estruturada com notificacao ao terminar.',
    intent: 'research',
    executor_preference: null,
    dispatch_mode: 'execution',
    requires_planning: false,
    routing_reason: 'Explicit web research command.',
    routing_confidence: 1,
    command: {
      command: 'research',
      description: 'Pesquisa um tema na web.',
      usage: '<tema>',
      section: 'search',
      privateMenu: true,
      groupMenu: true,
      explicit_executor: null,
      handler_action: 'research_queue',
      handler_config: {
        mode: 'research',
      },
    },
  },
  {
    id: 'command-deepresearch',
    label: 'Deep Research',
    type: 'research',
    description: 'Enfileira uma pesquisa profunda multi-etapa.',
    intent: 'deep_research',
    executor_preference: null,
    dispatch_mode: 'execution',
    requires_planning: false,
    routing_reason: 'Explicit deep research command.',
    routing_confidence: 1,
    command: {
      command: 'deepresearch',
      description: 'Pesquisa profunda multi-etapa.',
      usage: '<tema>',
      section: 'search',
      privateMenu: false,
      groupMenu: false,
      explicit_executor: null,
      handler_action: 'research_queue',
      handler_config: {
        mode: 'deepresearch',
      },
    },
  },
];
