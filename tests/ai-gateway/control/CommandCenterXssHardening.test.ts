import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('Command Center XSS hardening', () => {
  it('sanitizes Markdown and rich panel HTML before innerHTML sinks', () => {
    const appScript = readFileSync(
      join(rootDir, 'assets/command-center/scripts/app.js'),
      'utf8',
    );

    expect(appScript).toContain('function sanitizeRenderedHtml(html, options = {})');
    expect(appScript).toContain('DROP_MARKDOWN_TAGS');
    expect(appScript).toContain("name.startsWith('on')");
    expect(appScript).toContain("name === 'style'");
    expect(appScript).toContain("name === 'srcdoc'");
    expect(appScript).toContain("sanitizeRenderedHtml(marked.parse(String(text ?? '')))");
    expect(appScript).toContain('artifactBody.innerHTML = sanitizeRenderedHtml');
    expect(appScript).toContain("document.getElementById('core-modal-body').innerHTML = sanitizeRenderedHtml(content, { allowTrustedUi: true })");
    expect(appScript).toContain('const TRUSTED_UI_TAGS');
    expect(appScript).toContain('const safeName = escapeHtml(name)');
    expect(appScript).toContain('const safeDetail = escapeHtml(detail)');
    expect(appScript).toContain('const safeMessage = escapeHtml(message)');
    expect(appScript).not.toContain('if (window.marked) return marked.parse(text)');
    expect(appScript).not.toContain("document.getElementById('core-modal-body').innerHTML = content");
  });

  it('keeps active SVG artifacts out of visual preview object URLs', () => {
    const runtimeBridge = readFileSync(
      join(rootDir, 'assets/command-center/scripts/runtime-bridge.js'),
      'utf8',
    );
    const interactionRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts'),
      'utf8',
    );

    expect(runtimeBridge).toContain("['txt', 'md', 'json', 'csv', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'html', 'css', 'yml', 'yaml', 'toml', 'ini', 'log', 'sql', 'xml', 'svg', 'sh', 'ps1']");
    expect(runtimeBridge).toContain("return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension);");
    expect(runtimeBridge).not.toContain("['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']");
    expect(interactionRoutes).toContain("if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'image';");
    expect(interactionRoutes).not.toContain("['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']");
  });
});
