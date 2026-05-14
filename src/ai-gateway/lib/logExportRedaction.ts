import {
  redactSensitiveData,
  redactSensitiveText,
} from "../../security/SensitiveDataGuard.js";

const SENSITIVE_EXPORT_KEY =
  /(?:api[_-]?key|apiKey|access[_-]?token|accessToken|auth[_-]?token|authToken|authorization|client[_-]?secret|clientSecret|credential|password|private[_-]?key|privateKey|refresh[_-]?token|refreshToken|secret|senha|token|cookie|set-cookie)/i;

export function redactExportedLogRows(rows: unknown[]): unknown[] {
  return rows.map((row) => redactExportedLogValue(row));
}

export function redactExportedLogValue(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactString(value, seen);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = SENSITIVE_EXPORT_KEY.test(key)
      ? redactSensitiveKeyValue(entry)
      : redactValue(entry, seen);
  }
  return redacted;
}

function redactSensitiveKeyValue(value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    return value;
  }
  return "[redacted-secret]";
}

function redactString(value: string, seen: WeakSet<object>): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(redactSensitiveData(redactValue(parsed, seen)));
    } catch {
      // Fall through to text redaction.
    }
  }
  return redactSensitiveText(value);
}
