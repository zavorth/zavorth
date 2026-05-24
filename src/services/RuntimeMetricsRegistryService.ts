import os from 'node:os';

export type RuntimeMetricsSnapshotInput = {
  runs?: Record<string, number>;
  toolCalls?: Record<string, number>;
  tokens?: Record<string, { input?: number; output?: number }>;
  approvals?: Record<string, number>;
  sessions?: {
    active?: number;
    durationSeconds?: number[];
  };
};

export class RuntimeMetricsRegistryService {
  public renderPrometheus(input: RuntimeMetricsSnapshotInput = {}): string {
    const lines: string[] = [
      '# HELP zavorth_runtime_up Runtime metrics endpoint availability.',
      '# TYPE zavorth_runtime_up gauge',
      'zavorth_runtime_up 1',
      '# HELP zavorth_runtime_memory_rss Resident set size in bytes.',
      '# TYPE zavorth_runtime_memory_rss gauge',
      `zavorth_runtime_memory_rss ${process.memoryUsage().rss}`,
      '# HELP zavorth_runtime_cpu_count Logical CPU count.',
      '# TYPE zavorth_runtime_cpu_count gauge',
      `zavorth_runtime_cpu_count ${os.cpus().length}`,
      '# HELP zavorth_runs_total Runs by status.',
      '# TYPE zavorth_runs_total counter',
    ];

    for (const [status, value] of Object.entries(input.runs || { unknown: 0 })) {
      lines.push(`zavorth_runs_total{status="${label(status)}"} ${number(value)}`);
    }

    lines.push('# HELP zavorth_tool_calls_total Tool calls by tool name.');
    lines.push('# TYPE zavorth_tool_calls_total counter');
    for (const [tool, value] of Object.entries(input.toolCalls || {})) {
      lines.push(`zavorth_tool_calls_total{tool="${label(tool)}"} ${number(value)}`);
    }

    lines.push('# HELP zavorth_llm_tokens_total Estimated LLM tokens by provider and type.');
    lines.push('# TYPE zavorth_llm_tokens_total counter');
    for (const [provider, entry] of Object.entries(input.tokens || {})) {
      lines.push(`zavorth_llm_tokens_total{provider="${label(provider)}",type="input"} ${number(entry.input)}`);
      lines.push(`zavorth_llm_tokens_total{provider="${label(provider)}",type="output"} ${number(entry.output)}`);
    }

    lines.push('# HELP zavorth_approval_decisions_total Approval decisions by result.');
    lines.push('# TYPE zavorth_approval_decisions_total counter');
    for (const [decision, value] of Object.entries(input.approvals || {})) {
      lines.push(`zavorth_approval_decisions_total{decision="${label(decision)}"} ${number(value)}`);
    }

    lines.push('# HELP zavorth_sessions_active Active sessions.');
    lines.push('# TYPE zavorth_sessions_active gauge');
    lines.push(`zavorth_sessions_active ${number(input.sessions?.active)}`);
    lines.push('# HELP zavorth_session_duration_seconds Session duration samples.');
    lines.push('# TYPE zavorth_session_duration_seconds summary');
    const durations = input.sessions?.durationSeconds || [];
    lines.push(`zavorth_session_duration_seconds_count ${durations.length}`);
    lines.push(`zavorth_session_duration_seconds_sum ${durations.reduce((total, value) => total + number(value), 0)}`);

    return `${lines.join('\n')}\n`;
  }
}

function label(value: string): string {
  return String(value || 'unknown').replace(/["\\\n\r]/g, '_').slice(0, 80);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
