import { ZavorthPresentationAdapterService } from '../../../src/services/ZavorthPresentationAdapterService.js';

describe('ZavorthPresentationAdapterService.adaptMarkdownForChannel', () => {
  const service = new ZavorthPresentationAdapterService();

  it('converts markdown tables to lists for discord', () => {
    const input = [
      '| Name | Value |',
      '| --- | --- |',
      '| alpha | 1 |',
      '| beta | 2 |',
      '',
      'See https://example.com/docs',
    ].join('\n');

    const out = service.adaptMarkdownForChannel(input, 'discord');
    expect(out).not.toContain('| --- |');
    expect(out).toContain('- Name: alpha · Value: 1');
    expect(out).toContain('<https://example.com/docs>');
  });

  it('shortens long code blocks for whatsapp', () => {
    const code = Array.from({ length: 20 }, (_, i) => `line-${i}`).join('\n');
    const input = `before\n\`\`\`ts\n${code}\n\`\`\`\nafter`;
    const out = service.adaptMarkdownForChannel(input, 'whatsapp');
    expect(out).toContain('more lines');
    expect(out).toContain('line-0');
    expect(out).not.toContain('line-19');
  });

  it('keeps richer markdown for web/telegram short tables', () => {
    const input = '| a | b |\n| - | - |\n| 1 | 2 |';
    const web = service.adaptMarkdownForChannel(input, 'web');
    // web is not special-cased → tables remain
    expect(web).toContain('| a | b |');
  });
});
