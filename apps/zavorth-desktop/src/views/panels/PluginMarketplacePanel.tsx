import { useMemo } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { PageFrame, SearchBox, TextTabs } from './panelPrimitives';
import {
  IconStar,
  IconStarFilled,
  IconDownload,
  IconTrash,
  IconRefresh,
  IconCategory,
  IconPlug,
  IconShieldCheck,
  IconClock,
  IconUsers,
  IconChevronRight,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconExternalLink,
} from '@tabler/icons-react';

export type PluginCategory =
  | 'productivity'
  | 'development'
  | 'design'
  | 'communication'
  | 'analytics'
  | 'security'
  | 'automation'
  | 'other';

export type PluginStatus = 'available' | 'installed' | 'update_available' | 'deprecated';

export type PluginReview = {
  author: string;
  rating: number;
  comment: string;
  date: string;
};

export type PluginItem = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  latestVersion?: string;
  category: PluginCategory;
  status: PluginStatus;
  rating: number;
  reviewCount: number;
  downloads: number;
  icon?: string;
  screenshots?: string[];
  reviews?: PluginReview[];
  featured?: boolean;
  lastUpdated?: string;
  tags?: string[];
  skillMdContent?: string;
  sourceUrl?: string;
};

export type PluginMarketplacePanelProps = {
  plugins: PluginItem[];
  onInstall?: (pluginId: string) => void;
  onUninstall?: (pluginId: string) => void;
  onUpdate?: (pluginId: string) => void;
};

const $selectedTab = atom<'featured' | 'all' | 'categories' | 'installed'>('featured');
const $searchQuery = atom('');
const $selectedCategory = atom<PluginCategory | 'all'>('all');
const $selectedPlugin = atom<PluginItem | null>(null);
const $viewMode = atom<'grid' | 'list'>('grid');

const CATEGORY_META: Record<PluginCategory, { label: string; icon: React.ReactNode; color: string }> = {
  productivity: { label: 'Productivity', icon: <IconClock size={16} />, color: '#60a5fa' },
  development: { label: 'Development', icon: <IconPlug size={16} />, color: '#a78bfa' },
  design: { label: 'Design', icon: <IconCategory size={16} />, color: '#f472b6' },
  communication: { label: 'Communication', icon: <IconUsers size={16} />, color: '#4ade80' },
  analytics: { label: 'Analytics', icon: <IconCategory size={16} />, color: '#facc15' },
  security: { label: 'Security', icon: <IconShieldCheck size={16} />, color: '#f87171' },
  automation: { label: 'Automation', icon: <IconRefresh size={16} />, color: '#22d3ee' },
  other: { label: 'Other', icon: <IconCategory size={16} />, color: '#71717a' },
};

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function statusBadge(status: PluginStatus): { label: string; tone: string } {
  switch (status) {
    case 'installed':
      return { label: 'Installed', tone: 'ready' };
    case 'update_available':
      return { label: 'Update available', tone: 'warning' };
    case 'deprecated':
      return { label: 'Deprecated', tone: 'danger' };
    default:
      return { label: 'Available', tone: 'muted' };
  }
}

function StarRating(props: { rating: number; size?: number; interactive?: boolean; onChange?: (rating: number) => void }) {
  const size = props.size || 14;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(props.rating);
    stars.push(
      <span
        key={i}
        className={`zvd-pm-star ${filled ? 'is-filled' : ''} ${props.interactive ? 'is-interactive' : ''}`}
        onClick={() => props.interactive && props.onChange?.(i)}
        role={props.interactive ? 'button' : undefined}
        tabIndex={props.interactive ? 0 : undefined}
      >
        {filled ? <IconStarFilled size={size} /> : <IconStar size={size} />}
      </span>,
    );
  }
  return <span className="zvd-pm-stars">{stars}</span>;
}

