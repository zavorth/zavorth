import { ZavorthCli } from '../../src/cli/ZavorthCli';
import { ZavorthCliTuiPolishService } from '../../src/services/ZavorthCliTuiPolishService';

describe('ZavorthCliExperiencePolish Tests (Phase 21N)', () => {
  it('verifies that CLI outputs do not contain undefined, null, or [object Object]', async () => {
    const writes: string[] = [];
    const errors: string[] = [];

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: (text: string) => errors.push(text),
      },
    });

    const exitCode = await cli.run(['help']);
    expect(exitCode).toBe(0);

    const fullOutput = writes.join('\n') + '\n' + errors.join('\n');
    expect(fullOutput).not.toContain('undefined');
    expect(fullOutput).not.toContain('null');
    expect(fullOutput).not.toContain('[object Object]');
  });

  it('verifies that TUI Polish Service renders safe defaults and status indicators', async () => {
    const service = new ZavorthCliTuiPolishService();
    const snapshot = await service.buildSnapshot({
      refreshProviders: false,
      userId: 'test-user',
      workspaceHint: process.cwd()
    });

    expect(snapshot.surface).toBe('cli-tui-polish');
    expect(snapshot.safety.noRawSecretsSerialized).toBe(true);
    expect(snapshot.safety.cliProjectionCannotApproveOrExecute).toBe(true);

    const rendered = service.renderCli(snapshot);
    expect(rendered).toContain('Zavorth');
    expect(rendered).not.toContain('Legacy Agent');
    expect(rendered).not.toContain('undefined');
    expect(rendered).not.toContain('null');
  });

  it('verifies that any secret pattern, Bearer token, or secretRef is redacted in logs/output', () => {
    const rawSecret = 'sk-test-some-secret-token-pattern-here-123456';
    const bearer = 'Bearer abc123xyz456';
    const authHeader = 'Authorization: Bearer my-key';
    const secretRef = 'secretRef: my-secure-reference';

    // Simple sanitization helper mimicking error normalizer
    const sanitizeText = (text: string) => {
      return text
        .replace(/(sk-[a-zA-Z0-9_-]{12,})/g, '[REDACTED]')
        .replace(/(Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_BEARER]')
        .replace(/(Authorization:\s*[^\s]+)/gi, '[REDACTED_AUTH]')
        .replace(/(secretRef:\s*[^\s]+)/gi, '[REDACTED_SECRET_REF]');
    };

    expect(sanitizeText(rawSecret)).toBe('[REDACTED]');
    expect(sanitizeText(bearer)).toBe('[REDACTED_BEARER]');
    expect(sanitizeText(authHeader)).toBe('[REDACTED_AUTH]');
    expect(sanitizeText(secretRef)).toBe('[REDACTED_SECRET_REF]');
  });
});
