import { useEffect, useMemo, useState } from 'react';
import type {
  PluginOsBridgePlugin,
  PluginOsMarketplaceEntry,
  PluginOsPlanePanelData,
} from '../../desktop-state/pluginOsBridge';
import {
  friendlyMetricsLabelField,
  humanPluginStatus,
  humanPluginStatusLabel,
  humanTrustLabel,
  summarizePluginOsPlane,
} from '../../desktop-state/pluginOsBridge';
import { PageFrame, SearchBox, TextTabs } from './panelPrimitives';
import PluginOsOnboardingWizardPanel, {
  defaultPluginOsWizardProfiles,
  type PluginOsWizardOptional,
} from './PluginOsOnboardingWizardPanel';

type Filter = 'all' | 'enabled' | 'disabled' | 'blocked' | 'marketplace';

export type PluginOsPlanePanelProps = {
  data: PluginOsPlanePanelData;
  labels?: Partial<Record<string, string>>;
  onEnable?: (pluginId: string) => void;
  onDisable?: (pluginId: string) => void;
  onInspect?: (pluginId: string) => void;
  onRefresh?: () => void | Promise<void>;
  onRecommend?: (intent: string) => void | Promise<void>;
  onCatalogApply?: () => void | Promise<void>;
  onOnboarding?: (profile?: string) => void | Promise<void>;
  onUndoOnboarding?: () => void | Promise<void>;
  onWizardOptional?: (pluginId: string, selected: boolean) => void | Promise<void>;
  wizardOptionals?: Array<{
    id: string;
    name: string;
    summary: string;
    selected: boolean;
    available?: boolean;
  }>;
  telemetryHistory?: Array<{
    bucketStart: string;
    samples: number;
    recommends: number;
    enables: number;
    avgEnabled: number | null;
    health: string | null;
  }>;
  /** When true, suppress auto-opening the wizard on empty (tests / host control). */
  preferEmptyState?: boolean;
  /** Active suggest-to-enable card from last recommend/suggest. */
  suggest?: {
    title?: string;
    body?: string;
    message?: string;
    primary?: { pluginId?: string; needsCredentials?: boolean; risks?: string[] } | null;
    ui?: { actions?: Array<{ id: string; label: string; pluginId?: string }> };
  } | null;
  onSuggestAction?: (actionId: string, pluginId?: string) => void | Promise<void>;
  /** Human activity timeline */
  receipts?: Array<{ id?: string; headline?: string; detail?: string; createdAt?: string }>;
  injectMode?: string;
};

