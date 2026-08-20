import { TerminalDiffViewerComponent } from '../../../src/cli/components/TerminalDiffViewerComponent.js';

describe('TerminalDiffViewerComponent', () => {
  let viewer: TerminalDiffViewerComponent;

  const sampleDiff = `
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,4 +10,4 @@
 function login(user: string) {
-  return checkPassword(user);
+  return verifySecureToken(user);
 }
`;

  beforeEach(() => {
    viewer = new TerminalDiffViewerComponent();
  });

  it('parses unified diff format into structured hunks and lines', () => {
    const parsed = viewer.parseUnifiedDiff(sampleDiff);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].oldPath).toBe('src/auth.ts');
    expect(parsed[0].newPath).toBe('src/auth.ts');
    expect(parsed[0].hunks).toHaveLength(1);

    const lines = parsed[0].hunks[0].lines;
    expect(lines.find((l) => l.type === 'delete')?.content).toContain('checkPassword(user)');
    expect(lines.find((l) => l.type === 'add')?.content).toContain('verifySecureToken(user)');
  });

  it('renders clean unified diff for narrower terminal widths (< 120)', () => {
    const rendered = viewer.render(sampleDiff, 80);

    expect(rendered).toContain('diff: src/auth.ts -> src/auth.ts');
    expect(rendered).toContain('-   return checkPassword(user);');
    expect(rendered).toContain('+   return verifySecureToken(user);');
  });

  it('renders split side-by-side diff for wide terminal widths (>= 120)', () => {
    const rendered = viewer.render(sampleDiff, 140);

    expect(rendered).toContain('src/auth.ts (left) │ src/auth.ts (right)');
    expect(rendered).toContain('│');
    expect(rendered).toContain('checkPassword');
    expect(rendered).toContain('verifySecureToken');
  });
});
