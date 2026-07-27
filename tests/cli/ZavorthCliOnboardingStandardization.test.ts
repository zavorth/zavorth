import { formatZavorthGoReport } from '../../src/cli/ZavorthCliGoRenderer';
import { formatCliHelp } from '../../src/cli/ZavorthCliSurfaceHelpers';

describe('Zavorth onboarding standardization', () => {
  it('documents setup as the First Light entrypoint', () => {
    const help = formatCliHelp('onboard');

    expect(help).toContain('zavorth setup');
    expect(help).toContain('First Light');
    expect(help).toContain('zavorth onboard --dry-run');
    expect(help).toContain('zavorth ready');
    expect(help).toContain('zavorth start');
    expect(help).toContain('zavorth open');
  });

  it('points first-time go users to setup before daily use', () => {
    const output = formatZavorthGoReport(mockGoReport(), {
      dryRun: true,
      firstRun: {
        configured: false,
        profilePath: 'C:/workspace/data/runtime/first-run/profile.json',
      },
      launcher: {
        skipped: true,
        applied: false,
        mode: 'desktop',
        error: null,
      },
      appOpen: {
        skipped: true,
        opened: false,
        targetUrl: 'http://127.0.0.1:3333/dashboard',
      },
    });

    expect(output).toContain('Primeiro uso');
    expect(output).toMatch(/Perfil local ainda not configurado\.|Local profile not yet configured\./i);
    expect(output).toContain('zavorth setup --dry-run');
    expect(output).toContain('zavorth setup');
  });

  it('does not ask configured users to run setup from go', () => {
    const output = formatZavorthGoReport(mockGoReport(), {
      firstRun: {
        configured: true,
        profilePath: 'C:/workspace/data/runtime/first-run/profile.json',
        userDisplayName: 'Operator',
        agentDisplayName: 'Zavorth',
      },
    });

    expect(output).not.toContain('Perfil local ainda not configurado.');
    expect(output).not.toContain('zavorth setup --dry-run');
  });
});

function mockGoReport() {
  return {
    local: {
      ready: true,
      appUrl: 'http://127.0.0.1:3333/dashboard',
      trust: {
        applied: true,
        attempted: false,
        error: null,
      },
    },
    remote: {
      configured: false,
      ready: false,
      appUrl: null,
      issues: [],
    },
    summary: 'Zavorth ready.',
    tokenSource: 'file',
    journey: {
      summary: 'Zavorth ready.',
    },
    nextSteps: [],
  } as any;
}