const DEFAULT_LABELS: Record<string, string> = {
  title: 'Plugin OS',
  eyebrow: 'RUNTIME',
  description: 'Add capabilities to Zavorth — search, mail, tools, and more. You stay in control.',
  search: 'Search plugins',
  all: 'All',
  enabled: 'Enabled',
  disabled: 'Disabled',
  blocked: 'Blocked',
  marketplace: 'Marketplace',
  enable: 'Enable',
  disable: 'Disable',
  inspect: 'Inspect',
  refresh: 'Refresh',
  empty: 'No plugins yet.',
  emptyFilter: 'No plugins match this filter.',
  findings: 'Checks',
  noFindings: 'Nothing to report',
  trust: 'Trust',
  state: 'State',
  eligible: 'Ready to load',
  yes: 'Yes',
  no: 'No',
  installed: 'Installed',
  revision: 'Revision',
  source: 'Source',
  health: 'Health',
  funnel: 'Coverage',
  coverage: 'Coverage',
  firstParty: 'Built-in',
  mcp: 'MCP',
  forge: 'Change receipts',
  deepLinks: 'Shortcuts',
  recommend: 'Suggest plugins',
  recommendPlaceholder: 'e.g. search the web',
  catalogApply: 'Apply starter catalog',
  onboarding: 'Activate recommended pack',
  undoOnboarding: 'Undo onboarding',
  enableHint: 'CLI enable',
  tier: 'Tier',
  summary: 'Summary',
  optionals: 'Optional plugins',
  history: 'Recent activity',
  setup: 'Setup',
  setupGuide: 'Setup guide',
  statusActive: 'Active',
  statusAvailable: 'Available',
  statusNeedsSetup: 'Needs setup',
  statusBlocked: 'Blocked',
  trustReview: 'Needs review',
  trustTrusted: 'Trusted',
  trustBlocked: 'Blocked',
  emptyTitle: 'Make Zavorth more capable',
  emptyBody: 'Plugin OS adds tools and integrations when you want them. Nothing turns on until you choose.',
  emptyCtaPrimary: 'Activate recommended pack',
  emptyCtaSetup: 'Open setup guide',
  emptyNeverAuto: 'Never auto-enables plugins — you approve every change.',
  emptyRecommendHint: 'Or describe what you need:',
  intentSearchWeb: 'search the web',
  intentReadMail: 'read my email',
  intentTrackTasks: 'track tasks',
  wizardTitle: 'Plugin setup',
  wizardSubtitle: 'Pick a starting pack. You can change this anytime.',
  wizardWelcomeTitle: 'Welcome to Plugin OS',
  wizardWelcomeBody:
    'Plugins extend what Zavorth can do — from web search to mail and project tools. Choose a pack that matches how you work.',
  wizardProfileTitle: 'Choose a starting pack',
  wizardProfileBody: 'Each pack enables a different set of built-in plugins. You stay in control.',
  wizardOptionalsTitle: 'Optional add-ons',
  wizardOptionalsBody: 'These usually need sign-in or extra setup. Skip any you do not need.',
  wizardOptionalsEmpty: 'No optional plugins for this pack.',
  wizardReviewTitle: 'Review your choices',
  wizardReviewBody: 'Confirm the pack and optionals before applying. Nothing is enabled until you apply.',
  wizardDoneTitle: 'You are set',
  wizardDoneBody: 'Your pack request was sent. Refresh the list if plugins do not appear yet.',
  wizardNext: 'Next',
  wizardBack: 'Back',
  wizardSkip: 'Skip setup',
  wizardApply: 'Apply pack',
  wizardClose: 'Done',
  wizardStepOf: 'Step {current} of {total}',
  wizardProfileMinimal: 'Minimal',
  wizardProfileMinimalSummary: 'Router, security guidance, and MCP bridge only.',
  wizardProfileCore: 'Core',
  wizardProfileCoreSummary: 'Safe built-in defaults without credential-heavy tools.',
  wizardProfileRecommended: 'Recommended',
  wizardProfileRecommendedSummary: 'Balanced first-party pack for most people.',
  wizardProfileFull: 'Full',
  wizardProfileFullSummary: 'Every built-in plugin, including optional integrations.',
  wizardSelectedProfile: 'Pack',
  wizardSelectedOptionals: 'Optionals',
  wizardNoneSelected: 'None',
  suggestTitle: 'Plugin can help',
  suggestNeverAuto: 'Never auto-enables — you choose Enable or Recommend only.',
  activityTitle: 'Recent activity',
  activityEmpty: 'No recent plugin activity yet.',
  injectModeLabel: 'Prompt inject',
};

const DEFAULT_OPTIONALS: PluginOsWizardOptional[] = [
  { id: 'gmail', name: 'Gmail', summary: 'Read and draft mail (needs sign-in).', selected: false },
  { id: 'linear', name: 'Linear', summary: 'Track issues and projects.', selected: false },
  { id: 'notion', name: 'Notion', summary: 'Notes and workspace pages.', selected: false },
  { id: 'browser-playwright', name: 'Browser', summary: 'Automate a local browser session.', selected: false },
  { id: 'memory-honcho', name: 'Long-term memory', summary: 'Optional persistent memory helper.', selected: false },
];

