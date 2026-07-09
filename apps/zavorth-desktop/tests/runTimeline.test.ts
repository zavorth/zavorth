import { describe, expect, it } from 'vitest';
import {
  buildRunTimeline,
  filterTimeline,
  timelineSummary,
  type TimelineItem,
} from '../src/thread/runTimeline';

describe('buildRunTimeline', () => {
  it('returns empty list for empty input', () => {
    expect(buildRunTimeline({})).toEqual([]);
    expect(buildRunTimeline({ messages: [], approvals: [], receipts: [], agents: [] })).toEqual([]);
  });

  it('maps user/assistant messages and tool role as tools', () => {
    const items = buildRunTimeline({
      now: 1_000,
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', createdAt: 100 },
        { id: 'm2', role: 'assistant', content: 'Hi there', createdAt: 200 },
        { id: 'm3', role: 'tool', title: 'read_file', content: 'ok', createdAt: 150 },
      ],
    });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.kind)).toEqual(['message', 'tool', 'message']);
    expect(items[0].id).toBe('message:m1');
    expect(items[1].id).toBe('tool:m3');
    expect(items[1].title).toBe('read_file');
    expect(items[1].status).toBe('success');
    expect(items[2].id).toBe('message:m2');
  });

  it('sorts by at ascending with stable id tie-break', () => {
    const items = buildRunTimeline({
      now: 0,
      messages: [{ id: 'z', role: 'user', content: 'z', createdAt: 50 }],
      approvals: [{ id: 'a1', title: 'Write', status: 'pending', createdAt: 50 }],
      receipts: [{ id: 'r1', action: 'Applied', at: 10 }],
    });
    expect(items.map((i) => i.id)).toEqual(['receipt:r1', 'approval:a1', 'message:z']);
  });

  it('includes approvals with status normalization', () => {
    const items = buildRunTimeline({
      now: 500,
      approvals: [
        {
          id: 'ap1',
          title: 'Host command',
          action: 'run',
          summary: 'ls -la',
          risk: 'high',
          status: 'approve',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          title: 'Write file',
          status: 'reject',
          createdAt: 200,
        },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('approval');
    expect(items[0].status).toBe('rejected');
    expect(items[1].status).toBe('approved');
    expect(items[1].meta?.risk).toBe('high');
    expect(items[0].id).toMatch(/^approval:/);
  });

  it('includes receipts and agents', () => {
    const items = buildRunTimeline({
      now: 1000,
      receipts: [
        { id: 'rc1', action: 'Memory saved', status: 'ok', at: 100, summary: 'fact' },
        { action: 'Bare receipt', status: 'failed', at: 200 },
      ],
      agents: [
        { id: 'ag1', role: 'Researcher', status: 'running', task: 'Scan deps' },
        { id: 'ag2', role: 'Auditor', status: 'completed' },
      ],
    });
    const kinds = items.map((i) => i.kind);
    expect(kinds.filter((k) => k === 'receipt')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'agent')).toHaveLength(2);
    const researcher = items.find((i) => i.id === 'agent:ag1')!;
    expect(researcher.title).toBe('Researcher');
    expect(researcher.detail).toMatch(/Scan deps/);
    expect(researcher.status).toBe('running');
    const auditor = items.find((i) => i.id === 'agent:ag2')!;
    expect(auditor.status).toBe('success');
    const okReceipt = items.find((i) => i.id === 'receipt:rc1')!;
    expect(okReceipt.status).toBe('success');
  });

  it('uses ISO createdAt and falls back to now', () => {
    const items = buildRunTimeline({
      now: 9_999,
      messages: [{ id: 'x', role: 'user', content: 'no date' }],
    });
    expect(items[0].at).toBe(9_999);
  });

  it('uses content as title fallback when title missing', () => {
    const items = buildRunTimeline({
      now: 1,
      messages: [{ id: 'c', role: 'assistant', content: 'Short answer' }],
    });
    expect(items[0].title).toBe('Short answer');
  });
});

describe('filterTimeline', () => {
  const sample: TimelineItem[] = [
    { id: '1', kind: 'tool', at: 1, title: 't' },
    { id: '2', kind: 'approval', at: 2, title: 'a' },
    { id: '3', kind: 'receipt', at: 3, title: 'r' },
    { id: '4', kind: 'message', at: 4, title: 'm' },
    { id: '5', kind: 'agent', at: 5, title: 'g' },
  ];

  it('returns a copy when kinds omitted or empty', () => {
    expect(filterTimeline(sample)).toEqual(sample);
    expect(filterTimeline(sample)).not.toBe(sample);
    expect(filterTimeline(sample, [])).toEqual(sample);
  });

  it('filters to selected kinds', () => {
    expect(filterTimeline(sample, ['tool', 'agent']).map((i) => i.kind)).toEqual([
      'tool',
      'agent',
    ]);
    expect(filterTimeline(sample, ['message'])).toHaveLength(1);
  });
});

describe('timelineSummary', () => {
  it('counts tools approvals receipts agents (not messages)', () => {
    const items = buildRunTimeline({
      now: 0,
      messages: [
        { id: '1', role: 'user', content: 'hi', createdAt: 1 },
        { id: '2', role: 'tool', title: 'fs', createdAt: 2 },
      ],
      approvals: [{ id: 'a', title: 'x', createdAt: 3 }],
      receipts: [{ id: 'r', action: 'y', at: 4 }],
      agents: [{ id: 'g', role: 'worker' }],
    });
    expect(timelineSummary(items)).toEqual({
      tools: 1,
      approvals: 1,
      receipts: 1,
      agents: 1,
    });
  });

  it('returns zeros for empty', () => {
    expect(timelineSummary([])).toEqual({
      tools: 0,
      approvals: 0,
      receipts: 0,
      agents: 0,
    });
  });
});
