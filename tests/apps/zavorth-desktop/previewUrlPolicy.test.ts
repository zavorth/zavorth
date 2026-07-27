import {
  normalizeExternalBrowserUrl,
  normalizeLocalPreviewUrl,
} from './mocks/previewUrlPolicy';

describe('desktop preview URL policy', () => {
  it('allows HTTP localhost previews and blocks remote or credentialed embeds', () => {
    expect(normalizeLocalPreviewUrl('localhost:3000', 'http://localhost:5173')).toBe('http://localhost:3000/');
    expect(normalizeLocalPreviewUrl('http://127.0.0.1:8080/app', 'http://localhost:5173')).toBe('http://127.0.0.1:8080/app');
    expect(normalizeLocalPreviewUrl('https://example.com', 'http://localhost:5173')).toBeNull();
    expect(normalizeLocalPreviewUrl('http://user:pass@localhost:3000', 'http://localhost:5173')).toBeNull();
    expect(normalizeLocalPreviewUrl('javascript:alert(1)', 'http://localhost:5173')).toBeNull();
  });

  it('allows only HTTP(S) URLs for the operating-system browser handoff', () => {
    expect(normalizeExternalBrowserUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeExternalBrowserUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeExternalBrowserUrl('zavorth://pair?code=secret')).toBeNull();
  });
});
