export function resolveExecutionGatewayExecutorName(name: string): string {
  switch ((name || '').toLowerCase()) {
    case 'local_executor':
      return 'local';
    case 'external_executor':
    case 'external-executor':
    case 'executor.external':
      return 'external_executor';
    case 'codex_cli':
      return 'codex';
    case 'gemini':
    case 'gemini-cli':
      return 'gemini_cli';
    case 'gemini-managed-agent':
    case 'gemini_managed_agent':
    case 'managed-agent':
      return 'gemini_managed_agent';
    case 'aistudio':
    case 'ai_studio':
    case 'google_ai_studio':
    case 'google-ai-studio':
      return 'aistudio';
    case 'jules_api':
    case 'jules-api':
      return 'jules';
    case 'stitch_sdk':
    case 'stitch-sdk':
      return 'stitch';
    default:
      return name;
  }
}

export function resolveExecutionGatewayWorkspace(
  value: string | null | undefined,
  defaultWorkspace: string | null,
): string | null {
  const normalized = String(value || '').trim();
  if (normalized) {
    return normalized;
  }
  return defaultWorkspace || process.cwd();
}
