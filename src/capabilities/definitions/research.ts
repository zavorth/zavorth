import { CapabilityDefinition } from '../../contracts/CapabilityContract.js';

export const RESEARCH_CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'command-research',
    label: 'Research',
    type: 'research',
    description: 'Queues structured web research and notifies when finished.',
    intent: 'research',
    executor_preference: null,
    dispatch_mode: 'execution',
    requires_planning: false,
    routing_reason: 'Explicit web research command.',
    routing_confidence: 1,
    command: {
      command: 'research',
      description: 'Researches a topic on the web.',
      usage: '<topic>',
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
    description: 'Queues multi-step deep research.',
    intent: 'deep_research',
    executor_preference: null,
    dispatch_mode: 'execution',
    requires_planning: false,
    routing_reason: 'Explicit deep research command.',
    routing_confidence: 1,
    command: {
      command: 'deepresearch',
      description: 'Multi-step deep research.',
      usage: '<topic>',
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
