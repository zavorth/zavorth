/**
 * Flat + virtual window helpers for large workspace file trees.
 */

export type FileTreeNodeLike = {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  children?: FileTreeNodeLike[];
};

export type FlatFileRow = {
  id: string;
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  depth: number;
  hasChildren: boolean;
};

export const DEFAULT_FILE_ROW_HEIGHT = 28;
export const DEFAULT_FILE_TREE_OVERSCAN = 10;

/**
 * Flatten a tree into visible rows according to the expanded directory set.
 * Directories are always included; children only when parent path is expanded.
 */
export function flattenVisibleFileTree(
  nodes: FileTreeNodeLike[],
  expanded: ReadonlySet<string>,
  depth = 0,
): FlatFileRow[] {
  const rows: FlatFileRow[] = [];
  for (const node of nodes) {
    const isDir = node.type === 'directory';
    const children = Array.isArray(node.children) ? node.children : [];
    rows.push({
      id: node.relativePath || `${depth}:${node.name}`,
      name: node.name,
      relativePath: node.relativePath,
      type: node.type,
      depth,
      hasChildren: isDir && children.length > 0,
    });
    if (isDir && expanded.has(node.relativePath) && children.length > 0) {
      rows.push(...flattenVisibleFileTree(children, expanded, depth + 1));
    }
  }
  return rows;
}

/**
 * Expand only root-level directories (depth 0) — default first paint for large trees.
 */
export function defaultExpandedPaths(nodes: FileTreeNodeLike[]): Set<string> {
  const expanded = new Set<string>();
  for (const node of nodes) {
    if (node.type === 'directory') {
      expanded.add(node.relativePath);
    }
  }
  return expanded;
}

export type VirtualWindow = {
  start: number;
  end: number;
  offsetTop: number;
  totalHeight: number;
  visibleCount: number;
};

/**
 * Compute which row indices should render for a scroll viewport.
 * end is exclusive.
 */
export function windowFileTreeRows(
  total: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number = DEFAULT_FILE_ROW_HEIGHT,
  overscan: number = DEFAULT_FILE_TREE_OVERSCAN,
): VirtualWindow {
  const height = Math.max(1, Math.floor(rowHeight) || DEFAULT_FILE_ROW_HEIGHT);
  const view = Math.max(0, Math.floor(viewportHeight));
  const top = Math.max(0, scrollTop);
  const totalHeight = Math.max(0, total) * height;

  if (total <= 0) {
    return { start: 0, end: 0, offsetTop: 0, totalHeight: 0, visibleCount: 0 };
  }

  const rawStart = Math.floor(top / height);
  const visibleSlots = Math.ceil(view / height) + 1;
  const start = Math.max(0, rawStart - overscan);
  const end = Math.min(total, rawStart + visibleSlots + overscan);
  return {
    start,
    end,
    offsetTop: start * height,
    totalHeight,
    visibleCount: Math.max(0, end - start),
  };
}

/** Toggle a path in an expanded set (immutable-friendly). */
export function toggleExpandedPath(expanded: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}
