import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runZavorthSetupStudioCommand } from '../src/cli/setup-studio/ZavorthSetupStudioCommand.js';
import { TaskPlaneService } from '../src/services/TaskPlaneService.js';
import { ZavorthHomePathService } from '../src/services/ZavorthHomePathService.js';

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-clean-install-'));
const homeRoot = path.join(projectRoot, 'isolated-home');

async function main(): Promise<void> {
  const setup = await runZavorthSetupStudioCommand({
    projectRoot,
    args: ['--apply', '--provider=local', '--home', homeRoot, '--json'],
    json: true,
  });
  if (setup.exitCode !== 0) {
    throw new Error(`setup failed with exit ${setup.exitCode}`);
  }
  const envFile = path.join(projectRoot, '.env');
  const envText = fs.readFileSync(envFile, 'utf8');
  if (!envText.includes('ZAVORTH_HOME=')) {
    throw new Error('setup did not persist ZAVORTH_HOME in the clean project .env');
  }

  const status = new ZavorthHomePathService({
    projectRoot,
    env: { ZAVORTH_HOME: homeRoot },
  }).resolveSnapshot();
  if (status.root !== path.resolve(homeRoot) || status.isolated !== true) {
    throw new Error('home status did not resolve the isolated ZAVORTH_HOME');
  }
  status.migration.entries.forEach((entry) => {
    if (!entry.destination.startsWith(path.resolve(homeRoot))) {
      throw new Error(`migration target escaped home: ${entry.destination}`);
    }
  });

  const taskPlane = new TaskPlaneService({
    storePath: path.join(status.resolvedPaths.runtimeDir, 'task-plane.json'),
  });
  taskPlane.createTask({ title: 'clean install task', source: 'clean-install-smoke' });
  const taskPlanePath = path.join(homeRoot, 'runtime', 'task-plane.json');
  if (!fs.existsSync(taskPlanePath)) {
    throw new Error('task plane state was not written inside ZAVORTH_HOME');
  }
  if (fs.existsSync(path.join(projectRoot, 'runtime', 'task-plane.json'))) {
    throw new Error('task plane state escaped into the project root');
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    projectRoot,
    homeRoot,
    envFile,
    taskPlanePath,
  }, null, 2) + '\n');
}

main()
  .finally(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });
