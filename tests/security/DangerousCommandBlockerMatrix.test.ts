import { DangerousCommandBlocker } from '../../src/security/DangerousCommandBlocker.js';

describe('DangerousCommandBlocker Combinatorial Matrix Tests', () => {
  const allowedRoots = ['cat', 'echo', 'npm', 'git', 'jest', 'yarn'];
  const disallowedRoots = ['rm', 'curl', 'bash', 'wget', 'del', 'shutdown', 'systemctl', 'unknown_cmd'];

  const roots = [
    ...allowedRoots.map(r => ({ cmd: r, isAllowed: true })),
    ...disallowedRoots.map(r => ({ cmd: r, isAllowed: false }))
  ];

  const payloads = [
    { text: ' -v', hasDangerousPattern: false, hasMetachar: false },
    { text: ' --help', hasDangerousPattern: false, hasMetachar: false },
    { text: ' -rf /', hasDangerousPattern: true, hasMetachar: false }, // Caught by rm pattern
    { text: ' -rf c:\\', hasDangerousPattern: true, hasMetachar: false }, // Caught by rm pattern
    { text: ' /s /q C:\\Windows', hasDangerousPattern: true, hasMetachar: false }, // Caught by del pattern
    { text: ' > /dev/sda1', hasDangerousPattern: true, hasMetachar: true }, // Caught by metachar AND pattern
    { text: ' > /dev/null', hasDangerousPattern: false, hasMetachar: true }, // Caught by metachar >
    { text: ' && echo pwned', hasDangerousPattern: false, hasMetachar: true }, // Caught by &&
    { text: ' || true', hasDangerousPattern: false, hasMetachar: true }, // Caught by ||
    { text: ' | sh', hasDangerousPattern: true, hasMetachar: true }, // Caught by | and curl/wget pattern
    { text: ' ; echo', hasDangerousPattern: false, hasMetachar: true }, // Caught by ;
    { text: ' $(whoami)', hasDangerousPattern: false, hasMetachar: true }, // Caught by $()
    { text: '\u0000 -v', hasDangerousPattern: false, hasMetachar: false }, // null byte is stripped
    { text: '    multiple   spaces  ', hasDangerousPattern: false, hasMetachar: false }
  ];

  const pathPrefixes = [
    '',
    '/usr/bin/',
    'C:\\Program Files\\bin\\',
    './bin/',
    '..\\..\\bin\\'
  ];

  const formatters = [
    (cmd: string) => cmd,
    (cmd: string) => `"${cmd}"`,
    (cmd: string) => `'${cmd}'`
  ];

  let testCount = 0;

  roots.forEach((root) => {
    describe(`Command Root: ${root.cmd}`, () => {
      pathPrefixes.forEach((prefix) => {
        formatters.forEach((formatter, formatIndex) => {
          payloads.forEach((payload) => {
            const formattedCmd = formatter(`${prefix}${root.cmd}`);
            const fullCommand = `${formattedCmd}${payload.text}`;
            testCount++;

            it(`evaluates: ${fullCommand}`, () => {
              const decision = DangerousCommandBlocker.explain(fullCommand);

              // Calculate expected behavior
              let expectedSafe = true;

              // 1. Check dangerous patterns first (they take precedence)
              // Note: The specific dangerous patterns apply mainly if the root matches the pattern (e.g. rm -rf)
              // Since the Regex is applied to the full string, some payloads only trigger if the root is specific.
              // Also, if the command is quoted (formatIndex > 0), the trailing quote prevents the \s+ in the rm/del regexes from matching.
              let triggersDangerousRegex = false;
              if (formatIndex === 0) {
                if (payload.text.includes('-rf') && root.cmd === 'rm') triggersDangerousRegex = true;
                if (payload.text.includes('/s /q') && root.cmd === 'del') triggersDangerousRegex = true;
              }
              if (root.cmd === 'shutdown') triggersDangerousRegex = true;
              if (root.cmd === 'systemctl' && /(?:poweroff|reboot|halt|shutdown)/i.test(payload.text)) triggersDangerousRegex = true;
              if (payload.text.includes('> /dev/sda1')) triggersDangerousRegex = true;
              if (payload.text.includes('| sh') && (root.cmd === 'curl' || root.cmd === 'wget')) triggersDangerousRegex = true;

              if (triggersDangerousRegex) {
                expectedSafe = false;
                expect(decision.safe).toBe(false);
                expect(decision.reason).toBe('dangerous-pattern');
                return; // Early return as this branch is tested
              }

              // 2. Check shell metacharacters
              if (payload.hasMetachar) {
                expectedSafe = false;
                expect(decision.safe).toBe(false);
                expect(decision.reason).toBe('shell-composition-requires-sandbox');
                return;
              }

              // If the path has a space (e.g. Program Files) and is not quoted,
              // it will be split and fail to match allowlist or shell wrappers.
              const hasUnquotedSpace = prefix.includes(' ') && formatIndex === 0;

              // 3. Check shell wrappers
              if (['bash', 'cmd', 'powershell', 'sh'].includes(root.cmd)) {
                expectedSafe = false;
                expect(decision.safe).toBe(false);
                if (hasUnquotedSpace) {
                  expect(decision.reason).toBe('command-not-allowlisted');
                } else {
                  expect(decision.reason).toBe('shell-wrapper-requires-sandbox');
                }
                return;
              }

              // 4. Check allowlist
              if (!root.isAllowed || hasUnquotedSpace) {
                expectedSafe = false;
                expect(decision.safe).toBe(false);
                expect(decision.reason).toBe('command-not-allowlisted');
                return;
              }

              // 5. Must be safe
              expect(decision.safe).toBe(true);
              expect(decision.reason).toBe('allowlisted-command');
            });
          });
        });
      });
    });
  });

  it('sanity checks total permutations for DangerousCommandBlockerMatrix', () => {
    // 14 roots * 5 prefixes * 3 formatters * 14 payloads = 2940 tests
    expect(testCount).toBe(2940);
  });
});
