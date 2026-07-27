import { readFileSync } from 'fs';
import { join } from 'path';

describe('Zavorth Control local asset boundary', () => {
  it('bundles Markdown, highlighting and fonts without public CDN dependencies', () => {
    const html = readFileSync(join(process.cwd(), 'apps', 'zavorth-control-vite-shell', 'index.html'), 'utf8');
    const assets = readFileSync(
      join(process.cwd(), 'src', 'ai-gateway', 'app', '(zavorthControl)', 'control', 'ControlPageAssets.tsx'),
      'utf8',
    );
    for (const source of [html, assets]) {
      expect(source).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|cdnjs\.cloudflare/iu);
      expect(source).not.toMatch(/marked\.min\.js|prism(?:-[a-z]+)?\.min\.js/iu);
    }
  });

  it('renders the Next shell without raw HTML injection', () => {
    const shell = readFileSync(
      join(process.cwd(), 'src', 'ai-gateway', 'app', '(zavorthControl)', 'control', 'LegacyZavorthControlShell.tsx'),
      'utf8',
    );
    expect(shell).not.toContain('dangerouslySetInnerHTML');
    expect(shell).not.toContain('HtmlFragment');
  });

  it('does not expose a synthetic inbound action in the runtime bridge', () => {
    const bridge = readFileSync(
      join(process.cwd(), 'apps', 'zavorth-control-vite-shell', 'src', 'runtime-bridge.ts'),
      'utf8',
    );
    expect(bridge).not.toContain("provider: 'stub'");
    expect(bridge).not.toContain('sendSalesPackDemoInbound');
    expect(bridge).not.toContain("data-sales-os-action') !== 'demo-inbound'");
  });
});
