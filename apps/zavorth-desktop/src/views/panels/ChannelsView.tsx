import { useState } from 'react';
import type { ChannelItem, ChannelSetupOption, ChannelSetupSnapshot } from '../../apiClient';
import { asRecord, panelLabels } from '../../primitives/desktopPrimitives';
import { StatusBadge } from '../../primitives';
import { readinessFromChannel } from '../../desktop-state/readiness';
import { asString, isRecord } from '../../lib/typeGuards';
import { DetailRows, PageFrame, SearchBox, EmptyRows } from '../panelChrome';

export function ChannelsView(props: {
  busy: boolean;
  channels: ChannelItem[];
  setup: ChannelSetupSnapshot | null;
  onSetupAction(input: {
    action: 'applyScaffold' | 'doctor' | 'testConnection';
    channelId?: string | null;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
  }): void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [configuringChannelId, setConfiguringChannelId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  
  const setupOptions = Array.isArray(props.setup?.assistant?.options) ? props.setup.assistant.options : [];
  const selected = props.setup?.assistant?.selected || setupOptions[0] || null;
  const rows = props.channels
    .filter(channel => {
      const record = asRecord(channel);
      const hay = `${record.name || ''} ${record.channel || ''} ${record.id || ''} ${record.status || ''} ${record.summary || ''}`.toLowerCase();
      return !query.trim() || hay.includes(query.trim().toLowerCase());
    })
    .map((channel, index) => {
      const record = asRecord(channel);
      const id = String(record.id || record.channel || record.name || `channel-${index}`);
      const badge = readinessFromChannel({
        status: String(record.status || ''),
        liveReady: Boolean(record.liveReady),
        configured: Boolean(record.configured),
        readiness: String(record.readiness || record.status || ''),
        summary: String(record.summary || (record.outboxOnly ? 'Outbox or preview route only.' : '') || ''),
      });
      // Never surface catalog-only as "ready" — StatusBadge maps available ≠ live.
      const detail =
        badge.detail
        || (badge.state === 'needs_setup'
          ? 'Needs setup before it can send live messages.'
          : badge.state === 'available'
            ? 'Catalog support — not proven live yet.'
            : badge.state === 'live'
              ? 'Live route is ready.'
              : record.outboxOnly
                ? 'Outbox or preview route only.'
                : undefined);
      return {
        id,
        title: String(record.name || record.channel || record.id || 'Channel'),
        description: detail,
        tone: badge.tone,
        actions: <StatusBadge state={badge.state} label={badge.label} />,
      };
    });

  return (
    <PageFrame
      description="Communication routes with honest readiness and delivery state."
      meta={`${props.channels.length} routes`}
      title={panelLabels.channels}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search channels" />}
    >
      <section className="zvd-settings-section" aria-label="Channel setup wizard">
        <h2>Channel setup</h2>
        {setupOptions.length === 0 ? (
          <EmptyRows text="No channel setup options are available yet." />
        ) : (
          <div className="zvd-detail-list">
            {setupOptions.slice(0, 8).map((option: ChannelSetupOption) => {
              const channelId = asString(option.channelId || option.id);
              const selectedChannelId = isRecord(selected) ? asString(selected.channelId) : '';
              const active = Boolean(selected) && selectedChannelId === channelId;
              const missingKeys = Array.isArray(option.missingEnvKeys)
                ? option.missingEnvKeys.map(key => asString(key)).filter(Boolean)
                : [];
              const hasMissing = missingKeys.length > 0;
              const isConfiguring = configuringChannelId === channelId;
              
              return (
                <article className="zvd-detail-row" key={channelId || option.label}>
                  <div className="zvd-detail-main">
                    <span className={`zvd-row-dot tone-${option.configured ? 'ready' : 'warning'}`} />
                    <div style={{ width: '100%' }}>
                      <strong>{String(option.label || channelId || 'Channel')}</strong>
                      <p>{String(option.summary || option.operatorNextStep || 'Choose setup mode and validate connection.')}</p>
                      
                      {isConfiguring ? (
                        <div className="zvd-credentials-form">
                          {missingKeys.map((key) => {
                            const isSensitive = /(token|secret|password|credential|authorization|api[_-]?key)/i.test(key);
                            return (
                              <div className="zvd-credentials-field" key={key}>
                                <label htmlFor={`cred-${channelId}-${key}`}>{key}</label>
                                <input
                                  id={`cred-${channelId}-${key}`}
                                  type={isSensitive ? 'password' : 'text'}
                                  value={credentials[key] ?? ''}
                                  onChange={(e) => setCredentials(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder={`Enter ${key.toLowerCase().replace(/_/g, ' ')}`}
                                  autoComplete="off"
                                />
                              </div>
                            );
                          })}
                          <div className="zvd-credentials-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <button
                              disabled={props.busy}
                              onClick={() => {
                                const extraEntries = missingKeys.map((key: string) => ({
                                  key,
                                  value: credentials[key] || '',
                                }));
                                void props.onSetupAction({
                                  action: 'applyScaffold',
                                  channelId,
                                  mode: String(option.setupMode || option.recommendedMode || '') || null,
                                  extraEntries,
                                });
                                setConfiguringChannelId(null);
                                setCredentials({});
                              }}
                              type="button"
                              className="zvd-btn-primary"
                            >
                              Save &amp; Connect
                            </button>
                            <button
                              disabled={props.busy}
                              onClick={() => {
                                setConfiguringChannelId(null);
                                setCredentials({});
                              }}
                              type="button"
                              className="zvd-btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {hasMissing && (
                            <p style={{ color: 'var(--zvd-text-warn, #b45309)', fontSize: '0.9em', marginTop: '4px' }}>
                              Missing: {missingKeys.join(', ')}
                            </p>
                          )}
                        </>
                      )}
                      
                      {Boolean(option.webhookUrl) && <p>Webhook: {String(option.webhookUrl)}</p>}
                      {Boolean(option.qrCode) && <p>QR: {String(option.qrCode)}</p>}
                    </div>
                  </div>
                  <div className="zvd-detail-side">
                    <span>{active ? 'selected' : String(option.readiness || 'setup')}</span>
                    <div className="zvd-row-actions">
                      {hasMissing ? (
                        !isConfiguring && (
                          <button
                            disabled={props.busy}
                            onClick={() => {
                              setConfiguringChannelId(channelId);
                              const initial: Record<string, string> = {};
                              missingKeys.forEach((key: string) => {
                                initial[key] = '';
                              });
                              setCredentials(initial);
                            }}
                            type="button"
                          >
                            Configure
                          </button>
                        )
                      ) : (
                        <button
                          disabled={props.busy}
                          onClick={() => void props.onSetupAction({ action: 'applyScaffold', channelId, mode: String(option.setupMode || option.recommendedMode || '') || null })}
                          type="button"
                        >
                          Apply scaffold
                        </button>
                      )}
                      <button
                        disabled={props.busy || isConfiguring}
                        onClick={() => void props.onSetupAction({ action: 'testConnection', channelId })}
                        type="button"
                      >
                        Test connection
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <DetailRows rows={rows} empty="No channel readiness is projected yet." />
    </PageFrame>
  );
}
