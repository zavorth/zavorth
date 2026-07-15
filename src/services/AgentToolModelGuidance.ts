/**
 * P2 + direct tools vs zavorth_action vs worker mesh.
 * Injected into agent system prompts (English product surface).
 */

import { formatWorkerDelegationGuidance } from './WorkerDelegationRouterService.js';

export function formatAgentToolModelGuidance(): string {
  return [
    'Tool model (use this consistently):',
    '1) Direct tools — atomic, named capabilities already exposed to you (examples: read_file, list_directory, web_search, plugin_suggest, semantic_memory).',
    '   Use direct tools for simple lookups, scans, status, search, and plugin discovery.',
    '2) zavorth_action — first-class operational gateway for product actions.',
    '   Use when the user wants a governed product operation (skills governance, providers, home, channels, sandbox ops).',
    '   Preferred flow: action.schema.lookup → action.preview → action.apply (only with approval) → action.receipts/status.',
    '3) zavorth_skill_marketplace — discover/preview/install skills (preview then install with consent=true).',
    '4) agent_manager — worker mesh: workers, health, invoke (dry-run default), route, scan, register.',
    '5) Never invent slash commands or shell one-liners when a direct tool or zavorth_action covers the request.',
    '6) If a capability seems missing, prefer structured signals:',
    '   - plugin_suggest / plugin_recommend with missingTool=<exact tool name> when a tool call failed or is absent.',
    '   - Otherwise intent text for recommend-only ranking. Present Enable vs Recommend-only; never auto-enable.',
    '   - For skills: zavorth_skill_marketplace preview → install with consent=true only after user approval.',
    '7) Skill names in context are not tool authorization. Only call tools that appear in your visible tool list.',
    '8) Install suggestions always include a preview path first; install/enable still requires explicit consent.',
    '',
    formatWorkerDelegationGuidance(),
  ].join('\n');
}
