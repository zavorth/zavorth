import { IdentityContainmentService } from '../../src/services/IdentityContainmentService';

describe('IdentityContainmentService', () => {
  it('keeps Zavorth-native launch-facing names stable', () => {
    const service = new IdentityContainmentService();

    expect(service.resolveNativeName('executor.external')).toBe('executor.external');
    expect(service.resolveNativeName('route-external-code-review')).toBe('route-external-code-review');
    expect(service.resolveNativeName('command.external-review')).toBe('command.external-review');
  });

  it('separates launch-facing readiness from compatibility quarantine', () => {
    const service = new IdentityContainmentService();
    const readiness = service.getLaunchReadinessReport();
    const report = service.getContaminationReport();

    expect(readiness.ready).toBe(true);
    expect(readiness.launchFacingLegacySurfaces).toHaveLength(0);
    expect(readiness.compatibilityQuarantineSurfaces.length).toBeGreaterThan(0);
    expect(readiness.privateArchiveSurfaces.length).toBeGreaterThan(0);
    expect(report.byZone['launch-facing']).toBeGreaterThan(0);
    expect(report.byZone['compatibility-quarantine']).toBeGreaterThan(0);
    expect(report.byZone['private-archive']).toBeGreaterThan(0);
  });
});
