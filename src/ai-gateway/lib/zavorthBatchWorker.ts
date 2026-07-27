export type ZavorthBatchRequestLine = {
  custom_id?: string;
  method?: string;
  url?: string;
  body?: unknown;
};

export type ZavorthBatchWorkerDispatch = (input: {
  id: string;
  body: unknown;
}) => Promise<{ ok: boolean; status: number; body: unknown }>;

export type ZavorthBatchWorkerOptions = {
  concurrency?: number;
  maxRetries?: number;
  backoffMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type ZavorthBatchWorkerResult = {
  outputLines: string[];
  errorLines: string[];
  requestCounts: {
    total: number;
    completed: number;
    failed: number;
  };
  attempts: number;
  durationMs: number;
  maxConcurrency: number;
  maxRetries: number;
};

type PreparedBatchItem = {
  index: number;
  id: string;
  body: unknown;
};

export async function executeZavorthBatchJsonl(input: {
  jsonl: string;
  endpoint: string;
  dispatch: ZavorthBatchWorkerDispatch;
  options?: ZavorthBatchWorkerOptions;
}): Promise<ZavorthBatchWorkerResult> {
  const options = input.options || {};
  const now = options.now || (() => Date.now());
  const startedAt = now();
  const concurrency = clampPositiveInteger(options.concurrency, 4, 1, 16);
  const maxRetries = clampPositiveInteger(options.maxRetries, 2, 0, 8);
  const backoffMs = clampPositiveInteger(options.backoffMs, 250, 0, 30_000);
  const sleep = options.sleep || ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const lines = input.jsonl.split(/\r...\n/).map((line) => line.trim()).filter(Boolean);
  const outputLines = new Array<string | null>(lines.length).fill(null);
  const errorLines: string[] = [];
  const prepared: PreparedBatchItem[] = [];
  let attempts = 0;
  let completed = 0;
  let failed = 0;

  for (const [index, line] of lines.entries()) {
    try {
      const item = JSON.parse(line) as ZavorthBatchRequestLine;
      const method = String(item.method || "POST").toUpperCase();
      const url = String(item.url || input.endpoint || "/v1/chat/completions");
      if (method !== "POST" || !/\/(?:v1\/)...chat\/completions$/.test(url)) {
        throw new Error(`Unsupported batch request target: ${method} ${url}`);
      }
      prepared.push({
        index,
        id: item.custom_id || `request-${index + 1}`,
        body: item.body || {},
      });
    } catch (error: unknown) {failed += 1;
      errorLines.push(JSON.stringify(errorRow(`request-${index + 1}`, error, 0)));
    }
  }

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < prepared.length) {
      const item = prepared[cursor++];
      let lastError: unknown = null;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        attempts += 1;
        try {
          const response = await input.dispatch({ id: item.id, body: item.body });
          if (!response.ok && shouldRetryStatus(response.status) && attempt < maxRetries) {
            lastError = new Error(`retryable status ${response.status}`);
            await sleep(backoffMs * (attempt + 1));
            continue;
          }
          if (response.ok) {
            completed += 1;
            outputLines[item.index] = JSON.stringify({
              id: item.id,
              custom_id: item.id,
              response: { status_code: response.status, body: response.body },
              error: null,
            });
          } else {
            failed += 1;
            outputLines[item.index] = JSON.stringify({
              id: item.id,
              custom_id: item.id,
              response: null,
              error: { status_code: response.status, body: response.body },
            });
          }
          lastError = null;
          break;
        } catch (error: unknown) {lastError = error;
          if (attempt < maxRetries) {
            await sleep(backoffMs * (attempt + 1));
          }
        }
      }
      if (lastError) {
        failed += 1;
        errorLines.push(JSON.stringify(errorRow(item.id, lastError, maxRetries + 1)));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, prepared.length)) }, () => worker()));

  return {
    outputLines: outputLines.filter((line): line is string => Boolean(line)),
    errorLines,
    requestCounts: {
      total: lines.length,
      completed,
      failed,
    },
    attempts,
    durationMs: Math.max(0, now() - startedAt),
    maxConcurrency: concurrency,
    maxRetries,
  };
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function errorRow(customId: string, error: unknown, attempts: number) {
  return {
    custom_id: customId,
    error: {
      message: error instanceof Error ? error.message : String(error),
      type: "zavorth_batch_request_error",
      attempts,
    },
  };
}

function clampPositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}
