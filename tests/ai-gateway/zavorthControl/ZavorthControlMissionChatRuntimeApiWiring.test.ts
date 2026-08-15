import fs from 'fs';
import path from 'path';


const root = path.resolve(__dirname, '../../../');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ZavorthControl mission and chat runtime API wiring', () => {
  it('exposes a web-safe chat route that delegates preview and live submit to Runtime API v1', () => {
    const routeSource = read('src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts');
    const interactionSource = read(
      'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionSupport.ts',
    );
    const source = `${routeSource}\n${interactionSource}`;

    expect(source).toContain("'/api/web/zavorthControl/chat-v1'");
    expect(source).toContain('publicApi.submitChat');
    expect(source).toContain('live: body?.live === true || body?.execute === true');
    expect(source).toContain('liveRequiresExplicitFlag: true');
    expect(source).toContain('policyBrokerRequiredForTools: true');
    expect(source).toContain('zavorthControlCanExecute: false');
  });

  it('submits chat from the ZavorthControl through chat-v1 instead of the legacy session send route', () => {
    const hook = read('src/ai-gateway/app/(zavorthControl)/control/useControlPageClient.ts');

    expect(hook).toContain('fetchJson<Record<string, any>>(`/api/web/zavorthControl/chat-v1`');
    expect(hook).toContain('live: options.live === true');
    expect(hook).toContain('action: "mission.cancel"');
    expect(hook).toContain('handleMissionCancel');
    expect(hook).not.toContain('/api/web/gateway/sessions/send');
  });

  it('renders mission rows and explicit preview/live controls from the canonical contract', () => {
    const main = read('src/ai-gateway/app/(zavorthControl)/control/zavorthControlPageClient.main.tsx');
    const sidebar = read('src/ai-gateway/app/(zavorthControl)/control/zavorthControlPageClient.sidebar.tsx');
    const utils = read('src/ai-gateway/app/(zavorthControl)/control/zavorthControlPageClient.utils.ts');

    expect(utils).toContain('export function getMissionRows');
    expect(utils).toContain('state?.runtimeApiV1?.contracts?.missions?.data');
    expect(main).toContain('Mission Cockpit');
    expect(main).toContain('Cancel mission');
    expect(sidebar).toContain('Preview mission');
    expect(sidebar).toContain('Submit live');
  });
});
