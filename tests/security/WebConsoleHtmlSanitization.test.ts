import fs from 'fs';
import path from 'path';


const ROOT = path.resolve(__dirname, '..', '..');
const WEB_CONSOLE_SCRIPT_ROOTS = [
  'src/services/web-console-runtime-shell-script',
  'src/domain/surface/presentation/web-console/web-console-runtime-shell-script',
];

function readScriptPart(root: string, file: string): string {
  return fs.readFileSync(path.join(ROOT, root, file), 'utf8');
}

describe('web console HTML sanitization', () => {
  it('sanitizes operational panel details and action HTML in every runtime script copy', () => {
    for (const root of WEB_CONSOLE_SCRIPT_ROOTS) {
      const listRenderer = readScriptPart(root, 'part1-seg1.ts');
      const operationalPanel = readScriptPart(root, 'part5-seg2.ts');

      expect(listRenderer).toContain('function sanitizePanelHtml(value)');
      expect(listRenderer).toContain("allowedTags = new Set(['STRONG'");
      expect(listRenderer).toContain("name.startsWith('on')");
      expect(listRenderer).toContain('sanitizePanelHtml(item)');
      expect(listRenderer).not.toContain("'<li>' + String(item) + '</li>'");

      expect(operationalPanel).toContain('sanitizePanelHtml(config.actionsHtml)');
      expect(operationalPanel).not.toContain("String(config.actionsHtml)");
    }
  });
});
