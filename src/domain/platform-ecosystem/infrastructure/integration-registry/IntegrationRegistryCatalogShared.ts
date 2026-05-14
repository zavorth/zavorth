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
  choice('code', 'CÃƒÂ³digo', 'ImplementaÃƒÂ§ÃƒÂ£o, revisÃƒÂ£o e ediÃƒÂ§ÃƒÂ£o.'),
  choice('vision', 'VisÃƒÂ£o', 'Leitura de prints e imagens.'),
  choice('browser', 'Browser', 'NavegaÃƒÂ§ÃƒÂ£o e automaÃƒÂ§ÃƒÂ£o web.'),
  choice('agents', 'Agentes', 'Fluxos autÃƒÂ´nomos e delegaÃƒÂ§ÃƒÂ£o.'),
];

export const commonCapabilityQuestion = question(
  'capabilities',
  'Quais capacidades vocÃƒÂª quer liberar primeiro?',
  'multi_choice',
  'VocÃƒÂª pode comeÃƒÂ§ar pequeno e ampliar depois.',
  {
    required: false,
    choices: capabilityChoices,
  },
);
