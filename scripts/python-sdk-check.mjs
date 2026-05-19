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
  path.resolve(projectRoot, 'docs', 'platform', 'publicar-plugin.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'usar-recipe.md'),
  path.resolve(projectRoot, 'docs', 'platform', 'criar-extensao.md'),
  path.resolve(projectRoot, 'docs', 'protocol', 'sdk-usage.md'),
  path.resolve(projectRoot, 'docs', 'protocol', 'websocket-v1.md'),
  path.resolve(projectRoot, 'docs', 'protocol', 'rest-v1.md'),
];
const pyrightConfigPath = path.resolve(projectRoot, 'sdk', 'python', 'pyrightconfig.json');
const pyrightCliPath = path.resolve(projectRoot, 'node_modules', 'pyright', 'index.js');

function filterBenignWindowsPythonNoise(text) {
  return String(text || '')
    .split(/\r?\n/u)
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
    throw new Error('Pyright nao encontrado em node_modules. Rode npm install antes do check.');
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
    throw new Error(`pyright retornou exit ${String(result.status)}.`);
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
      console.log(`[sdk:python] py_compile validado via ${candidate.command}.`);
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
    throw new Error(`py_compile falhou via ${candidate.command}.`);
  }
  console.log('[sdk:python] py_compile opcional ignorado: nenhum interpretador Python disponivel.');
}

function staticValidate() {
  for (const filePath of pythonFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo ausente: ${filePath}`);
    }
    const content = String(fs.readFileSync(filePath, 'utf8') || '');
    if (!content.trim()) {
      throw new Error(`Arquivo vazio: ${filePath}`);
    }
  }

  const clientContent = String(fs.readFileSync(pythonFiles[0], 'utf8') || '');
  if (!clientContent.includes('class ZavorthClient')) {
    throw new Error('sdk/python/zavorth/client.py nao exporta ZavorthClient.');
  }
  if (!clientContent.includes('class ZavorthApiError')) {
    throw new Error('sdk/python/zavorth/client.py nao exporta ZavorthApiError.');
  }
  const initContent = String(fs.readFileSync(pythonFiles[1], 'utf8') || '');
  if (!initContent.includes('ZavorthApiError')) {
    throw new Error('sdk/python/zavorth/__init__.py nao reexporta ZavorthApiError.');
  }
  const exampleContent = String(fs.readFileSync(pythonFiles[4], 'utf8') || '');
  if (!exampleContent.includes('ZavorthClient')) {
    throw new Error('examples/clients/simple-bot.py nao usa ZavorthClient.');
  }
  if (!exampleContent.includes('public contracts')) {
    throw new Error('examples/clients/simple-bot.py nao consulta o catalogo publico de contratos.');
  }
  const readmeContent = String(fs.readFileSync(pythonFiles[2], 'utf8') || '');
  if (!readmeContent.includes('PUBLIC_ECOSYSTEM_CONTRACTS')) {
    throw new Error('sdk/python/README.md nao referencia o manifesto publico de contratos.');
  }
  if (!readmeContent.includes('nao e um SDK de runtime')) {
    throw new Error('sdk/python/README.md nao delimita o SDK Python como cliente REST v1.');
  }
  const publicContractsDoc = String(fs.readFileSync(pythonFiles[5], 'utf8') || '');
  if (!publicContractsDoc.includes('PUBLIC_ECOSYSTEM_CONTRACTS')) {
    throw new Error('docs/README.md nao documenta PUBLIC_ECOSYSTEM_CONTRACTS.');
  }
}

function main() {
  runPyrightCheck();
  staticValidate();
  maybeRunPyCompile();
  console.log('[sdk:python] pyright, estrutura e docs do SDK Python validados.');
}

try {
  main();
} catch (error) {
  console.error('[sdk:python] check falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
