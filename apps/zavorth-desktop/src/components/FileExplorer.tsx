import { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n';
import { VirtualFileTree } from './VirtualFileTree';

export type FileExplorerNode = {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  children?: FileExplorerNode[];
};

export interface FileExplorerProps {
  /**
   * Callback triggered when a file is selected.
   * Documented behavior:
   * - Receives ONLY the relativePath of the selected node.
   * - Does NOT read the file's content.
   * - Does NOT call or trigger any MCP tools.
   * - Does NOT upload any files or content to a remote server.
   * - Does NOT send any file content or code to the LLM.
   * - Does NOT execute any modifying operations (write, delete, rename, move, edit).
   */
  onAttachFile?: (relativePath: string) => void;
  /** Optional preloaded tree. When omitted, loads via desktop bridge when workspacePath is set. */
  data?: FileExplorerNode[];
  /** Absolute workspace root used with readFileTree when data is not provided. */
  workspacePath?: string | null;
}

/**
 * Defensive path validation function to reject any absolute paths,
 * keyword variables, or traversal indicators in relative path fields.
 */
export function isSuspiciousPath(pathStr: string): boolean {
  if (!pathStr) return true;

  const suspiciousKeywords = ['workspaceRoot', 'absolutePath', 'realpath'];
  const lowerPath = pathStr.toLowerCase();

  if (suspiciousKeywords.some(keyword => lowerPath.includes(keyword.toLowerCase()))) {
    return true;
  }

  if (/^[a-zA-Z]:[/\\]/.test(pathStr)) {
    return true;
  }

  if (pathStr.startsWith('/') || pathStr.startsWith('\\')) {
    return true;
  }

  if (pathStr.includes('../') || pathStr.includes('..\\') || pathStr === '..' || pathStr === '.') {
    return true;
  }

  if (lowerPath.includes('users/') || lowerPath.includes('users\\') || lowerPath === 'users') {
    return true;
  }

  return false;
}

/**
 * Recursively filters and sanitizes a node tree, removing any nodes
 * with absolute paths or traversal sequences.
 */
export function sanitizeTree(nodes: FileExplorerNode[]): FileExplorerNode[] {
  return nodes
    .map(node => {
      if (isSuspiciousPath(node.relativePath) || isSuspiciousPath(node.name)) {
        return null;
      }
      if (node.type === 'directory') {
        return {
          ...node,
          children: node.children ? sanitizeTree(node.children) : [],
        };
      }
      return node;
    })
    .filter((n): n is FileExplorerNode => n !== null);
}

export function FileExplorer({ onAttachFile, data, workspacePath }: FileExplorerProps) {
  const [tree, setTree] = useState<FileExplorerNode[]>(() => (Array.isArray(data) ? data : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTree = useCallback(async () => {
    if (Array.isArray(data)) {
      setTree(data);
      setError('');
      return;
    }

    const root = String(workspacePath || '').trim();
    if (!root) {
      setTree([]);
      setError('');
      return;
    }

    if (!window.zavorthDesktop?.readFileTree) {
      setTree([]);
      setError(t('files.unavailable'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await window.zavorthDesktop.readFileTree(root);
      if (res.ok && Array.isArray(res.tree)) {
        setTree(res.tree);
      } else {
        setTree([]);
        setError(res.error || t('files.error'));
      }
    } catch {
      setTree([]);
      setError(t('files.error'));
    } finally {
      setLoading(false);
    }
  }, [data, workspacePath]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const sanitizedData = sanitizeTree(tree);

  return (
    <div className="zavorth-file-explorer">
      <div className="zavorth-file-explorer-root-label">
        {t('files.workspaceTitle')}
      </div>
      <div className="zavorth-file-tree">
        {loading ? (
          <div className="zavorth-file-node-empty">{t('files.loading')}</div>
        ) : error ? (
          <div className="zavorth-file-node-empty">{error}</div>
        ) : !workspacePath && !data ? (
          <div className="zavorth-file-node-empty">{t('files.noFolder')}</div>
        ) : (
          <VirtualFileTree
            nodes={sanitizedData}
            onAttachFile={onAttachFile}
            maxHeight="min(60vh, 520px)"
            emptyLabel={t('files.empty')}
          />
        )}
      </div>
    </div>
  );
}
