import { ZavorthUserResponseRendererService } from '../../../src/services/ZavorthUserResponseRendererService';

describe('ZavorthUserResponseRendererService structured receipts', () => {
  const run = {
    id: '4f7c2b1e-9d0a-4c1f-b2a3-56f7e8d9c0ab',
    status: 'waiting_approval',
    approvals: [{ id: 'ap-1', status: 'pending' }],
  } as never;

  it('exposes a receipt with summary up front and technical lines separate', () => {
    const result = new ZavorthUserResponseRendererService().render({
      text: 'Working on it.',
      channel: 'desktop',
      run,
    });

    expect(result.footerIncluded).toBe(true);
    expect(result.receipt).toBeDefined();
    expect(result.receipt!.summary).toContain('I need your confirmation');
    expect(result.receipt!.technicalLines.some((line) => line.includes('approval:'))).toBe(true);
  });

  it('keeps the flat text stable for operator audiences while exposing the receipt', () => {
    const input = {
      text: 'Deploy finished cleanly.',
      channel: 'cli',
      audience: 'operator' as const,
      approvalId: 'ap-2',
      approvalStatus: 'approved',
      replayCommand: 'zavorth deploy --again',
    };
    const service = new ZavorthUserResponseRendererService();
    const rendered = service.render(input);
    expect(rendered.text.split('\n')[0]).toBe('I need your confirmation to continue safely.');
    expect(rendered.text).toContain('- replay: zavorth deploy --again');
    expect(rendered.receipt).toBeDefined();
    expect(rendered.receipt!.summary).toContain('I need your confirmation');
    expect(rendered.receipt!.technicalLines).toEqual([
      '- approval: ap-2 (approved)',
      '- replay: zavorth deploy --again',
    ]);
  });

  it('omits the receipt when no footer is included', () => {
    const result = new ZavorthUserResponseRendererService().render({
      text: 'All done.',
      channel: 'web',
      includeTechnicalFooter: false,
    });
    expect(result.footerIncluded).toBe(false);
    expect(result.receipt).toBeUndefined();
  });
});
