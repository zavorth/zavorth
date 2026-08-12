import { ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER } from '../../src/contracts/ZavorthHandoffEnvelopeContract';
import { ZavorthHandoffEnvelopeService } from '../../src/services/ZavorthHandoffEnvelopeService';

describe('ZavorthHandoffEnvelopeService', () => {
  it('builds a governed nine-section handoff envelope', () => {
    const service = new ZavorthHandoffEnvelopeService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const snapshot = service.buildEnvelope({
      sessionId: 'session-1',
      workspace: 'C:/repo',
      operator: 'user-1',
      activeMandate: 'Continue memory implementation without live execution.',
      architectureDecisions: ['Use markdown handoff envelopes.'],
      modifiedPaths: ['src/services/ZavorthHandoffEnvelopeService.ts'],
      securityApprovals: ['No break-glass permission granted.'],
      remainingTodos: ['Implement wiki baseline.'],
      simulatedStatePreview: ['Preview engine ready, follow-up pending.'],
      nextPrescribedAction: 'Start follow-up.',
      messages: [
        { role: 'user', content: 'Preserve this directive verbatim.' },
        { role: 'tool', toolName: 'jest', status: 'error', content: 'timeout in tests/services/Foo.test.ts' },
        { role: 'assistant', content: 'Ready.' },
      ],
      usableContextTokens: 20,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-18T12:00:00.000Z',
      status: 'preview-ready',
      sessionId: 'session-1',
      workspace: 'C:/repo',
      operator: 'user-1',
      receipt: expect.objectContaining({
        providerCall: false,
        durableMutation: false,
        toolExecution: false,
        secretsRedacted: true,
        approvalRequiredToPersist: true,
      }),
    }));
    expect(snapshot.sections.map((section) => section.id)).toEqual(ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER);
    expect(snapshot.sections).toHaveLength(9);
    expect(snapshot.markdown).toContain('# Zavorth Handoff Envelope');
    expect(snapshot.markdown).toContain('## Active Mandate');
    expect(snapshot.markdown).toContain('## Next Prescribed Action');
    expect(snapshot.markdown).toContain('Preserve this directive verbatim.');
  });

  it('redacts secrets from markdown and structured sections', () => {
    const service = new ZavorthHandoffEnvelopeService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const snapshot = service.buildEnvelope({
      sessionId: 'session-secret',
      activeMandate: 'Use api_key=should-not-leak for nothing.',
      messages: [
        { role: 'user', content: 'My token=super-secret-token-value should never appear.' },
      ],
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).toContain('[REDACTED_SECRET]');
    expect(serialized).not.toContain('should-not-leak');
    expect(serialized).not.toContain('super-secret-token-value');
  });

  it('keeps the envelope as preview-only and does not require runtime side effects', () => {
    const service = new ZavorthHandoffEnvelopeService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const snapshot = service.buildEnvelope({
      sessionId: 'fresh',
      messages: [],
    });

    expect(snapshot.status).toBe('preview-ready');
    expect(snapshot.markdown).toContain('Preview only');
    expect(snapshot.receipt.approvalRequiredToPersist).toBe(true);
    expect(snapshot.sections.find((section) => section.id === 'tool-failure-log')?.items).toEqual(['No tool failure detected in compacted turns.']);
  });
});
