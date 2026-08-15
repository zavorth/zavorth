import { readFileSync } from 'fs';
import { join, resolve } from 'path';


describe('Zavorth Control local asset boundary', () => {
  it('documents the current CDN dependency surface for the control shell', () => {
    const html = readFileSync(resolve(__dirname, '../../../apps', 'zavorth-control-vite-shell', 'index.html'), 'utf8');
    const assets = readFileSync(
      resolve(__dirname, '../../../src', 'ai-gateway', 'app', '(zavorthControl)', 'control', 'ControlPageAssets.tsx'),
      'utf8',
    );
    const fontsMatch = /fonts\.googleapis|fonts\.gstatic/iu;
    const prismMatch = /prism(?:-[a-z]+)?\.min\.(?:js|css)/iu;
    const markedMatch = /marked\.min\.js/iu;
    const jsdelivrMatch = /cdn\.jsdelivr/iu;
    const cloudflareMatch = /cdnjs\.cloudflare/iu;

    expect(html).toMatch(fontsMatch);
    expect(html).toMatch(prismMatch);
    expect(html).toMatch(markedMatch);
    expect(html).toMatch(cloudflareMatch);
    expect(html).toMatch(jsdelivrMatch);

    expect(assets).toMatch(fontsMatch);
    expect(assets).toMatch(prismMatch);
    expect(assets).toMatch(markedMatch);
    expect(assets).toMatch(cloudflareMatch);
    expect(assets).toMatch(jsdelivrMatch);
  });

  it('renders the Next shell with explicit HTML injection surfaces for legacy overlays', () => {
    const shell = readFileSync(
      resolve(__dirname, '../../../src', 'ai-gateway', 'app', '(zavorthControl)', 'control', 'LegacyZavorthControlShell.tsx'),
      'utf8',
    );
    const assets = readFileSync(
      resolve(__dirname, '../../../src', 'ai-gateway', 'app', '(zavorthControl)', 'control', 'ControlPageAssets.tsx'),
      'utf8',
    );
    expect(shell).toContain('HtmlFragment');
    expect(shell).toContain('dangerouslySetInnerHTML');
    expect(assets).toContain('dangerouslySetInnerHTML');
  });

  it('exposes the sales pack demo inbound action through the runtime bridge', () => {
    const bridge = readFileSync(
      resolve(__dirname, '../../../apps', 'zavorth-control-vite-shell', 'src', 'runtime-bridge.ts'),
      'utf8',
    );
    expect(bridge).toContain('sendSalesPackDemoInbound');
    expect(bridge).toContain("data-sales-os-action') !== 'demo-inbound'");
    expect(bridge).not.toContain("provider: 'stub'");
  });
});
