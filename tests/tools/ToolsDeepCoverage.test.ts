import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthCronSchedulerTool } from '../../src/tools/ZavorthCronSchedulerTool';
import { ZavorthDelegateTool } from '../../src/tools/ZavorthDelegateTool';
import { ZavorthChannelSendTool } from '../../src/tools/ZavorthChannelSendTool';
import { ZavorthDocumentExtractorTool } from '../../src/tools/ZavorthDocumentExtractorTool';
import { ZavorthPolicyEnforcerTool } from '../../src/tools/ZavorthPolicyEnforcerTool';
import { ZavorthReceiptSearchTool } from '../../src/tools/ZavorthReceiptSearchTool';
import { ZavorthTrajectoryExportTool } from '../../src/tools/ZavorthTrajectoryExportTool';
import { ZavorthApiClientTool } from '../../src/tools/ZavorthApiClientTool';
import { ZavorthSessionSearchTool } from '../../src/tools/ZavorthSessionSearchTool';

describe('ZavorthCronSchedulerTool - deep coverage', () => {
  let tool: ZavorthCronSchedulerTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-deep-')); tool = new ZavorthCronSchedulerTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('creates interval job with interval_ms', async () => {
    const r = await tool.execute({ action: 'create', name: 'IntervalJob', schedule: '60000', schedule_type: 'interval', interval_ms: 60000, task_description: 'Check health' });
    expect(r).toContain('interval');
  });

  it('creates once job', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const r = await tool.execute({ action: 'create', name: 'OnceJob', schedule: future, schedule_type: 'once', task_description: 'One-time task' });
    expect(r).toContain('once');
  });

  it('creates natural language job', async () => {
    const r = await tool.execute({ action: 'create', name: 'NLJob', schedule: '{"kind":"calendar_day","targetHour":9,"targetMinute":0}', task_description: 'Morning briefing' });
    expect(r).toContain('natural_language');
  });

  it('returns error for duplicate job', async () => {
    await tool.execute({ action: 'create', name: 'DupJob', schedule: '0 * * * *', task_description: 'Dup' });
    const r = await tool.execute({ action: 'create', name: 'DupJob', schedule: '0 * * * *', task_description: 'Dup' });
    expect(r).toContain('already exists');
  });

  it('updates job fields', async () => {
    await tool.execute({ action: 'create', name: 'UpdateMe', schedule: '0 * * * *', task_description: 'Original' });
    const r = await tool.execute({ action: 'update', job_id: 'updateme', task_description: 'Updated', risk_level: 'high' });
    expect(r).toContain('updated');
  });

  it('run_now increments run_count', async () => {
    await tool.execute({ action: 'create', name: 'RunCount', schedule: '0 * * * *', task_description: 'Count runs' });
    await tool.execute({ action: 'run_now', job_id: 'runcount' });
    const status = await tool.execute({ action: 'status', job_id: 'runcount' });
    expect(status).toContain('1');
  });

  it('returns error for missing job_id on delete', async () => {
    const r = await tool.execute({ action: 'delete' });
    expect(r).toContain('Error');
  });

  it('returns error for non-existent job status', async () => {
    const r = await tool.execute({ action: 'status', job_id: 'nonexistent' });
    expect(r).toContain('not found');
  });

  it('handles critical risk with requires_approval', async () => {
    const r = await tool.execute({ action: 'create', name: 'CriticalJob', schedule: '0 * * * *', task_description: 'Delete all production data', risk_level: 'critical' });
    expect(r).toContain('critical');
    expect(r).toContain('DISABLED');
  });

  it('handles multiple jobs listing', async () => {
    for (let i = 0; i < 5; i++) {
      await tool.execute({ action: 'create', name: `Job${i}`, schedule: '0 * * * *', task_description: `Task ${i}` });
    }
    const r = await tool.execute({ action: 'list' });
    expect(r).toContain('5');
  });
});

