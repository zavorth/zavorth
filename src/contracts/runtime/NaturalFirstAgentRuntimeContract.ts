export const NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION = 'natural-first-agent-runtime/1' as const;

export type NaturalFirstRuntimeInputKind =
  | 'slash-command'
  | 'operator-command'
  | 'free-text';

export type NaturalFirstRuntimeEntrypoint =
  | 'command-router-shortcut'
  | 'zavorth-agent-gateway';

export type NaturalFirstRuntimeEntrypointDecision = {
  version: typeof NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION;
  inputKind: NaturalFirstRuntimeInputKind;
  entrypoint: NaturalFirstRuntimeEntrypoint;
  gatewayRequired: boolean;
  commandShortcutAllowed: boolean;
  reason: string;
  guardrails: string[];
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function isSlashCommand(text: string): boolean {
  return /^\//.test(text);
}

function isOperatorCommand(text: string): boolean {
  return /^(?:zavorth|npm|pnpm|yarn|git|docker|node|npx|tsx|powershell|pwsh|wsl)(?:\s|$)/i.test(text);
}

function baseGuardrails(): string[] {
  return [
    'ZavorthAgentGateway remains the required runtime entrance for free text.',
    'Slash and explicit operator commands may use command-router shortcuts.',
    'No text route may bypass tool policy, approval policy, reply pipeline, or trace metadata.',
    'LLM usage is a runtime route decision, not an entrypoint requirement.',
  ];
}

export function decideNaturalFirstRuntimeEntrypoint(
  textInput: unknown,
): NaturalFirstRuntimeEntrypointDecision {
  const text = normalizeText(textInput);
  if (isSlashCommand(text)) {
    return {
      version: NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION,
      inputKind: 'slash-command',
      entrypoint: 'command-router-shortcut',
      gatewayRequired: false,
      commandShortcutAllowed: true,
      reason: 'Slash command is an explicit operator shortcut and should keep the command router path.',
      guardrails: baseGuardrails(),
    };
  }

  if (isOperatorCommand(text)) {
    return {
      version: NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION,
      inputKind: 'operator-command',
      entrypoint: 'command-router-shortcut',
      gatewayRequired: false,
      commandShortcutAllowed: true,
      reason: 'Explicit operator command may stay on the command router path.',
      guardrails: baseGuardrails(),
    };
  }

  return {
    version: NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION,
    inputKind: 'free-text',
    entrypoint: 'zavorth-agent-gateway',
    gatewayRequired: true,
    commandShortcutAllowed: false,
    reason: 'Free-form human text must enter the governed Zavorth agent gateway.',
    guardrails: baseGuardrails(),
  };
}
