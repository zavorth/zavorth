import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const projectRoot = process.cwd();
const pythonFiles = [
  path.resolve(projectRoot, 'sdk', 'python', 'zavorth', 'client.py'),
  path.resolve(projectRoot, 'sdk', 'python', 'zavorth', '__init__.py'),
  path.resolve(projectRoot, 'sdk', 'python', 'README.md'),
  path.resolve(projectRoot, 'sdk', 'python', 'pyproject.toml'),
  path.resolve(projectRoot, 'examples', 'clients', 'simple-bot.py'),
  path.resolve(projectRoot, 'docs', '112-public-ecosystem-contracts.md'),
  path.resolve(projectRoot, 'docs', '50-track-9-ecosystem-sdk.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'integrar-client.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'registrar-node.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'publish-plugin.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'usar-recipe.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'criar-extension.md'),
  path.resolve(projectRoot, 'docs', 'protocol', 'sdk-usage.md'),
  path.resolve(projectRoot, 'docs', 'protocol', 'websocket-v1.md'),
  path.resolve(projectRoot, 'docs', 'protocol', 'rest-v1.md'),
];
const pyrightConfigPath = path.resolve(projectRoot, 'sdk', 'python', 'pyrightconfig.json');
const pyrightCliPath = path.resolve(projectRoot, 'node_modules', 'pyright', 'index.js');

function filterBenignWindowsPythonNoise(text) {
  return String(text || '')
    .split(/\r...\n/u)
    .filter((line) => {
      const normalized = line.trim();
      if (!normalized) {
        return false;
      }
      return !(
        normalized.startsWith('Python was not found; run without arguments to install from the Microsoft Store')
        || normalized.includes('App execution aliases')
      );
    })
    .join('\n');
}

function runPyrightCheck() {
  if (!fs.existsSync(pyrightCliPath)) {
    throw new Error('Pyright not found em node_modules. Run npm install before do check.');
  }

  const result = spawnSync(process.execPath, [pyrightCliPath, '-p', pyrightConfigPath], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  const stdout = String(result.stdout || '').trim();
  const stderr = filterBenignWindowsPythonNoise(result.stderr || '');

  if (stdout) {
    process.stdout.write(`${stdout}\n`);
  }
  if (stderr) {
    process.stderr.write(`${stderr}\n`);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pyright returned exit ${String(result.status)}.`);
  }
}

function maybeRunPyCompile() {
  const candidates = process.platform === 'win32'
    ? [
        { command: 'py', args: ['-3', '-m', 'py_compile', path.relative(projectRoot, pythonFiles[0])] },
        { command: 'python', args: ['-m', 'py_compile', path.relative(projectRoot, pythonFiles[0])] },
      ]
    : [
        { command: 'python3', args: ['-m', 'py_compile', path.relative(projectRoot, pythonFiles[0])] },
        { command: 'python', args: ['-m', 'py_compile', path.relative(projectRoot, pythonFiles[0])] },
      ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (result.error && result.error.code === 'ENOENT') {
      continue;
    }
    const stdout = filterBenignWindowsPythonNoise(result.stdout || '');
    const stderr = filterBenignWindowsPythonNoise(result.stderr || '');
    if (result.status === 0) {
      console.log(`[sdk:python] py_compile validated via ${candidate.command}.`);
      return;
    }
    if (!stdout && !stderr) {
      continue;
    }
    if (stdout) {
      process.stdout.write(`${stdout}\n`);
    }
    if (stderr) {
      process.stderr.write(`${stderr}\n`);
    }
    throw new Error(`py_compile failed via ${candidate.command}.`);
  }
  console.log('[sdk:python] optional py_compile skipped: no Python interpreter available.');
}

function staticValidate() {
  for (const filePath of pythonFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing file: ${filePath}`);
    }
    const content = String(fs.readFileSync(filePath, 'utf8') || '');
    if (!content.trim()) {
      throw new Error(`Empty file: ${filePath}`);
    }
  }

  const clientContent = String(fs.readFileSync(pythonFiles[0], 'utf8') || '');
  if (!clientContent.includes('class ZavorthClient')) {
    throw new Error('sdk/python/zavorth/client.py does not export ZavorthClient.');
  }
  if (!clientContent.includes('class ZavorthApiError')) {
    throw new Error('sdk/python/zavorth/client.py does not export ZavorthApiError.');
  }
  const initContent = String(fs.readFileSync(pythonFiles[1], 'utf8') || '');
  if (!initContent.includes('ZavorthApiError')) {
    throw new Error('sdk/python/zavorth/__init__.py does not re-export ZavorthApiError.');
  }
  const exampleContent = String(fs.readFileSync(pythonFiles[4], 'utf8') || '');
  if (!exampleContent.includes('ZavorthClient')) {
    throw new Error('examples/clients/simple-bot.py does not use ZavorthClient.');
  }
  if (!exampleContent.includes('public contracts')) {
    throw new Error('examples/clients/simple-bot.py does not query the public contract catalog.');
  }
  const readmeContent = String(fs.readFileSync(pythonFiles[2], 'utf8') || '');
  if (!readmeContent.includes('PUBLIC_ECOSYSTEM_CONTRACTS')) {
    throw new Error('sdk/python/README.md does not reference the public contract manifest.');
  }
  if (!readmeContent.includes('is not a runtime SDK')) {
    throw new Error('sdk/python/README.md does not delimit the Python SDK as a REST v1 client.');
  }
  const publicContractsDoc = String(fs.readFileSync(pythonFiles[5], 'utf8') || '');
  if (!publicContractsDoc.includes('PUBLIC_ECOSYSTEM_CONTRACTS')) {
    throw new Error('docs/README.md does not document PUBLIC_ECOSYSTEM_CONTRACTS.');
  }
}

function main() {
  runPyrightCheck();
  staticValidate();
  maybeRunPyCompile();
  console.log('[sdk:python] pyright, estrutura e docs do SDK Python validateds.');
}

try {
  main();
} catch (error) {
  console.error('[sdk:python] check failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