describe('ZavorthDelegateTool - deep coverage', () => {
  let tool: ZavorthDelegateTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delegate-deep-')); tool = new ZavorthDelegateTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('returns error for invalid role', async () => {
    const r = await tool.execute({ action: 'delegate', task_description: 'Test', role: 'wizard' });
    expect(r).toContain('Error');
    expect(r).toContain('role');
  });

  it('returns error for missing task_description', async () => {
    const r = await tool.execute({ action: 'delegate' });
    expect(r).toContain('Error');
  });

  it('returns error for missing task_id on status', async () => {
    const r = await tool.execute({ action: 'status' });
    expect(r).toContain('Error');
  });

  it('cancels a task and its children', async () => {
    const parent = await tool.execute({ action: 'delegate', task_description: 'Parent' });
    const parentId = parent.match(/ID: (del_\w+)/)![1];
    await tool.execute({ action: 'delegate', task_description: 'Child', parent_id: parentId });
    const r = await tool.execute({ action: 'cancel', task_id: parentId });
    expect(r).toContain('cancelled');
  });

  it('gets result of completed task', async () => {
    const d = await tool.execute({ action: 'delegate', task_description: 'Test result' });
    const id = d.match(/ID: (del_\w+)/)![1];
    const r = await tool.execute({ action: 'result', task_id: id });
    expect(r).toContain('pending');
  });

  it('returns error for cancel_batch without batch_id', async () => {
    const r = await tool.execute({ action: 'cancel_batch' });
    expect(r).toContain('Error');
  });

  it('handles batch with max tasks limit', async () => {
    const tasks = Array.from({ length: 25 }, (_, i) => ({ task_description: `Task ${i}` }));
    const r = await tool.execute({ action: 'delegate_batch', tasks: JSON.stringify(tasks) });
    expect(r).toContain('maximum');
  });

  it('returns error for invalid batch JSON', async () => {
    const r = await tool.execute({ action: 'delegate_batch', tasks: 'not-json' });
    expect(r).toContain('Error');
  });

  it('handles context parameter', async () => {
    const r = await tool.execute({ action: 'delegate', task_description: 'Context test', context: JSON.stringify({ key: 'value' }) });
    expect(r).toContain('Delegated');
  });

  it('handles depth limit', async () => {
    const parent = await tool.execute({ action: 'delegate', task_description: 'Depth parent' });
    const parentId = parent.match(/ID: (del_\w+)/)![1];
    const child = await tool.execute({ action: 'delegate', task_description: 'Depth child', parent_id: parentId });
    const childId = child.match(/ID: (del_\w+)/)![1];
    const grandchild = await tool.execute({ action: 'delegate', task_description: 'Depth grandchild', parent_id: childId });
    expect(grandchild).toContain('Delegated');
  });
});

describe('ZavorthChannelSendTool - deep coverage', () => {
  const tool = new ZavorthChannelSendTool();

  it('returns error for missing message', async () => {
    const r = await tool.execute({ channel: 'telegram', recipient: '123' });
    expect(r).toContain('Error');
    expect(r).toContain('message');
  });

  it('returns error for invalid channel', async () => {
    const r = await tool.execute({ channel: 'carrier_pigeon', recipient: '123', message: 'test' });
    expect(r).toContain('invalid');
  });

  it('handles multi-channel with invalid JSON', async () => {
    const r = await tool.execute({ channel: 'telegram', recipient: '123', message: 'test', multi_channel: 'not-json' });
    expect(r).toContain('Error');
  });

  it('handles multi-channel with empty array', async () => {
    const r = await tool.execute({ channel: 'telegram', recipient: '123', message: 'test', multi_channel: '[]' });
    expect(r).toContain('Error');
  });

  it('handles multi-channel with too many targets', async () => {
    const targets = Array.from({ length: 15 }, (_, i) => ({ channel: 'telegram', recipient: String(i) }));
    const r = await tool.execute({ channel: 'telegram', recipient: '123', message: 'test', multi_channel: JSON.stringify(targets) });
    expect(r).toContain('maximum');
  });

  it('handles silent flag', async () => {
    const r = await tool.execute({ channel: 'telegram', recipient: '123', message: 'Silent', silent: true });
    expect(r).toContain('sent');
  });

  it('handles reply_to', async () => {
    const r = await tool.execute({ channel: 'telegram', recipient: '123', message: 'Reply', reply_to: 'msg_456' });
    expect(r).toContain('sent');
  });

  it('handles all channel types', async () => {
    const channels = ['telegram', 'discord', 'slack', 'whatsapp', 'email', 'teams', 'signal', 'matrix', 'irc', 'line', 'nostr', 'sms'];
    for (const ch of channels) {
      const r = await tool.execute({ channel: ch, recipient: 'test', message: 'Hello' });
      expect(r).toContain('sent');
    }
  });

  it('formats message for discord', async () => {
    const r = await tool.execute({ channel: 'discord', recipient: '123', message: '**bold** and *italic*' });
    expect(r).toContain('sent');
  });

  it('formats message for whatsapp', async () => {
    const r = await tool.execute({ channel: 'whatsapp', recipient: '123', message: '# Header and **bold**' });
    expect(r).toContain('sent');
  });
});

