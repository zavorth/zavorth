import { describe, expect, it } from 'vitest';
import { isReceiptFooter, parseReceiptSummary } from '../src/thread/receiptSummary';

const RENDERER_FOOTER = [
  'I need your confirmation to continue safely.',
  'Nothing has been executed yet. Review the request and approve if you want to proceed.',
  '',
  'Zavorth',
  '- approval: waiting for your decision',
].join('\n');

describe('isReceiptFooter', () => {
  it('accepts approval, run, and replay lines', () => {
    expect(isReceiptFooter(['- approval: abc'])).toBe(true);
    expect(isReceiptFooter(['- run: run-123'])).toBe(true);
    expect(isReceiptFooter(['- replay: zavorth ask hi'])).toBe(true);
  });

  it('rejects ordinary list items', () => {
    expect(isReceiptFooter(['- milk', '- eggs'])).toBe(false);
    expect(isReceiptFooter([])).toBe(false);
  });
});

describe('parseReceiptSummary', () => {
  it('splits the plain summary from collapsed technical lines', () => {
    const parsed = parseReceiptSummary(RENDERER_FOOTER);
    expect(parsed).not.toBeNull();
    expect(parsed!.summary).toBe(
      'I need your confirmation to continue safely.\nNothing has been executed yet. Review the request and approve if you want to proceed.',
    );
    expect(parsed!.technicalLines).toEqual(['- approval: waiting for your decision']);
  });

  it('keeps every technical line when operator details are present', () => {
    const content = [
      'Mission complete.',
      '',
      'Zavorth',
      '- approval: ap-1 (approved)',
      '- run: 4f7c2b1e-9d0a-4c1f-b2a3-56f7e8d9c0ab (success)',
      '- replay: zavorth ask "deploy"',
    ].join('\n');
    const parsed = parseReceiptSummary(content)!;
    expect(parsed.summary).toBe('Mission complete.');
    expect(parsed.technicalLines).toHaveLength(3);
    expect(parsed.technicalLines[1]).toContain('4f7c2b1e');
  });

  it('returns null for prose without a receipt footer', () => {
    expect(parseReceiptSummary('Just a normal answer with - approval: nowhere')).toBeNull();
    expect(parseReceiptSummary('')).toBeNull();
    expect(parseReceiptSummary(null)).toBeNull();
  });

  it('returns null when only technical lines exist without a summary', () => {
    expect(parseReceiptSummary('- approval: abc')).toBeNull();
  });
});
