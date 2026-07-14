import os from 'node:os';
import type { SkillMetadata } from '../../src/skills/SkillLoader.js';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';
import { ZavorthNaturalInvocationRouter } from '../../src/services/ZavorthNaturalInvocationRouter.js';

describe('ZavorthNaturalInvocationRouter', () => {
  beforeEach(() => {
    jest.spyOn(ProviderFactory, 'create').mockImplementation(() => {
      throw new Error('LLM disabled in NaturalInvocationRouter unit tests');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not route free-text multi-agent phrases without the LLM', async () => {
    const router = new ZavorthNaturalInvocationRouter({
      now: () => new Date('2026-05-10T14:10:00.000Z'),
    });

    const plan = await router.plan({
      text: 'use subagents: one to research and another to review locally',
      autoExecute: true,
      mockLiveSubagents: true,
      skillCatalog: [],
    });

    // Without LLM, free text must not force spawn via keywords.
    expect(plan.primaryAction).toBe('answer_directly');
    expect(plan.surfaceCommands.map((command) => command.command)).toEqual(expect.arrayContaining([
      '/agents',
      '/invoke <request>',
    ]));
  });

  it('does not force use_skill from free-text skill phrases without the LLM', async () => {
    const router = new ZavorthNaturalInvocationRouter({
      now: () => new Date('2026-05-10T14:10:00.000Z'),
    });

    const plan = await router.plan({
      text: 'use skill security-review',
      skillCatalog: [skill()],
    });

    expect(plan.primaryAction).toBe('answer_directly');
  });

  it('injects capability catalog when answering directly with skills available', async () => {
    const router = new ZavorthNaturalInvocationRouter({
      now: () => new Date('2026-05-10T14:10:00.000Z'),
    });

    const plan = await router.plan({
      text: 'talk directly without using any specific skill',
      skillCatalog: [skill()],
    });

    expect(plan.primaryAction).toBe('answer_directly');
    expect(plan.selectedSkillName).toBeNull();
    expect(plan.availableCapabilitiesCatalogue).toContain('<zavorth_available_capabilities>');
    expect(plan.availableCapabilitiesCatalogue).toContain('security-review');
  });

  it('compacts skill paths in the available capabilities catalogue', async () => {
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/home/zavorth-user');

    try {
      const router = new ZavorthNaturalInvocationRouter({
        now: () => new Date('2026-05-10T14:10:00.000Z'),
      });

      const skillWithAbsPath = skill();
      skillWithAbsPath.skillFilePath = '/home/zavorth-user/skill-library/imported/security-review/SKILL.md';

      const plan = await router.plan({
        text: 'talk directly',
        skillCatalog: [skillWithAbsPath],
      });

      expect(plan.primaryAction).toBe('answer_directly');
      expect(plan.availableCapabilitiesCatalogue).toContain('~/skill-library/imported/security-review/SKILL.md');
    } finally {
      homedirSpy.mockRestore();
    }
  });
});

function skill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    name: 'security-review',
    description: 'Review security posture.',
    skillFilePath: 'skill-library/imported/security-review/SKILL.md',
    source: 'imported',
    ...overrides,
  } as SkillMetadata;
}
