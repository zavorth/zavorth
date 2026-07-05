import { useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Plus } from '../icons';

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
   * - Does NOT access the filesystem or trigger IPC/IPC-based operations.
   * - Does NOT call or trigger any MCP tools.
   * - Does NOT upload any files or content to a remote server.
   * - Does NOT send any file content or code to the LLM.
   * - Does NOT execute any modifying operations (write, delete, rename, move, edit).
   */
  onAttachFile?: (relativePath: string) => void;
  data?: FileExplorerNode[];
}

/**
 * Defensive path validation function to reject any absolute paths,
 * keyword variables, or traversal indicators.
 */
export function isSuspiciousPath(pathStr: string): boolean {
  if (!pathStr) return true;
  
  const suspiciousKeywords = ['workspaceRoot', 'absolutePath', 'realpath'];
  const lowerPath = pathStr.toLowerCase();
  
  // Check for forbidden keyword strings representing paths
  if (suspiciousKeywords.some(keyword => lowerPath.includes(keyword.toLowerCase()))) {
    return true;
  }
  
  // Check for absolute Windows paths (e.g. C:\... or D:/...)
  if (/^[a-zA-Z]:[/\\]/.test(pathStr)) {
    return true;
  }
  
  // Check for absolute paths starting with root directory separators
  if (pathStr.startsWith('/') || pathStr.startsWith('\\')) {
    return true;
  }
  
  // Check for directory traversal sequences (../ or ..\)
  if (pathStr.includes('../') || pathStr.includes('..\\') || pathStr === '..' || pathStr === '.') {
    return true;
  }
  
  // Check for absolute unix user paths or system references
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

const defaultMockData: FileExplorerNode[] = [
  {
    name: 'apps',
    relativePath: 'apps',
    type: 'directory',
    children: [
      {
        name: 'zavorth-desktop',
        relativePath: 'apps/zavorth-desktop',
        type: 'directory',
        children: [
          {
            name: 'src',
            relativePath: 'apps/zavorth-desktop/src',
            type: 'directory',
            children: [
              {
                name: 'components',
                relativePath: 'apps/zavorth-desktop/src/components',
                type: 'directory',
                children: [
                  { name: 'FileExplorer.tsx', relativePath: 'apps/zavorth-desktop/src/components/FileExplorer.tsx', type: 'file' }
                ]
              },
              { name: 'App.tsx', relativePath: 'apps/zavorth-desktop/src/App.tsx', type: 'file' },
              { name: 'styles.css', relativePath: 'apps/zavorth-desktop/src/styles.css', type: 'file' }
            ]
          },
          { name: 'package.json', relativePath: 'apps/zavorth-desktop/package.json', type: 'file' }
        ]
      }
    ]
  },
  {
    name: 'tests',
    relativePath: 'tests',
    type: 'directory',
    children: [
      {
        name: 'apps',
        relativePath: 'tests/apps',
        type: 'directory',
        children: [
          {
            name: 'zavorth-desktop',
            relativePath: 'tests/apps/zavorth-desktop',
            type: 'directory',
            children: [
              { name: 'DesktopReadOnlyFileExplorer.test.ts', relativePath: 'tests/apps/zavorth-desktop/DesktopReadOnlyFileExplorer.test.ts', type: 'file' }
            ]
          }
        ]
      }
    ]
  },
  { name: 'README.md', relativePath: 'README.md', type: 'file' }
];

export function FileExplorer({ onAttachFile, data }: FileExplorerProps) {
  const rawData = data || defaultMockData;
  const sanitizedData = sanitizeTree(rawData);

  return (
    <div className="zavorth-file-explorer">
      <div className="zavorth-file-explorer-root-label">
        Arquivos do Workspace
      </div>
      <div className="zavorth-file-tree">
        {sanitizedData.length === 0 ? (
          <div className="zavorth-file-node-empty">No safe file in the workspace.</div>
        ) : (
          sanitizedData.map(node => (
            <FileTreeNode
              key={node.relativePath}
              node={node}
              onAttachFile={onAttachFile}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  onAttachFile,
  depth,
}: {
  node: FileExplorerNode;
  onAttachFile?: (relativePath: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleSelect = (e: MouseEvent) => {
    e.stopPropagation();
    // Safety check: verify path is not suspicious before triggering callback
    if (!isSuspiciousPath(node.relativePath) && onAttachFile) {
      onAttachFile(node.relativePath);
    }
  };

  const isDir = node.type === 'directory';

  // Double validation check before rendering anything
  if (isSuspiciousPath(node.relativePath) || isSuspiciousPath(node.name)) {
    return null;
  }

  const paddingLeft = `${depth * 12 + 8}px`;

  if (!isDir) {
    return (
      <div
        className="zavorth-file-node zavorth-file-node-file"
        onClick={handleSelect}
        style={{ paddingLeft }}
      >
        <span className="zavorth-file-node-icon">
          <File aria-hidden="true" size={14} stroke={1.75} />
        </span>
        <span className="zavorth-file-node-name" title={node.relativePath}>
          {node.name}
        </span>
        <button
          onClick={handleSelect}
          title="Attach reference to chat"
          className="zavorth-file-node-action"
          type="button"
        >
          <Plus aria-hidden="true" size={14} stroke={2} />
        </button>
      </div>
    );
  }

  const childrenNodes = node.children || [];
  const sanitizedChildren = sanitizeTree(childrenNodes);

  return (
    <div className="zavorth-file-node-directory">
      <div
        className="zavorth-file-node zavorth-file-node-dir-header"
        onClick={toggleExpand}
        style={{ paddingLeft }}
      >
        <span className="zavorth-file-node-caret">
          {expanded ? (
            <ChevronDown aria-hidden="true" size={14} stroke={1.8} />
          ) : (
            <ChevronRight aria-hidden="true" size={14} stroke={1.8} />
          )}
        </span>
        <span className="zavorth-file-node-icon">
          {expanded ? (
            <FolderOpen aria-hidden="true" size={14} stroke={1.75} />
          ) : (
            <Folder aria-hidden="true" size={14} stroke={1.75} />
          )}
        </span>
        <span className="zavorth-file-node-name" title={node.relativePath}>
          {node.name}
        </span>
      </div>

      {expanded && (
        <div className="zavorth-file-node-children">
          {sanitizedChildren.length === 0 ? (
            <div
              className="zavorth-file-node-empty"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              (vazio)
            </div>
          ) : (
            sanitizedChildren.map(child => (
              <FileTreeNode
                key={child.relativePath}
                node={child}
                onAttachFile={onAttachFile}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
