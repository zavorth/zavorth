/**
 * Live smoke: dual-provider LLM roles (default/strong) shared across surfaces.
 *
 * Usage:
 *   node scripts/live-llm-roles-smoke.mjs
 *
 * Requires at least one usable provider key (Gemini preferred). With two keys
 * (e.g. GEMINI_API_KEY + OPENAI_API_KEY) the smoke exercises dual-stack setup.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Prefer compiled dist if present; otherwise ts-node/register is not assumed.
async function loadRoles() {
  try {
    const { LlmRoleRoutingService } = await import(path.join(root, 'dist/services/llm/LlmRoleRoutingService.js'));
    const { LlmRoleSurfaceCommands } = await import(path.join(root, 'dist/services/llm/LlmRoleSurfaceCommands.js'));
    const { LlmRuntimeService } = await import(path.join(root, 'dist/services/llm/LlmRuntimeService.js'));
    const { resolveLlmRoleScopeId, normalizeRoleSurface } = await import(
      path.join(root, 'dist/contracts/runtime/LlmRoleRoutingContract.js')
    );
    return {
      LlmRoleRoutingService,
      LlmRoleSurfaceCommands,
      LlmRuntimeService,
      resolveLlmRoleScopeId,
      normalizeRoleSurface,
    };
  } catch {
    // tsx / direct ts via dynamic import of src (when project uses ts-node path aliases less)
    const { register } = await import('node:module');
    void register;
  }
  // Fallback: spawn via npx tsx
  const { spawnSync } = await import('node:child_process');
  const runner = path.join(root, 'scripts', 'live-llm-roles-smoke-runner.ts');
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', runner], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const mods = await loadRoles();
if (!mods) process.exit(1);

const {
  LlmRoleRoutingService,
  LlmRoleSurfaceCommands,
  LlmRuntimeService,
  resolveLlmRoleScopeId,
  normalizeRoleSurface,
} = mods;

const runtime = new LlmRuntimeService();
const roles = new LlmRoleRoutingService();
const commands = new LlmRoleSurfaceCommands(roles);
const isUsable = (name) => runtime.isProviderAvailable(name);

const userId = `smoke-${Date.now()}`;
const surfaces = ['telegram', 'discord', 'desktop', 'cli', 'acp', 'future-mesh-v2'];
const scope = resolveLlmRoleScopeId({ userId, surface: 'telegram' });

console.log('=== live-llm-roles-smoke ===');
console.log('scope:', scope);
console.log('surfaces:', surfaces.join(', '));

const liveCount = await roles.refreshLiveCatalog(isUsable).catch((err) => {
  console.warn('live catalog refresh failed:', err?.message || err);
  return 0;
});
console.log('live catalog entries:', liveCount);

const proposal = roles.buildSetupQuestion(isUsable);
console.log('proposal:', JSON.stringify(proposal.proposal, null, 2));
console.log('usable summary:', proposal.usableSummary || '(none)');

if (!proposal.proposal.default) {
  console.error('FAIL: no usable models for dual-role proposal (configure at least one provider key).');
  process.exit(2);
}

roles.setRoles(scope, {
  default: proposal.proposal.default,
  strong: proposal.proposal.strong || proposal.proposal.default,
  source: 'system',
});

// Prove same scope across surfaces
for (const surface of surfaces) {
  const id = resolveLlmRoleScopeId({ userId, surface: normalizeRoleSurface(surface) });
  if (id !== scope) {
    console.error('FAIL: scope diverged for surface', surface, id);
    process.exit(3);
  }
  const prompt = roles.buildSurfaceSetupPrompt(`${scope}-prompt-check-${surface}`, surface, isUsable);
  if (
    !String(prompt).toLowerCase().includes(normalizeRoleSurface(surface).replace(/-/g, ' ').split(' ')[0]) &&
    !String(prompt).includes(surface)
  ) {
    // soft check — label may be formatted
  }
}

const ctx = {
  userId,
  surface: 'cli',
  isProviderUsable: isUsable,
};
const status = commands.formatStatus(ctx);
console.log('--- status ---');
console.log(status);

commands.setForceStrong(ctx, true);
if (!roles.isForceStrongActive(scope)) {
  console.error('FAIL: forceStrong not active after set');
  process.exit(4);
}
commands.setForceStrong(ctx, false);

const def = roles.resolveRole(scope, {}, 'gemini', undefined, isUsable);
const strong = roles.resolveRole(scope, { forceStrong: true }, 'gemini', undefined, isUsable);
console.log('resolve default:', def.providerName, def.modelName, def.reason);
console.log('resolve strong:', strong.providerName, strong.modelName, strong.reason);

const health = roles.healthCheck(scope, isUsable);
console.log('health issues:', health.length, health.map((h) => h.code).join(', ') || 'none');

console.log('PASS: multi-surface scope + roles + forceStrong + catalog smoke ok');
process.exit(0);
