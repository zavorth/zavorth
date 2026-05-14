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
  choice('chat', 'Chat', 'Conversas e suporte geral.'),
  choice('code', 'CÃ³digo', 'ImplementaÃ§Ã£o, revisÃ£o e ediÃ§Ã£o.'),
  choice('vision', 'VisÃ£o', 'Leitura de prints e imagens.'),
  choice('browser', 'Browser', 'NavegaÃ§Ã£o e automaÃ§Ã£o web.'),
  choice('agents', 'Agentes', 'Fluxos autÃ´nomos e delegaÃ§Ã£o.'),
];

export const commonCapabilityQuestion = question(
  'capabilities',
  'Quais capacidades vocÃª quer liberar primeiro?',
  'multi_choice',
  'VocÃª pode comeÃ§ar pequeno e ampliar depois.',
  {
    required: false,
    choices: capabilityChoices,
  },
);
