import { applyZavorthContextCompression } from "./zavorthContextCompression";

export type ZavorthCompressionBenchmarkCase = {
  name: string;
  body: Record<string, unknown>;
};

export type ZavorthCompressionBenchmarkResult = {
  name: string;
  applied: boolean;
  originalBytes: number;
  compressedBytes: number;
  savedBytes: number;
  ratio: number;
  latestIntentPreserved: boolean;
};

export type ZavorthCompressionBenchmarkSummary = {
  object: "zavorth.gateway.compression_benchmark";
  created_at: number;
  cases: ZavorthCompressionBenchmarkResult[];
  averageRatio: number;
  totalSavedBytes: number;
  passed: boolean;
};

const LATEST_INTENT = "ZAVORTH_BENCHMARK_LATEST_INTENT_KEEP_ME";

export function defaultZavorthCompressionBenchmarkCases(): ZavorthCompressionBenchmarkCase[] {
  return [
    {
      name: "repeated-retrieval-context",
      body: {
        model: "auto",
        zavorth_compression: true,
        messages: [
          { role: "system", content: "You are Zavorth. Preserve user intent." },
          { role: "user", content: "retrieved doc paragraph\n".repeat(9000) },
          { role: "user", content: "retrieved doc paragraph\n".repeat(9000) },
          { role: "user", content: LATEST_INTENT },
        ],
      },
    },
    {
      name: "stacktrace-and-tool-log",
      body: {
        model: "auto",
        zavorth_compression: true,
        messages: [
          { role: "system", content: "You are Zavorth." },
          {
            role: "tool",
            content: [
              "Error: noisy",
              ...Array.from({ length: 7000 }, (_, index) => `    at node_modules/pkg/file${index}.js:1:1`),
              LATEST_INTENT,
            ].join("\n"),
          },
          { role: "user", content: LATEST_INTENT },
        ],
      },
    },
    {
      name: "normal-small-chat",
      body: {
        model: "auto",
        messages: [
          { role: "system", content: "You are Zavorth." },
          { role: "user", content: LATEST_INTENT },
        ],
      },
    },
  ];
}

export function runZavorthCompressionBenchmark(
  cases: ZavorthCompressionBenchmarkCase[] = defaultZavorthCompressionBenchmarkCases(),
): ZavorthCompressionBenchmarkSummary {
  const results = cases.map((entry) => {
    const result = applyZavorthContextCompression(entry.body);
    const serialized = JSON.stringify(result.body);
    return {
      name: entry.name,
      applied: result.applied,
      originalBytes: result.originalBytes,
      compressedBytes: result.compressedBytes,
      savedBytes: Math.max(0, result.originalBytes - result.compressedBytes),
      ratio: result.ratio,
      latestIntentPreserved: serialized.includes(LATEST_INTENT),
    };
  });
  const averageRatio = results.length > 0
    ? results.reduce((sum, item) => sum + item.ratio, 0) / results.length
    : 1;
  const totalSavedBytes = results.reduce((sum, item) => sum + item.savedBytes, 0);
  return {
    object: "zavorth.gateway.compression_benchmark",
    created_at: Math.floor(Date.now() / 1000),
    cases: results,
    averageRatio,
    totalSavedBytes,
    passed: results.every((item) => item.latestIntentPreserved)
      && results.some((item) => item.applied && item.savedBytes > 0),
  };
}
