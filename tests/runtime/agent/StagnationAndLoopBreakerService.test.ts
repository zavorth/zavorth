import { StagnationAndLoopBreakerService } from '../../../src/runtime/agent/StagnationAndLoopBreakerService.js';

describe('StagnationAndLoopBreakerService', () => {
  let detector: StagnationAndLoopBreakerService;

  beforeEach(() => {
    detector = new StagnationAndLoopBreakerService();
  });

  it('computes 3-gram shingle similarity accurately', () => {
    const text1 = 'function authenticateUser(token: string) { return verify(token); }';
    const text2 = 'function authenticateUser(token: string) { return verifyToken(token); }';
    const similarity = StagnationAndLoopBreakerService.computeShingleSimilarity(text1, text2);

    expect(similarity).toBeGreaterThan(0.75);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });

  it('triggers edit_repeat when near-identical edits occur on the same file', () => {
    const file = 'src/auth/service.ts';
    const edit1 = 'export function check(x) { if (!x) return null; }';
    const edit2 = 'export function check(x) { if (!x) return undefined; }';
    const edit3 = 'export function check(x) { if (!x) return false; }';

    expect(detector.recordEdit(file, edit1)).toBeNull();
    expect(detector.recordEdit(file, edit2)).toBeNull();
    const trigger = detector.recordEdit(file, edit3);

    expect(trigger).not.toBeNull();
    expect(trigger?.patternType).toBe('edit_repeat');
    expect(trigger?.severity).toBe('critical');
    expect(trigger?.reflectionGuidance).toContain('STOP trying minor variations');
  });

  it('triggers command_retry on 3 consecutive failing command attempts', () => {
    const cmd1 = 'npm test tests/auth.test.ts';
    const cmd2 = 'npm test tests/auth.test.ts --verbose';
    const cmd3 = 'npm test tests/auth.test.ts --silent';

    expect(detector.recordCommand(cmd1, 1)).toBeNull();
    expect(detector.recordCommand(cmd2, 1)).toBeNull();
    const trigger = detector.recordCommand(cmd3, 1);

    expect(trigger).not.toBeNull();
    expect(trigger?.patternType).toBe('command_retry');
    expect(trigger?.reflectionGuidance).toContain('failed 3 consecutive times');
  });

  it('triggers doom_loop on 5 identical consecutive tool calls', () => {
    const tool = 'read_file';
    const args = '{"path": "config.json"}';

    expect(detector.recordToolCall(tool, args)).toBeNull();
    expect(detector.recordToolCall(tool, args)).toBeNull();
    expect(detector.recordToolCall(tool, args)).toBeNull();
    expect(detector.recordToolCall(tool, args)).toBeNull();
    const trigger = detector.recordToolCall(tool, args);

    expect(trigger).not.toBeNull();
    expect(trigger?.patternType).toBe('doom_loop');
    expect(trigger?.reflectionGuidance).toContain('repetitive tool loop');
  });
});
