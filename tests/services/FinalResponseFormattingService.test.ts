import { FinalResponseFormattingService } from '../../src/services/FinalResponseFormattingService';

describe('FinalResponseFormattingService', () => {
  it('formats file previews with a friendlier intro and section title', () => {
    const service = new FinalResponseFormattingService();
    const text = service.formatFilePreview('Encontrei o arquivo index.html', 'index.html');

    expect(text).toContain('Envio pronto');
    expect(text).toContain('Ja deixei este arquivo preparado para envio.');
    expect(text).toContain('Arquivo: index.html');
    expect(text).toContain('Resumo rapido:');
    expect(text).toContain('Encontrei o arquivo index.html');
  });
});
