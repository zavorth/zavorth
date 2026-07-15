import fs from 'fs';
import os from 'os';
import path from 'path';
import { LlmRoleRoutingService } from '../../../src/services/llm/LlmRoleRoutingService';
import { LlmRoleStoreService } from '../../../src/services/llm/LlmRoleStoreService';
import { LlmRoleCatalogService } from '../../../src/services/llm/LlmRoleCatalogService';
import { LlmRoleSurfaceCommands } from '../../../src/services/llm/LlmRoleSurfaceCommands';

describe('LlmRoleSurfaceCommands', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-llm-role-cmds-'));
  const store = new LlmRoleStoreService(tmp);
  const roles = new LlmRoleRoutingService({ store, catalog: new LlmRoleCatalogService() });
  const commands = new LlmRoleSurfaceCommands(roles);
  const usable = () => true;

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('shares user scope across arbitrary surfaces', () => {
    const telegram = commands.resolveScope({
      userId: '99',
      surface: 'telegram',
      isProviderUsable: usable,
    });
    const discord = commands.resolveScope({
      userId: '99',
      surface: 'discord',
      isProviderUsable: usable,
    });
    const future = commands.resolveScope({
      userId: '99',
      surface: 'my-new-surface-v2',
      isProviderUsable: usable,
    });
    expect(telegram).toBe('user:99');
    expect(discord).toBe('user:99');
    expect(future).toBe('user:99');
  });

  it('handles /model status and force-strong for any surface context', () => {
    roles.setRoles('user:77', {
      default: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strong: { provider: 'gemini', model: 'gemini-2.5-pro' },
      source: 'slash',
    });
    const ctx = {
      userId: '77',
      surface: 'whatsapp',
      isProviderUsable: usable,
    };
    const status = commands.handleModelArgs(ctx, 'status');
    expect(status.handled).toBe(true);
    expect(status.text || '').toMatch(/gemini-2\.5-flash/i);
    expect(status.text || '').toMatch(/whatsapp/i);

    const on = commands.setForceStrong(ctx, true);
    expect(on.toLowerCase()).toMatch(/strong/);
    expect(roles.isForceStrongActive('user:77')).toBe(true);
    commands.setForceStrong(ctx, false);
    expect(roles.isForceStrongActive('user:77')).toBe(false);
  });

  it('handles model setup verbs used by shared slash hosts', () => {
    const ctx = {
      userId: 'shared-slash',
      surface: 'discord',
      isProviderUsable: usable,
    };
    const setup = commands.handleModelArgs(ctx, 'setup');
    expect(setup.handled).toBe(true);
    expect(setup.text || '').toMatch(/default|strong|setup|gemini|openai|usable/i);
  });

  it('can force setup prompt on a future surface', () => {
    const prev = process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT;
    process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT = '1';
    try {
      const ctx = {
        userId: 'setup-future',
        surface: 'bridge-neo-9',
        isProviderUsable: usable,
      };
      const prompt = commands.promptSetup(ctx, true);
      expect(prompt.shouldPrompt).toBe(true);
      expect(prompt.text || '').toMatch(/bridge/i);
      const cfg = roles.getConfig('user:setup-future');
      expect(cfg.awaitingSetup).toBe(true);
      expect(cfg.lastPromptSurface).toBe('bridge-neo-9');
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT;
      else process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT = prev;
    }
  });
});
