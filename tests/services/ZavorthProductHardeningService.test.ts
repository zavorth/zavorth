import path from 'node:path';
import { ZavorthProductHardeningService } from '../../src/services/ZavorthProductHardeningService';

import {
  ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthProductHardeningContract';

describe('ZavorthProductHardeningService', () => {
  it('builds a consolidated maturity snapshot for product stabilization', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const snapshot = await new ZavorthProductHardeningService({
      projectRoot,
      now: () => new Date('2026-06-01T12:00:00.000Z'),
      env: {},
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION);
    expect(snapshot.generatedAt).toBe('2026-06-01T12:00:00.000Z');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.areas.map((area) => area.id)).toEqual([
      'quality-gates',
      'surface-consolidation',
      'install-ux',
      'dashboard-ux',
      'certification',
      'repo-hygiene',
    ]);
    expect(snapshot.surfacePolicy).toEqual(expect.objectContaining({
      canonicalEntry: '/zavorthControl',
      retiredSurfaces: ['/app', '/classic'],
      legacyRoutesRetired: true,
      duplicateSurfacesRemoved: true,
    }));
    expect(snapshot.installPolicy).toEqual(expect.objectContaining({
      homeIsExplicit: true,
      setupExplainsGovernance: true,
      wakeDetectorChoiceIsExplicit: true,
      migrationRequiresApproval: true,
    }));
  });

  it('keeps the hardening report actionable and safe to show', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthProductHardeningService({
      projectRoot,
      now: () => new Date('2026-06-01T12:00:00.000Z'),
      env: {},
    });
    const snapshot = await service.buildSnapshot();
    const report = JSON.stringify(snapshot);

    expect(snapshot.commands.qa).toContain('qa:zavorth-product-hardening');
    expect(snapshot.commands.dashboard).toContain('zavorth-control-vite:check');
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noSilentMutation: true,
      secretValuesSerialized: false,
      oldSurfacesRemoved: true,
      checksAreRepeatable: true,
    }));
    expect(report).not.toMatch(/sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{16,}|xox[baprs]-[A-Za-z0-9-]{12,}/u);
    expect(service.renderText(snapshot)).toContain('qa:zavorth-product-hardening');
  });
});
