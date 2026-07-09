import { useState } from 'react';
import type { ChannelItem } from '../../apiClient';
import { asRecord, panelLabels } from '../../primitives/desktopPrimitives';
import { StatusBadge } from '../../primitives';
import { readinessFromChannel } from '../../desktop-state/readiness';
import { DetailRows, PageFrame, SearchBox } from './panelPrimitives';

export function ChannelsPanel(props: { channels: ChannelItem[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = props.channels
    .filter(channel => {
      const record = asRecord(channel);
      const haystack = `${record.name || ''} ${record.channel || ''} ${record.id || ''} ${record.status || ''} ${record.summary || ''}`.toLowerCase();
      return !q || haystack.includes(q);
    })
    .map((channel, index) => {
      const record = asRecord(channel);
      const id = String(record.id || record.channel || record.name || `channel-${index}`);
      const badge = readinessFromChannel({
        status: String(record.status || ''),
        liveReady: Boolean(record.liveReady),
        configured: Boolean(record.configured),
        readiness: String(record.readiness || record.status || ''),
        summary: String(
          record.summary
            || (record.outboxOnly ? 'Outbox or preview route only.' : '')
            || '',
        ),
      });
      // Catalog/configured alone must never read as "ready" — StatusBadge uses readiness state.
      const detail =
        badge.detail
        || (badge.state === 'needs_setup'
          ? 'Needs setup before it can send live messages.'
          : badge.state === 'available'
            ? 'Catalog support — not proven live yet.'
            : badge.state === 'live'
              ? 'Live route is ready.'
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
      <DetailRows rows={rows} empty="No channel readiness is projected yet." />
    </PageFrame>
  );
}
