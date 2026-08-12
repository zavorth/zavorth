export type ChannelEntry = {
  id: string;
  label: string;
  readiness?: string;
  configured?: boolean;
  transport?: string;
  connection?: { connected?: boolean; running?: boolean; linked?: boolean } | null;
  actions?: Array<{ id: string; kind: string }>;
  lastHealth?: string;
  readinessProof?: string;
  liveReady?: boolean;
};

export type DoctorEvidence = {
  checkedAt?: string;
  status?: string;
  items?: Array<{ channelId: string; status: string }>;
};

export type CatalogRow = {
  id: string;
  label: string;
  catalog: { label: string; tone: string };
  configuration: { label: string; tone: string };
  connection: { label: string; tone: string };
  probe: { label: string; tone: string };
};

export type CatalogView = {
  total: number;
  configured: number;
  connected: number;
  liveReady: number;
  rows: CatalogRow[];
  probeLabel?: string;
};

export function buildChannelCatalogView(data: { entries?: ChannelEntry[]; generatedAt?: string } = { entries: [] }, doctorEvidence?: DoctorEvidence): CatalogView {
  const entries = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data) ? data : []);
  const total = entries.length;
  const configured = entries.filter((e) => e.configured === true).length;
  const connected = entries.filter((e) => e.connection != null).length;
  const liveReady = entries.filter((e) => e.liveReady === true).length;

  const rows: CatalogRow[] = entries.map((entry) => {
    const isReady = entry.readiness === 'ready';
    const isPartial = entry.readiness === 'partial';
    const isFailed = doctorEvidence?.items?.find((item) => item.channelId === entry.id)?.status === 'failed';
    const isProbedPartial = doctorEvidence?.items?.find((item) => item.channelId === entry.id)?.status === 'partial';

    return {
      id: entry.id,
      label: entry.label,
      catalog: { label: isReady ? 'Ready' : isPartial ? 'Partial' : 'Planned', tone: isReady ? 'ok' : isPartial ? 'warn' : 'info' },
      configuration: { label: entry.configured ? 'Configured' : 'Not configured', tone: entry.configured ? 'ok' : 'warn' },
      connection: { label: (entry.connection && (entry.connection.connected || entry.connection.running || entry.connection.linked)) ? 'Connected' : 'Not connected', tone: (entry.connection && (entry.connection.connected || entry.connection.running || entry.connection.linked)) ? 'ok' : 'info' },
      probe: { label: isFailed ? 'Failed' : isProbedPartial ? 'Partial' : 'Not probed', tone: isFailed ? 'danger' : isProbedPartial ? 'warn' : 'warn' },
    };
  });

  const failedProbes = doctorEvidence?.items?.filter((item) => item.status === 'failed').length || 0;
  return {
    total,
    configured,
    connected,
    liveReady,
    rows,
    probeLabel: failedProbes > 0 ? 'Failed' : undefined,
  };
}

export function normalizeChannelQrDataUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!trimmed.startsWith('data:image/png;base64,')) return null;
  const base64Part = trimmed.slice('data:image/png;base64,'.length);
  if (base64Part.length > 1_500_000) return null;
  if (!base64Pattern.test(base64Part)) return null;
  return trimmed;
}

export function renderChannelCatalogHtml(view: CatalogView): string {
  const rowsHtml = view.rows.map((row) => {
    return `<div>${escapeLabel(row.label)} - Catalog: ${row.catalog.label}, Config: ${row.configuration.label}, Connection: ${row.connection.label}, Probe: ${row.probe.label}</div>`;
  }).join('');
  return `<div>${rowsHtml}</div><div>Prepare in chat</div>`;
}

function escapeLabel(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
