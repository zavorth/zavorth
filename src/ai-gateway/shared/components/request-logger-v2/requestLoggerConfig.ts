import type {
  RequestLoggerColumn,
  RequestLoggerStatusOption,
  RequestLoggerVisibleColumns,
} from "./requestLoggerTypes";

export const STATUS_FILTERS: RequestLoggerStatusOption[] = [
  { key: "all", label: "All" },
  { key: "error", label: "Errors", icon: "error" },
  { key: "ok", label: "Success", icon: "check_circle" },
  { key: "combo", label: "Combo", icon: "hub" },
];

export const COLUMNS: RequestLoggerColumn[] = [
  { key: "status", label: "Status" },
  { key: "model", label: "Model" },
  { key: "requestedModel", label: "Requested" },
  { key: "provider", label: "Provider" },
  { key: "protocol", label: "Req Protocol" },
  { key: "account", label: "Account" },
  { key: "apiKey", label: "API Key" },
  { key: "combo", label: "Combo" },
  { key: "tokens", label: "Tokens" },
  { key: "duration", label: "Duration" },
  { key: "time", label: "Time" },
];

export const DEFAULT_VISIBLE = Object.fromEntries(
  COLUMNS.map((column) => [column.key, true])
) as RequestLoggerVisibleColumns;

export const LOGGER_VISIBLE_COLUMNS_STORAGE_KEY = "loggerVisibleColumns";
export const REQUEST_LOGGER_LIMIT = "300";
export const REQUEST_LOGGER_REFRESH_MS = 3000;
