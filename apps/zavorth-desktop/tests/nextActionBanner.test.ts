import { describe, expect, it } from 'vitest';
import { resolveNextAction } from '../src/components/NextActionBanner';
import { t } from '../src/i18n';

describe('NextActionBanner resolveNextAction', () => {
  it('uses honest pending-approval copy (no false open-proof claim)', () => {
    const onOpenReview = () => undefined;
    const one = resolveNextAction({
      approvalsCount: 1,
      onOpenReview,
      language: 'en',
    });
    expect(one).toMatchObject({
      title: t('nextAction.oneApproval', 'en'),
      cta: t('nextAction.review', 'en'),
      tone: 'warn',
    });
    expect(one?.title.toLowerCase()).not.toContain('proof');

    const many = resolveNextAction({
      approvalsCount: 3,
      onOpenReview,
      language: 'en',
    });
    expect(many?.title).toBe(t('nextAction.nApprovals', 'en').replace('{n}', '3'));
  });

  it('localizes approval copy for pt without leftover placeholders', () => {
    const model = resolveNextAction({
      approvalsCount: 2,
      onOpenReview: () => undefined,
      language: 'pt',
    });
    expect(model?.title).toBe(t('nextAction.nApprovals', 'pt').replace('{n}', '2'));
    expect(model?.title).not.toMatch(/\{n\}|\{base\}/);
    expect(model?.cta).toBe(t('nextAction.review', 'pt'));
  });

  it('ignores non-positive approval counts and shows busy only when chat handler exists', () => {
    expect(resolveNextAction({
      approvalsCount: 0,
      busy: true,
      onOpenReview: () => undefined,
    })).toBeNull();

    const busy = resolveNextAction({
      approvalsCount: 0,
      busy: true,
      onOpenReview: () => undefined,
      onOpenChat: () => undefined,
      language: 'en',
    });
    expect(busy?.title).toBe(t('nextAction.taskRunning', 'en'));
  });

  it('treats fractional/denytive counts as non-pending', () => {
    expect(resolveNextAction({
      approvalsCount: -2,
      onOpenReview: () => undefined,
    })).toBeNull();
    expect(resolveNextAction({
      approvalsCount: 0.4,
      onOpenReview: () => undefined,
    })).toBeNull();
  });
});
