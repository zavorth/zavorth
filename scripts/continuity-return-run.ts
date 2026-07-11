import { DailyReturnContinuityService } from '../src/services/DailyReturnContinuityService.js';

function main(): void {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const service = new DailyReturnContinuityService();

  if (asCheck) {
    const withApprovals = service.buildSnapshot({ pendingApprovals: 1, providerReady: true });
    const continueSession = service.buildSnapshot({
      pendingApprovals: 0,
      providerReady: true,
      sessions: [{ id: 's1', title: 'Yesterday', updatedAt: '2026-07-10T12:00:00.000Z' }],
    });
    const day1 = service.buildSnapshot({
      previousOpenAt: '2026-07-10T09:00:00.000Z',
      currentOpenAt: '2026-07-11T10:00:00.000Z',
      providerReady: true,
      sessions: [{ id: 's1', title: 'Work', updatedAt: '2026-07-10T20:00:00.000Z' }],
    });
    const ok = withApprovals.nextAction.kind === 'review-approval'
      && continueSession.nextAction.kind === 'continue-session'
      && day1.day1ReturnEligible === true;
    const payload = {
      ok,
      approvals: withApprovals.nextAction.kind,
      continue: continueSession.nextAction.kind,
      day1: day1.day1ReturnEligible,
    };
    process.stdout.write(asJson ? `${JSON.stringify(payload, null, 2)}\n` : `continuity check: ${ok ? 'pass' : 'fail'}\n`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  const snapshot = service.buildSnapshot({
    pendingApprovals: 0,
    providerReady: true,
    sessions: [{ id: 'local', title: 'Current work', updatedAt: new Date().toISOString() }],
  });
  process.stdout.write(asJson ? `${JSON.stringify(snapshot, null, 2)}\n` : `${service.renderText(snapshot)}\n`);
}

main();
