export type RequestLoggerStatusFilter = "all" | "error" | "ok" | "combo";

export type RequestLoggerSortKey =
  | "newest"
  | "oldest"
  | "tokens_desc"
  | "tokens_asc"
  | "duration_desc"
  | "duration_asc"
  | "status_desc"
  | "status_asc"
  | "model_asc"
  | "model_desc";

export type RequestLoggerColumnKey =
  | "status"
  | "model"
  | "requestedModel"
  | "provider"
  | "protocol"
  | "account"
  | "apiKey"
  | "combo"
  | "tokens"
  | "duration"
  | "time";

export interface RequestLoggerColumn {
  key: RequestLoggerColumnKey;
  label: string;
}

export interface RequestLoggerStatusOption {
  key: RequestLoggerStatusFilter;
  label: string;
  icon?: string;
}

export interface RequestLogEntry {
  id: string;
  status?: number;
  model?: string;
  requestedModel?: string;
  provider?: string;
  sourceFormat?: string;
  account?: string;
  apiKeyId?: string;
  apiKeyName?: string;
  comboName?: string;
  duration?: number;
  timestamp?: string;
  tokens?: {
    in?: number;
    out?: number;
  };
  [key: string]: unknown;
}

export interface ProviderNode {
  id?: string;
  prefix?: string;
  name?: string;
}

export interface RequestLoggerStats {
  totalCount: number;
  okCount: number;
  errorCount: number;
  comboCount: number;
  apiKeyCount: number;
}

export type RequestLoggerVisibleColumns = Record<RequestLoggerColumnKey, boolean>;
