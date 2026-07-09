import { describe, expect, it } from 'vitest';
import {
  extractOpenTargets,
  preferDiffTarget,
  preferFileTarget,
  type OpenTarget,
} from '../src/thread/openFromChat';

describe('extractOpenTargets', () => {
  it('returns empty for blank content', () => {
    expect(extractOpenTargets('')).toEqual([]);
    expect(extractOpenTargets('   \n')).toEqual([]);
  });

  it('detects relative file paths', () => {
    const targets = extractOpenTargets('Please open src/thread/planCard.ts for review.');
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets[0]).toMatchObject({
      kind: 'file',
      path: 'src/thread/planCard.ts',
      label: 'src/thread/planCard.ts',
    });
  });

  it('detects path:line patterns', () => {
    const targets = extractOpenTargets('Error at apps/zavorth-desktop/src/App.tsx:42');
    expect(targets.some((t) => t.path.endsWith('App.tsx') && t.line === 42)).toBe(true);
    const hit = targets.find((t) => t.line === 42)!;
    expect(hit.label).toContain('42');
  });

  it('detects markdown links to relative paths', () => {
    const targets = extractOpenTargets('See [the module](src/foo/bar.ts) for details.');
    expect(targets).toEqual([
      expect.objectContaining({
        kind: 'file',
        path: 'src/foo/bar.ts',
        label: 'the module',
      }),
    ]);
  });

  it('detects markdown link with line', () => {
    const targets = extractOpenTargets('[jump](lib/util.ts:10)');
    expect(targets[0]).toMatchObject({ path: 'lib/util.ts', line: 10 });
  });

  it('ignores http(s) markdown links', () => {
    const targets = extractOpenTargets('[docs](https://example.com/a.ts) and [ok](src/a.ts)');
    expect(targets).toHaveLength(1);
    expect(targets[0].path).toBe('src/a.ts');
  });

  it('detects Wrote file / Modified lines', () => {
    const content = `
Wrote file: src/thread/openFromChat.ts
Modified: tests/openFromChat.test.ts
Created file: src/newModule.ts
`;
    const targets = extractOpenTargets(content);
    const paths = targets.map((t) => t.path);
    expect(paths).toContain('src/thread/openFromChat.ts');
    expect(paths).toContain('tests/openFromChat.test.ts');
    expect(paths).toContain('src/newModule.ts');
  });

  it('deduplicates by path+line', () => {
    const content = `
src/a.ts
src/a.ts
src/a.ts:10
src/a.ts:10
src/a.ts:11
`;
    const targets = extractOpenTargets(content);
    const keys = targets.map((t) => `${t.path}:${t.line ?? ''}`);
    expect(keys).toEqual([...new Set(keys)]);
    expect(targets.filter((t) => t.path === 'src/a.ts')).toHaveLength(3);
  });

  it('rejects absolute Windows paths', () => {
    const targets = extractOpenTargets(
      'Open C:\\Users\\me\\project\\src\\a.ts and also src/safe.ts',
    );
    expect(targets.every((t) => !t.path.includes('Users'))).toBe(true);
    expect(targets.some((t) => t.path === 'src/safe.ts')).toBe(true);
  });

  it('rejects absolute Unix paths', () => {
    const targets = extractOpenTargets(
      'See /Users/me/src/a.ts and /home/x/b.ts and /var/log/x.ts but keep apps/x/y.tsx',
    );
    expect(targets.every((t) => !t.path.startsWith('/'))).toBe(true);
    expect(targets.some((t) => t.path === 'apps/x/y.tsx')).toBe(true);
  });

  it('rejects path traversal', () => {
    const targets = extractOpenTargets('bad ../secrets/key.ts and good src/ok.ts');
    expect(targets.every((t) => !t.path.includes('..'))).toBe(true);
    expect(targets.some((t) => t.path === 'src/ok.ts')).toBe(true);
  });

  it('caps at 20 targets', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `src/file${i}.ts`);
    const targets = extractOpenTargets(lines.join('\n'));
    expect(targets.length).toBeLessThanOrEqual(20);
  });

  it('marks diff-like context as kind diff', () => {
    const targets = extractOpenTargets('git diff shows changes in src/thread/planCard.ts');
    const hit = targets.find((t) => t.path.includes('planCard'));
    expect(hit?.kind).toBe('diff');
  });

  it('detects .diff / .patch files as diff', () => {
    const targets = extractOpenTargets('Apply changes.patch then review foo.diff');
    expect(targets.some((t) => t.path === 'changes.patch' && t.kind === 'diff')).toBe(true);
    expect(targets.some((t) => t.path === 'foo.diff' && t.kind === 'diff')).toBe(true);
  });

  it('detects folder references', () => {
    const targets = extractOpenTargets('Open folder src/thread/ for the helpers');
    expect(targets.some((t) => t.kind === 'folder' && t.path.startsWith('src/thread'))).toBe(
      true,
    );
  });

  it('handles ./ relative prefixes', () => {
    const targets = extractOpenTargets('touch ./src/main.tsx');
    expect(targets.some((t) => t.path === './src/main.tsx' || t.path === 'src/main.tsx')).toBe(
      true,
    );
  });
});

describe('preferFileTarget / preferDiffTarget', () => {
  const mixed: OpenTarget[] = [
    { kind: 'folder', path: 'src/', label: 'src/' },
    { kind: 'diff', path: 'src/a.ts', label: 'diff a' },
    { kind: 'file', path: 'src/b.ts', label: 'b' },
  ];

  it('preferFileTarget returns first file', () => {
    expect(preferFileTarget(mixed)?.path).toBe('src/b.ts');
  });

  it('preferDiffTarget returns first diff', () => {
    expect(preferDiffTarget(mixed)?.path).toBe('src/a.ts');
  });

  it('returns null when kind missing', () => {
    expect(preferFileTarget([{ kind: 'diff', path: 'a.ts', label: 'a' }])).toBeNull();
    expect(preferDiffTarget([{ kind: 'file', path: 'a.ts', label: 'a' }])).toBeNull();
    expect(preferFileTarget([])).toBeNull();
    expect(preferDiffTarget([])).toBeNull();
  });
});