function PluginCard(props: {
  plugin: PluginItem;
  onSelect: (plugin: PluginItem) => void;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
  onUpdate?: (id: string) => void;
  viewMode: 'grid' | 'list';
}) {
  const { plugin } = props;
  const badge = statusBadge(plugin.status);
  const catMeta = CATEGORY_META[plugin.category];

  return (
    <article
      className={`zvd-pm-card ${props.viewMode === 'list' ? 'is-list' : ''}`}
      onClick={() => props.onSelect(plugin)}
    >
      <div className="zvd-pm-card-header">
        <div className="zvd-pm-card-icon" style={{ background: `${catMeta.color}15`, color: catMeta.color }}>
          {plugin.icon ? <span>{plugin.icon}</span> : <IconPlug size={20} />}
        </div>
        <div className="zvd-pm-card-info">
          <h3 className="zvd-pm-card-name">{plugin.name}</h3>
          <span className="zvd-pm-card-author">{plugin.author}</span>
        </div>
        <span className={`zvd-pm-badge tone-${badge.tone}`}>{badge.label}</span>
      </div>

      <p className="zvd-pm-card-desc">{plugin.description}</p>

      <div className="zvd-pm-card-meta">
        <span className="zvd-pm-card-rating">
          <StarRating rating={plugin.rating} size={12} />
          <span className="zvd-pm-card-review-count">({plugin.reviewCount})</span>
        </span>
        <span className="zvd-pm-card-downloads">
          <IconDownload size={12} />
          {formatDownloads(plugin.downloads)}
        </span>
      </div>

      <div className="zvd-pm-card-footer">
        <span className="zvd-pm-card-version">v{plugin.version}</span>
        <div className="zvd-pm-card-actions" onClick={e => e.stopPropagation()}>
          {plugin.status === 'update_available' && props.onUpdate && (
            <button
              type="button"
              className="zvd-pm-btn is-update"
              onClick={() => props.onUpdate?.(plugin.id)}
            >
              <IconRefresh size={13} />
              Update
            </button>
          )}
          {plugin.status === 'installed' && props.onUninstall && (
            <button
              type="button"
              className="zvd-pm-btn is-uninstall"
              onClick={() => props.onUninstall?.(plugin.id)}
            >
              <IconTrash size={13} />
            </button>
          )}
          {plugin.status === 'available' && props.onInstall && (
            <button
              type="button"
              className="zvd-pm-btn is-install"
              onClick={() => props.onInstall?.(plugin.id)}
            >
              <IconDownload size={13} />
              Install
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function PluginDetailModal(props: {
  plugin: PluginItem;
  onClose: () => void;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
  onUpdate?: (id: string) => void;
}) {
  const { plugin } = props;
  const badge = statusBadge(plugin.status);
  const catMeta = CATEGORY_META[plugin.category];

  return (
    <div className="zvd-pm-modal-backdrop" onClick={props.onClose}>
      <div className="zvd-pm-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="zvd-pm-modal-close" onClick={props.onClose}>
          <IconX size={18} />
        </button>

        <div className="zvd-pm-modal-header">
          <div className="zvd-pm-modal-icon" style={{ background: `${catMeta.color}15`, color: catMeta.color }}>
            {plugin.icon ? <span>{plugin.icon}</span> : <IconPlug size={28} />}
          </div>
          <div>
            <h2 className="zvd-pm-modal-title">{plugin.name}</h2>
            <div className="zvd-pm-modal-subtitle">
              <span>by {plugin.author}</span>
              <span className="zvd-pm-modal-dot">·</span>
              <span>v{plugin.version}</span>
              {plugin.latestVersion && plugin.status === 'update_available' && (
                <>
                  <span className="zvd-pm-modal-dot">·</span>
                  <span className="zvd-pm-modal-update-hint">v{plugin.latestVersion} available</span>
                </>
              )}
            </div>
          </div>
          <span className={`zvd-pm-badge tone-${badge.tone}`}>{badge.label}</span>
        </div>

        <div className="zvd-pm-modal-rating-row">
          <StarRating rating={plugin.rating} size={16} />
          <span className="zvd-pm-modal-rating-text">
            {plugin.rating.toFixed(1)} ({plugin.reviewCount} reviews)
          </span>
          <span className="zvd-pm-modal-downloads">
            <IconDownload size={14} />
            {formatDownloads(plugin.downloads)} downloads
          </span>
        </div>

        <div className="zvd-pm-modal-section">
          <h3>Description</h3>
          <p>{plugin.description}</p>
        </div>

        {plugin.tags && plugin.tags.length > 0 && (
          <div className="zvd-pm-modal-section">
            <h3>Tags</h3>
            <div className="zvd-pm-tags">
              {plugin.tags.map(tag => (
                <span key={tag} className="zvd-pm-tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {plugin.screenshots && plugin.screenshots.length > 0 && (
          <div className="zvd-pm-modal-section">
            <h3>Screenshots</h3>
            <div className="zvd-pm-screenshots">
              {plugin.screenshots.map((src, i) => (
                <img key={i} src={src} alt={`Screenshot ${i + 1}`} className="zvd-pm-screenshot" />
              ))}
            </div>
          </div>
        )}

        {plugin.reviews && plugin.reviews.length > 0 && (
          <div className="zvd-pm-modal-section">
            <h3>Reviews</h3>
            <div className="zvd-pm-reviews">
              {plugin.reviews.slice(0, 5).map((review, i) => (
                <div key={i} className="zvd-pm-review">
                  <div className="zvd-pm-review-header">
                    <span className="zvd-pm-review-author">{review.author}</span>
                    <StarRating rating={review.rating} size={11} />
                    <span className="zvd-pm-review-date">{review.date}</span>
                  </div>
                  <p className="zvd-pm-review-comment">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="zvd-pm-modal-footer">
          <div className="zvd-pm-modal-info">
            <span>
              <IconCategory size={14} />
              {catMeta.label}
            </span>
            {plugin.lastUpdated && (
              <span>
                <IconClock size={14} />
                Updated {plugin.lastUpdated}
              </span>
            )}
          </div>
          <div className="zvd-pm-modal-actions">
            {plugin.status === 'update_available' && props.onUpdate && (
              <button type="button" className="zvd-pm-btn is-update" onClick={() => props.onUpdate?.(plugin.id)}>
                <IconRefresh size={14} />
                Update to v{plugin.latestVersion}
              </button>
            )}
            {plugin.status === 'installed' && props.onUninstall && (
              <button type="button" className="zvd-pm-btn is-uninstall" onClick={() => props.onUninstall?.(plugin.id)}>
                <IconTrash size={14} />
                Uninstall
              </button>
            )}
            {plugin.status === 'available' && props.onInstall && (
              <button type="button" className="zvd-pm-btn is-install" onClick={() => props.onInstall?.(plugin.id)}>
                <IconDownload size={14} />
                Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryNav(props: {
  selected: PluginCategory | 'all';
  onSelect: (cat: PluginCategory | 'all') => void;
  plugins: PluginItem[];
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of props.plugins) {
      map.set(p.category, (map.get(p.category) || 0) + 1);
    }
    return map;
  }, [props.plugins]);

  return (
    <div className="zvd-pm-categories">
      <button
        type="button"
        className={`zvd-pm-cat-btn ${props.selected === 'all' ? 'is-active' : ''}`}
        onClick={() => props.onSelect('all')}
      >
        <IconCategory size={16} />
        <span>All</span>
        <span className="zvd-pm-cat-count">{props.plugins.length}</span>
      </button>
      {(Object.keys(CATEGORY_META) as PluginCategory[]).map(cat => {
        const meta = CATEGORY_META[cat];
        const count = counts.get(cat) || 0;
        if (count === 0) return null;
        return (
          <button
            type="button"
            key={cat}
            className={`zvd-pm-cat-btn ${props.selected === cat ? 'is-active' : ''}`}
            onClick={() => props.onSelect(cat)}
          >
            <span style={{ color: meta.color }}>{meta.icon}</span>
            <span>{meta.label}</span>
            <span className="zvd-pm-cat-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ViewToggle(props: { mode: 'grid' | 'list'; onChange: (mode: 'grid' | 'list') => void }) {
  return (
    <div className="zvd-pm-view-toggle">
      <button
        type="button"
        className={props.mode === 'grid' ? 'is-active' : ''}
        onClick={() => props.onChange('grid')}
        title="Grid view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        type="button"
        className={props.mode === 'list' ? 'is-active' : ''}
        onClick={() => props.onChange('list')}
        title="List view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="6" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="11" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}

export default function PluginMarketplacePanel(props: PluginMarketplacePanelProps) {
  const tab = useStore($selectedTab);
  const search = useStore($searchQuery);
  const category = useStore($selectedCategory);
  const selectedPlugin = useStore($selectedPlugin);
  const viewMode = useStore($viewMode);

  const featuredPlugins = useMemo(() => props.plugins.filter(p => p.featured), [props.plugins]);

  const installedPlugins = useMemo(() => props.plugins.filter(p => p.status === 'installed' || p.status === 'update_available'), [props.plugins]);

  const updateCount = useMemo(() => props.plugins.filter(p => p.status === 'update_available').length, [props.plugins]);

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.plugins.filter(p => {
      if (tab === 'featured' && !p.featured) return false;
      if (tab === 'installed' && p.status !== 'installed' && p.status !== 'update_available') return false;
      if (category !== 'all' && p.category !== category) return false;
      if (q) {
        const there isystack = `${p.name} ${p.description} ${p.author} ${(p.tags || []).join(' ')}`.toLowerCase();
        if (!there isystack.includes(q)) return false;
      }
      return true;
    });
  }, [props.plugins, tab, category, search]);

  const tabItems = useMemo(() => [
    { value: 'featured' as const, label: 'Featured', count: featuredPlugins.length },
    { value: 'all' as const, label: 'All Plugins', count: props.plugins.length },
    { value: 'categories' as const, label: 'Categories' },
    { value: 'installed' as const, label: 'Installed', count: installedPlugins.length },
  ], [featuredPlugins.length, props.plugins.length, installedPlugins.length]);

  return (
    <PageFrame
      eyebrow="marketplace"
      description="Discover, install, and manage plugins to extend your workspace capabilities."
      meta={`${props.plugins.length} plugins`}
      title="Plugin Marketplace"
      actions={
        <div className="zvd-pm-header-actions">
          {updateCount > 0 && (
            <span className="zvd-pm-update-badge">
              <IconAlertTriangle size={13} />
              {updateCount} update{updateCount !== 1 ? 's' : ''}
            </span>
          )}
          <SearchBox value={search} onChange={$searchQuery.set} placeholder="Search plugins..." />
        </div>
      }
    >
      <style>{`
        .zvd-pm-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .zvd-pm-update-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 600;
          color: #facc15;
          background: rgba(234, 179, 8, 0.12);
          padding: 4px 10px;
          border-radius: 6px;
          white-space: nowrap;
        }

        /* View toggle */
        .zvd-pm-view-toggle {
          display: flex;
          gap: 2px;
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 2px;
          margin-left: auto;
        }

        .zvd-pm-view-toggle button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: #71717a;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .zvd-pm-view-toggle button.is-active {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .zvd-pm-view-toggle button:hover:not(.is-active) {
          color: #a1a1aa;
        }

        /* Toolbar row */
        .zvd-pm-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        /* Category navigation */
        .zvd-pm-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 20px;
        }

        .zvd-pm-cat-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: #121318;
          color: #a1a1aa;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .zvd-pm-cat-btn:hover {
          border-color: rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
        }

        .zvd-pm-cat-btn.is-active {
          border-color: var(--zvd-accent, #f16a21);
          background: rgba(241, 106, 33, 0.1);
          color: var(--zvd-accent, #f16a21);
        }

        .zvd-pm-cat-count {
          font-size: 10.5px;
          color: #52525b;
          font-weight: 600;
        }

        /* Featured banner */
        .zvd-pm-featured {
          margin-bottom: 24px;
        }

        .zvd-pm-featured-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #71717a;
          margin-bottom: 12px;
        }

        .zvd-pm-featured-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }

        /* Plugin cards grid */
        .zvd-pm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        .zvd-pm-grid.is-list {
          grid-template-columns: 1fr;
        }

        /* Plugin card */
        .zvd-pm-card {
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .zvd-pm-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-pm-card.is-list {
          flex-direction: row;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
        }

        .zvd-pm-card.is-list .zvd-pm-card-header {
          flex: 0 0 auto;
          min-width: 200px;
        }

        .zvd-pm-card.is-list .zvd-pm-card-desc {
          flex: 1;
          margin: 0;
          -webkit-line-clamp: 1;
        }

        .zvd-pm-card.is-list .zvd-pm-card-meta {
          flex: 0 0 auto;
        }

        .zvd-pm-card.is-list .zvd-pm-card-footer {
          flex: 0 0 auto;
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }

        .zvd-pm-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .zvd-pm-card-icon {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 18px;
        }

        .zvd-pm-card-info {
          flex: 1;
          min-width: 0;
        }

        .zvd-pm-card-name {
          font-size: 13.5px;
          font-weight: 600;
          color: #fff;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .zvd-pm-card-author {
          font-size: 11px;
          color: #71717a;
        }

        .zvd-pm-card-desc {
          font-size: 12.5px;
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .zvd-pm-card-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11.5px;
          color: #71717a;
        }

        .zvd-pm-card-rating {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zvd-pm-card-review-count {
          color: #52525b;
          font-size: 10.5px;
        }

        .zvd-pm-card-downloads {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zvd-pm-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .zvd-pm-card-version {
          font-size: 10.5px;
          color: #52525b;
          font-weight: 500;
        }

        .zvd-pm-card-actions {
          display: flex;
          gap: 6px;
        }

        /* Badges */
        .zvd-pm-badge {
          display: inline-block;
          font-size: 10.5px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          white-space: nowrap;
        }

        .zvd-pm-badge.tone-ready {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .zvd-pm-badge.tone-warning {
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
        }

        .zvd-pm-badge.tone-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .zvd-pm-badge.tone-muted {
          background: rgba(255, 255, 255, 0.05);
          color: #71717a;
        }

        /* Buttons */
        .zvd-pm-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          background: #25262d;
          color: #e4e4e7;
        }

        .zvd-pm-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .zvd-pm-btn.is-install {
          background: var(--zvd-accent, #f16a21);
          border-color: var(--zvd-accent, #f16a21);
          color: #fff;
        }

        .zvd-pm-btn.is-install:hover {
          opacity: 0.9;
        }

        .zvd-pm-btn.is-update {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.3);
          color: #4ade80;
        }

        .zvd-pm-btn.is-update:hover {
          background: rgba(34, 197, 94, 0.2);
        }

        .zvd-pm-btn.is-uninstall {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .zvd-pm-btn.is-uninstall:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        /* Stars */
        .zvd-pm-stars {
          display: inline-flex;
          gap: 1px;
        }

        .zvd-pm-star {
          color: #3f3f46;
          display: inline-flex;
        }

        .zvd-pm-star.is-filled {
          color: #facc15;
        }

        .zvd-pm-star.is-interactive {
          cursor: pointer;
        }

        .zvd-pm-star.is-interactive:hover {
          color: #fde68a;
        }

        /* Empty state */
        .zvd-pm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: #71717a;
          text-align: center;
          gap: 8px;
        }

        .zvd-pm-empty-icon {
          color: #3f3f46;
          margin-bottom: 4px;
        }

        .zvd-pm-empty-text {
          font-size: 13.5px;
          font-weight: 500;
        }

        .zvd-pm-empty-hint {
          font-size: 12px;
          color: #52525b;
        }

        /* Modal */
        .zvd-pm-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .zvd-pm-modal {
          position: relative;
          background: #0d0e12;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          width: 100%;
          max-width: 640px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .zvd-pm-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: rgba(255, 255, 255, 0.06);
          color: #71717a;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .zvd-pm-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .zvd-pm-modal-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-right: 40px;
        }

        .zvd-pm-modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .zvd-pm-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .zvd-pm-modal-subtitle {
          font-size: 12.5px;
          color: #71717a;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }

        .zvd-pm-modal-dot {
          color: #3f3f46;
        }

        .zvd-pm-modal-update-hint {
          color: #facc15;
          font-weight: 500;
        }

        .zvd-pm-modal-rating-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #a1a1aa;
        }

        .zvd-pm-modal-rating-text {
          font-weight: 500;
        }

        .zvd-pm-modal-downloads {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-left: auto;
          color: #71717a;
          font-size: 12px;
        }

        .zvd-pm-modal-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .zvd-pm-modal-section h3 {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #71717a;
          margin: 0;
        }

        .zvd-pm-modal-section p {
          font-size: 13.5px;
          color: #e4e4e7;
          line-height: 1.6;
          margin: 0;
        }

        /* Tags */
        .zvd-pm-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .zvd-pm-tag {
          font-size: 11px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          color: #a1a1aa;
        }

        /* Screenshots */
        .zvd-pm-screenshots {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .zvd-pm-screenshot {
          height: 140px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          object-fit: cover;
        }

        /* Reviews */
        .zvd-pm-reviews {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .zvd-pm-review {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 12px;
        }

        .zvd-pm-review-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .zvd-pm-review-author {
          font-size: 12.5px;
          font-weight: 600;
          color: #e4e4e7;
        }

        .zvd-pm-review-date {
          font-size: 11px;
          color: #52525b;
          margin-left: auto;
        }

        .zvd-pm-review-comment {
          font-size: 12.5px;
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        /* Modal footer */
        .zvd-pm-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          gap: 12px;
        }

        .zvd-pm-modal-info {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 12px;
          color: #71717a;
        }

        .zvd-pm-modal-info span {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .zvd-pm-modal-actions {
          display: flex;
          gap: 8px;
        }

        /* Section title */
        .zvd-pm-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #71717a;
          margin: 20px 0 10px 4px;
        }
      `}</style>

      <TextTabs
        value={tab}
        onChange={$selectedTab.set}
        items={tabItems}
      />

      {tab === 'categories' && (
        <CategoryNav selected={category} onSelect={$selectedCategory.set} plugins={props.plugins} />
      )}

      {tab !== 'categories' && tab !== 'installed' && featuredPlugins.length > 0 && tab === 'featured' && (
        <div className="zvd-pm-featured">
          <div className="zvd-pm-featured-title">Featured Plugins</div>
          <div className="zvd-pm-featured-grid">
            {featuredPlugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                viewMode="grid"
                onSelect={$selectedPlugin.set}
                onInstall={props.onInstall}
                onUninstall={props.onUninstall}
                onUpdate={props.onUpdate}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'featured' && (
        <>
          <div className="zvd-pm-section-title">All Plugins</div>
          <div className="zvd-pm-toolbar">
            <ViewToggle mode={viewMode} onChange={$viewMode.set} />
          </div>
        </>
      )}

      {tab !== 'featured' && (
        <div className="zvd-pm-toolbar">
          <ViewToggle mode={viewMode} onChange={$viewMode.set} />
        </div>
      )}

      {filteredPlugins.length === 0 ? (
        <div className="zvd-pm-empty">
          <div className="zvd-pm-empty-icon"><IconPlug size={32} /></div>
          <div className="zvd-pm-empty-text">No plugins found</div>
          <div className="zvd-pm-empty-hint">
            {search ? 'Try a different search term' : 'No plugins available in this category'}
          </div>
        </div>
      ) : (
        <div className={`zvd-pm-grid ${viewMode === 'list' ? 'is-list' : ''}`}>
          {(tab === 'featured' ? filteredPlugins.filter(p => !p.featured) : filteredPlugins).map(plugin => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              viewMode={viewMode}
              onSelect={$selectedPlugin.set}
              onInstall={props.onInstall}
              onUninstall={props.onUninstall}
              onUpdate={props.onUpdate}
            />
          ))}
        </div>
      )}

      {selectedPlugin && (
        <PluginDetailModal
          plugin={selectedPlugin}
          onClose={() => $selectedPlugin.set(null)}
          onInstall={props.onInstall}
          onUninstall={props.onUninstall}
          onUpdate={props.onUpdate}
        />
      )}
    </PageFrame>
  );
}
