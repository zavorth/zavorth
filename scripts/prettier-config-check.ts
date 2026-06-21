import fs from 'node:fs';
import path from 'node:path';

type PrettierReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed';
    configFound: boolean;
    configFormat: string;
    optionsCount: number;
    overridesCount: number;
  };
  configPath: string;
  options: Record<string, unknown>;
  overrides: unknown[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const workspaceRoot = process.cwd();

const configCandidates = [
  '.prettierrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
];

let configPath = '';
let configFound = false;
let configFormat = '';
let config: any = {};

for (const candidate of configCandidates) {
  const fullPath = path.join(workspaceRoot, candidate);
  if (fs.existsSync(fullPath)) {
    configPath = candidate;
    configFound = true;
    configFormat = path.extname(candidate) || '.json';

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (configFormat === '.json' || candidate === '.prettierrc') {
        config = JSON.parse(content);
      } else if (configFormat === '.js' || configFormat === '.cjs' || configFormat === '.mjs') {
        configFormat += ' (cannot parse JS module statically)';
        config = {};
      } else if (configFormat === '.yaml' || configFormat === '.yml') {
        configFormat += ' (YAML detected)';
        config = {};
      }
    } catch {
      config = {};
    }
    break;
  }
}

const { overrides: configOverrides, ...options } = config;
const overridesList: unknown[] = Array.isArray(configOverrides) ? configOverrides : [];
const optionsKeys = Object.keys(options);

const report: PrettierReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: configFound ? 'passed' : 'failed',
    configFound,
    configFormat,
    optionsCount: optionsKeys.length,
    overridesCount: overridesList.length,
  },
  configPath,
  options,
  overrides: overridesList,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[prettier-config] checking Prettier configuration');
  console.log(`[prettier-config] config found: ${configFound ? 'yes' : 'no'}`);
  if (configFound) {
    console.log(`[prettier-config] config path: ${configPath}`);
    console.log(`[prettier-config] config format: ${configFormat}`);
    console.log(`[prettier-config] options: ${optionsKeys.length}`);
    console.log(`[prettier-config] overrides: ${overridesList.length}`);

    const expectedOptions = ['semi', 'singleQuote', 'tabWidth', 'trailingComma', 'printWidth', 'bracketSpacing', 'arrowParens'];
    for (const opt of expectedOptions) {
      const value = options[opt];
      if (value !== undefined) {
        console.log(`  - ${opt}: ${JSON.stringify(value)}`);
      }
    }
  }
  if (!configFound) {
    console.log('[prettier-config] ERROR: No Prettier config found');
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
