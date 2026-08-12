let customSystemPrompt: string | null = null;

export function getSystemPrompt(): string | null {
  return customSystemPrompt;
}

export function setSystemPrompt(prompt: string | null): void {
  customSystemPrompt = prompt;
}

export interface SystemPromptConfig {
  prompt: string | null;
  enabled: boolean;
}

export function getSystemPromptConfig(): SystemPromptConfig {
  return { prompt: customSystemPrompt, enabled: customSystemPrompt !== null };
}

export function setSystemPromptConfig(config: { prompt?: string | null; enabled?: boolean }): void {
  customSystemPrompt = typeof config.prompt === "string" ? config.prompt : null;
}

export function injectSystemPrompt(messages: unknown[]): unknown[] {
  if (!customSystemPrompt) return messages;
  return [{ role: "system", content: customSystemPrompt }, ...messages];
}
