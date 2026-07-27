const popularProviders = [
  { id: 'openai', label: 'OpenAI', status: 'recommended' as const, command: 'zavorth providers add --provider openai', detail: 'Cloud LLM provider' },
  { id: 'anthropic', label: 'Anthropic', status: 'recommended' as const, command: 'zavorth providers add --provider anthropic', detail: 'Cloud LLM provider' },
  { id: 'local', label: 'Local (Ollama)', status: 'optional' as const, command: 'zavorth providers add --provider local', detail: 'Run models locally' },
  { id: 'google', label: 'Google Gemini', status: 'optional' as const, command: 'zavorth providers add --provider google', detail: 'Cloud LLM provider' },
  { id: 'groq', label: 'Groq', status: 'optional' as const, command: 'zavorth providers add --provider groq', detail: 'Fast inference' },
  { id: 'deepseek', label: 'DeepSeek', status: 'optional' as const, command: 'zavorth providers add --provider deepseek', detail: 'Cloud LLM provider' },
];

const allProviders = [
  ...popularProviders,
  { id: 'mistral', label: 'Mistral', status: 'optional' as const, command: 'zavorth providers add --provider mistral', detail: 'Cloud LLM provider' },
];

const popularChannels = [
  { id: 'telegram', label: 'Telegram', connectable: true, status: 'recommended' as const, command: 'zavorth channels telegram', detail: 'Remote ChatOps' },
  { id: 'discord', label: 'Discord', connectable: true, status: 'recommended' as const, command: 'zavorth channels discord', detail: 'Team ChatOps' },
  { id: 'slack', label: 'Slack', connectable: true, status: 'optional' as const, command: 'zavorth channels slack', detail: 'Team ChatOps' },
];

const allChannels = [
  ...popularChannels,
  { id: 'whatsapp', label: 'WhatsApp', connectable: true, status: 'optional' as const, command: 'zavorth channels whatsapp', detail: 'Mobile ChatOps' },
];

export function listAllQuickStartChannels() { return allChannels; }
export function listPopularQuickStartChannels() { return popularChannels; }
export function listPopularQuickStartProviders() { return popularProviders; }
export function listQuickStartProviders() { return allProviders; }
export function resolveQuickStartChannel(id: string) { return allChannels.find((c) => c.id === id) || null; }
export function resolveQuickStartProvider(id: string) { return allProviders.find((p) => p.id === id) || null; }
