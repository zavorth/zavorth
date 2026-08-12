import { SkillRouter } from '../../src/skills/SkillRouter';
import type { SkillMetadata } from '../../src/skills/SkillLoader';

function skill(name: string, description = `${name} description`): SkillMetadata {
  return {
    name,
    description,
    dirPath: `C:/skills/${name}`,
    skillFilePath: `C:/skills/${name}/SKILL.md`,
    supportFilePaths: [],
  };
}

function createProvider(content: string | null = null) {
  return {
    chat: jest.fn().mockResolvedValue({ content }),
  } as any;
}

const skills = [
  skill('zavorth-maestro'),
  skill('debugging'),
  skill('requirements-analysis'),
  skill('system-design'),
  skill('discover-research'),
];

describe('SkillRouter hardening', () => {
  it('returns an empty deterministic selection when no skills are available', async () => {
    const provider = createProvider('{"primarySkillName":"debugging"}');
    const router = new SkillRouter(provider);

    await expect(router.routeSelection('debugue este erro', [])).resolves.toEqual({
      primarySkillName: null,
      supportSkillName: null,
    });
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('honors explicit available skills without asking the LLM', async () => {
    const provider = createProvider(null);
    const router = new SkillRouter(provider);

    const selection = await router.routeSelection(
      'Use zavorth maestro com system design para organizar este projeto em etapas',
      skills,
    );

    expect(selection).toEqual({
      primarySkillName: 'zavorth-maestro',
      supportSkillName: 'system-design',
    });
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('does not auto-activate skills from free-text keyword heuristics', async () => {
    const provider = createProvider(null);
    const router = new SkillRouter(provider);

    const selection = await router.routeSelection(
      'there is a bug error crash stack trace exception that is broken and not working',
      skills,
    );

    // Free-text keywords must not force-load debugging without the model.
    expect(selection).toEqual({
      primarySkillName: null,
      supportSkillName: null,
    });
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it('lets the LLM own free-text skill selection', async () => {
    const provider = createProvider('{"primarySkillName":"debugging","supportSkillName":null}');
    const router = new SkillRouter(provider);

    const selection = await router.routeSelection('help me fix this issue in production', skills);

    expect(selection).toEqual({
      primarySkillName: 'debugging',
      supportSkillName: null,
    });
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it('does not soft-fill support skill from free-text keywords after LLM chooses primary', async () => {
    const provider = createProvider('{"primarySkillName":"debugging","supportSkillName":null}');
    const router = new SkillRouter(provider);

    // Even when free text would historically soft-rank system-design, LLM owns support.
    const selection = await router.routeSelection(
      'debug this architecture latency queue database api microservice failure stack trace',
      skills,
    );

    expect(selection.primarySkillName).toBe('debugging');
    expect(selection.supportSkillName).toBeNull();
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it('normalizes conflicting LLM output so the same skill is not both primary and support', async () => {
    const provider = createProvider('{"primarySkillName":"debugging","supportSkillName":"debugging"}');
    const router = new SkillRouter(provider);

    const selection = await router.routeSelection('conversa casual sem heuristica forte', skills);

    expect(selection).toEqual({
      primarySkillName: 'debugging',
      supportSkillName: null,
    });
  });

  it('drops unavailable skills from LLM output instead of routing to a missing capability', async () => {
    const provider = createProvider('{"primarySkillName":"missing-skill","supportSkillName":"debugging"}');
    const router = new SkillRouter(provider);

    const selection = await router.routeSelection('analise isso', skills);

    expect(selection).toEqual({
      primarySkillName: 'debugging',
      supportSkillName: null,
    });
  });

  it('does not fall back to free-text heuristics when the LLM response is unusable', async () => {
    const provider = createProvider('isso nao e json');
    const router = new SkillRouter(provider);

    const selection = await router.routeSelection('tem um bug estranho nesse teste', skills);

    expect(selection).toEqual({
      primarySkillName: null,
      supportSkillName: null,
    });
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
});
