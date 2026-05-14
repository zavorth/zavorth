export type AgentGatewayTraceInput = {
  channel: string;
  requestId: string;
  sessionId: string;
  traceId?: unknown;
  metadata?: Record<string, unknown> | null;
};

const TRACE_METADATA_KEYS = [
  'traceId',
  'trace_id',
  'requestTraceId',
  'request_trace_id',
  'telemetryTraceId',
];

function normalizeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function resolveMetadataTraceId(metadata?: Record<string, unknown> | null): string {
  if (!metadata) {
    return '';
  }
  for (const key of TRACE_METADATA_KEYS) {
    const value = normalizeText(metadata[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

export function resolveAgentGatewayTraceId(input: AgentGatewayTraceInput): string {
  const directTraceId = normalizeText(input.traceId);
  if (directTraceId) {
    return directTraceId;
  }

  const metadataTraceId = resolveMetadataTraceId(input.metadata);
  if (metadataTraceId) {
    return metadataTraceId;
  }

  return [
    normalizeText(input.channel, 'unknown'),
    normalizeText(input.sessionId, 'session'),
    normalizeText(input.requestId, 'request'),
  ].join(':');
}

export function withAgentGatewayTraceMetadata(
  metadata: Record<string, unknown> | undefined,
  traceId: string,
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    traceId,
  };
}
