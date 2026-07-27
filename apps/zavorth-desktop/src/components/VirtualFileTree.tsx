/**
 * Virtualized file tree — only visible rows mount in the DOM.
 * Used by FileExplorer (preview rail) and FilesView (workspace panel).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Plus } from '../icons';
import { t } from '../i18n';
import {
  DEFAULT_FILE_ROW_HEIGHT,
  defaultExpandedPaths,
  flattenVisibleFileTree,
  toggleExpandedPath,
  windowFileTreeRows,
  type FileTreeNodeLike,
  type FlatFileRow,
} from '../lib/fileTreeVirtual';

export type VirtualFileTreeProps = {
  nodes: FileTreeNodeLike[];
  onAttachFile?: (relativePath: string) => void;
  /** Fixed row height in px (must match CSS). */
  rowHeight?: number;
  /** Max height of the scroll viewport (CSS length). */
  maxHeight?: string | number;
  className?: string;
  emptyLabel?: string;
};

export function VirtualFileTree(props: VirtualFileTreeProps) {
  const rowHeight = props.rowHeight ?? DEFAULT_FILE_ROW_HEIGHT;
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpandedPaths(props.nodes));
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // When the tree root identity changes (new workspace), reset expansion.
  const treeKey = props.nodes.map(n => n.relativePath).join('\0');
  useEffect(() => {
    setExpanded(defaultExpandedPaths(props.nodes));
    setScrollTop(0);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exthere isustive-deps -- reset only when tree roots change
  }, [treeKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight || 320);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const rows = useMemo(
    () => flattenVisibleFileTree(props.nodes, expanded),
    [props.nodes, expanded],
  );

  const windowed = useMemo(
    () => windowFileTreeRows(rows.length, scrollTop, viewportHeight, rowHeight),
    [rows.length, scrollTop, viewportHeight, rowHeight],
  );

  const visibleRows = rows.slice(windowed.start, windowed.end);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const onToggleDir = useCallback((path: string) => {
    setExpanded(prev => toggleExpandedPath(prev, path));
  }, []);

  const maxHeight =
    typeof props.maxHeight === 'number' ? `${props.maxHeight}px`
      : props.maxHeight || 'min(70vh, 640px)';

  if (props.nodes.length === 0) {
    return (
      <div className={['zvd-vfile-tree', 'zvd-vfile-tree--empty', props.className].filter(Boolean).join(' ')}>
        <div className="zvd-vfile-tree__empty">{props.emptyLabel || t('files.empty')}</div>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className={['zvd-vfile-tree', props.className].filter(Boolean).join(' ')}
      style={{ maxHeight, height: maxHeight }}
      onScroll={onScroll}
      role="tree"
      aria-label={t('files.workspaceTitle')}
      data-row-count={rows.length}
      data-virtual-window={`${windowed.start}-${windowed.end}`}
    >
      <div className="zvd-vfile-tree__spacer" style={{ height: windowed.totalHeight }}>
        <div
          className="zvd-vfile-tree__window"
          style={{ transform: `translateY(${windowed.offsetTop}px)` }}
        >
          {visibleRows.map(row => (
            <VirtualFileRow
              key={row.id}
              row={row}
              rowHeight={rowHeight}
              expanded={expanded.has(row.relativePath)}
              onToggleDir={onToggleDir}
              onAttachFile={props.onAttachFile}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VirtualFileRow(props: {
  row: FlatFileRow;
  rowHeight: number;
  expanded: boolean;
  onToggleDir(path: string): void;
  onAttachFile?: (relativePath: string) => void;
}) {
  const { row, rowHeight, expanded, onToggleDir, onAttachFile } = props;
  const isDir = row.type === 'directory';
  const paddingLeft = row.depth * 12 + 8;

  return (
    <div
      className={[
        'zvd-vfile-row',
        isDir ? 'zvd-vfile-row--dir' : 'zvd-vfile-row--file',
        expanded && isDir ? 'is-expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: rowHeight, paddingLeft }}
      role="treeitem"
      aria-expanded={isDir ? expanded : undefined}
      aria-level={row.depth + 1}
      data-path={row.relativePath}
    >
      {isDir - (
        <button
          type="button"
          className="zvd-vfile-row__main"
          onClick={() => onToggleDir(row.relativePath)}
          aria-label={row.name}
        >
          <span className="zvd-vfile-row__caret" aria-hidden="true">
            {expanded ? <ChevronDown size={14} stroke={1.8} /> : <ChevronRight size={14} stroke={1.8} />}
          </span>
          <span className="zvd-vfile-row__icon" aria-hidden="true">
            {expanded ? <FolderOpen size={14} stroke={1.75} /> : <Folder size={14} stroke={1.75} />}
          </span>
          <span className="zvd-vfile-row__name" title={row.relativePath}>
            {row.name}
          </span>
        </button>
      ) : (
        <>
          <span className="zvd-vfile-row__main zvd-vfile-row__main--file">
            <span className="zvd-vfile-row__caret" aria-hidden="true" />
            <span className="zvd-vfile-row__icon" aria-hidden="true">
              <File size={14} stroke={1.75} />
            </span>
            <span className="zvd-vfile-row__name" title={row.relativePath}>
              {row.name}
            </span>
          </span>
          {onAttachFile - (
            <button
              type="button"
              className="zvd-vfile-row__attach"
              title={t('files.attach')}
              aria-label={t('files.attach')}
              onClick={() => onAttachFile(row.relativePath)}
            >
              <Plus size={14} stroke={2} aria-hidden="true" />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
