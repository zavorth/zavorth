import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILE_ROW_HEIGHT,
  defaultExpandedPaths,
  flattenVisibleFileTree,
  toggleExpandedPath,
  windowFileTreeRows,
  type FileTreeNodeLike,
} from '../src/lib/fileTreeVirtual';

function buildWideTree(fileCount: number): FileTreeNodeLike[] {
  return [
    {
      name: 'src',
      relativePath: 'src',
      type: 'directory',
      children: Array.from({ length: fileCount }, (_, i) => ({
        name: `file-${i}.ts`,
        relativePath: `src/file-${i}.ts`,
        type: 'file' as const,
      })),
    },
    {
      name: 'README.md',
      relativePath: 'README.md',
      type: 'file',
    },
  ];
}

describe('fileTreeVirtual', () => {
  it('expands only root directories by default', () => {
    const tree = buildWideTree(3);
    const expanded = defaultExpandedPaths(tree);
    expect(expanded.has('src')).toBe(true);
    expect(expanded.has('README.md')).toBe(false);

    const rows = flattenVisibleFileTree(tree, expanded);
    expect(rows.map(r => r.relativePath)).toEqual([
      'src',
      'src/file-0.ts',
      'src/file-1.ts',
      'src/file-2.ts',
      'README.md',
    ]);
  });

  it('hides children when directory is collapsed', () => {
    const tree = buildWideTree(5);
    const rows = flattenVisibleFileTree(tree, new Set());
    expect(rows).toHaveLength(2);
    expect(rows[0].relativePath).toBe('src');
    expect(rows[0].hasChildren).toBe(true);
  });

  it('windows large lists so only a viewport slice is active', () => {
    const total = 5000;
    const win = windowFileTreeRows(total, 0, 280, DEFAULT_FILE_ROW_HEIGHT, 10);
    expect(win.totalHeight).toBe(total * DEFAULT_FILE_ROW_HEIGHT);
    expect(win.start).toBe(0);
    expect(win.visibleCount).toBeLessThan(total);
    expect(win.visibleCount).toBeLessThanOrEqual(Math.ceil(280 / DEFAULT_FILE_ROW_HEIGHT) + 1 + 20);

    const mid = windowFileTreeRows(total, 28 * 1000, 280, DEFAULT_FILE_ROW_HEIGHT, 5);
    expect(mid.start).toBeGreaterThan(900);
    expect(mid.end - mid.start).toBeLessThan(50);
    expect(mid.offsetTop).toBe(mid.start * DEFAULT_FILE_ROW_HEIGHT);
  });

  it('toggles expanded paths immutably', () => {
    const a = new Set(['src']);
    const b = toggleExpandedPath(a, 'src');
    const c = toggleExpandedPath(b, 'src');
    expect(a.has('src')).toBe(true);
    expect(b.has('src')).toBe(false);
    expect(c.has('src')).toBe(true);
  });

  it('keeps depth metadata for nested folders', () => {
    const tree: FileTreeNodeLike[] = [
      {
        name: 'a',
        relativePath: 'a',
        type: 'directory',
        children: [
          {
            name: 'b',
            relativePath: 'a/b',
            type: 'directory',
            children: [{ name: 'c.ts', relativePath: 'a/b/c.ts', type: 'file' }],
          },
        ],
      },
    ];
    const expanded = new Set(['a', 'a/b']);
    const rows = flattenVisibleFileTree(tree, expanded);
    expect(rows.find(r => r.relativePath === 'a/b')?.depth).toBe(1);
    expect(rows.find(r => r.relativePath === 'a/b/c.ts')?.depth).toBe(2);
  });
});
