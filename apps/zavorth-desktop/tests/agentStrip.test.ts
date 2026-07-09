import { describe, expect, it } from 'vitest';
import {
  agentStripVisible,
  buildAgentStrip,
  countActiveAgents,
  type AgentStripItem,
} from '../src/agents/agentStrip';

describe('buildAgentStrip', () => {
  it('returns empty for empty / invalid input', () => {
    expect(buildAgentStrip([])).toEqual([]);
    expect(buildAgentStrip([{ id: '' } as { id: string }])).toEqual([]);
    expect(buildAgentStrip([{ id: '   ' } as { id: string }])).toEqual([]);
  });

  it('maps name, role, typeName, task and status', () => {
    const items = buildAgentStrip([
      {
        id: 'a1',
        name: 'Scout',
        role: 'Researcher',
        typeName: 'research',
        status: 'running',
        task: 'Find TODOs',
      },
    ]);
    expect(items).toEqual([
      {
        id: 'a1',
        label: 'Scout',
        role: 'Researcher',
        status: 'running',
        task: 'Find TODOs',
      },
    ]);
  });

  it('falls back label and role when fields missing', () => {
    const items = buildAgentStrip([
      { id: 'x1', typeName: 'coder' },
      { id: 'x2', role: 'Reviewer' },
      { id: 'x3' },
    ]);
    expect(items[0]).toMatchObject({ id: 'x1', label: 'coder', role: 'coder', status: 'idle' });
    expect(items[1]).toMatchObject({ id: 'x2', label: 'Reviewer', role: 'Reviewer' });
    expect(items[2]).toMatchObject({ id: 'x3', label: 'x3', role: 'agent' });
  });

  it('normalizes status aliases and busy flag', () => {
    const items = buildAgentStrip([
      { id: '1', status: 'completed' },
      { id: '2', status: 'failed' },
      { id: '3', status: 'blocked' },
      { id: '4', status: 'queued' },
      { id: '5', status: 'idle', busy: true },
      { id: '6', status: 'active' },
      { id: '7', status: 'success' },
      { id: '8', status: 'waiting' },
      { id: '9', status: 'error' },
    ]);
    expect(items.map((i) => i.status)).toEqual([
      'done',
      'error',
      'blocked',
      'running',
      'running',
      'running',
      'done',
      'blocked',
      'error',
    ]);
  });

  it('omits empty task', () => {
    const items = buildAgentStrip([{ id: 't1', task: '  ' }]);
    expect(items[0].task).toBeUndefined();
  });

  it('preserves multiple agents order', () => {
    const items = buildAgentStrip([
      { id: 'first', name: 'A' },
      { id: 'second', name: 'B' },
      { id: 'third', name: 'C' },
    ]);
    expect(items.map((i) => i.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('agentStripVisible', () => {
  it('is false for empty and true when items exist', () => {
    expect(agentStripVisible([])).toBe(false);
    expect(
      agentStripVisible([{ id: '1', label: 'A', role: 'r', status: 'idle' }]),
    ).toBe(true);
  });
});

describe('countActiveAgents', () => {
  it('counts running and blocked only', () => {
    const items: AgentStripItem[] = [
      { id: '1', label: 'a', role: 'r', status: 'idle' },
      { id: '2', label: 'b', role: 'r', status: 'running' },
      { id: '3', label: 'c', role: 'r', status: 'blocked' },
      { id: '4', label: 'd', role: 'r', status: 'done' },
      { id: '5', label: 'e', role: 'r', status: 'error' },
    ];
    expect(countActiveAgents(items)).toBe(2);
    expect(countActiveAgents([])).toBe(0);
  });

  it('works after buildAgentStrip', () => {
    const strip = buildAgentStrip([
      { id: '1', status: 'running' },
      { id: '2', status: 'blocked' },
      { id: '3', status: 'done' },
    ]);
    expect(agentStripVisible(strip)).toBe(true);
    expect(countActiveAgents(strip)).toBe(2);
  });
});
