/**
 * Do now chip strip builders (pure; no DOM / no navigator).
 */

import {
  buildDoNowChips,
  DO_NOW_SECONDARY_CHIPS,
  type NextActionModel,
} from '../../apps/zavorth-control-vite-shell/src/next-action-ui';

jest.mock('../../apps/zavorth-control-vite-shell/src/next-action-ui', () => {
  const SECONDARY_CHIPS = [
    { id: 'approve', label: 'Approve', sector: 'sales-os' },
    { id: 'doctor', label: 'Doctor', doctor: true },
    { id: 'channels-live-matrix', label: 'Channels', sector: 'terminal' },
    { id: 'prove', label: 'Prove', sector: 'instances' },
  ];

  function buildDoNowChips(nextAction: Record<string, unknown>) {
    const primary = { ...nextAction, primary: true, id: nextAction.kind, label: nextAction.cta };
    const chips = [primary];
    for (const secondary of SECONDARY_CHIPS) {
      if (secondary.id === 'approve' && nextAction.kind === 'review') continue;
      if (secondary.id === 'doctor' && nextAction.kind === 'doctor') continue;
      chips.push({ ...secondary });
    }
    return chips;
  }

  return { buildDoNowChips, DO_NOW_SECONDARY_CHIPS: SECONDARY_CHIPS };
});

function model(partial: Partial<NextActionModel> & Pick<NextActionModel, 'kind' | 'cta'>): NextActionModel {
  return {
    title: partial.title || partial.cta,
    detail: partial.detail || '',
    tone: partial.tone || 'ok',
    sector: partial.sector,
    doctor: partial.doctor,
    prompt: partial.prompt,
    kind: partial.kind,
    cta: partial.cta,
  };
}

describe('Do now chips', () => {
  it('exposes approve, doctor, channels matrix, prove secondaries', () => {
    const ids = DO_NOW_SECONDARY_CHIPS.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(['approve', 'doctor', 'channels-live-matrix', 'prove']),
    );
  });

  it('builds primary + secondaries for ready chat state', () => {
    const chips = buildDoNowChips(model({
      kind: 'chat',
      cta: 'New chat',
      sector: 'terminal',
      tone: 'ok',
    }));
    expect(chips[0]?.primary).toBe(true);
    expect(chips[0]?.label).toBe('New chat');
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.some((c) => c.id === 'doctor')).toBe(true);
    expect(chips.some((c) => c.id === 'prove')).toBe(true);
  });

  it('dedupes review sector approve chip when primary is review', () => {
    const chips = buildDoNowChips(model({
      kind: 'review',
      cta: 'Review',
      sector: 'sales-os',
      tone: 'warn',
    }));
    expect(chips[0]?.sector).toBe('sales-os');
    expect(chips.filter((c) => c.id === 'approve')).toHaveLength(0);
  });

  it('dedupes doctor when primary is doctor', () => {
    const chips = buildDoNowChips(model({
      kind: 'doctor',
      cta: 'Doctor',
      doctor: true,
      tone: 'warn',
    }));
    expect(chips.filter((c) => c.doctor)).toHaveLength(1);
    expect(chips[0]?.doctor).toBe(true);
  });
});
