import { resolveVoiceCallStatus } from '../../src/services/voice/VoiceCallStatus.js';

describe('resolveVoiceCallStatus (priority 5 UI)', () => {
  it('idle when inactive', () => {
    const s = resolveVoiceCallStatus({ active: false });
    expect(s.key).toBe('idle');
    expect(s.label).toBe('Idle');
  });

  it('connecting / listening / thinking / speaking / error', () => {
    expect(
      resolveVoiceCallStatus({ active: true, phase: 'connecting' }).label,
    ).toBe('Connecting');
    expect(
      resolveVoiceCallStatus({ active: true, phase: 'listening' }).label,
    ).toBe('Listening');
    expect(
      resolveVoiceCallStatus({ active: true, phase: 'listening', rms: 0.05 }).label,
    ).toBe('Hearing you');
    expect(
      resolveVoiceCallStatus({ active: true, phase: 'processing' }).label,
    ).toBe('Thinking');
    expect(
      resolveVoiceCallStatus({ active: true, phase: 'speaking' }).label,
    ).toBe('Speaking');
    expect(
      resolveVoiceCallStatus({
        active: true,
        phase: 'error',
        lastError: 'STT failed. Type your message instead.',
      }).label,
    ).toBe('Error');
    expect(
      resolveVoiceCallStatus({
        active: true,
        phase: 'error',
        lastError: 'STT failed. Type your message instead.',
      }).detail,
    ).toMatch(/Type your message/i);
  });
});
