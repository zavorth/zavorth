import { ChannelFormattingService } from '../../src/channels/formatting/ChannelFormattingService.js';

function repeatWord(word: string, times: number): string {
  return Array.from({ length: times }, () => word).join(' ');
}

describe('ChannelFormattingService', () => {
  it('resolves platform message limits', () => {
    expect(ChannelFormattingService.resolveMessageCharLimit('telegram')).toBe(4096);
    expect(ChannelFormattingService.resolveMessageCharLimit('discord')).toBe(2000);
    expect(ChannelFormattingService.resolveMessageCharLimit('slack')).toBe(4000);
    expect(ChannelFormattingService.resolveMessageCharLimit('signal')).toBe(4096);
  });

  it('keeps short messages as a single chunk', () => {
    const chunks = ChannelFormattingService.chunkMessageForPlatform('discord', 'hello world');
    expect(chunks).toEqual(['hello world']);
  });

  it('never exceeds the platform limit across chunks', () => {
    const longText = repeatWord('alpha', 1200);
    const chunks = ChannelFormattingService.chunkMessageForPlatform('discord', longText);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
    expect(chunks.join(' ')).toContain('alpha');
  });

  it('splits at paragraph boundaries before line boundaries', () => {
    const paragraph = 'a'.repeat(600);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const chunks = ChannelFormattingService.chunkMessage(text, 1400);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1400);
      expect(chunk.split('\n\n').every((part) => part.length <= 601)).toBe(true);
    }
  });

  it('does not split words when a paragraph overflows', () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`);
    const chunks = ChannelFormattingService.chunkMessage(words.join(' '), 800);
    const rejoined = chunks.join('\n').replace(/\n/g, ' ');
    for (const word of words) {
      expect(rejoined).toContain(word);
    }
  });

  it('re-wraps oversized fenced code blocks so every chunk stays renderable', () => {
    const codeLines = Array.from({ length: 200 }, (_, i) => `const value${i} = ${i};`).join('\n');
    const text = `before\n\n\`\`\`ts\n${codeLines}\n\`\`\`\n\nafter`;
    const chunks = ChannelFormattingService.chunkMessage(text, 900);
    expect(chunks.length).toBeGreaterThan(2);
    let openFences = 0;
    let closeFences = 0;
    for (const chunk of chunks) {
      if (chunk.includes('```')) {
        const fenceLines = chunk.split('\n').filter((line) => line.startsWith('```'));
        if (fenceLines.length >= 2) {
          openFences += 1;
          closeFences += 1;
          expect(chunk.startsWith('```')).toBe(true);
          expect(chunk.endsWith('```')).toBe(true);
        } else {
          expect(chunk.startsWith('before') || chunk.endsWith('after')).toBe(true);
        }
      }
    }
    expect(openFences).toBeGreaterThan(0);
    expect(closeFences).toBe(openFences);
  });

  it('keeps table rows intact while chunking a table-heavy message', () => {
    const header = '| colA | colB |';
    const separator = '| --- | --- |';
    const rows = Array.from({ length: 80 }, (_, i) => `| cell-${i}-aaaaaaaaaa | value-${i}-bbbbbb |`);
    const table = [header, separator, ...rows].join('\n');
    const chunks = ChannelFormattingService.chunkMessage(table, 700);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      for (const row of chunk.split('\n')) {
        expect(row.startsWith('|')).toBe(true);
        expect(row.endsWith('|')).toBe(true);
      }
    }
  });

  it('re-checks the rendered size before merging segments whose raw length fits', () => {
    // A pipe-heavy row renders wider than its raw length (each pipe becomes
    // cell padding), so the merged candidate fits the raw budget but would
    // render oversized on the platform.
    const prose = 'Deployment finished for all staging clusters.';
    const pipeRow = `|${'x|'.repeat(29)}x`;
    expect(pipeRow.length).toBe(60);
    const message = `${prose}\n\n${pipeRow}`;
    // Raw length (107) fits; rendered size of the whole message does not.
    const limit = 130;

    const chunks = ChannelFormattingService.chunkMessage(message, limit);

    expect(chunks.length).toBe(2);
    expect(chunks[0]?.trim()).toBe(prose);
    expect(chunks[1]).toBe(pipeRow);
  });
});
