jest.mock('@/shared/utils/logger', () => ({
  logger: { warn: jest.fn() },
}), { virtual: true });

import { buildExperienceCommand } from '../../src/ai-gateway/app/api/experience/experienceRouteSupport';

describe('experience route metadata binding', () => {
  it('preserves desktop metadata while protecting route-owned provenance', () => {
    const command = buildExperienceCommand({
      text: 'Analise este workspace',
      requestedBy: 'desktop-user',
      responseProfile: 'dev',
      metadata: {
        client: 'zavorth-desktop',
        model: 'gemini-pro',
        effort: 'high',
        profileConfig: { systemPrompt: 'Seja rigoroso.' },
        source: 'untrusted-source',
        requestedBy: 'untrusted-user',
        responseProfile: 'short',
      },
    });

    expect(command.metadata).toMatchObject({
      client: 'zavorth-desktop',
      model: 'gemini-pro',
      effort: 'high',
      profileConfig: { systemPrompt: 'Seja rigoroso.' },
      source: 'api/experience',
      requestedBy: 'desktop-user',
      responseProfile: 'dev',
    });
  });

  it('ignores non-object metadata', () => {
    const command = buildExperienceCommand({ text: 'Ola', metadata: ['invalid'] });

    expect(command.metadata).toEqual({
      requestedBy: 'control-ui',
      source: 'api/experience',
      responseProfile: undefined,
    });
  });
});