describe('ZavorthPolicyEnforcerTool - deep coverage', () => {
  const tool = new ZavorthPolicyEnforcerTool();

  it('lists all policies', async () => {
    const r = await tool.execute({ action: 'list_policies' });
    expect(r).toContain('Policies');
    expect(r).toContain('Email Send');
    expect(r).toContain('Destructive Command');
    expect(r).toContain('Sensitive Data');
  });

  it('checks email with high risk', async () => {
    const r = await tool.execute({ action: 'check', tool_name: 'send_email', risk_level: 'high' });
    expect(r).toContain('send_email');
  });

  it('checks destructive command', async () => {
    const r = await tool.execute({ action: 'check', tool_name: 'remote_shell', tool_args: JSON.stringify({ command: 'rm -rf /tmp/test' }), risk_level: 'critical' });
    expect(r).toContain('remote_shell');
  });

  it('checks sensitive file access', async () => {
    const r = await tool.execute({ action: 'check', tool_name: 'read_file', tool_args: JSON.stringify({ path: '.env' }), risk_level: 'medium' });
    expect(r).toContain('read_file');
  });

  it('checks safe tool', async () => {
    const r = await tool.execute({ action: 'check', tool_name: 'web_search', risk_level: 'low' });
    expect(r).toContain('web_search');
  });

  it('runs audit', async () => {
    const r = await tool.execute({ action: 'audit' });
    expect(r).toContain('Audit');
    expect(r).toContain('Total');
  });

  it('runs policy tests', async () => {
    const r = await tool.execute({ action: 'test' });
    expect(r).toContain('Test');
  });

  it('adds custom policy', async () => {
    const r = await tool.execute({ action: 'add_policy', policy_name: 'Custom Block', policy_description: 'Blocks custom ops', policy_category: 'tool_access', policy_condition: 'tool_name == "custom"', policy_action: 'deny', policy_severity: 'block' });
    expect(r).toContain('created');
  });

  it('returns error for check without tool_name', async () => {
    const r = await tool.execute({ action: 'check' });
    expect(r).toContain('Error');
  });

  it('returns error for invalid action', async () => {
    const r = await tool.execute({ action: 'dance' });
    expect(r).toContain('Error');
  });
});

