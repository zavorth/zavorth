import { buildInlineDataFromAttachments } from '../../src/services/WebAppConversationInlineData';

function imageAttachment(index: number, overrides: Record<string, unknown> = {}) {
  return {
    name: `image-${index}.png`,
    type: 'image/png',
    content: `base64-${index}`,
    media: { kind: 'image', mimeType: 'image/png' },
    ...overrides,
  } as any;
}

describe('WebAppConversationInlineData', () => {
  it('returns an empty array when no attachments are available', () => {
    expect(buildInlineDataFromAttachments([])).toEqual([]);
  });

  it('returns every ready media entry when fewer than five are provided', () => {
    const inlineData = buildInlineDataFromAttachments([
      imageAttachment(0),
      imageAttachment(1),
      imageAttachment(2),
    ]);

    expect(inlineData).toHaveLength(3);
    expect(inlineData.map((entry) => entry.data)).toEqual(['base64-0', 'base64-1', 'base64-2']);
  });

  it('keeps exactly five ready media entries at the boundary', () => {
    const inlineData = buildInlineDataFromAttachments(
      Array.from({ length: 5 }, (_, index) => imageAttachment(index)),
    );

    expect(inlineData).toHaveLength(5);
    expect(inlineData.map((entry) => entry.data)).toEqual([
      'base64-0',
      'base64-1',
      'base64-2',
      'base64-3',
      'base64-4',
    ]);
  });

  it('skips attachments that are not ready media', () => {
    const inlineData = buildInlineDataFromAttachments([
      imageAttachment(0, { content: '' }),
      imageAttachment(1, { media: undefined, type: 'text/plain' }),
      imageAttachment(2),
    ]);

    expect(inlineData).toHaveLength(1);
    expect(inlineData[0]).toEqual({ mimeType: 'image/png', data: 'base64-2' });
  });

  it('limits attachment inline data to the first five ready media entries', () => {
    const attachments = Array.from({ length: 7 }, (_, index) => imageAttachment(index));

    const inlineData = buildInlineDataFromAttachments(attachments);

    expect(inlineData).toHaveLength(5);
    expect(inlineData.map((entry) => entry.data)).toEqual([
      'base64-0',
      'base64-1',
      'base64-2',
      'base64-3',
      'base64-4',
    ]);
  });
});
