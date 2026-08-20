import { TokenEfficientOutputFilterService } from '../../../src/services/terminal/TokenEfficientOutputFilterService.js';

describe('TokenEfficientOutputFilterService', () => {
  let filterService: TokenEfficientOutputFilterService;

  beforeEach(() => {
    filterService = new TokenEfficientOutputFilterService();
  });

  it('strips ANSI color and cursor codes cleanly', () => {
    const ansiText = '\u001b[32mPASS\u001b[39m \u001b[2msrc/index.test.ts\u001b[22m';
    const clean = TokenEfficientOutputFilterService.stripAnsi(ansiText);

    expect(clean).toBe('PASS src/index.test.ts');
  });

  it('removes build progress indicators and npm spinners', () => {
    const raw = `
[ 1 / 100 ] Building modules...
[ 50 / 100 ] Building modules...
⸨░░░░░░░░░░░░░░░░░░⸩ 12%
npm sill fetchPackage metadata
Compilation finished successfully.
`;

    const result = filterService.filter(raw);
    expect(result.text).not.toContain('[ 1 / 100 ]');
    expect(result.text).not.toContain('npm sill');
    expect(result.text).toContain('Compilation finished successfully.');
  });

  it('condenses passing test noise while preserving failures and summaries', () => {
    const rawTestOutput = `
PASS tests/auth.test.ts
PASS tests/utils.test.ts
PASS tests/db.test.ts
FAIL tests/payment.test.ts
  ● Payment Gateway › should charge card
    Error: Insufficient funds
      at charge (src/payment.ts:42:11)
Test Suites: 1 failed, 3 passed, 4 total
Tests:       1 failed, 12 passed, 13 total
`;

    const result = filterService.filter(rawTestOutput, { condenseTests: true });
    expect(result.text).toContain('FAIL tests/payment.test.ts');
    expect(result.text).toContain('Error: Insufficient funds');
    expect(result.text).toContain('Test Suites: 1 failed, 3 passed, 4 total');
    expect(result.text).toContain('[... passing test suites omitted ...]');
  });
});
