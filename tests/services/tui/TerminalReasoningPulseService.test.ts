import { TerminalReasoningPulseService } from '../../../src/services/tui/TerminalReasoningPulseService.js';

describe('TerminalReasoningPulseService', () => {
  let pulseService: TerminalReasoningPulseService;

  beforeEach(() => {
    pulseService = new TerminalReasoningPulseService();
  });

  it('calculates sinusoidal pulse oscillating between 0.25 and 1.0', () => {
    const pulseAt0 = pulseService.calculatePulse(0);
    const pulseAtMid = pulseService.calculatePulse(416); // halfway through period

    expect(pulseAt0).toBeGreaterThanOrEqual(0.25);
    expect(pulseAt0).toBeLessThanOrEqual(1.0);
    expect(pulseAtMid).toBeGreaterThanOrEqual(0.25);
    expect(pulseAtMid).toBeLessThanOrEqual(1.0);
  });

  it('returns valid PulseVisualFrame with blended RGB color and ambient string', () => {
    const frame = pulseService.getPulseFrame(500, 'deep');

    expect(frame.intensity).toBeGreaterThan(0);
    expect(frame.color).toHaveProperty('r');
    expect(frame.color).toHaveProperty('g');
    expect(frame.color).toHaveProperty('b');
    expect(frame.ambientString).toContain('Thinking...');
  });

  it('generates starry ambient banner with sparkle glyphs', () => {
    const banner = pulseService.generateStarryBanner(40, 1);

    expect(banner).toBeDefined();
    expect(banner.length).toBeGreaterThan(20);
  });
});
