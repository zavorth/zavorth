import { describe, expect, it } from 'vitest';
import {
  buildSettingsModules,
  personalSettingsHidesJargon,
} from '../src/settings/settingsModules';

describe('V11 personal settings jargon', () => {
  it('hides Runtime Doctor and MCP for personal audience', () => {
    const groups = buildSettingsModules({
      runtimeRunning: true,
      audience: 'personal',
      providerCount: 1,
      mcpServerCount: 2,
      trustedMcpServerCount: 1,
    });
    expect(personalSettingsHidesJargon(groups)).toBe(true);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label)).join(' | ');
    expect(labels).not.toMatch(/Runtime Doctor/i);
    expect(labels).not.toMatch(/Policy Broker/i);
    expect(labels).not.toMatch(/MCP Servers/i);
    expect(labels).toMatch(/Something wrong\...|AI models|Safety|Privacy/i);
  });

  it('keeps operator modules for developer audience', () => {
    const groups = buildSettingsModules({
      runtimeRunning: true,
      audience: 'developer',
      mcpServerCount: 1,
      trustedMcpServerCount: 1,
    });
    const flat = groups.flatMap((group) => group.items);
    expect(flat.some((item) => item.id === 'doctor')).toBe(true);
    expect(flat.some((item) => item.id === 'mcp')).toBe(true);
    expect(personalSettingsHidesJargon(groups)).toBe(false);
  });
});
