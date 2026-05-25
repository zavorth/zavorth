import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Dashboard Hermes-class surface', () => {
  it('wires the dashboard projection, cards, queue and reconnect affordances', () => {
    const contract = read('src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardHermesClassContracts.ts');
    const panel = read('src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardHermesClassPanel.tsx');
    const chat = read('src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardChatSurface.tsx');
    const hook = read('src/ai-gateway/app/(dashboard)/dashboard/useControlPageClient.ts');
    const shell = read('src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx');
    const css = read('src/ai-gateway/app/(dashboard)/dashboard/dashboard/styles/dashboard.css');

    expect(contract).toContain('dashboard-hermes-class/v1');
    expect(contract).toContain('DashboardDashboardHermesToolCallCard');
    expect(contract).toContain('DashboardDashboardHermesSubagentCard');
    expect(contract).toContain('DashboardDashboardHermesContextMeter');
    expect(contract).toContain('DashboardDashboardHermesMermaidDiagram');
    expect(contract).toContain('DashboardDashboardHermesMessageQueueItem');

    expect(panel).toContain('buildDashboardHermesClassProjection');
    expect(panel).toContain('DashboardToolCallCards');
    expect(panel).toContain('DashboardSubagentCards');
    expect(panel).toContain('DashboardRichApprovalCards');
    expect(panel).toContain('DashboardMermaidRenderer');
    expect(panel).toContain('DashboardMessageQueue');

    expect(chat).toContain('<DashboardHermesClassPanel');
    expect(chat).toContain('Retry draft');
    expect(chat).toContain('Message actions');
    expect(shell).toContain('wsReconnectAttempt={model.wsReconnectAttempt}');
    expect(hook).toContain('scheduleReconnect');
    expect(hook).toContain('reconnectTimeoutRef');
    expect(css).toContain('.bcc-hermes-class');
    expect(css).toContain('.bcc-context-meter');
    expect(css).toContain('.bcc-mermaid-render');
  });
});
