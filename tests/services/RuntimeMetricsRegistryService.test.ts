import { RuntimeMetricsRegistryService } from '../../src/services/RuntimeMetricsRegistryService';

describe('RuntimeMetricsRegistryService', () => {
  it('renders Prometheus text with stable Zavorth metric names', () => {
    const text = new RuntimeMetricsRegistryService().renderPrometheus({
      runs: { success: 2 },
      toolCalls: { read_file: 3 },
      tokens: { openai: { input: 10, output: 4 } },
      approvals: { approved: 1 },
      sessions: { active: 1, durationSeconds: [2, 3] },
    });

    expect(text).toContain('zavorth_runs_total{status="success"} 2');
    expect(text).toContain('zavorth_tool_calls_total{tool="read_file"} 3');
    expect(text).toContain('zavorth_llm_tokens_total{provider="openai",type="input"} 10');
    expect(text).toContain('zavorth_approval_decisions_total{decision="approved"} 1');
  });
});
