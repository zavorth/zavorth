import { getDashboardClassicClientOverviewOperationsHostScript } from '../../src/domain/surface/presentation/dashboard/DashboardClassicClientOverviewOperationsHostScript.js';

describe('DashboardClassicClientOverviewOperationsHostScript', () => {
  it('renders explicit maintenance priority context for Node Mesh-triggered automation', () => {
    const script = getDashboardClassicClientOverviewOperationsHostScript();

    expect(script).toContain('maintenanceAutomation.lastTriggerSource === \'priority\'');
    expect(script).toContain('maintenanceAutomation.lastPriorityReason');
    expect(script).toContain('priorizada');
    expect(script).toContain('Prioridade: ');
  });

  it('renders native channel doctor status in the operations host card', () => {
    const script = getDashboardClassicClientOverviewOperationsHostScript();

    expect(script).toContain('channelProviderDoctor');
    expect(script).toContain('Doctor dos canais nativos');
    expect(script).toContain('npm run test:channels:smoke');
    expect(script).toContain('Slack native');
    expect(script).toContain('WhatsApp Cloud API');
  });

  it('renders remote transport doctor status in the operations host card', () => {
    const script = getDashboardClassicClientOverviewOperationsHostScript();

    expect(script).toContain('remoteTransportDoctor');
    expect(script).toContain('Doctor dos transportes remotos');
    expect(script).toContain('npm run test:transports:smoke');
    expect(script).toContain('Fluxos: ');
  });
});
