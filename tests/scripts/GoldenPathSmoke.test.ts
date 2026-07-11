/**
 * Light unit coverage for golden-path smoke pure checks.
 * Full E2E remains: npm run qa:zavorth-golden-path
 */

import {
  runGoldenPathSmoke,
  smokeHonestyReadiness,
  smokeChangePreview,
  smokeProofLedger,
} from '../../scripts/zavorth-golden-path-smoke';

describe('GoldenPathSmoke', () => {
  test('runGoldenPathSmoke passes hermetically', () => {
    const report = runGoldenPathSmoke();
    expect(report.ok).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(8);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  test('individual core checks pass', () => {
    expect(smokeProofLedger().ok).toBe(true);
    expect(smokeChangePreview().ok).toBe(true);
    expect(smokeHonestyReadiness().ok).toBe(true);
    expect(smokeHonestyReadiness().detail).toMatch(/catalog=/);
  });
});
