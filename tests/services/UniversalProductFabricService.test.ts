import { UniversalProductFabricService } from '../../src/services/UniversalProductFabricService.js';

describe('UniversalProductFabricService', () => {
  it('lists public commands grouped and brand-agnostic', () => {
    const service = new UniversalProductFabricService({ projectRoot: process.cwd() });
    const all = service.listPublicCommands();
    expect(all.length).toBeGreaterThan(10);
    expect(all.some((c) => c.command.startsWith('zavorth absorb'))).toBe(true);
    expect(all.some((c) => c.command.startsWith('zavorth reach'))).toBe(true);
    expect(all.some((c) => c.command.startsWith('zavorth power'))).toBe(true);
    expect(all.some((c) => c.command.startsWith('zavorth product'))).toBe(true);
    for (const cmd of all) {
    }
    const daily = service.listPublicCommands('daily');
    expect(daily.every((c) => c.group === 'daily')).toBe(true);
  });

  it('builds first-run trail with next command', async () => {
    const service = new UniversalProductFabricService({ projectRoot: process.cwd() });
    const snap = await service.buildSnapshot({ runCertification: false });
    expect(snap.policy.brandAgnostic).toBe(true);
    expect(snap.policy.catalogIsNotLive).toBe(true);
    expect(snap.narrative.productThesis.toLowerCase()).toContain('capabilities');
    expect(snap.firstRun.steps.length).toBeGreaterThanOrEqual(5);
    expect(snap.firstRun.nextCommand).toBeTruthy();
    expect(snap.publicCommands.length).toBeGreaterThan(10);
  });

  it('runs hermetic certification across fabrics', async () => {
    const service = new UniversalProductFabricService({ projectRoot: process.cwd() });
    const snap = await service.certify();
    expect(snap.certification.checks.length).toBeGreaterThanOrEqual(10);
    expect(snap.certification.checks.every((c) => c.hermetic && c.liveIoPerformed === false)).toBe(true);
    expect(snap.certification.blocked).toBe(0);
    expect(snap.certification.passed).toBeGreaterThanOrEqual(8);
    expect(['ready', 'attention']).toContain(snap.certification.status);

    const ids = snap.certification.checks.map((c) => c.id);
    expect(ids).toContain('capability-absorb-preview');
    expect(ids).toContain('reach-inventory-truth');
    expect(ids).toContain('power-backend-elastic');
    expect(ids).toContain('trusted-operator-red-lane');
    expect(ids).toContain('learning-promote-consent');
    expect(ids).toContain('public-command-surface');
  }, 60_000);

  it('doctor returns actionable lines', async () => {
    const service = new UniversalProductFabricService({ projectRoot: process.cwd() });
    const out = await service.doctor();
    expect(out.lines.join('\n')).toMatch(/Status:/);
    expect(out.lines.join('\n')).toMatch(/Certification:/);
    expect(out.snapshot.certification.checks.length).toBeGreaterThan(0);
  }, 60_000);
});
