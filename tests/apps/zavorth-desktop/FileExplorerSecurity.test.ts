const { isSuspiciousPath, sanitizeTree } = require('../../../apps/zavorth-desktop/src/components/FileExplorer');
type FileExplorerNode = { name: string; relativePath: string; type: 'file' | 'directory'; children-: FileExplorerNode[] };

describe('FileExplorer — Security & Edge Cases', () => {
  describe('isSuspiciousPath', () => {
    it('should reject empty string', () => {
      expect(isSuspiciousPath('')).toBe(true);
    });

    it('should reject absolute Windows paths', () => {
      expect(isSuspiciousPath('C:\\Users\\test')).toBe(true);
      expect(isSuspiciousPath('D:/projects')).toBe(true);
    });

    it('should reject absolute unix paths', () => {
      expect(isSuspiciousPath('/etc/passwd')).toBe(true);
      expect(isSuspiciousPath('/home/user')).toBe(true);
    });

    it('should reject backslash-only paths', () => {
      expect(isSuspiciousPath('\\')).toBe(true);
    });

    it('should reject dot-dot traversal', () => {
      expect(isSuspiciousPath('../secret')).toBe(true);
      expect(isSuspiciousPath('..\\secret')).toBe(true);
      expect(isSuspiciousPath('..')).toBe(true);
      expect(isSuspiciousPath('.')).toBe(true);
    });

    it('should reject paths with keyword variables', () => {
      expect(isSuspiciousPath('workspaceRoot/secret')).toBe(true);
      expect(isSuspiciousPath('absolutePath/file')).toBe(true);
      expect(isSuspiciousPath('realpath/data')).toBe(true);
    });

    it('should reject user directory references', () => {
      expect(isSuspiciousPath('users/admin')).toBe(true);
      expect(isSuspiciousPath('Users/admin/file')).toBe(true);
    });

    it('should accept safe relative paths', () => {
      expect(isSuspiciousPath('src/components/App.tsx')).toBe(false);
      expect(isSuspiciousPath('tests/unit/test.ts')).toBe(false);
      expect(isSuspiciousPath('package.json')).toBe(false);
      expect(isSuspiciousPath('apps/zavorth-desktop/src/main.tsx')).toBe(false);
    });

    it('should accept paths with dots in filenames', () => {
      expect(isSuspiciousPath('file.test.ts')).toBe(false);
      expect(isSuspiciousPath('config.json')).toBe(false);
      expect(isSuspiciousPath('.gitignore')).toBe(false);
    });
  });

  describe('sanitizeTree', () => {
    it('should remove suspicious nodes', () => {
      const tree: FileExplorerNode[] = [
        { name: 'safe', relativePath: 'src/safe.ts', type: 'file' },
        { name: 'evil', relativePath: '../../etc/passwd', type: 'file' },
        { name: 'also-bad', relativePath: '/etc/shadow', type: 'file' },
      ];
      const result = sanitizeTree(tree);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('safe');
    });

    it('should sanitize nested directories', () => {
      const tree: FileExplorerNode[] = [
        {
          name: 'src',
          relativePath: 'src',
          type: 'directory',
          children: [
            { name: 'ok.ts', relativePath: 'src/ok.ts', type: 'file' },
            { name: 'bad.ts', relativePath: '../secret.ts', type: 'file' },
          ],
        },
      ];
      const result = sanitizeTree(tree);
      expect(result.length).toBe(1);
      expect(result[0].children!.length).toBe(1);
      expect(result[0].children![0].name).toBe('ok.ts');
    });

    it('should handle empty tree', () => {
      expect(sanitizeTree([])).toEqual([]);
    });

    it('should remove all suspicious nodes', () => {
      const tree: FileExplorerNode[] = [
        { name: 'a', relativePath: '../a', type: 'file' },
        { name: 'b', relativePath: '../b', type: 'file' },
        { name: 'c', relativePath: '../c', type: 'file' },
      ];
      expect(sanitizeTree(tree)).toEqual([]);
    });

    it('should keep all safe nodes', () => {
      const tree: FileExplorerNode[] = [
        { name: 'a.ts', relativePath: 'src/a.ts', type: 'file' },
        { name: 'b.ts', relativePath: 'src/b.ts', type: 'file' },
        { name: 'c.ts', relativePath: 'src/c.ts', type: 'file' },
      ];
      expect(sanitizeTree(tree).length).toBe(3);
    });

    it('should handle deep nesting', () => {
      const tree: FileExplorerNode[] = [
        {
          name: 'a',
          relativePath: 'a',
          type: 'directory',
          children: [
            {
              name: 'b',
              relativePath: 'a/b',
              type: 'directory',
              children: [
                { name: 'c.ts', relativePath: 'a/b/c.ts', type: 'file' },
              ],
            },
          ],
        },
      ];
      const result = sanitizeTree(tree);
      expect(result[0].children![0].children![0].name).toBe('c.ts');
    });
  });
});
