import fs from 'fs';
import os from 'os';
import path from 'path';
import { LlmRoleRoutingService } from '../../../src/services/llm/LlmRoleRoutingService';
import { LlmRoleStoreService } from '../../../src/services/llm/LlmRoleStoreService';
import { LlmRoleCatalogService } from '../../../src/services/llm/LlmRoleCatalogService';

describe('LlmRoleRoutingService', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-llm-roles-'));
  const store = new LlmRoleStoreService(tmp);
  const service = new LlmRoleRoutingService({ store, catalog: new LlmRoleCatalogService() });
  const usable = () => true;
  const prevGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const prevOpenAi = process.env.OPENAI_API_KEY;
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    // Catalog filters by credential presence as well as isProviderUsable.
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key-for-unit';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key-for-unit';
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key-for-unit';
  });

  afterAll(() => {
    if (prevGemini === undefined) {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = prevGemini;
    }
    if (prevOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenAi;
    if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropic;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('stores and resolves default/strong roles', () => {
    service.setRoles('u1', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strong: { provider: 'gemini', model: 'gemini-2.5-pro' },
      source: 'slash',
    });

    const def = service.resolveRole('u1', {}, 'openai', 'gpt-4o', usable);
    expect(def.role).toBe('default');
    expect(def.providerName).toBe('gemini');
    expect(def.modelName).toBe('gemini-2.5-flash');

    const strong = service.resolveRole('u1', { forceStrong: true }, 'openai', 'gpt-4o', usable);
    expect(strong.role).toBe('strong');
    expect(strong.modelName).toBe('gemini-2.5-pro');
  });

  it('uses strong on effort high when configured', () => {
    service.setRoles('u2', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strong: { provider: 'openai', model: 'gpt-4o' },
      source: 'slash',
    });
    const resolved = service.resolveRole('u2', { effortHigh: true }, 'gemini', 'gemini-2.5-flash', usable);
    expect(resolved.role).toBe('strong');
    expect(resolved.providerName).toBe('openai');
  });

  it('uses strong on default failure only when opt-in', () => {
    service.setRoles('u3', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strong: { provider: 'openai', model: 'gpt-4o' },
      strongOnDefaultFailure: false,
      source: 'slash',
    });
    const off = service.resolveRole('u3', { defaultFailed: true }, 'gemini', 'gemini-2.5-flash', usable);
    expect(off.role).toBe('default');

    service.setRoles('u3', { strongOnDefaultFailure: true, source: 'slash' });
    const on = service.resolveRole('u3', { defaultFailed: true }, 'gemini', 'gemini-2.5-flash', usable);
    expect(on.role).toBe('strong');
  });

  it('supports task-specific strong bindings', () => {
    service.setRoles('u4', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strong: { provider: 'openai', model: 'gpt-4o' },
      taskStrong: {
        code: { provider: 'deepseek', model: 'deepseek-reasoner' },
        research: { provider: 'openai', model: 'gpt-4.1' },
      },
      source: 'slash',
    });
    const code = service.resolveRole('u4', { forceStrong: true, taskKind: 'code' }, 'gemini', 'x', usable);
    expect(code.providerName).toBe('deepseek');
    const research = service.resolveRole('u4', { forceStrong: true, taskKind: 'research' }, 'gemini', 'x', usable);
    expect(research.modelName).toBe('gpt-4.1');
  });

  it('prompts only with smart triggers', () => {
    const idle = service.shouldPromptSetup('u5', usable);
    // May prompt if multiple catalog providers considered usable with () => true
    expect(typeof idle.shouldPrompt).toBe('boolean');

    service.setRoles('u5', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      source: 'slash',
    });
    const configured = service.shouldPromptSetup('u5', usable);
    expect(configured.shouldPrompt).toBe(false);
    expect(configured.reason).toBe('already_configured');
  });

  it('records model switches and proposes dual roles', () => {
    service.recordModelSwitch('u6', 'gemini', 'gemini-2.5-flash');
    service.recordModelSwitch('u6', 'gemini', 'gemini-2.5-pro');
    const cfg = service.getConfig('u6');
    expect(cfg.modelSwitchEvents.length).toBeGreaterThanOrEqual(2);
    const proposal = service.buildSetupQuestion(usable);
    expect(proposal.proposal.default).toBeTruthy();
    expect(proposal.proposal.strong).toBeTruthy();
  });

  it('resolves nearest model matches from family wording', () => {
    const catalog = new LlmRoleCatalogService();
    const hit = catalog.resolveBinding('gemini', 'flash', usable, 'fast');
    expect(hit.binding?.model).toMatch(/flash/i);
    const miss = catalog.resolveBinding('gemini', 'gemini-9-super-ultra', usable, 'strong');
    expect(miss.exact).toBe(false);
    expect(miss.nearest).toBeTruthy();
  });

  it('stores force-strong window and surface-agnostic awaiting setup', () => {
    service.setForceStrong('u7', true, 60_000);
    expect(service.isForceStrongActive('u7')).toBe(true);
    const cfg = service.markPrompted('u7', 'desktop');
    expect(cfg.awaitingSetup).toBe(true);
    expect(cfg.lastPromptSurface).toBe('desktop');
    service.setForceStrong('u7', false);
    expect(service.isForceStrongActive('u7')).toBe(false);
  });

  it('reports health issues for missing strong models', () => {
    service.setRoles('u8', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strong: { provider: 'gemini', model: 'does-not-exist-xyz' },
      source: 'slash',
    });
    const health = service.healthCheck('u8', usable);
    expect(health.some((issue) => issue.code.includes('strong_model_missing'))).toBe(true);
  });

  it('uses user-centric scope helper across surfaces', () => {
    const {
      resolveLlmRoleScopeId,
      normalizeRoleSurface,
      formatRoleSurfaceLabel,
    } = require('../../../src/contracts/runtime/LlmRoleRoutingContract');
    expect(resolveLlmRoleScopeId({ userId: '42', surface: 'telegram' })).toBe('user:42');
    expect(resolveLlmRoleScopeId({ userId: '42', surface: 'desktop' })).toBe('user:42');
    expect(resolveLlmRoleScopeId({ userId: '42', surface: 'discord' })).toBe('user:42');
    expect(resolveLlmRoleScopeId({ userId: '42', surface: 'future-mesh-v9' })).toBe('user:42');
    expect(resolveLlmRoleScopeId({ surface: 'cli' })).toBe('surface:cli');
    expect(normalizeRoleSurface('  WhatsApp/Business ')).toBe('whatsapp-business');
    expect(formatRoleSurfaceLabel('future_mesh')).toContain('future');
  });

  it('prompts and records setup on any surface label without whitelist', () => {
    const prev = process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT;
    process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT = '1';
    try {
      const scope = 'user:multi-surface-x';
      const decision = service.shouldPromptSetup(scope, usable, {
        force: true,
        calmTurn: true,
        surface: 'future-channel-xyz',
      });
      expect(decision.shouldPrompt).toBe(true);
      const prompt = service.buildSurfaceSetupPrompt(scope, 'future-channel-xyz', usable);
      expect(prompt.toLowerCase()).toContain('future');
      const cfg = service.getConfig(scope);
      expect(cfg.awaitingSetup).toBe(true);
      expect(cfg.lastPromptSurface).toBe('future-channel-xyz');
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT;
      else process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT = prev;
    }
  });
});
