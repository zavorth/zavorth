import { describe, expect, it } from 'vitest';
import {
  createTerminalTab,
  addTerminalTab,
  removeTerminalTab,
  renameTerminalTab,
  setAgentActivity,
  pickActiveTab,
  ensureDefaultTabs,
  type TerminalTab,
} from '../src/shell/terminalTabs';

function tab(
  partial: Partial<TerminalTab> & { id: string; kind: TerminalTab['kind'] },
): TerminalTab {
  return createTerminalTab(partial);
}

describe('createTerminalTab', () => {
  it('applies kind defaults for title and sessionKey', () => {
    const shell = createTerminalTab({ kind: 'shell', id: 't1' });
    expect(shell).toEqual({
      id: 't1',
      title: 'Shell',
      kind: 'shell',
      sessionKey: 'shell:t1',
    });

    const agent = createTerminalTab({ kind: 'agent', id: 't2', agentActive: true });
    expect(agent.title).toBe('Agent');
    expect(agent.sessionKey).toBe('agent:t2');
    expect(agent.agentActive).toBe(true);

    const logs = createTerminalTab({ kind: 'logs', id: 't3' });
    expect(logs.title).toBe('Logs');
  });

  it('respects explicit title and sessionKey', () => {
    const t = createTerminalTab({
      kind: 'shell',
      id: 'x',
      title: '  Custom  ',
      sessionKey: 'custom-key',
    });
    expect(t.title).toBe('Custom');
    expect(t.sessionKey).toBe('custom-key');
  });

  it('generates id when omitted', () => {
    const t = createTerminalTab({ kind: 'shell' });
    expect(t.id).toBeTruthy();
    expect(t.sessionKey).toContain(t.id);
  });
});

describe('addTerminalTab', () => {
  it('appends tabs', () => {
    const a = tab({ id: 'a', kind: 'shell' });
    const b = tab({ id: 'b', kind: 'agent' });
    expect(addTerminalTab([a], b).map(t => t.id)).toEqual(['a', 'b']);
  });

  it('replaces existing id in place', () => {
    const a = tab({ id: 'a', kind: 'shell', title: 'Old' });
    const next = addTerminalTab([a], tab({ id: 'a', kind: 'shell', title: 'New' }));
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe('New');
  });

  it('enforces max tabs by dropping oldest (default 8)', () => {
    let tabs: TerminalTab[] = [];
    for (let i = 0; i < 8; i += 1) {
      tabs = addTerminalTab(tabs, tab({ id: `t${i}`, kind: 'shell' }));
    }
    expect(tabs).toHaveLength(8);
    tabs = addTerminalTab(tabs, tab({ id: 't8', kind: 'shell' }));
    expect(tabs).toHaveLength(8);
    expect(tabs[0].id).toBe('t1');
    expect(tabs[7].id).toBe('t8');
  });

  it('respects custom maxTabs', () => {
    const tabs = addTerminalTab(
      [tab({ id: 'a', kind: 'shell' }), tab({ id: 'b', kind: 'shell' })],
      tab({ id: 'c', kind: 'shell' }),
      2,
    );
    expect(tabs.map(t => t.id)).toEqual(['b', 'c']);
  });
});

describe('removeTerminalTab', () => {
  const tabs = [
    tab({ id: 'a', kind: 'shell' }),
    tab({ id: 'b', kind: 'agent' }),
    tab({ id: 'c', kind: 'logs' }),
  ];

  it('removes and picks next neighbor as active', () => {
    const mid = removeTerminalTab(tabs, 'b');
    expect(mid.tabs.map(t => t.id)).toEqual(['a', 'c']);
    expect(mid.nextActiveId).toBe('c');

    const first = removeTerminalTab(tabs, 'a');
    expect(first.tabs.map(t => t.id)).toEqual(['b', 'c']);
    expect(first.nextActiveId).toBe('b');

    const last = removeTerminalTab(tabs, 'c');
    expect(last.tabs.map(t => t.id)).toEqual(['a', 'b']);
    expect(last.nextActiveId).toBe('b');
  });

  it('returns null active when last tab removed', () => {
    const result = removeTerminalTab([tab({ id: 'only', kind: 'shell' })], 'only');
    expect(result.tabs).toEqual([]);
    expect(result.nextActiveId).toBeNull();
  });

  it('handles unknown id without changing list', () => {
    const result = removeTerminalTab(tabs, 'missing');
    expect(result.tabs.map(t => t.id)).toEqual(['a', 'b', 'c']);
    expect(result.nextActiveId).toBe('a');
  });
});

describe('renameTerminalTab / setAgentActivity', () => {
  it('renames by id immutably', () => {
    const tabs = [tab({ id: 'a', kind: 'shell', title: 'Shell' })];
    const next = renameTerminalTab(tabs, 'a', '  Build  ');
    expect(next[0].title).toBe('Build');
    expect(tabs[0].title).toBe('Shell');
  });

  it('ignores blank rename', () => {
    const tabs = [tab({ id: 'a', kind: 'shell', title: 'Shell' })];
    expect(renameTerminalTab(tabs, 'a', '   ')[0].title).toBe('Shell');
  });

  it('sets agent activity flag', () => {
    const tabs = [tab({ id: 'a', kind: 'agent', agentActive: false })];
    const next = setAgentActivity(tabs, 'a', true);
    expect(next[0].agentActive).toBe(true);
    expect(setAgentActivity(next, 'a', false)[0].agentActive).toBe(false);
  });
});

describe('pickActiveTab', () => {
  const tabs = [
    tab({ id: 'a', kind: 'shell' }),
    tab({ id: 'b', kind: 'agent' }),
  ];

  it('returns matching tab', () => {
    expect(pickActiveTab(tabs, 'b')?.id).toBe('b');
  });

  it('falls back to first when id missing or null', () => {
    expect(pickActiveTab(tabs, null)?.id).toBe('a');
    expect(pickActiveTab(tabs, 'nope')?.id).toBe('a');
  });

  it('returns null for empty list', () => {
    expect(pickActiveTab([], 'a')).toBeNull();
    expect(pickActiveTab([], null)).toBeNull();
  });
});

describe('ensureDefaultTabs', () => {
  it('returns shell + agent tabs for workspace', () => {
    const tabs = ensureDefaultTabs('folder:C:/proj');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].kind).toBe('shell');
    expect(tabs[1].kind).toBe('agent');
    expect(tabs[0].title).toBe('Shell');
    expect(tabs[1].title).toBe('Agent');
    expect(tabs[0].sessionKey).toContain('shell:');
    expect(tabs[1].sessionKey).toContain('agent:');
    expect(tabs[0].id).not.toBe(tabs[1].id);
    expect(tabs[1].agentActive).toBe(false);
  });

  it('sanitizes workspace id in keys', () => {
    const tabs = ensureDefaultTabs('path with spaces//..');
    expect(tabs[0].id.startsWith('shell-')).toBe(true);
    expect(tabs[0].id).not.toMatch(/\s/);
  });

  it('handles empty workspace id', () => {
    const tabs = ensureDefaultTabs('');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].sessionKey).toMatch(/^shell:/);
  });
});
