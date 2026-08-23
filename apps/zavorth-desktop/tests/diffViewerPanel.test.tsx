import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiffViewerPanel, buildDiffViewerRows, classifyDiffLine } from '../src/thread/DiffViewerPanel';

const MODIFIED_DIFF = [
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -10,4 +10,5 @@ heading',
  ' keep me',
  '-old text',
  '+new text',
].join('\n');

const LONG_DIFF = [
  '--- a/big.ts',
  '+++ b/big.ts',
  '@@ -1,40 +1,41 @@',
  ...Array.from({ length: 40 }, (_, i) => `+line ${i}`),
].join('\n');

describe('classifyDiffLine', () => {
  it('maps diff markers to colorized tones', () => {
    expect(classifyDiffLine('+added')).toBe('add');
    expect(classifyDiffLine('-removed')).toBe('remove');
    expect(classifyDiffLine('@@ -1 +1 @@')).toBe('meta');
    expect(classifyDiffLine('plain')).toBe('context');
  });
});

describe('buildDiffViewerRows', () => {
  it('flattens hunk headers and bodies into tone-tagged rows', () => {
    const { rows, total, truncated } = buildDiffViewerRows(MODIFIED_DIFF);
    expect(truncated).toBe(0);
    expect(total).toBe(rows.length);
    expect(rows.map((row) => row.tone)).toEqual([
      'meta',
      'context',
      'remove',
      'add',
    ]);
    expect(rows[0].text).toBe('@@ -10,4 +10,5 @@ heading');
  });

  it('truncates long files to maxLines and reports the remainder', () => {
    const { rows, total, truncated } = buildDiffViewerRows(LONG_DIFF, 8);
    expect(rows).toHaveLength(8);
    expect(total).toBe(41);
    expect(truncated).toBe(33);
  });

  it('returns no rows for non-diff input', () => {
    expect(buildDiffViewerRows('not a diff at all').rows).toEqual([]);
  });
});

describe('DiffViewerPanel rendering', () => {
  it('renders add/remove/context rows with distinct tone classes', () => {
    const html = renderToStaticMarkup(<DiffViewerPanel diffText={MODIFIED_DIFF} compact />);
    expect(html).toContain('zvd-diff-viewer');
    expect(html).toContain('is-remove">-old text');
    expect(html).toContain('is-add">+new text');
    expect(html).toContain('is-context"> keep me');
    expect(html).toContain('is-meta">@@');
  });

  it('marks truncation for long diffs without rendering every line', () => {
    const html = renderToStaticMarkup(<DiffViewerPanel diffText={LONG_DIFF} maxLines={6} />);
    expect(html).toContain('data-truncated="true"');
    expect(html).not.toContain('+line 39');
    expect(html).toMatch(/zvd-diff-viewer__limit/);
  });

  it('renders nothing when the input has no hunks', () => {
    const html = renderToStaticMarkup(<DiffViewerPanel diffText="plain text reply" />);
    expect(html).toBe('');
  });
});
