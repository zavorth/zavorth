import { useState } from 'react';
import type { ChannelItem } from '../../apiClient';
import { asRecord, panelLabels } from '../../primitives/desktopPrimitives';
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
      return {
        id,
        title: String(record.name || record.channel || record.id || 'Channel'),
        description: record.liveReady
          ? 'Live route is ready.'
          : record.outboxOnly
            ? 'Outbox or preview route only.'
            : String(record.summary || 'Needs setup before it can send live messages.'),
        meta: record.liveReady ? 'live' : record.outboxOnly ? 'outbox' : String(record.status || 'setup'),
        tone: record.liveReady ? 'ready' as const : record.outboxOnly ? 'warning' as const : 'muted' as const,
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
