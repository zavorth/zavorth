/**
 * Persist secondary/background cost-routing stack from env into provider preferences.
 * Usage: npx tsx scripts/apply-cost-stack-preferences.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  writeProviderPreference,
  resolveUserProviderSelection,
} from '../src/services/UserSelectionResolver.js';
import { resolveUserStackProviderChain } from '../src/services/llm/UserStackProviderChain.js';
import { resolveCheapUserStackHop } from '../src/services/llm/UserStackCostRoute.js';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));

const written = writeProviderPreference({
  providerId: process.env.LLM_PROVIDER || 'gemini',
  modelId: process.env.ZAVORTH_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  secondaryModelId: process.env.ZAVORTH_SECONDARY_MODEL || 'gemini-2.5-flash-lite',
  fallbackProviderIds: [],
  projectRoot: process.cwd(),
});

const selection = resolveUserProviderSelection({ projectRoot: process.cwd() });
const hops = resolveUserStackProviderChain({ selection, env: process.env });
const cheap = resolveCheapUserStackHop({ selection, env: process.env });

console.log(JSON.stringify({ written, selection, hops, cheap }, null, 2));
