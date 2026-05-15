import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const runnerPrefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];
const requiredFiles = [
  'src/contracts/ZavorthConversationalSetupContract.ts',
  'src/services/ZavorthConversationalSetupService.ts',
  'scripts/zavorth-conversational-setup.ts',
  'tests/services/ZavorthConversationalSetupService.test.ts',
];

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const json = execFileSync(
  runner,
  [
    ...runnerPrefix,
    'tsx',
    'scripts/zavorth-conversational-setup.ts',
    '--agent-name',
    'Zavorth',
    '--user-name',
    'Grey',
    '--call-me',
    'Grey',
    '--language',
    'Arabic',
    '--intent',
    'quero modo empresa com auditoria',
    '--approval-channel',
    'dashboard',
    '--first-mission',
    'safe audit',
    '--json',
  ],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(json);

if (snapshot.surface !== 'conversational-setup') {
  throw new Error(`unexpected surface: ${snapshot.surface}`);
}
if (snapshot.status !== 'ready') {
  throw new Error(`expected ready status, got ${snapshot.status}`);
}
if (snapshot.uiLanguage !== 'en-US') {
  throw new Error(`expected en-US UI language, got ${snapshot.uiLanguage}`);
}
if (snapshot.answers.preferredLanguage !== 'Arabic') {
  throw new Error(`expected free-text preferred language, got ${snapshot.answers.preferredLanguage}`);
}
if (snapshot.answers.experienceProfileId !== 'business') {
  throw new Error(`expected business profile, got ${snapshot.answers.experienceProfileId}`);
}
if (snapshot.writePlan.previewOnly !== true) {
  throw new Error('setup must be preview-only by default');
}
if (snapshot.safety.rawSecretsSerialized !== false) {
  throw new Error('setup must not serialize raw secrets');
}

let secretOutput = '';
try {
  execFileSync(
    runner,
    [
      ...runnerPrefix,
      'tsx',
      'scripts/zavorth-conversational-setup.ts',
      '--agent-name',
      'Zavorth',
      '--user-name',
      'Grey',
      '--intent',
      'token=super-secret-token-value',
      '--json',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (error) {
  secretOutput = String(error.stdout || '');
}
if (!secretOutput) {
  throw new Error('secret-like setup input should be blocked');
}
if (secretOutput.includes('super-secret-token-value')) {
  throw new Error('raw secret-like value leaked into setup output');
}
const secretSnapshot = JSON.parse(secretOutput);
if (secretSnapshot.status !== 'blocked' || secretSnapshot.safety.rawSecretDetected !== true) {
  throw new Error('secret-like setup input did not produce blocked safety state');
}

execFileSync(
  runner,
  [...runnerPrefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthConversationalSetupService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-conversational-setup-check] ok');
