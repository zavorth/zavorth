import {
  formatSharedSurfaceUnavailableReply,
  getDiscordSlashCommandManifest,
  isSharedSurfaceCommandType,
} from '../../src/services/SharedSurfaceCommandContract';

describe('SharedSurfaceCommandContract', () => {
  it('formats the canonical fallback hint with the shared command surface', () => {
    expect(formatSharedSurfaceUnavailableReply('discord')).toContain('/reload');
    expect(formatSharedSurfaceUnavailableReply('discord')).toContain('/dryrun');
    expect(formatSharedSurfaceUnavailableReply('discord')).toContain('discord');
  });

  it('distinguishes dispatcher commands from shared-service commands', () => {
    expect(isSharedSurfaceCommandType('/task', false)).toBe(true);
    expect(isSharedSurfaceCommandType('/gateway', false)).toBe(false);
    expect(isSharedSurfaceCommandType('/gateway', true)).toBe(true);
  });

  it('builds the Discord slash manifest from the same contract', () => {
    const minimal = getDiscordSlashCommandManifest({
      commandExposure: 'minimal',
      publicServerMode: false,
    }).map((entry) => entry.discordSlashName);
    const operator = getDiscordSlashCommandManifest({
      commandExposure: 'operator',
      publicServerMode: false,
    }).map((entry) => entry.discordSlashName);

    expect(minimal).toEqual(['help', 'commands', 'task', 'auto', 'plan']);
    expect(operator).toEqual([
      'help',
      'commands',
      'status',
      'changes',
      'reload',
      'autorepair',
      'task',
      'auto',
      'plan',
      'workflow',
      'models',
      'skills',
      'agents',
      'vision',
      'computer',
      'device',
      'invoke',
    ]);
  });

  it('exposes the workflow slash command only for operator contexts and includes sdd mode', () => {
    const operatorManifest = getDiscordSlashCommandManifest({
      commandExposure: 'operator',
      publicServerMode: false,
    });
    const workflowEntry = operatorManifest.find((entry) => entry.discordSlashName === 'workflow');

    expect(workflowEntry).toEqual(expect.objectContaining({
      commandType: '/workflow',
      discordSlashVisibility: 'operator',
    }));
    expect(workflowEntry?.options?.find((option) => option.name === 'mode')).toEqual(
      expect.objectContaining({
        required: true,
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'sdd' }),
        ]),
      }),
    );
  });
});
