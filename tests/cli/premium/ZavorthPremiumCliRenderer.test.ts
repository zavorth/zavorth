import {
  createNonInteractivePromptAdapter,
  createZavorthPremiumCliTheme,
  renderPremiumProgressRail,
  renderPremiumStatusRows,
  renderZavorthPremiumCliScreen,
} from '../../../src/cli/premium';

describe('Zavorth premium CLI foundation', () => {
  it('renders a stable premium screen without ANSI when color is disabled', () => {
    const theme = createZavorthPremiumCliTheme({ colorEnabled: false, columns: 72 });
    const output = renderZavorthPremiumCliScreen({
      title: 'Setup Studio',
      subtitle: 'Configure provider, channels and trust without leaving the terminal.',
      mode: 'compact',
      steps: [
        { id: 'security', title: 'Security disclaimer', status: 'ready' },
        { id: 'provider', title: 'Model provider', status: 'waiting', detail: 'OpenAI recommended' },
        { id: 'finish', title: 'Hatch agent', status: 'unknown' },
      ],
      statusRows: [
        { label: 'Runtime', value: 'ready', status: 'ready' },
        { label: 'Provider', value: 'missing', status: 'warning' },
      ],
      panels: [{
        title: 'Security baseline',
        accent: 'amber',
        lines: [
          'Sensitive actions require preview, approval and receipts.',
          'Secrets should not be written into prompts, logs or screenshots.',
        ],
      }],
      actions: [
        { label: 'Run setup', command: 'zavorth setup', detail: 'guided path' },
        { label: 'Open dashboard', command: 'zavorth open' },
      ],
    });

    expect(output).toContain('ZAVORTH');
    expect(output).toContain('Setup Studio');
    expect(output).toContain('Security disclaimer');
    expect(output).toContain('Runtime status');
    expect(output).toContain('zavorth setup');
    expect(output).not.toMatch(/\u001B\[[0-9;]*m/);
  });

  it('renders status rows and progress rail as reusable building blocks', () => {
    const theme = createZavorthPremiumCliTheme({ colorEnabled: false, columns: 60 });
    expect(renderPremiumStatusRows([
      { label: 'Sandbox', value: 'ready', status: 'ready' },
      { label: 'Telegram', value: 'not configured', status: 'waiting' },
    ], theme)).toContain('Sandbox');
    expect(renderPremiumProgressRail([
      { id: 'doctor', title: 'Doctor', status: 'running' },
      { id: 'done', title: 'Ready', status: 'unknown' },
    ], theme)).toContain('Doctor');
  });

  it('preserves indentation when long action commands wrap', () => {
    const output = renderZavorthPremiumCliScreen({
      title: 'Actions',
      actions: [{
        label: 'Approve',
        command: 'zavorth approve selfmod-effect-boundary-run-1-call-write-very-long-plan-id --yes',
        detail: 'approval only',
      }],
    });

    expect(output).toContain('  zavorth approve');
    expect(output).toContain('  --yes');
  });

  it('has a deterministic non-interactive prompt adapter for tests and dry runs', async () => {
    const adapter = createNonInteractivePromptAdapter({
      defaults: {
        Provider: 'openai',
        Confirm: false,
      },
    });

    await expect(adapter.select({
      message: 'Provider',
      choices: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Google', value: 'google' },
      ],
    })).resolves.toBe('openai');
    await expect(adapter.confirm({ message: 'Confirm', defaultValue: true })).resolves.toBe(false);
  });
});