export default function PluginOsPlanePanel(props: PluginOsPlanePanelProps) {
  const labels: Record<string, string> = { ...DEFAULT_LABELS };
  for (const [key, value] of Object.entries(props.labels || {})) {
    if (typeof value === 'string' && value.length > 0) labels[key] = value;
  }
  const isEmpty = props.data.plugins.length === 0;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [recommendIntent, setRecommendIntent] = useState('');
  const [wizardOpen, setWizardOpen] = useState(() => isEmpty && !props.preferEmptyState);
  const [selectedProfile, setSelectedProfile] = useState('recommended');
  const [optionalState, setOptionalState] = useState<Record<string, boolean>>({});

  // Auto-open wizard when the plane becomes empty (soft welcome path).
  useEffect(() => {
    if (isEmpty && !props.preferEmptyState) {
      setWizardOpen(true);
    }
  }, [isEmpty, props.preferEmptyState]);

  const summary = useMemo(() => summarizePluginOsPlane(props.data), [props.data]);
  const counts = useMemo(() => ({
    enabled: props.data.plugins.filter((plugin) => plugin.enabled).length,
    disabled: props.data.plugins.filter((plugin) => plugin.installed && !plugin.enabled).length,
    blocked: props.data.plugins.filter((plugin) => plugin.trust === 'blocked').length,
    marketplace: props.data.marketplace.length,
  }), [props.data.plugins, props.data.marketplace]);

  const statusLabels = useMemo(() => ({
    active: labels.statusActive,
    available: labels.statusAvailable,
    needs_setup: labels.statusNeedsSetup,
    blocked: labels.statusBlocked,
  }), [labels.statusActive, labels.statusAvailable, labels.statusNeedsSetup, labels.statusBlocked]);

  const trustLabels = useMemo(() => ({
    review: labels.trustReview,
    trusted: labels.trustTrusted,
    blocked: labels.trustBlocked,
  }), [labels.trustReview, labels.trustTrusted, labels.trustBlocked]);

  const wizardProfiles = useMemo(
    () => defaultPluginOsWizardProfiles(labels),
    [labels],
  );

  const wizardOptionals: PluginOsWizardOptional[] = useMemo(() => {
    const source = props.wizardOptionals && props.wizardOptionals.length > 0
      ? props.wizardOptionals
      : DEFAULT_OPTIONALS;
    return source.map((item) => ({
      ...item,
      selected: optionalState[item.id] !== undefined ? Boolean(optionalState[item.id]) : Boolean(item.selected),
    }));
  }, [props.wizardOptionals, optionalState]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.data.plugins.filter((plugin) => {
      if (filter === 'marketplace') return false;
      if (filter === 'enabled' && !plugin.enabled) return false;
      if (filter === 'disabled' && (plugin.enabled || !plugin.installed)) return false;
      if (filter === 'blocked' && plugin.trust !== 'blocked') return false;
      if (!q) return true;
      const haystack = [
        plugin.pluginId,
        plugin.trust,
        plugin.runtimeState,
        plugin.sourceLocator || '',
        ...(plugin.findings || []),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, props.data.plugins, query]);

  const marketplaceVisible = useMemo(() => {
    if (filter !== 'marketplace' && filter !== 'all') return [] as PluginOsMarketplaceEntry[];
    const q = query.trim().toLowerCase();
    return props.data.marketplace.filter((entry) => {
      if (filter === 'all') return false; // marketplace only on its tab
      if (!q) return true;
      const haystack = [entry.id, entry.name, entry.summary || '', entry.tier || '', ...(entry.tags || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, props.data.marketplace, query]);

  const selected: PluginOsBridgePlugin | null =
    visible.find((plugin) => plugin.pluginId === selectedId) || visible[0] || null;

  const selectedMarket: PluginOsMarketplaceEntry | null =
    marketplaceVisible.find((entry) => entry.id === selectedMarketId) || marketplaceVisible[0] || null;

  const metrics = props.data.metrics;
  const coverageLabel = labels[friendlyMetricsLabelField('coverage')] || labels.coverage || labels.funnel;

  function rowStatusText(plugin: PluginOsBridgePlugin): string {
    const status = humanPluginStatus(plugin);
    return humanPluginStatusLabel(status, statusLabels);
  }

  function rowMetaText(plugin: PluginOsBridgePlugin): string {
    const trust = humanTrustLabel(plugin.trust, trustLabels);
    return `${trust} · ${rowStatusText(plugin)}`;
  }

  function handleOptionalToggle(pluginId: string, selectedOpt: boolean) {
    setOptionalState((prev) => ({ ...prev, [pluginId]: selectedOpt }));
    void props.onWizardOptional?.(pluginId, selectedOpt);
  }

  async function handleWizardApply(profile: string) {
    if (props.onOnboarding) {
      await props.onOnboarding(profile);
    }
  }

  const intentChips = [
    { id: 'search', label: labels.intentSearchWeb },
    { id: 'mail', label: labels.intentReadMail },
    { id: 'tasks', label: labels.intentTrackTasks },
  ];

  const showEmptyState = isEmpty && !wizardOpen;

  return (
    <PageFrame
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
      meta={
        isEmpty
          ? labels.empty
          : `${summary.total} plugins · ${summary.enabled} enabled · health ${summary.health}`
      }
      actions={(
        <div className="zvd-capability-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isEmpty - (
            <button
              className="zvd-btn zvd-btn-secondary zvd-btn-sm"
              type="button"
              onClick={() => setWizardOpen(true)}
            >
              {labels.setup}
            </button>
          ) : null}
          {props.onOnboarding && !wizardOpen ? (
            <button
              className="zvd-btn zvd-btn-primary zvd-btn-sm"
              onClick={() => void props.onOnboarding?.('recommended')}
              type="button"
            >
              {labels.onboarding}
            </button>
          ) : null}
          {props.onUndoOnboarding && !wizardOpen ? (
            <button
              className="zvd-btn zvd-btn-secondary zvd-btn-sm"
              onClick={() => void props.onUndoOnboarding?.()}
              type="button"
            >
              {labels.undoOnboarding}
            </button>
          ) : null}
          {props.onCatalogApply - (
            <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" onClick={() => void props.onCatalogApply?.()} type="button">
              {labels.catalogApply}
            </button>
          ) : null}
          {props.onRefresh - (
            <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" onClick={() => void props.onRefresh?.()} type="button">
              {labels.refresh}
            </button>
          ) : null}
        </div>
      )}
    >
      {wizardOpen - (
        <PluginOsOnboardingWizardPanel
          profiles={wizardProfiles}
          optionals={wizardOptionals}
          selectedProfile={selectedProfile}
          onProfileChange={setSelectedProfile}
          onOptionalToggle={handleOptionalToggle}
          onApply={handleWizardApply}
          onSkip={() => setWizardOpen(false)}
          labels={labels}
        />
      ) : null}

      {showEmptyState - (
        <div
          className="zvd-capability-empty"
          role="region"
          aria-label={labels.emptyTitle}
          style={{
            textAlign: 'left',
            padding: 20,
            marginBottom: 12,
            border: '1px solid var(--zvd-border, rgba(255,255,255,0.08))',
            borderRadius: 12,
          }}
        >
          <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: 8 }}>{labels.emptyTitle}</strong>
          <span style={{ display: 'block', marginBottom: 12, opacity: 0.9 }}>{labels.emptyBody}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {props.onOnboarding - (
              <button
                className="zvd-btn zvd-btn-primary zvd-btn-sm"
                type="button"
                onClick={() => void props.onOnboarding?.('recommended')}
              >
                {labels.emptyCtaPrimary}
              </button>
            ) : null}
            <button
              className="zvd-btn zvd-btn-secondary zvd-btn-sm"
              type="button"
              onClick={() => setWizardOpen(true)}
            >
              {labels.emptyCtaSetup}
            </button>
          </div>
          {props.onRecommend - (
            <div style={{ marginBottom: 10 }}>
              <span style={{ display: 'block', marginBottom: 6, opacity: 0.85 }}>{labels.emptyRecommendHint}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {intentChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="zvd-btn zvd-btn-secondary zvd-btn-sm"
                    onClick={() => void props.onRecommend?.(chip.label)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <small style={{ opacity: 0.75 }}>{labels.emptyNeverAuto}</small>
        </div>
      ) : null}

      {!isEmpty && metrics ? (
        <div className="zvd-capability-summary" aria-label="Plugin OS metrics">
          <div><strong>{metrics.health}</strong><span>{labels.health}</span></div>
          <div><strong>{metrics.loadEligible}/{metrics.discovered}</strong><span>{coverageLabel}</span></div>
          <div><strong>{metrics.firstPartyEnabled}/{metrics.firstPartyTotal}</strong><span>{labels.firstParty}</span></div>
          <div><strong>{metrics.mcpEnabled}/{metrics.mcpConfigured}</strong><span>{labels.mcp}</span></div>
          <div><strong>{metrics.forgeReceipts}</strong><span>{labels.forge}</span></div>
        </div>
      ) : !isEmpty ? (
        <div className="zvd-capability-summary" aria-label="Plugin OS summary">
          <div><strong>{summary.installed}</strong><span>{labels.installed}</span></div>
          <div><strong>{counts.enabled}</strong><span>{labels.enabled}</span></div>
          <div><strong>{counts.blocked}</strong><span>{labels.blocked}</span></div>
        </div>
      ) : null}

      {props.telemetryHistory && props.telemetryHistory.length > 0 ? (
        <div className="zvd-capability-summary" aria-label={labels.history} style={{ marginBottom: 8 }}>
          {props.telemetryHistory.slice(-6).map((point) => (
            <div key={point.bucketStart}>
              <strong>{point.avgEnabled == null ? point.samples : point.avgEnabled.toFixed(0)}</strong>
              <span>{new Date(point.bucketStart).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })} · rec {point.recommends}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!wizardOpen && props.wizardOptionals && props.wizardOptionals.length > 0 ? (
        <div style={{ marginBottom: 12 }} aria-label={labels.optionals}>
          <strong>{labels.optionals}</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
            {props.wizardOptionals.map((item) => (
              <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={item.selected}
                  disabled={item.available === false || !props.onWizardOptional}
                  onChange={(event) => void props.onWizardOptional?.(item.id, event.target.checked)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small style={{ display: 'block', opacity: 0.8 }}>{item.summary}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.suggest?.primary || props.suggest?.ui?.actions?.length ? (
        <div
          className="zvd-capability-empty"
          role="region"
          aria-label={props.suggest?.title || labels.suggestTitle}
          style={{ marginBottom: 12, textAlign: 'left', padding: 12 }}
        >
          <strong>{props.suggest?.title || labels.suggestTitle}</strong>
          <p style={{ margin: '6px 0' }}>{props.suggest?.body || props.suggest?.message}</p>
          {props.suggest?.primary?.risks?.length - (
            <small style={{ display: 'block', opacity: 0.8, marginBottom: 8 }}>
              {props.suggest.primary.risks.slice(0, 3).join(' · ')}
              {props.suggest.primary.needsCredentials ? ' · may need credentials' : ''}
            </small>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(props.suggest?.ui?.actions || []).map((action) => (
              <button
                key={`${action.id}-${action.pluginId || ''}`}
                type="button"
                className={action.id === 'enable' ? 'zvd-btn zvd-btn-primary zvd-btn-sm' : 'zvd-btn zvd-btn-secondary zvd-btn-sm'}
                onClick={() => void props.onSuggestAction?.(action.id, action.pluginId)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <small style={{ display: 'block', marginTop: 8, opacity: 0.75 }}>{labels.suggestNeverAuto}</small>
        </div>
      ) : null}

      {!isEmpty && props.onRecommend ? (
        <div className="zvd-capability-toolbar" style={{ gap: 8 }}>
          <SearchBox
            value={recommendIntent}
            onChange={setRecommendIntent}
            placeholder={labels.recommendPlaceholder}
          />
          <button
            className="zvd-btn zvd-btn-secondary zvd-btn-sm"
            type="button"
            onClick={() => {
              const intent = recommendIntent.trim();
              if (intent) void props.onRecommend?.(intent);
            }}
          >
            {labels.recommend}
          </button>
        </div>
      ) : null}

      {props.receipts && props.receipts.length > 0 ? (
        <div style={{ marginBottom: 12 }} aria-label={labels.activityTitle}>
          <strong>{labels.activityTitle}</strong>
          {props.injectMode - (
            <small style={{ marginLeft: 8, opacity: 0.75 }}>
              {labels.injectModeLabel}: {props.injectMode}
            </small>
          ) : null}
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {props.receipts.slice(0, 8).map((entry) => (
              <li key={entry.id || entry.headline || entry.createdAt} style={{ marginBottom: 4 }}>
                {entry.headline || entry.detail || entry.createdAt}
                {entry.detail && entry.headline ? (
                  <small style={{ display: 'block', opacity: 0.75 }}>{entry.detail}</small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : !isEmpty ? (
        <div style={{ marginBottom: 12, opacity: 0.75 }}>
          <small>{labels.activityEmpty}</small>
          {props.injectMode - (
            <small style={{ marginLeft: 8 }}>{labels.injectModeLabel}: {props.injectMode}</small>
          ) : null}
        </div>
      ) : null}

      {!isEmpty - (
        <>
          <div className="zvd-capability-toolbar">
            <TextTabs<Filter>
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: labels.all, count: props.data.plugins.length },
                { value: 'enabled', label: labels.enabled, count: counts.enabled },
                { value: 'disabled', label: labels.disabled, count: counts.disabled },
                { value: 'blocked', label: labels.blocked, count: counts.blocked },
                { value: 'marketplace', label: labels.marketplace, count: counts.marketplace },
              ]}
            />
            <SearchBox value={query} onChange={setQuery} placeholder={labels.search} />
          </div>

          {filter === 'marketplace' ? (
            <div className="zvd-capability-layout">
              <div className="zvd-capability-list" role="listbox" aria-label="Curated marketplace">
                {marketplaceVisible.length - marketplaceVisible.map((entry) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedMarket?.id === entry.id}
                    className={`zvd-capability-row ${selectedMarket?.id === entry.id ? 'is-active' : ''}`}
                    key={entry.id}
                    onClick={() => setSelectedMarketId(entry.id)}
                  >
                    <span className="zvd-capability-row-icon" aria-hidden="true">
                      {entry.id.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="zvd-capability-row-copy">
                      <strong>{entry.name}</strong>
                      <small>{entry.tier || 'curated'} · {entry.moduleKind || 'plugin'}</small>
                    </span>
                    <span className="zvd-capability-row-status">
                      {entry.enabled ? labels.statusActive : entry.installed ? labels.installed : labels.statusAvailable}
                    </span>
                  </button>
                )) : (
                  <div className="zvd-capability-empty">
                    <strong>{query ? labels.emptyFilter : labels.empty}</strong>
                  </div>
                )}
              </div>
              <aside className="zvd-capability-detail" aria-live="polite">
                {selectedMarket - (
                  <>
                    <div className="zvd-capability-detail-heading">
                      <span className="zvd-capability-detail-icon" aria-hidden="true">
                        {selectedMarket.id.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h2>{selectedMarket.name}</h2>
                        <p>{selectedMarket.id}</p>
                      </div>
                    </div>
                    <dl className="zvd-capability-meta">
                      <div><dt>{labels.tier}</dt><dd>{selectedMarket.tier || '—'}</dd></div>
                      <div><dt>{labels.summary}</dt><dd>{selectedMarket.summary || '—'}</dd></div>
                      <div><dt>{labels.enableHint}</dt><dd><code>{selectedMarket.enableHint}</code></dd></div>
                    </dl>
                    <div className="zvd-capability-actions">
                      {!selectedMarket.enabled && props.onEnable ? (
                        <button className="zvd-btn zvd-btn-primary" type="button" onClick={() => props.onEnable?.(selectedMarket.id)}>
                          {labels.enable}
                        </button>
                      ) : null}
                      {selectedMarket.enabled && props.onDisable ? (
                        <button className="zvd-btn zvd-btn-secondary" type="button" onClick={() => props.onDisable?.(selectedMarket.id)}>
                          {labels.disable}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="zvd-capability-empty"><span>{labels.empty}</span></div>
                )}
              </aside>
            </div>
          ) : (
            <div className="zvd-capability-layout">
              <div className="zvd-capability-list" role="listbox" aria-label="Plugin OS packages">
                {visible.length - visible.map((plugin) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected?.pluginId === plugin.pluginId}
                    className={`zvd-capability-row ${selected?.pluginId === plugin.pluginId ? 'is-active' : ''}`}
                    key={plugin.pluginId}
                    onClick={() => setSelectedId(plugin.pluginId)}
                  >
                    <span className="zvd-capability-row-icon" aria-hidden="true">
                      {plugin.pluginId.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="zvd-capability-row-copy">
                      <strong>{plugin.pluginId}</strong>
                      <small>{rowMetaText(plugin)}</small>
                    </span>
                    <span className="zvd-capability-row-status">
                      {rowStatusText(plugin)}
                    </span>
                  </button>
                )) : (
                  <div className="zvd-capability-empty">
                    <strong>{query || filter !== 'all' ? labels.emptyFilter : labels.empty}</strong>
                  </div>
                )}
              </div>
              <aside className="zvd-capability-detail" aria-live="polite">
                {selected ? (
                  <>
                    <div className="zvd-capability-detail-heading">
                      <span className="zvd-capability-detail-icon" aria-hidden="true">
                        {selected.pluginId.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h2>{selected.pluginId}</h2>
                        <p>{selected.sourceLocator || selected.packageDir || '—'}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }} aria-label="Trust badges">
                          <span className="zvd-badge zvd-badge-tone-neutral" title={labels.trust}>
                            {humanTrustLabel(selected.trust, trustLabels)}
                          </span>
                          <span className="zvd-badge zvd-badge-tone-neutral" title={labels.state}>
                            {rowStatusText(selected)}
                          </span>
                          {selected.sourceLocator?.startsWith('bundled://') || selected.sourceLocator?.includes('first-party') ? (
                            <span className="zvd-badge zvd-badge-tone-success">{labels.firstParty}</span>
                          ) : null}
                          {selected.trust === 'blocked' ? (
                            <span className="zvd-badge zvd-badge-tone-error">{labels.statusBlocked}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0 }}>{labels.emptyNeverAuto}</p>
                    <dl className="zvd-capability-meta">
                      <div>
                        <dt>{labels.trust}</dt>
                        <dd>{humanTrustLabel(selected.trust, trustLabels)}</dd>
                      </div>
                      <div>
                        <dt>{labels.state}</dt>
                        <dd>{rowStatusText(selected)}</dd>
                      </div>
                      <div>
                        <dt>{labels.eligible}</dt>
                        <dd>
                          {selected.loadEligible === undefined ? '—'
                            : selected.loadEligible ? labels.yes : labels.no}
                        </dd>
                      </div>
                      <div><dt>{labels.revision}</dt><dd>{selected.installedRevision || '—'}</dd></div>
                      <div><dt>{labels.source}</dt><dd>{selected.sourceLocator || '—'}</dd></div>
                    </dl>
                    <div>
                      <strong>{labels.findings}</strong>
                      {selected.findings && selected.findings.length > 0 ? (
                        <ul>
                          {selected.findings.slice(0, 12).map((finding) => (
                            <li key={finding}>{finding}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{labels.noFindings}</p>
                      )}
                    </div>
                    <div className="zvd-capability-actions">
                      {!selected.enabled && props.onEnable ? (
                        <button className="zvd-btn zvd-btn-primary" type="button" onClick={() => props.onEnable?.(selected.pluginId)}>
                          {labels.enable}
                        </button>
                      ) : null}
                      {selected.enabled && props.onDisable ? (
                        <button className="zvd-btn zvd-btn-secondary" type="button" onClick={() => props.onDisable?.(selected.pluginId)}>
                          {labels.disable}
                        </button>
                      ) : null}
                      {props.onInspect - (
                        <button className="zvd-btn zvd-btn-secondary" type="button" onClick={() => props.onInspect?.(selected.pluginId)}>
                          {labels.inspect}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="zvd-capability-empty"><span>{labels.empty}</span></div>
                )}
              </aside>
            </div>
          )}
        </>
      ) : null}

      {props.data.deepLinks.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <strong>{labels.deepLinks}</strong>
          <ul>
            {props.data.deepLinks.slice(0, 8).map((link) => (
              <li key={link}><code>{link}</code></li>
            ))}
          </ul>
        </div>
      ) : null}
    </PageFrame>
  );
}
