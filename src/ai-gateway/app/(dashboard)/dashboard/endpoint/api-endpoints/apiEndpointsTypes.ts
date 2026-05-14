export interface Endpoint {
  method: string;
  path: string;
  tags: string[];
  summary: string;
  description: string;
  security: boolean;
  parameters: unknown[];
  requestBody: boolean;
  responses: string[];
}

export interface CatalogData {
  info: { title?: string; version?: string; description?: string };
  servers: { url: string; description?: string }[];
  tags: { name: string; description?: string }[];
  endpoints: Endpoint[];
  schemas: string[];
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  enabled: boolean;
  description: string;
  created_at: string;
  last_triggered_at: string | null;
  last_status: number | null;
  failure_count: number;
}

export interface TryItResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  latencyMs: number;
  contentType: string;
}

export type ApiEndpointSection = "catalog" | "webhooks";
