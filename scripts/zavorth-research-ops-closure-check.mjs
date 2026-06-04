import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthTrajectoryExportContract.ts',
  'src/services/ZavorthTrajectoryExportService.ts',
  'tests/services/ZavorthTrajectoryExportService.test.ts',
  'src/contracts/ZavorthBatchWorkloadContract.ts',
  'src/services/ZavorthBatchWorkloadService.ts',
  'tests/services/ZavorthBatchWorkloadService.test.ts',
  'src/contracts/ZavorthCloudWorkspaceBackendsContract.ts',
  'src/services/ZavorthCloudWorkspaceBackendsService.ts',
  'tests/services/ZavorthCloudWorkspaceBackendsService.test.ts',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));
if (missing.length > 0) {
  console.error(`[zavorth-research-ops-closure] missing files: ${missing.join(', ')}`);
  process.exit(1);
}

const jestBin = path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');
const command = fs.existsSync(jestBin) ? process.execPath : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
const commandArgs = fs.existsSync(jestBin) ? [jestBin] : ['jest'];
const jest = spawnSync(command, [
  ...commandArgs,
  'tests/services/ZavorthTrajectoryExportService.test.ts',
  'tests/services/ZavorthBatchWorkloadService.test.ts',
  'tests/services/ZavorthCloudWorkspaceBackendsService.test.ts',
  '--runInBand',
], {
  stdio: 'inherit',
});

if (jest.status !== 0) {
  process.exit(jest.status || 1);
}

console.log('[zavorth-research-ops-closure] ok');