describe('ZavorthReceiptSearchTool - deep coverage', () => {
  let tool: ZavorthReceiptSearchTool;
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-deep-'));
    const receipts = [
      { id: 'r1', timestamp: '2025-06-01T10:00:00Z', action: 'execute', tool: 'web_search', args: { query: 'TS' }, result_summary: 'Found 10 results', success: true, risk_level: 'low', approval_status: 'auto_approved', session_id: 's1', user: 'ermys', channel: 'cli', duration_ms: 250, metadata: {} },
      { id: 'r2', timestamp: '2025-06-02T14:00:00Z', action: 'send', tool: 'send_email', args: { to: 'test@example.com' }, result_summary: 'Email sent', success: true, risk_level: 'high', approval_status: 'approved', session_id: 's1', user: 'ermys', channel: 'telegram', duration_ms: 1500, metadata: {} },
      { id: 'r3', timestamp: '2025-06-03T09:00:00Z', action: 'execute', tool: 'remote_shell', args: { command: 'ls' }, result_summary: 'Listed files', success: false, risk_level: 'critical', approval_status: 'denied', session_id: 's2', user: 'ermys', channel: 'cli', duration_ms: 100, metadata: {} },
    ];
    fs.writeFileSync(path.join(tempDir, 'receipts.json'), JSON.stringify(receipts));
    tool = new ZavorthReceiptSearchTool({ receiptsDir: tempDir });
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('searches by query', async () => {
    const r = await tool.execute({ action: 'search', query: 'email' });
    expect(r).toBeTruthy();
  });

  it('searches by tool', async () => {
    const r = await tool.execute({ action: 'search', tool: 'send_email' });
    expect(r).toBeTruthy();
  });

  it('searches by risk level', async () => {
    const r = await tool.execute({ action: 'search', risk_level: 'critical' });
    expect(r).toBeTruthy();
  });

  it('searches by session', async () => {
    const r = await tool.execute({ action: 'search', session_id: 's2' });
    expect(r).toBeTruthy();
  });

  it('searches by date range', async () => {
    const r = await tool.execute({ action: 'search', date_from: '2025-06-01', date_to: '2025-06-02' });
    expect(r).toBeTruthy();
  });

  it('gets specific receipt', async () => {
    const r = await tool.execute({ action: 'get', receipt_id: 'r1' });
    expect(r).toBeTruthy();
  });

  it('returns error for non-existent receipt', async () => {
    const r = await tool.execute({ action: 'get', receipt_id: 'nonexistent' });
    expect(r).toContain('not found');
  });

  it('gets stats', async () => {
    const r = await tool.execute({ action: 'stats' });
    expect(r).toBeTruthy();
  });

  it('lists tools', async () => {
    const r = await tool.execute({ action: 'list_tools' });
    expect(r).toBeTruthy();
  });

  it('lists sessions', async () => {
    const r = await tool.execute({ action: 'list_sessions' });
    expect(r).toBeTruthy();
  });

  it('verifies receipt integrity', async () => {
    const r = await tool.execute({ action: 'verify', receipt_id: 'r1' });
    expect(r).toBeTruthy();
  });

  it('exports as CSV', async () => {
    const r = await tool.execute({ action: 'export', export_format: 'csv' });
    expect(r).toBeTruthy();
  });

  it('exports as markdown', async () => {
    const r = await tool.execute({ action: 'export', export_format: 'markdown' });
    expect(r).toBeTruthy();
  });

  it('exports as JSON', async () => {
    const r = await tool.execute({ action: 'export', export_format: 'json' });
    expect(r).toBeTruthy();
  });

  it('searches with max_results', async () => {
    const r = await tool.execute({ action: 'search', max_results: 1 });
    expect(r).toBeTruthy();
  });
});

