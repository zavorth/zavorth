import { readFileSync } from 'fs';
import { join } from 'path';

describe('SystrayService notifications', () => {
  const source = () => readFileSync(
    join(process.cwd(), 'agent', 'src', 'SystrayService.ts'),
    'utf8',
  );

  it('defines safe tray events for approvals, gateway fallback, budget, channels and memory receipts', () => {
    const code = source();

    expect(code).toContain("public notify(event: TrayNotificationEvent");
    expect(code).toContain("'approval-pending'");
    expect(code).toContain("'gateway-fallback'");
    expect(code).toContain("'budget-blocked'");
    expect(code).toContain("'channel-test-result'");
    expect(code).toContain("'memory-mutation-receipt'");
    expect(code).toContain("this.emit('notification'");
    expect(code).toContain("this.state.lastFallback");
    expect(code).toContain("this.state.budgetStatus = 'blocked'");
  });

  it('sanitizes notification payloads before emitting them', () => {
    const code = source();
    const notifyIndex = code.indexOf('public notify(event: TrayNotificationEvent');
    const emitIndex = code.indexOf("this.emit('notification'", notifyIndex);
    const sanitizeIndex = code.indexOf('const safePayload = this.sanitizeNotificationPayload(payload)', notifyIndex);

    expect(sanitizeIndex).toBeGreaterThan(notifyIndex);
    expect(sanitizeIndex).toBeLessThan(emitIndex);
    expect(code).toContain("sanitizeNotificationPayload");
    expect(code).toContain("sanitizeNotificationText");
    expect(code).toContain("prompt|memoryContent|content|secret|token|apiKey|authorization|password|path");
    expect(code).toContain("[redacted-token]");
    expect(code).toContain("[local path]");
  });
});
