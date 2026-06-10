import { buildInlineDataFromAttachments } from '../../src/services/WebAppConversationInlineData';

describe('WebAppConversationInlineData', () => {
  it('limits attachment inline data to the first five ready media entries', () => {
    const attachments = Array.from({ length: 7 }, (_, index) => ({
      name: `image-${index}.png`,
      type: 'image/png',
      content: `base64-${index}`,
      media: { kind: 'image', mimeType: 'image/png' },
    } as any));

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
