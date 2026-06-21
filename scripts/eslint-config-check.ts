import fs from 'node:fs';
import path from 'node:path';

type EslintReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed';
    configFound: boolean;
    configFormat: string;
    rulesCount: number;
    extendsCount: number;
    pluginsCount: number;
  };
  configPath: string;
  extends: string[];
  plugins: string[];
  rules: string[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const workspaceRoot = process.cwd();

const configCandidates = [
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  'eslint.config.mjs',
  'eslint.config.js',
  'eslint.config.cjs',
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
    configFormat = path.extname(candidate);

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (configFormat === '.json') {
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

const extendsList: string[] = Array.isArray(config.extends) ? config.extends : config.extends ? [config.extends] : [];
const pluginsList: string[] = Array.isArray(config.plugins) ? config.plugins : config.plugins ? [config.plugins] : [];
const rulesList: string[] = config.rules ? Object.keys(config.rules) : [];

const isFlatConfig = configPath.includes('eslint.config');
const isValid = configFound && (
  isFlatConfig
    ? true
    : (extendsList.length > 0 || rulesList.length > 0)
);

const report: EslintReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: isValid ? 'passed' : 'failed',
    configFound,
    configFormat,
    rulesCount: rulesList.length,
    extendsCount: extendsList.length,
    pluginsCount: pluginsList.length,
  },
  configPath,
  extends: extendsList,
  plugins: pluginsList,
  rules: rulesList,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[eslint-config] checking ESLint configuration');
  console.log(`[eslint-config] config found: ${configFound ? 'yes' : 'no'}`);
  if (configFound) {
    console.log(`[eslint-config] config path: ${configPath}`);
    console.log(`[eslint-config] config format: ${configFormat}`);
    console.log(`[eslint-config] extends: ${extendsList.length} (${extendsList.join(', ') || 'none'})`);
    console.log(`[eslint-config] plugins: ${pluginsList.length} (${pluginsList.join(', ') || 'none'})`);
    console.log(`[eslint-config] rules: ${rulesList.length}`);
    if (rulesList.length > 0) {
      const importantRules = ['no-unused-vars', 'no-console', '@typescript-eslint/no-explicit-any', 'prefer-const', 'no-var'];
      for (const rule of importantRules) {
        const value = config.rules?.[rule];
        if (value !== undefined) {
          console.log(`  - ${rule}: ${JSON.stringify(value)}`);
        }
      }
    }
  }
  if (!configFound) {
    console.log('[eslint-config] ERROR: No ESLint config found');
  } else if (!isValid) {
    console.log('[eslint-config] ERROR: Config appears invalid (no extends or rules)');
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