describe('ZavorthTrajectoryExportTool - deep coverage', () => {
  let tool: ZavorthTrajectoryExportTool;
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traj-deep-'));
    const traj = {
      id: 'traj_001', session_id: 's1', task: 'Build API', hypothesis: 'REST is best', method: 'Benchmark',
      steps: [
        { step_number: 1, action: 'Setup', tool_used: 'sandbox', result_summary: 'Done', duration_ms: 100, success: true },
        { step_number: 2, action: 'Test', tool_used: 'terminal', result_summary: 'Passed', duration_ms: 200, success: true },
      ],
      outcome: 'confirmed', conclusion: 'REST works great', evidence: ['Fast response times'], citations: [{ source: 'https://example.com', title: 'REST Guide', relevance: 0.9 }],
      quality_score: 0.85, created_at: '2025-06-01T10:00:00Z', metadata: { model: 'gpt-4o' },
    };
    fs.writeFileSync(path.join(tempDir, 'traj_001.json'), JSON.stringify(traj));
    tool = new ZavorthTrajectoryExportTool({ trajectoriesDir: tempDir });
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('lists trajectories', async () => {
    const r = await tool.execute({ action: 'list' });
    expect(r).toBeTruthy();
  });

  it('lists with outcome filter', async () => {
    const r = await tool.execute({ action: 'list', outcome_filter: 'confirmed' });
    expect(r).toBeTruthy();
  });

  it('gets stats', async () => {
    const r = await tool.execute({ action: 'stats' });
    expect(r).toBeTruthy();
  });

  it('exports as JSONL', async () => {
    const r = await tool.execute({ action: 'export', format: 'jsonl' });
    expect(r).toBeTruthy();
  });

  it('exports as alpaca', async () => {
    const r = await tool.execute({ action: 'export', format: 'alpaca' });
    expect(r).toBeTruthy();
  });

  it('exports as sharegpt', async () => {
    const r = await tool.execute({ action: 'export', format: 'sharegpt' });
    expect(r).toBeTruthy();
  });

  it('exports as CSV', async () => {
    const r = await tool.execute({ action: 'export', format: 'csv' });
    expect(r).toBeTruthy();
  });

  it('exports as markdown', async () => {
    const r = await tool.execute({ action: 'export', format: 'markdown' });
    expect(r).toBeTruthy();
  });

  it('exports to file', async () => {
    const outputPath = path.join(tempDir, 'export.json');
    const r = await tool.execute({ action: 'export', format: 'json', output_path: outputPath });
    expect(r).toBeTruthy();
  });

  it('filters by outcome', async () => {
    const r = await tool.execute({ action: 'filter', outcome_filter: 'confirmed' });
    expect(r).toBeTruthy();
  });

  it('returns error for invalid action', async () => {
    const r = await tool.execute({ action: 'dance' });
    expect(r).toContain('Error');
  });
});

describe('ZavorthSessionSearchTool - deep coverage', () => {
  let tool: ZavorthSessionSearchTool;
  let tempDir: string;
  let sessionsDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-deep-'));
    sessionsDir = path.join(tempDir, 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, 's1.md'), 'User asked about TypeScript generics.\nAssistant explained with examples.\nUser was satisfied.');
    fs.writeFileSync(path.join(sessionsDir, 's2.md'), 'User wanted to deploy Docker containers.\nAssistant helped with Dockerfile and docker-compose.');
    fs.writeFileSync(path.join(sessionsDir, 's3.md'), 'Discussion about PostgreSQL performance tuning.\nIndexed queries run 10x faster.');
    tool = new ZavorthSessionSearchTool({ sessionsDir, memoryDir: path.join(tempDir, 'memory') });
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('finds TypeScript discussion', async () => {
    const r = await tool.execute({ query: 'TypeScript' });
    expect(r).toContain('TypeScript');
  });

  it('finds Docker discussion', async () => {
    const r = await tool.execute({ query: 'Docker' });
    expect(r).toContain('Docker');
  });

  it('finds PostgreSQL discussion', async () => {
    const r = await tool.execute({ query: 'PostgreSQL performance' });
    expect(r).toContain('PostgreSQL');
  });

  it('returns no results for missing query', async () => {
    const r = await tool.execute({ query: 'quantum_physics_xyz' });
    expect(r).toContain('No results');
  });

  it('limits results with max_results', async () => {
    const r = await tool.execute({ query: 'a', max_results: 1 });
    expect(r).toContain('1 result');
  });

  it('searches in exact mode', async () => {
    const r = await tool.execute({ query: 'TypeScript generics', search_mode: 'exact' });
    expect(r).toContain('TypeScript');
  });

  it('handles regex mode with invalid regex', async () => {
    const r = await tool.execute({ query: '[invalid', search_mode: 'regex' });
    expect(r).toBeTruthy();
  });

  it('filters by date', async () => {
    const r = await tool.execute({ query: 'TypeScript', date_from: '2020-01-01', date_to: '2030-12-31' });
    expect(r).toContain('TypeScript');
  });

  it('sorts by date_asc', async () => {
    const r = await tool.execute({ query: 'a', sort_by: 'date_asc' });
    expect(r).toBeTruthy();
  });
});
