import { asErrorLike } from '../src/utils/errorLike';
﻿import { TerminalTheme } from '../src/cli/presentation/TerminalTheme.js';
import { TerminalSpinner } from '../src/cli/presentation/TerminalSpinner.js';
import { TerminalPanel } from '../src/cli/presentation/TerminalPanel.js';
import { TerminalMarkdown } from '../src/cli/presentation/TerminalMarkdown.js';
import { TerminalDiff } from '../src/cli/presentation/TerminalDiff.js';
import { TerminalPrompt } from '../src/cli/presentation/TerminalPrompt.js';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.clear();

  // 1. Title/Header
  const header = `
ZZZZZZZ  AAAAA  V     V  OOOOO  RRRRRR  TTTTTTT H   H
    ZZ  A     A V     V O     O R     R    T    H   H
   ZZ   AAAAAAA V     V O     O RRRRRR     T    HHHHH
  ZZ    A     A  V   V  O     O R   R      T    H   H
ZZZZZZZ A     A   VVV    OOOOO  R    R     T    H   H
`;
  console.log(TerminalTheme.colors.primary(header));
  console.log(TerminalTheme.colors.primary.bold('   PREMIUM CLI PRESENTATION LAYER - DEMONSTRATION'));
  console.log(TerminalTheme.colors.dim('-'.repeat(70)));
  console.log();

  // 2. Spinner Demo
  console.log(TerminalTheme.colors.primaryLight.bold('1. Spinners (Async Task Indicators)'));
  const spinner = new TerminalSpinner();

  spinner.start('Starting repository security analysis...');
  await sleep(1500);

  spinner.update('Checking for exposed API keys in code...');
  await sleep(1500);

  spinner.succeed('No exposed API keys found in the repository.');
  console.log();

  // 3. Semantic Panels/Boxes Demo
  console.log(TerminalTheme.colors.primaryLight.bold('2. Semantic Panels (Semantic wrappers with clean hierarchy)'));

  TerminalPanel.info(
    'Zavorth runs in Governed-Dev mode. Destructive actions or code changes require explicit approval and leave signed receipts in history.',
    'Zavorth Security Policy'
  );
  await sleep(800);

  TerminalPanel.success(
    'gVisor sandbox enabled and healthy.\nCPU: 2 cores\nMemory: 512 MB RAM\nVolume mount: /workspace (read-write-governed)',
    'Sandbox Status'
  );
  await sleep(800);

  TerminalPanel.warning(
    'External network access is blocked for unauthorized subprocesses.\nTo allow a temporary external route, use `/trust-mesh`.',
    'Sandbox Firewalls'
  );
  await sleep(800);

  TerminalPanel.error(
    'Failed to connect to the Telegram provider.\nCheck TELEGRAM_BOT_TOKEN in .env or run `zavorth doctor`.',
    'Connection Error'
  );
  console.log();
  await sleep(800);

  // 4. Markdown Rendering Demo
  console.log(TerminalTheme.colors.primaryLight.bold('3. Rendered Markdown (With highlight, blocks, lists)'));
  const markdownText = `
# Security Audit Report

### Vulnerabilities Found
* **High Severity**: Prompt injection detected in the \`query-engine\` library
* **Medium Severity**: Excessive write permissions in \`package.json\`

### Recommended Actions
1. Update \`zavorth-core\` to version \`v1.1.2\`
2. Run:
   \`\`\`bash
   npm run security:harden
   \`\`\`

> **Security Note**: For more information, visit [Zavorth Trust docs](https://zavorth.security/docs)
`;
  TerminalMarkdown.print(markdownText);
  console.log();
  await sleep(800);

  // 5. Visual Diffs Demo
  console.log(TerminalTheme.colors.primaryLight.bold('4. Visual Diffs (Clear green/red diffs for change previews)'));
  const oldCode = `const jwt = require('jsonwebtoken');

function validateToken(token) {
  // TODO: Implement verification
  return true;
}`;
  const newCode = `const jwt = require('jsonwebtoken');
const config = require('./config');

function validateToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256']
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);

    console.error('Invalid token:', err.message);
    return null;
  }
}`;

  TerminalDiff.print(oldCode, newCode, { fileName: 'src/auth/jwt.js', contextLines: 3 });
  console.log();
  await sleep(800);

  // 6. Interactive Prompts Demo
  console.log(TerminalTheme.colors.primaryLight.bold('5. Interactive Prompts (Confirm, Input, Select)'));

  if (process.stdout.isTTY) {
    const confirm = await TerminalPrompt.confirm('Apply the suggested fixes to src/auth/jwt.js?', true);
    console.log(TerminalTheme.colors.dim(`Selected answer: ${confirm ? 'Yes' : 'No'}`));

    if (confirm) {
      const selected = await TerminalPrompt.select('Select the deployment environment:', ['development', 'staging', 'production']);
      console.log(TerminalTheme.colors.dim(`Selected environment: ${selected}`));
    }
  } else {
    console.log(TerminalTheme.colors.dim('[Non-interactive environment: skipping real interactive prompts]'));
    console.log(TerminalTheme.colors.primary('> Apply the suggested fixes to src/auth/jwt.js? (y/N)'));
    console.log(TerminalTheme.colors.primary('> Select the deployment environment: (Use arrow keys)'));
    console.log(TerminalTheme.colors.dim('  > development\n    staging\n    production'));
  }

  console.log();
  console.log(TerminalTheme.colors.success.bold('OK Demonstration completed successfully.'));
}

main().catch(console.error);
