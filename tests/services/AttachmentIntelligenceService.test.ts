import { AttachmentIntelligenceService } from '../../src/services/AttachmentIntelligenceService';

describe('AttachmentIntelligenceService', () => {
  it('profiles encoded token-like text without relying on prompt word lists', () => {
    const service = new AttachmentIntelligenceService();
    const encodedBlock = 'QvSxjZLRMQHD%2Bo2UQfv05oFK6Ev%2BsA%2B%2BKRbIMbVDbc8T6EJfayYIqAiXvvmlMJ03q%2FLxhcFz%2F6';

    const profile = service.profileTextAttachment({
      name: 'token.txt',
      type: 'text/plain',
      size: encodedBlock.length * 3,
      text: encodedBlock.repeat(3),
    });

    expect(profile.looksTokenLike).toBe(true);
    expect(profile.looksUrlEncoded).toBe(true);
    expect(profile.looksBase64Like).toBe(true);
    expect(profile.repeatedStructure).toBe(true);
    expect(profile.sensitivity).toBe('high');
    expect(profile.classification).toContain('URL-encoded');
    expect(profile.signals.join('\n')).toContain('URL encoding');
    expect(profile.signals.join('\n')).toContain('Base64');
  });

  it('renders a useful local fallback while avoiding raw sensitive dumps', () => {
    const service = new AttachmentIntelligenceService();
    const sensitiveText = 'QvSxjZLRMQHD%2Bo2UQfv05oFK6Ev%2BsA%2B%2BKRbIMbVDbc8T6EJfayYIqAiXvvmlMJ03q%2FLxhcFz%2F6'.repeat(4);
    const profile = service.profileTextAttachment({
      name: 'token.txt',
      type: 'text/plain',
      size: sensitiveText.length,
      text: sensitiveText,
    });

    const reply = service.renderLocalReply({
      message: 'o que tem nesse arquivo?',
      profiles: [profile],
    });

    expect(reply).toContain('texto com cara de token/codigo codificado');
    expect(reply).toContain('URL encoding');
    expect(reply).toContain('Base64');
    expect(reply).toContain('Por seguranca');
    expect(reply).not.toContain(sensitiveText);
  });
});
