import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileExplorerNode } from '../../global';
import type { DesktopWorkspaceScope } from '../../workspaceScopes';
import { InfinityLoader } from '../../components/InfinityLoader';
import { VirtualFileTree } from '../../components/VirtualFileTree';
import { Refresh } from '../../icons';
import { PageFrame, SearchBox } from '../panelChrome';
import { t } from '../../i18n';

export function FilesView(props: {
  workspaceScope: DesktopWorkspaceScope;
  onAttachFile?: (relativePath: string) => void;
}) {
  const [tree, setTree] = useState<FileExplorerNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const loadFileTree = useCallback(async () => {
    if (!props.workspaceScope.path) {
      setError(t('files.noFolder'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (window.zavorthDesktop?.readFileTree) {
        const res = await window.zavorthDesktop.readFileTree(props.workspaceScope.path);
        if (res.ok && res.tree) {
          setTree(res.tree);
        } else {
          setError(res.error || t('files.error'));
        }
      } else {
        setError(t('files.unavailable'));
      }
    } catch {
      setError(t('files.error'));
    } finally {
      setLoading(false);
    }
  }, [props.workspaceScope.path]);

  useEffect(() => {
    void loadFileTree();
  }, [loadFileTree]);

  const filterTree = (nodes: FileExplorerNode[], q: string): FileExplorerNode[] => {
    if (!q) return nodes;
    return nodes
      .map(node => {
        if (node.type === 'file') {
          return node.name.toLowerCase().includes(q) ? node : null;
        }
        const filteredChildren = node.children ? filterTree(node.children, q) : [];
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter((n): n is FileExplorerNode => n !== null);
  };

  const filteredTree = useMemo(() => filterTree(tree, query.trim().toLowerCase()), [tree, query]);

  return (
    <PageFrame
      description="Browse the trusted workspace folder and attach file references to chat."
      meta={props.workspaceScope.path || 'No path'}
      title={t('files.workspaceTitle')}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => void loadFileTree()}
            className="session-picker-btn"
            disabled={loading}
            title="Refresh"
            type="button"
            style={{
              padding: '6px',
              backgroundColor: 'var(--zvd-surface-panel, #161b22)',
              border: '1px solid var(--zvd-border, #30363d)',
              borderRadius: '4px',
              color: 'var(--zvd-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Refresh size={14} />
          </button>
          <SearchBox value={query} onChange={setQuery} placeholder="Filter files..." />
        </div>
      }
    >
      <div className="zvd-files-panel-body">
        {loading && <InfinityLoader text={t('files.loading')} />}
        {error && <div className="zvd-files-panel-error">{error}</div>}
        {!loading && !error && (
          <VirtualFileTree
            nodes={filteredTree}
            onAttachFile={props.onAttachFile}
            maxHeight="calc(100vh - 200px)"
            emptyLabel={t('files.empty')}
          />
        )}
      </div>
    </PageFrame>
  );
}
