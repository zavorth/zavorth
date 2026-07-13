import { normalizeNaturalText } from './workflowGovernanceText.js';

/**
 * Explicit free-text prefix for self-modification DSL (not phrase regex).
 * Prefer slash: /selfmod …
 */
export type ExplicitSelfModificationIntent = {
  args: string;
  intro: string;
};

export function parseExplicitSelfModificationIntent(rawText: string): ExplicitSelfModificationIntent | null {
  const original = String(rawText || '').trim();
  const normalized = normalizeNaturalText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const prefixes = ['selfmod ', 'auto-modificacao ', 'auto modificacao '];
  const matchedPrefix = prefixes.find((prefix) => normalized.startsWith(prefix));
  if (!matchedPrefix) {
    return null;
  }

  const args = original.slice(matchedPrefix.length).trim();
  if (!args) {
    return null;
  }

  return {
    args,
    intro: 'Entendi que voce quer abrir o fluxo guardado de auto-modificacao do Zavorth.',
  };
}
