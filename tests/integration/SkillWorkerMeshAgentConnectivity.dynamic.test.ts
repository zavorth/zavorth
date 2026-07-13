/**
 * Dynamic connectivity suite for skill/worker mesh + agent-first product path.
 * Locks registration, exposure, guidance, and free-text routing invariants.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createBootstrapToolRuntime } from '../../src/bootstrap/bootstrapToolRuntime.js';
import {
  isDailyOpsPreferredTool,
  isProfileAlwaysExpose,
  resolveExposureProfileName,
  DAILY_OPS_PREFERRED_TOOLS,
} from '../../src/runtime/agent/tools/ToolExposureProfile.js';
import { formatAgentToolModelGuidance } from '../../src/services/AgentToolModelGuidance.js';
import { preDispatchSharedSurfaceCommand } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.js';
import {
  resetSurfaceAgentFirstMetrics,
  getSurfaceAgentFirstMetrics,
} from '../../src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.js';
import { SkillInstallPipelineService } from '../../src/services/SkillInstallPipelineService.js';
import { AgentManagerTool } from '../../src/tools/AgentManagerTool.js';
import { ZavorthSkillMarketplaceTool } from '../../src/tools/ZavorthSkillMarketplaceTool.js';
import { assertTrustedGitSource } from '../../src/skills/marketplace/SkillGitRegistry.js';

describe('Skill/worker mesh + agent connectivity (dynamic)', () => {
  const prevExposure = process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE;
  const prevPluginOs = process.env.ZAVORTH_PLUGIN_OS_RUNTIME;
  const prevAgentFirst = process.env.ZAVORTH_TELEGRAM_AGENT_FIRST;

  afterEach(() => {
    if (prevExposure === undefined) delete process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE;
    else process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE = prevExposure;
    if (prevPluginOs === undefined) delete process.env.ZAVORTH_PLUGIN_OS_RUNTIME;
    else process.env.ZAVORTH_PLUGIN_OS_RUNTIME = prevPluginOs;
    if (prevAgentFirst === undefined) delete process.env.ZAVORTH_TELEGRAM_AGENT_FIRST;
    else process.env.ZAVORTH_TELEGRAM_AGENT_FIRST = prevAgentFirst;
  });

  it('bootstrap registers zavorth_skill_marketplace and agent_manager', () => {
    process.env.ZAVORTH_PLUGIN_OS_RUNTIME = '0';
    process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE = 'daily-ops';

    const rt = createBootstrapToolRuntime({ log: jest.fn() } as any);
    const names = rt.toolRuntime.getRegisteredToolNames();

    expect(names).toEqual(
      expect.arrayContaining(['zavorth_skill_marketplace', 'agent_manager']),
    );
    rt.dispose?.();
  });

  it('daily-ops profile prefers mesh tools when registered', () => {
    expect(DAILY_OPS_PREFERRED_TOOLS.has('zavorth_skill_marketplace')).toBe(true);
    expect(DAILY_OPS_PREFERRED_TOOLS.has('agent_manager')).toBe(true);
    expect(isDailyOpsPreferredTool('zavorth_skill_marketplace')).toBe(true);
    expect(isDailyOpsPreferredTool('agent_manager')).toBe(true);
    expect(isProfileAlwaysExpose('daily-ops', 'zavorth_skill_marketplace')).toBe(true);
    expect(isProfileAlwaysExpose('daily-ops', 'agent_manager')).toBe(true);
    expect(
      resolveExposureProfileName({
        envValue: 'daily-ops',
      }),
    ).toBe('daily-ops');
  });

  it('agent model guidance mentions marketplace and agent_manager', () => {
    const text = formatAgentToolModelGuidance();
    expect(text).toMatch(/zavorth_skill_marketplace/);
    expect(text).toMatch(/agent_manager/);
  });

  it('preDispatch free text → pass_to_agent; slash stays deterministic', async () => {
    delete process.env.ZAVORTH_TELEGRAM_AGENT_FIRST;
    resetSurfaceAgentFirstMetrics();

    const free = await preDispatchSharedSurfaceCommand({
      ctx: {
        platform: 'telegram',
        rawText: 'install a skill for memory please',
        userId: 'u1',
        chatId: 'c1',
        isGroup: false,
        reply: async () => undefined,
      } as any,
      rawText: 'install a skill for memory please',
      parsed: null,
      parse: (t: string) => ({
        command_type: '/task',
        command_args: t,
        normalized_message: t.toLowerCase(),
        explicit_executor: null,
        references_last_task: false,
      }),
      discordSurfacePolicyService: {
        canUseOperationalCommand: () => true,
        formatOperationalCommandDenied: () => 'denied',
        isOperationalCommand: () => false,
      },
    });
    expect(free.kind).toBe('pass_to_agent');

    const slash = await preDispatchSharedSurfaceCommand({
      ctx: {
        platform: 'telegram',
        rawText: '/approve task-1',
        userId: 'u1',
        chatId: 'c1',
        isGroup: false,
        reply: async () => undefined,
      } as any,
      rawText: '/approve task-1',
      parsed: {
        command_type: '/approve',
        command_args: 'task-1',
        normalized_message: '/approve task-1',
        explicit_executor: null,
        references_last_task: false,
      },
      parse: (t: string) => ({
        command_type: t.split(' ')[0],
        command_args: t.split(' ').slice(1).join(' '),
        normalized_message: t.toLowerCase(),
        explicit_executor: null,
        references_last_task: false,
      }),
      discordSurfacePolicyService: {
        canUseOperationalCommand: () => true,
        formatOperationalCommandDenied: () => 'denied',
        isOperationalCommand: () => false,
      },
    });
    expect(slash.kind).not.toBe('pass_to_agent');
    expect(slash.kind).toBe('resolved');
    expect(getSurfaceAgentFirstMetrics().naturalSkippedForAgent).toBeGreaterThanOrEqual(1);
  });

  it('skill install without consent is blocked (no silent materialize)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-dyn-'));
    const fixture = path.join(tmp, 'demo-skill');
    fs.mkdirSync(fixture, { recursive: true });
    fs.writeFileSync(
      path.join(fixture, 'SKILL.md'),
      '---\nname: demo-skill\ndescription: fixture\n---\n# Demo\n',
      'utf8',
    );

    try {
      const pipeline = new SkillInstallPipelineService({ projectRoot: tmp } as any);
      const blocked = await pipeline.apply({
        source: fixture,
        consent: false,
      } as any);
      const status = String(
        (blocked as any)?.status || (blocked as any)?.state || (blocked as any)?.kind || '',
      );
      expect(
        (blocked as any)?.ok === false ||
          /block|deny|consent|preview|required/i.test(status) ||
          /consent/i.test(JSON.stringify(blocked)),
      ).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('agent_manager path register without approval is not auto-granted as registered', async () => {
    const tool = new AgentManagerTool();
    const raw = await tool.execute({
      action: 'register',
      target: path.join(os.tmpdir(), 'no-such-worker-path-xyz-unique'),
    });
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    expect(text).not.toMatch(/"status"\s*:\s*"registered"/);
  });

  it('skill marketplace blocks force without operator allow', async () => {
    delete process.env.ZAVORTH_SKILL_ALLOW_FORCE;
    delete process.env.ZAVORTH_SKILL_OPERATOR_MODE;
    const tool = new ZavorthSkillMarketplaceTool({ projectRoot: os.tmpdir() });
    const out = await tool.execute({
      action: 'install',
      source: path.join(os.tmpdir(), 'fake-skill-src'),
      consent: true,
      force: true,
    });
    expect(String(out)).toMatch(/force=true is blocked/i);
  });

  it('skill marketplace blocks trust add without operator confirm', async () => {
    delete process.env.ZAVORTH_SKILL_OPERATOR_MODE;
    const tool = new ZavorthSkillMarketplaceTool({ projectRoot: os.tmpdir() });
    const out = await tool.execute({
      action: 'trust',
      query: 'add',
      trust_kind: 'domain',
      trust_pattern: 'evil.example',
    });
    expect(String(out)).toMatch(/operator_confirm/i);
  });

  it('git trust rejects untrusted hosts', () => {
    const bad = assertTrustedGitSource('https://evil.example/repo.git');
    expect(bad.ok).toBe(false);
    const good = assertTrustedGitSource('https://github.com/org/repo.git');
    expect(good.ok).toBe(true);
  });
});
