import fs from 'node:fs';
import path from 'node:path';

// Helper interface to mock tree structure in tests
type FileExplorerNode = {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  children?: FileExplorerNode[];
};

describe('Desktop Read-Only FileExplorer Component', () => {
  const fileExplorerPath = path.resolve('apps/zavorth-desktop/src/components/FileExplorer.tsx');
  const previewRailPath = path.resolve('apps/zavorth-desktop/src/shell/DesktopPreviewRail.tsx');
  const appPath = path.resolve('apps/zavorth-desktop/src/App.tsx');

  const fileExplorerSrc = fs.readFileSync(fileExplorerPath, 'utf8');
  const previewRailSrc = fs.readFileSync(previewRailPath, 'utf8');
  const appSrc = fs.readFileSync(appPath, 'utf8');

  // Simple regex-based TypeScript type stripper to generate pure ES6 JS
  function cleanTypeScript(code: string): string {
    return code
      .replace(/\bexport\s+/g, '') // remove export keyword
      .replace(/:\s*FileExplorerNode\[\]/g, '') // remove FileExplorerNode[] type
      .replace(/:\s*FileExplorerNode/g, '') // remove FileExplorerNode type
      .replace(/:\s*string/g, '') // remove string types
      .replace(/:\s*boolean/g, '') // remove boolean types
      .replace(/\(n\):\s*n\s+is\s+\w+/g, '(n)') // simplify type guard to (n)
      .replace(/as\s+[\w\s|<>\[\]]+/g, ''); // remove any type castings
  }

  // Dynamic compiler to run assertions on helper functions without triggering JSX parse errors in Jest
  function compileHelpers() {
    const isSuspiciousMatch = fileExplorerSrc.match(/export function isSuspiciousPath\([\s\S]*?\n\}/);
    const sanitizeTreeMatch = fileExplorerSrc.match(/export function sanitizeTree\([\s\S]*?\n\}/);
    
    if (!isSuspiciousMatch || !sanitizeTreeMatch) {
      throw new Error('Could not extract helper functions from FileExplorer source');
    }
    
    const isSuspiciousCode = cleanTypeScript(isSuspiciousMatch[0]);
    const sanitizeTreeCode = cleanTypeScript(sanitizeTreeMatch[0]);
    
    const isSuspiciousCompiled = new Function('pathStr', `
      ${isSuspiciousCode}
      return isSuspiciousPath(pathStr);
    `) as (pathStr: string) => boolean;

    const sanitizeTreeCompiled = new Function('nodes', `
      ${isSuspiciousCode}
      ${sanitizeTreeCode}
      return sanitizeTree(nodes);
    `) as (nodes: FileExplorerNode[]) => FileExplorerNode[];

    return {
      isSuspiciousPath: isSuspiciousCompiled,
      sanitizeTree: sanitizeTreeCompiled,
    };
  }

  const { isSuspiciousPath: testIsSuspicious, sanitizeTree: testSanitize } = compileHelpers();

  // Helper validation
  describe('isSuspiciousPath validator', () => {
    it('returns true for absolute windows paths', () => {
      expect(testIsSuspicious('C:\\workspace')).toBe(true);
      expect(testIsSuspicious('d:/project/file.ts')).toBe(true);
    });

    it('returns true for unix absolute paths', () => {
      expect(testIsSuspicious('/Users/user/project')).toBe(true);
      expect(testIsSuspicious('/root')).toBe(true);
    });

    it('returns true for directory traversal paths', () => {
      expect(testIsSuspicious('../file.ts')).toBe(true);
      expect(testIsSuspicious('..\\folder')).toBe(true);
      expect(testIsSuspicious('..')).toBe(true);
      expect(testIsSuspicious('.')).toBe(true);
    });

    it('returns true for suspicious keywords', () => {
      expect(testIsSuspicious('workspaceRoot')).toBe(true);
      expect(testIsSuspicious('absolutePath')).toBe(true);
      expect(testIsSuspicious('realpath')).toBe(true);
      expect(testIsSuspicious('Realpath')).toBe(true);
    });

    it('returns true for generic users folder references', () => {
      expect(testIsSuspicious('users/alex')).toBe(true);
      expect(testIsSuspicious('users\\file.txt')).toBe(true);
      expect(testIsSuspicious('users')).toBe(true);
    });

    it('returns false for safe relative paths', () => {
      expect(testIsSuspicious('src/App.tsx')).toBe(false);
      expect(testIsSuspicious('package.json')).toBe(false);
      expect(testIsSuspicious('apps/zavorth-desktop/src/components/FileExplorer.tsx')).toBe(false);
    });
  });

  describe('sanitizeTree recursive sanitizer', () => {
    it('removes nodes and their children containing suspicious paths', () => {
      const mockTree: FileExplorerNode[] = [
        {
          name: 'safe_folder',
          relativePath: 'safe_folder',
          type: 'directory',
          children: [
            {
              name: 'safe_file.txt',
              relativePath: 'safe_folder/safe_file.txt',
              type: 'file',
            },
            {
              name: 'unsafe_file.txt',
              relativePath: 'C:\\unsafe_file.txt',
              type: 'file',
            },
          ],
        },
        {
          name: 'unsafe_folder',
          relativePath: '../unsafe_folder',
          type: 'directory',
          children: [
            {
              name: 'some_file.txt',
              relativePath: 'some_file.txt',
              type: 'file',
            },
          ],
        },
      ];

      const sanitized = testSanitize(mockTree);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].name).toBe('safe_folder');
      expect(sanitized[0].children).toHaveLength(1);
      expect(sanitized[0].children![0].name).toBe('safe_file.txt');
    });
  });

  // Code inspection tests to ensure restrictions are enforced
  describe('FileExplorer JSX Static Analysis', () => {
    it('does not contain any embedded <style> tags', () => {
      expect(fileExplorerSrc).not.toContain('<style>');
      expect(fileExplorerSrc).not.toContain('</style>');
    });

    it('does not contain modify/destructive operation triggers or buttons', () => {
      // Strip comments to only test actual running JSX code
      const cleanSrc = fileExplorerSrc
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .toLowerCase();
      expect(cleanSrc).not.toContain('delete');
      expect(cleanSrc).not.toContain('rename');
      expect(cleanSrc).not.toContain('create');
      expect(cleanSrc).not.toContain('upload');
    });

    it('does not contain editable input elements', () => {
      expect(fileExplorerSrc).not.toContain('<input');
      expect(fileExplorerSrc).not.toContain('type="text"');
      expect(fileExplorerSrc).not.toContain("type='text'");
    });

    it('does not contain drag-and-drop indicators or triggers', () => {
      expect(fileExplorerSrc).not.toContain('draggable');
      expect(fileExplorerSrc).not.toContain('onDragStart');
      expect(fileExplorerSrc).not.toContain('onDragOver');
      expect(fileExplorerSrc).not.toContain('onDrop');
    });

    it('ensures callback is documented and called correctly', () => {
      expect(fileExplorerSrc).toContain('onAttachFile?: (relativePath: string) => void;');
      expect(fileExplorerSrc).toContain('onAttachFile(node.relativePath);');
    });
  });

  describe('DesktopPreviewRail and Layout Integration Static Analysis', () => {
    it('mounts the FileExplorer component only when mode is expanded', () => {
      expect(previewRailSrc).toContain("import { FileExplorer } from '../components/FileExplorer';");
      expect(previewRailSrc).toContain("props.mode === 'expanded'");
      expect(previewRailSrc).toContain('<FileExplorer');
    });

    it('ensures WorkspaceWriteApprovalModal remains intact as a top-level overlay in App.tsx', () => {
      expect(appSrc).toContain("import { WorkspaceWriteApprovalModal } from './components/WorkspaceWriteApprovalModal';");
      expect(appSrc).toContain('<WorkspaceWriteApprovalModal');
      expect(appSrc).toContain('</ZavorthPaneShell>');
      expect(appSrc).toContain('<WorkspaceWriteApprovalModal');
    });
  });
});
