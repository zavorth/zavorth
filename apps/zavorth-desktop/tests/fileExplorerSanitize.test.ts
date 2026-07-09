import { describe, expect, it } from 'vitest';
import { isSuspiciousPath, sanitizeTree, type FileExplorerNode } from '../src/components/FileExplorer';

describe('FileExplorer path sanitization', () => {
  it('flags absolute and traversal paths as suspicious', () => {
    expect(isSuspiciousPath('src/App.tsx')).toBe(false);
    expect(isSuspiciousPath('C:\\Users\\x\\file.ts')).toBe(true);
    expect(isSuspiciousPath('/etc/passwd')).toBe(true);
    expect(isSuspiciousPath('../secret')).toBe(true);
    expect(isSuspiciousPath('users/home')).toBe(true);
    expect(isSuspiciousPath('')).toBe(true);
  });

  it('sanitizes tree nodes and drops unsafe children', () => {
    const tree: FileExplorerNode[] = [
      {
        name: 'src',
        relativePath: 'src',
        type: 'directory',
        children: [
          { name: 'App.tsx', relativePath: 'src/App.tsx', type: 'file' },
          { name: 'evil', relativePath: '../evil', type: 'file' },
          { name: 'abs', relativePath: 'C:/Windows/system.ini', type: 'file' },
        ],
      },
      {
        name: 'README.md',
        relativePath: 'README.md',
        type: 'file',
      },
    ];

    const safe = sanitizeTree(tree);
    expect(safe).toHaveLength(2);
    expect(safe[0].children?.map(child => child.name)).toEqual(['App.tsx']);
    expect(safe[1].name).toBe('README.md');
  });
});
