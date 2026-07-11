import { describe, expect, it } from 'vitest';
import { buildCommandCenterItems, type CommandCenterInput } from '../src/command-center/commandCenter';

function baseInput(overrides: Partial<CommandCenterInput> = {}): CommandCenterInput {
  return {
    settingsGroups: [],
    ...overrides,
  };
}

describe('command center provider honesty', () => {
  it('never labels providers as Ready from catalog count alone', () => {
    const none = buildCommandCenterItems(baseInput());
    const noneItem = none.find(item => item.id === 'providers:add');
    expect(noneItem?.statusLabel).toBe('Needs setup');

    const catalog = buildCommandCenterItems(baseInput({ providerCount: 2 }));
    const catalogItem = catalog.find(item => item.id === 'providers:add');
    expect(catalogItem?.statusLabel).toBe('Catalog only');
    expect(catalogItem?.statusLabel).not.toMatch(/ready/i);
    expect(catalogItem?.subtitle).toMatch(/catalog/i);

    const live = buildCommandCenterItems(baseInput({ providerCount: 2, providerLiveCount: 1 }));
    const liveItem = live.find(item => item.id === 'providers:add');
    expect(liveItem?.statusLabel).toBe('Live');
    expect(liveItem?.subtitle).toMatch(/live/i);
  });

  it('hides MCP jargon actions for personal audience', () => {
    const personal = buildCommandCenterItems(baseInput({ audience: 'personal', mcpServerCount: 2 }));
    expect(personal.some((item) => item.id === 'mcp:trust')).toBe(false);

    const developer = buildCommandCenterItems(baseInput({ audience: 'developer', mcpServerCount: 2 }));
    expect(developer.some((item) => item.id === 'mcp:trust')).toBe(true);
  });
});
