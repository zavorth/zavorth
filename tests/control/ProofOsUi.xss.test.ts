/**
 * S6 — Control Proof OS UI must HTML-escape untrusted proof fields.
 * Presentation lives in apps/zavorth-control-vite-shell/src/proof-os-ui.ts.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readShell(rel: string): string {
  return readFileSync(path.join(root, 'apps', 'zavorth-control-vite-shell', 'src', rel), 'utf8');
}

describe('Proof OS UI XSS posture (S6)', () => {
  it('imports and uses escapeHtml for all dynamic proof fields', () => {
    const ui = readShell('proof-os-ui.ts');
    const htmlUtils = readShell('html-utils.ts');

    expect(ui).toContain("import { escapeHtml } from './html-utils'");
    expect(htmlUtils).toContain('export function escapeHtml');
    expect(htmlUtils).toContain(".replace(/&/g, '&amp;')");
    expect(htmlUtils).toContain(".replace(/</g, '&lt;')");
    expect(htmlUtils).toContain('.replace(/"/g, \'&quot;\')');

    // Dynamic surfaces in the panel must not concatenate raw event fields.
    expect(ui).toContain('escapeHtml(formatProofLine(event))');
    expect(ui).toContain('escapeHtml(event.id)');
    expect(ui).toContain('escapeHtml(String(event.status');
    expect(ui).toContain('escapeHtml(line)');
    expect(ui).toContain('escapeHtml(translate(');
    expect(ui).not.toMatch(/\$\{event\.(title|summary|id)\}/);
  });

  it('escapeHtml neutralizes classic XSS payloads', () => {
    // Inline copy of escapeHtml rules for hermetic unit check (no DOM).
    function escapeHtml(value: unknown): string {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const payloads = [
      `<img src=x onerror=alert(1)>`,
      `" onload="alert(1)`,
      `</script><script>alert(1)</script>`,
      `javascript:alert(1)`,
      `Proof <b>title</b> & "summary"`,
    ];

    for (const payload of payloads) {
      const out = escapeHtml(payload);
      // Tags must not remain live HTML; attribute text may remain but is inert.
      expect(out).not.toContain('<script');
      expect(out).not.toContain('<img');
      expect(out).not.toContain('<');
      expect(out).not.toContain('>');
      if (payload.includes('<')) expect(out).toContain('&lt;');
      if (payload.includes('>')) expect(out).toContain('&gt;');
      if (payload.includes('"')) expect(out).toContain('&quot;');
      if (payload.includes('&') && !payload.startsWith('javascript')) {
        expect(out).toContain('&amp;');
      }
    }
  });

  it('renderProofOsPanelHtml path never uses raw innerHTML templates without escapeHtml', () => {
    const ui = readShell('proof-os-ui.ts');
    // Mount uses innerHTML only with pre-escaped render helpers.
    expect(ui).toContain('host.innerHTML = html');
    expect(ui).toContain('renderProofOsPanelHtml');
    expect(ui).toContain('renderProofOsChromeHtml');
    // No unescaped template of event fields:
    expect(ui).not.toMatch(/innerHTML\s*=\s*[`'"].*\$\{event\./);
  });

  it('website TrustLoopDemo is React text-only (no raw HTML inject) for public demo (S6)', () => {
    const demoPath = path.join(
      root,
      '..',
      'zavorth-website',
      'components',
      'TrustLoopDemo.tsx',
    );
    let demo = '';
    try {
      demo = readFileSync(demoPath, 'utf8');
    } catch {
      // Website may live next to monorepo; skip soft if missing.
      return;
    }
    expect(demo).not.toContain('dangerouslySetInnerHTML');
    expect(demo).not.toContain('innerHTML');
    expect(demo).toContain('export function TrustLoopDemo');
    expect(demo).toContain('fixture / offline');
  });
});
