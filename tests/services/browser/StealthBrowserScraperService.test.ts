import { StealthBrowserScraperService } from '../../../src/services/browser/StealthBrowserScraperService.js';

describe('StealthBrowserScraperService', () => {
  it('should generate valid anti-detection headers for different platforms', () => {
    const winHeaders = StealthBrowserScraperService.generateStealthHeaders('windows');
    expect(winHeaders['User-Agent']).toContain('Windows NT 10.0');
    expect(winHeaders['Sec-Ch-Ua-Platform']).toBe('"Windows"');
    expect(winHeaders['Sec-Fetch-Dest']).toBe('document');

    const macHeaders = StealthBrowserScraperService.generateStealthHeaders('mac');
    expect(macHeaders['User-Agent']).toContain('Macintosh');
    expect(macHeaders['Sec-Ch-Ua-Platform']).toBe('"macOS"');

    const linuxHeaders = StealthBrowserScraperService.generateStealthHeaders('linux');
    expect(linuxHeaders['User-Agent']).toContain('Linux x86_64');
    expect(linuxHeaders['Sec-Ch-Ua-Platform']).toBe('"Linux"');
  });

  it('should extract title from HTML', () => {
    const html = '<html><head><title>Zavorth Documentation & Guide</title></head><body><h1>Welcome</h1></body></html>';
    const title = StealthBrowserScraperService.extractTitle(html);
    expect(title).toBe('Zavorth Documentation & Guide');
  });

  it('should extract clean, readable markdown from HTML without tags or scripts', () => {
    const html = `
      <html>
        <head><title>Test Page</title><style>body { color: red; }</style></head>
        <body>
          <script>console.log("bad script");</script>
          <h1>Main Title</h1>
          <p>This is a paragraph with <a href="https://example.com">a link</a> and <code>inline code</code>.</p>
          <pre><code>const x = 42;</code></pre>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </body>
      </html>
    `;

    const markdown = StealthBrowserScraperService.extractReadableMarkdown(html);
    expect(markdown).toContain('# Main Title');
    expect(markdown).toContain('[a link](https://example.com)');
    expect(markdown).toContain('`inline code`');
    expect(markdown).toContain('const x = 42;');
    expect(markdown).toContain('* Item 1');
    expect(markdown).not.toContain('<script>');
    expect(markdown).not.toContain('console.log');
    expect(markdown).not.toContain('<style>');
  });

  it('should block SSRF requests to private IP ranges via EgressNetPolicyGuard', async () => {
    await expect(
      StealthBrowserScraperService.scrape('http://169.254.169.254/latest/meta-data')
    ).rejects.toThrow(/Blocked by security policy/);
  });
});
