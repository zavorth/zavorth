import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';


const apiRoot = resolve(__dirname, '../../../src', 'ai-gateway', 'app', 'api');

function route(...segments: string[]): string {
  return readFileSync(join(apiRoot, ...segments, 'route.ts'), 'utf8');
}

describe('Zavorth Control runtime truthfulness', () => {
  it('builds the experience home from the canonical runtime instead of a welcome fixture', () => {
    const home = route('experience', 'home');
    expect(home).toContain('getExperienceCoreService().buildHome');
    expect(home).not.toContain('Hello, operator.');
    const compatibilitySnapshot = route('web', 'zavorthControl').replace(
      /[\s\S]*/,
      readFileSync(join(apiRoot, 'web', 'zavorthControl', 'zavorthControlApiSnapshot.ts'), 'utf8'),
    );
    expect(existsSync(join(apiRoot, 'web', 'zavorthControl', 'zavorthControlApiSnapshot.ts'))).toBe(true);
    expect(compatibilitySnapshot).toContain('getExperienceCoreService().buildHome');
    expect(compatibilitySnapshot).not.toContain('Hello, operator.');
  });

  it('runs chat through Experience Core without synthetic mission ids or canned replies', () => {
    const chat = route('web', 'zavorthControl', 'chat-v1');
    expect(chat).toContain('ensureExperienceAgentReady');
    expect(chat).toContain('getExperienceCoreService().executeCommand');
    expect(chat).toContain('requireControlAuth(request)');
    expect(chat).not.toContain('mission-${Date.now()}');
    expect(chat).not.toContain('Velocity selected');
    expect(chat).not.toContain('Shield selected');
  });

  it('executes supported actions and rejects unsupported work without fake receipts', () => {
    const actions = route('web', 'zavorthControl', 'actions');
    expect(actions).toContain('ProviderConnectionTestService.getInstance().testConnection');
    expect(actions).toContain('new ZavorthChannelActionService().execute');
    expect(actions).toContain('getExperienceCoreService().executeCommand');
    expect(actions).toContain('requireControlAuth(request)');
    expect(actions).not.toContain('status: "recorded"');
    expect(actions).not.toContain('control-action-${Date.now()}');
  });

  it('protects read-side control, event, session and runtime projections', () => {
    for (const source of [
      route('web', 'zavorthControl'),
      route('web', 'zavorthControl', 'events-v1'),
      route('web', 'gateway', 'sessions'),
      route('web', 'gateway', 'runtime'),
    ]) {
      expect(source).toContain('requireControlAuth(request)');
    }
  });
});
