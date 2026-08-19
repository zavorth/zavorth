import { formatOfficialInstallReport } from '../../scripts/lib/runtime-official-install.js';

describe('runtime-official-install presentation', () => {
  const baseReport = {
    generatedAt: '2026-04-23T00:00:00.000Z',
    summary: 'The official path still needs to prepare the runtime before opening the best entry.',
    tokenSource: 'file',
    journey: { summary: 'Zavorth is not yet ready for consistent use: The host service is not active.' },
    manifest: { commands: { go: 'zavorth go', trust: '/hostauth trust' } },
    readiness: {},
    local: { ready: false, appUrl: 'http://127.0.0.1:33333/dashboard', trust: { attempted: false, applied: false, statusCode: null, error: null } },
    remote: { configured: false, appUrl: null, appProbe: null, authProbe: null, issues: ['ZAVORTH_PUBLIC_BASE_URL not configured yet.'], ready: false },
    nextSteps: ['Authorize this host with /hostauth trust or run zavorth go to apply local trust via the official path.'],
  };

  const baseOptions = {
    eyebrow: 'Zavorth go',
    title: 'Zavorth still needs an adjustment',
    dryRun: true,
    currentCommand: 'zavorth go',
  };

  it('renders required structural sections', () => {
    const output = formatOfficialInstallReport(baseReport, baseOptions);

    // Core structure present
    expect(output).toContain('Zavorth go');
    expect(output).toContain('Zavorth still needs an adjustment');
    expect(output).toContain('Now');
    expect(output).toContain('Local access');
    expect(output).toContain('Remote access');
    expect(output).toContain('Do now');

    // Dry-run notice
    expect(output).toContain('dry-run');

    // Trust status shown
    expect(output).toContain('host authorization');
  });

  it('includes actionable next steps', () => {
    const output = formatOfficialInstallReport(baseReport, baseOptions);

    expect(output).toContain('zavorth doctor');
    expect(output).toContain('ZAVORTH_PUBLIC_BASE_URL');
    expect(output).toContain('Exit dry-run');
  });

  it('excludes legacy trust command from user-facing output', () => {
    const output = formatOfficialInstallReport(baseReport, baseOptions);

    // Legacy internal command should not leak to user
    expect(output).not.toContain('/hostauth trust');
  });

  it('renders local URL when not ready', () => {
    const output = formatOfficialInstallReport(baseReport, baseOptions);
    expect(output).toContain('http://127.0.0.1:33333/dashboard');
    expect(output).toContain('not ready');
  });
});