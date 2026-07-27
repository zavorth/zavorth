import { FinalResponseFormattingService } from '../../src/services/FinalResponseFormattingService';

describe('FinalResponseFormattingService', () => {
  it('formats file previews with a friendlier intro and section title', () => {
    const service = new FinalResponseFormattingService();
    const text = service.formatFilePreview('Encontrei o file index.html', 'index.html');

    expect(text).toContain('Envio ready');
    expect(text).toContain('I have prepared this file for delivery.');
    expect(text).toContain('File: index.html');
    expect(text).toContain('Resumo rapido:');
    expect(text).toContain('Encontrei o file index.html');
  });
});
