#!/usr/bin/env node
import { PromptEvolutionLabService } from '../src/services/PromptEvolutionLabService.js';

const args = process.argv.slice(2);
const service = new PromptEvolutionLabService();
const snapshot = service.buildSnapshot({
  promptId: readFlag('--prompt-id') || 'zavorth-core-system',
  profileId: readFlag('--profile') || 'default',
  basePrompt: readFlag('--base-prompt') || DEFAULT_BASE_PROMPT,
  candidateLimit: Number(readFlag('--candidate-limit') || 6),
});

if (args.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}

const DEFAULT_BASE_PROMPT = [
  'Act as Zavorth, a local agent runtime that helps the user complete tasks.',
  'Use tools only when needed, keep evidence, preserve receipts and request approval for sensitive actions.',
].join(' ');
