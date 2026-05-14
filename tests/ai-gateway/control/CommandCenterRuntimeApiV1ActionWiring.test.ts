import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Command Center runtime API v1 action wiring', () => {
  it('exposes web-safe event and action routes that delegate to canonical runtime API v1', () => {
    const source = read('src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts');

    expect(source).toContain("'/api/web/command-center/events-v1'");
    expect(source).toContain("'/api/web/command-center/actions'");
    expect(source).toContain('deps.publicApi.readRuntimeEvents');
    expect(source).toContain('deps.publicApi.approveApproval');
    expect(source).toContain('deps.publicApi.denyApproval');
    expect(source).toContain('deps.publicApi.cancelMission');
    expect(source).toContain('deps.publicApi.testProvider');
    expect(source).toContain('deps.publicApi.executeChannelAction');
    expect(source).toContain('delegatedToRuntimeApiV1: true');
    expect(source).toContain('commandCenterCanExecute: false');
    expect(source).toContain('controllerMutatedDirectly: false');
  });

  it('routes approval buttons through the governed action endpoint instead of websocket-only legacy resolution', () => {
    const hook = read('src/ai-gateway/app/(dashboard)/control/useControlPageClient.ts');

    expect(hook).toContain('fetchJson<Record<string, any>>("/api/web/command-center/actions"');
    expect(hook).toContain('action: decision === "approve" ? "approval.approve" : "approval.deny"');
    expect(hook).toContain('fetchJson<Record<string, any>>(`/api/web/command-center/events-v1${query}`)');
    expect(hook).not.toContain('sendGatewayRequest("approval.resolve"');
  });

  it('renders runtime API v1 evidence as projection-only UX', () => {
    const main = read('src/ai-gateway/app/(dashboard)/control/controlPageClient.main.tsx');

    expect(main).toContain('Runtime API v1');
    expect(main).toContain('this panel has no direct execution authority');
  });
});
