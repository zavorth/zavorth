import {
  CHANNEL_COMMAND_CATALOG,
  KNOWN_COMMANDS,
  getExplicitExecutorForCommand,
  isKnownCommand,
  resolveCommandAlias,
  type CommandSection,
} from '../../../src/channels/commands/ChannelCommandCatalog';
import {
  EXTERNAL_EXECUTOR_COMMAND,
  LEGACY_EXTERNAL_COMMAND,
  LEGACY_EXTERNAL_REVIEW_COMMAND,
  LEGACY_EXTERNAL_SHORT_COMMAND,
} from '../../../src/channels/commands/ExternalExecutorIdentity';
import { ChannelCommandParser } from '../../../src/channels/commands/ChannelCommandParser';

describe('ChannelCommandCatalog', () => {
  describe('alias resolution chain', () => {
    it('resolves /deny exactly like /reject', () => {
      expect(resolveCommandAlias('/deny')).toBe('/reject');
    });

    it('resolves /menu to the zavorth hub', () => {
      expect(resolveCommandAlias('/menu')).toBe('/zavorth');
    });

    it('maps legacy external commands to the canonical external command', () => {
      expect(resolveCommandAlias(LEGACY_EXTERNAL_COMMAND)).toBe(EXTERNAL_EXECUTOR_COMMAND);
      expect(resolveCommandAlias(LEGACY_EXTERNAL_SHORT_COMMAND)).toBe(EXTERNAL_EXECUTOR_COMMAND);
      expect(resolveCommandAlias(LEGACY_EXTERNAL_REVIEW_COMMAND)).toBe('/external_review');
    });

    it('returns the input untouched when no alias matches', () => {
      expect(resolveCommandAlias('/plan')).toBe('/plan');
    });
  });

  describe('explicit executor map', () => {
    it('binds planning and local execution commands to their executors', () => {
      expect(getExplicitExecutorForCommand('/plan')).toBe('planner');
      expect(getExplicitExecutorForCommand('/run')).toBe('local_executor');
    });

    it('binds approval decisions to the approval manager', () => {
      expect(getExplicitExecutorForCommand('/approve')).toBe('approval_manager');
      expect(getExplicitExecutorForCommand('/reject')).toBe('approval_manager');
    });

    it('keeps recognized non-executor commands unbound', () => {
      expect(isKnownCommand('/perm')).toBe(true);
      expect(getExplicitExecutorForCommand('/perm')).toBeNull();
    });
  });

  describe('unknown command classification', () => {
    const parser = new ChannelCommandParser();

    it('classifies unrecognized slash commands as unknown without an executor', () => {
      const parsed = parser.parse('/definitelynotacommand 1');

      expect(parsed.command_type).toBe('unknown');
      expect(parsed.explicit_executor).toBeNull();
    });

    it('keeps resolved aliases inside the known command set', () => {
      const alias = resolveCommandAlias(LEGACY_EXTERNAL_COMMAND);

      expect(isKnownCommand(alias)).toBe(true);
      expect(KNOWN_COMMANDS.has(EXTERNAL_EXECUTOR_COMMAND)).toBe(true);
    });
  });

  describe('capability catalog merge precedence', () => {
    it('keeps the static entry when a capability declares the same command', () => {
      const entries = CHANNEL_COMMAND_CATALOG.filter((entry) => entry.command === 'zavorthControl');

      expect(entries).toHaveLength(1);
      expect(entries[0].description).toBe('Opens or shows the daily zavorthControl URL.');
      expect(entries[0].description).not.toBe('Opens the Zavorth web panel.');
    });

    it('appends capability-only commands after static entries', () => {
      expect(isKnownCommand('/shipfix')).toBe(false);
      expect(KNOWN_COMMANDS.has('/workflow')).toBe(true);
      expect(KNOWN_COMMANDS.has('/start')).toBe(true);
    });
  });

  describe('catalog sections coverage', () => {
    it('covers every channel-neutral section', () => {
      const sections = new Set<CommandSection>(CHANNEL_COMMAND_CATALOG.map((entry) => entry.section));

      expect([...sections].sort()).toEqual(
        [
          'entry',
          'execution',
          'monitoring',
          'permissions',
          'zavorthBridge',
          'skills',
          'search',
          'memory',
          'fun',
          'group_admin',
        ].sort(),
      );
    });

    it('derives the known command set from every catalog entry', () => {
      const commands = CHANNEL_COMMAND_CATALOG.map((entry) => entry.command);

      expect(KNOWN_COMMANDS.size).toBe(new Set(commands).size);
      expect(KNOWN_COMMANDS.has('/zavorth')).toBe(true);
    });
  });
});
