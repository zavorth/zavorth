import { readFileSync } from 'fs';
import { join } from 'path';

const controlDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/dashboard',
);

describe('Dashboard access and onboarding', () => {
  it('accepts the CLI hash token and scrubs it before runtime calls', () => {
    const utils = readFileSync(join(controlDir, 'controlPageClient.utils.ts'), 'utf8');

    expect(utils).toContain('new URLSearchParams(url.hash.startsWith("#")');
    expect(utils).toContain('hashParams.get("token")');
    expect(utils).toContain('hashParams.get("zavorthToken")');
    expect(utils).toContain('hashParams.delete("token")');
    expect(utils).toContain('hashParams.delete("zavorthToken")');
    expect(utils).toContain('window.sessionStorage.setItem("zavorth.webAuthToken", urlToken)');
  });

  it('ships first-run guidance in the official /dashboard shell instead of the Vite prototype', () => {
    const panel = readFileSync(
      join(controlDir, 'dashboard/components/DashboardOnboardingPanel.tsx'),
      'utf8',
    );
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );

    expect(shell).toContain('DashboardOnboardingPanel');
    expect(panel).toContain('/api/auth/validate');
    expect(panel).toContain('zavorth.webAuthToken');
    expect(panel).toContain('Runtime protegido');
    expect(panel).toContain('Provider');
    expect(panel).toContain('Safe tools');
    expect(panel).toContain('First run');
    expect(panel).toContain('Resuma esta pasta e diga o que posso fazer aqui.');
  });

  it('keeps premium access/onboarding/approval classes in the scoped visual contract', () => {
    const visualContract = readFileSync(
      join(controlDir, 'dashboard/styles/dashboardVisualContract.ts'),
      'utf8',
    );
    const css = readFileSync(
      join(controlDir, 'dashboard/styles/dashboard.css'),
      'utf8',
    );
    const operationsPanel = readFileSync(
      join(controlDir, 'dashboard/components/DashboardOperationsPanel.tsx'),
      'utf8',
    );

    for (const className of [
      'bcc-access-card',
      'bcc-onboarding-step',
      'bcc-approval-summary',
    ]) {
      expect(visualContract).toContain(className);
      expect(css).toContain(`.${className}`);
    }

    expect(operationsPanel).toContain('Aguardando sua decisao');
    expect(operationsPanel).toContain('Mutacao, rede sensivel e impacto externo');
    expect(operationsPanel).toContain('Negar');
  });
});
