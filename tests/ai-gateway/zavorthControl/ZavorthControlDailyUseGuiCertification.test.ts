import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ZavorthControl daily-use GUI certification wiring', () => {
  it('exposes the daily-use GUI certification as a projection-only ZavorthControl route', () => {
    const route = read('src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts');

    expect(route).toContain("'/api/web/zavorthControl/gui-certification-v1'");
    expect(route).toContain('new ZavorthDailyUseGuiCertificationService().certify');
    expect(route).toContain('desktopCanBypassRuntime: false');
    expect(route).toContain('policyBrokerRequiredForMutableActions: true');
    expect(route).toContain('rawSecretsSerialized: false');
  });

  it('keeps the certification documented as a pre-desktop gate', () => {
    const docs = read('docs/protocol/runtime-api-v1.md');
    const packageJson = read('package.json');

    expect(docs).toContain('/api/web/zavorthControl/gui-certification-v1');
    expect(docs).toContain('Daily-Use GUI Certification');
    expect(docs).toContain('status, health, providers, channels, approvals, receipts, missions, chat, events and governed actions');
    expect(packageJson).toContain('ZavorthDailyUseGuiCertificationService.test.ts');
    expect(packageJson).toContain('ZavorthControlDailyUseGuiCertification.test.ts');
  });
});
