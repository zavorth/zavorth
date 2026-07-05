import type {
  IntegrationInstallMode,
  IntegrationInstallModeDescriptor,
  IntegrationInstallStep,
  IntegrationQuestion,
  IntegrationQuestionChoice,
  IntegrationRequirement,
} from '../../../../contracts/IntegrationHubContract.js';

export function mode(
  id: IntegrationInstallMode,
  label: string,
  summary: string,
  autoInstallable = false,
  safeByDefault = true,
): IntegrationInstallModeDescriptor {
  return { id, label, summary, autoInstallable, safeByDefault };
}

export function req(
  id: string,
  label: string,
  description: string,
  options: Partial<IntegrationRequirement> = {},
): IntegrationRequirement {
  return {
    id,
    label,
    description,
    type: options.type || 'manual',
    required: options.required !== false,
    secret: options.secret,
    envKey: options.envKey ?? null,
  };
}

export function choice(value: string, label: string, description: string): IntegrationQuestionChoice {
  return { value, label, description };
}

export function question(
  id: string,
  label: string,
  type: IntegrationQuestion['type'],
  help: string,
  options: Partial<IntegrationQuestion> = {},
): IntegrationQuestion {
  return {
    id,
    label,
    type,
    help,
    required: options.required !== false,
    choices: options.choices,
    placeholder: options.placeholder,
  };
}

export function step(
  id: string,
  title: string,
  description: string,
  kind: IntegrationInstallStep['kind'],
  command: string | null = null,
  blocking = true,
): IntegrationInstallStep {
  return { id, title, description, kind, command, blocking };
}

export const capabilityChoices = [
  choice('chat', 'Chat', 'General conversation and support.'),
  choice('code', 'Code', 'Implementation, review, and editing.'),
  choice('vision', 'Vision', 'Screenshot and image understanding.'),
  choice('browser', 'Browser', 'Navigation and web automation.'),
  choice('agents', 'Agents', 'Autonomous flows and delegation.'),
];

export const commonCapabilityQuestion = question(
  'capabilities',
  'Which capabilities should be enabled first?',
  'multi_choice',
  'You can start small and expand later.',
  {
    required: false,
    choices: capabilityChoices,
  },
);
