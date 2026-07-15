/**
 * TypeScript entry for live dual-role smoke (invoked via tsx).
 */
import { LlmRoleRoutingService } from '../src/services/llm/LlmRoleRoutingService.js';
import { LlmRoleSurfaceCommands } from '../src/services/llm/LlmRoleSurfaceCommands.js';
import { LlmRuntimeService } from '../src/services/llm/LlmRuntimeService.js';
import { normalizeRoleSurface, resolveLlmRoleScopeId } from '../src/contracts/runtime/LlmRoleRoutingContract.js';

async function main(): Promise<void> {
  const runtime = new LlmRuntimeService();
  const roles = new LlmRoleRoutingService();
  const commands = new LlmRoleSurfaceCommands(roles);
  const isUsable = (name: string) => runtime.isProviderAvailable(name);

  const userId = `smoke-${Date.now()}`;
  const surfaces = ['telegram', 'discord', 'desktop', 'cli', 'acp', 'future-mesh-v2'];
  const scope = resolveLlmRoleScopeId({ userId, surface: 'telegram' });

  console.log('=== live-llm-roles-smoke (tsx) ===');
  console.log('scope:', scope);

  const liveCount = await roles.refreshLiveCatalog(isUsable).catch(() => 0);
  console.log('live catalog entries:', liveCount);

  const proposal = roles.buildSetupQuestion(isUsable);
  console.log('proposal:', JSON.stringify(proposal.proposal, null, 2));
  console.log('usable:', proposal.usableSummary || '(none)');

  if (!proposal.proposal.default) {
    console.error('FAIL: no usable models (set GEMINI_API_KEY or another provider key).');
    process.exit(2);
  }

  roles.setRoles(scope, {
    default: proposal.proposal.default,
    strong: proposal.proposal.strong || proposal.proposal.default,
    source: 'system',
  });

  for (const surface of surfaces) {
    const id = resolveLlmRoleScopeId({ userId, surface: normalizeRoleSurface(surface) });
    if (id !== scope) {
      console.error('FAIL: scope diverged', surface, id);
      process.exit(3);
    }
  }

  // Prompt labels for arbitrary future surface
  const prompt = roles.buildSurfaceSetupPrompt(`${scope}-future`, 'future-channel-xyz', isUsable);
  if (!/future/i.test(prompt)) {
    console.error('FAIL: setup prompt missing future surface label');
    process.exit(5);
  }

  const ctx = { userId, surface: 'discord', isProviderUsable: isUsable };
  const status = commands.handleModelArgs(ctx, 'status');
  console.log(status.text || '');

  commands.setForceStrong(ctx, true);
  if (!roles.isForceStrongActive(scope)) {
    console.error('FAIL: forceStrong inactive');
    process.exit(4);
  }
  commands.setForceStrong(ctx, false);

  // Optional live chat turn with default role (cheap ping)
  try {
    const { ConversationalAgent } = await import('../src/agents/ConversationalAgent.js');
    process.env.ZAVORTH_LLM_ROLE_SETUP_INTERCEPT = '1';
    const agent = new ConversationalAgent();
    const reply = await agent.chat('Reply with exactly: dual-role-smoke-ok', undefined, {
      mode: 'direct',
      userId,
      surface: 'cli',
    });
    console.log('agent reply preview:', String(reply.text || '').slice(0, 200));
    console.log('agent role:', reply.llm?.role, reply.llm?.roleReason);
  } catch (error: unknown) {
    console.warn('agent chat smoke skipped/failed:', error instanceof Error ? error.message : error);
  }

  console.log('PASS: multi-surface dual-role smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
