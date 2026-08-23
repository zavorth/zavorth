import { estimateVisibleMessageSize } from '../../src/channels/formatting/visibleMessageSize.js';

describe('visible message size estimator', () => {
  it('counts plain prose verbatim', () => {
    const text = 'Deploy finished with zero errors.';
    expect(estimateVisibleMessageSize(text)).toBe(text.length);
  });

  it('keeps fenced code bodies while counting the fence lines as visible overhead', () => {
    const text = ['```ts', 'const value = 1;', '```'].join('\n');
    // Rendered output still contains the fence markers, but the language
    // tag is syntax-only overhead and disappears from the visible size.
    expect(estimateVisibleMessageSize(text)).toBe(text.length - 'ts'.length);
  });

  it('drops emphasis, heading and blockquote markers that disappear when rendered', () => {
    expect(estimateVisibleMessageSize('**bold** and _italic_ and `code`')).toBe(
      'bold and italic and code'.length,
    );
    expect(estimateVisibleMessageSize('# Release notes\n> internal build')).toBe(
      'Release notes\ninternal build'.length,
    );
  });

  it('adds the link URL overhead to the label so link-heavy chunks stay within limits', () => {
    const label = 'build log';
    const url = 'https://example.test/very/long/path/to/artifact/index.html';
    expect(estimateVisibleMessageSize(`[${label}](${url})`)).toBe(label.length + url.length);
    expect(estimateVisibleMessageSize(`![chart](${url})`)).toBe('chart'.length + url.length);
  });

  it('expands table pipes into cell padding and collapses separator rows', () => {
    const table = ['| stage | status |', '| --- | --- |', '| build | ok |'].join('\n');
    const estimated = estimateVisibleMessageSize(table);
    expect(estimated).toBeGreaterThan(table.replace(/\|/g, '').length);
    expect(estimated).toBeLessThanOrEqual(table.length * 2);
  });
});
