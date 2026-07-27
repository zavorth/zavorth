import { ZavorthUserResponseRendererService } from '../../../src/services/ZavorthUserResponseRendererService';

describe('ZavorthUserResponseRendererService', () => {
  it('hides technical footers for normal completed chat', () => {
    const service = new ZavorthUserResponseRendererService();

    const result = service.render({
      channel: 'telegram',
      audience: 'normal-user',
      text: 'Here is the response.',
    });

    expect(result.text).toBe('Here is the response.');
    expect(result.footerIncluded).toBe(false);
  });

  it('turns capability negotiation jargon into a plain confirmation request', () => {
    const service = new ZavorthUserResponseRendererService();

    const result = service.render({
      channel: 'telegram',
      audience: 'normal-user',
      text: 'Capability Negotiation waiting for approval de escopo.',
      approvalId: 'approval-123',
      approvalStatus: 'pending',
    });

    expect(result.text).toContain('I need your confirmation to continue safely.');
    expect(result.text).toContain('Nothing has been executed yet.');
    expect(result.text).toContain('- approval: waiting for your decision');
    expect(result.text).not.toContain('approval-123');
    expect(result.text).toContain(
      'Tap Approve/Reject on the card, or use /approve or /reject (or /approve 1 if several).',
    );
    expect(result.text).not.toContain('reply "Approve"');
    expect(result.text).not.toContain('Capability Negotiation');
  });

  it('keeps full approval id for operator audience only', () => {
    const service = new ZavorthUserResponseRendererService();

    const result = service.render({
      channel: 'cli',
      audience: 'operator',
      text: 'Need confirmation.',
      approvalId: 'approval-op-99',
      approvalStatus: 'pending',
      run: {
        id: 'run-op-1',
        status: 'waiting_approval',
        approvals: [{ id: 'approval-op-99', status: 'pending' }],
      } as any,
    });

    expect(result.text).toContain('approval: approval-op-99 (pending)');
    expect(result.text).toContain(
      'Tap Approve/Reject on the card, or use /approve or /reject (or /approve 1 if several).',
    );
    expect(result.text).toContain('run: run-op-1');
  });

  it('keeps operator details available when the audience needs them', () => {
    const service = new ZavorthUserResponseRendererService();

    const result = service.render({
      channel: 'cli',
      audience: 'operator',
      text: 'Request processed by the universal runtime.',
      run: {
        id: 'run-1',
        status: 'completed',
        approvals: [],
      } as any,
      replayCommand: 'zavorth replay run run-1 --json',
    });

    expect(result.text).toContain('Received. Zavorth recorded the request');
    expect(result.text).toContain('run: run-1');
    expect(result.text).toContain('replay: zavorth replay run run-1 --json');
  });
});
