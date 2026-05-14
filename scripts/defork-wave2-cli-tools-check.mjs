import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const componentsRoot = path.join(
  root,
  'src',
  'ai-gateway',
  'app',
  '(dashboard)',
  'dashboard',
  'cli-tools',
  'components'
);

const failures = [];

const files = {
  managedCard: path.join(componentsRoot, 'ManagedCliToolCard.tsx'),
  profiles: path.join(componentsRoot, 'managed-cli-tool-card', 'managedCliToolProfiles.ts'),
  frame: path.join(componentsRoot, 'CliToolCardFrame.tsx'),
  index: path.join(componentsRoot, 'index.tsx'),
  legacyHeader: path.join(componentsRoot, 'CodexToolCardHeader.tsx'),
};

if (!fs.existsSync(componentsRoot)) {
  failures.push('cli-tools components directory is missing');
} else {
  checkRequiredFiles();
  checkLegacyHeaderRemoved();
  checkManagedCardSize();
  checkSharedFrameExports();
  checkManagedProfiles();
  checkManagedWrappers();
  checkManagedCapabilities();
}

if (failures.length > 0) {
  console.error('[defork-wave2] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[defork-wave2] ok: CLI tool card frame, managed profiles, wrappers, and legacy header guard passed.');

function checkRequiredFiles() {
  for (const [label, filePath] of Object.entries(files)) {
    if (label === 'legacyHeader') continue;
    if (!fs.existsSync(filePath)) {
      failures.push(`${path.relative(root, filePath)}: missing`);
    }
  }
}

function checkLegacyHeaderRemoved() {
  if (fs.existsSync(files.legacyHeader)) {
    failures.push('CodexToolCardHeader.tsx should remain removed after Wave 2');
  }

  for (const filePath of walk(componentsRoot)) {
    if (!/\.(ts|tsx)$/.test(filePath)) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    if (source.includes('CodexToolCardHeader')) {
      failures.push(`${path.relative(root, filePath)} still references CodexToolCardHeader`);
    }
  }
}

function checkManagedCardSize() {
  if (!fs.existsSync(files.managedCard)) return;
  const lineCount = fs.readFileSync(files.managedCard, 'utf8').split(/\r?\n/).length;
  if (lineCount > 800) {
    failures.push(`ManagedCliToolCard.tsx has ${lineCount} lines; expected at most 800 for hardening`);
  }
}

function checkSharedFrameExports() {
  if (!fs.existsSync(files.frame) || !fs.existsSync(files.index)) return;
  const frameSource = fs.readFileSync(files.frame, 'utf8');
  const indexSource = fs.readFileSync(files.index, 'utf8');
  const requiredExports = [
    'CliToolCardSection',
    'CliToolLabeledField',
    'CliToolMetaPill',
    'CliToolNotice',
  ];

  for (const exportName of requiredExports) {
    if (!frameSource.includes(`export function ${exportName}`)) {
      failures.push(`CliToolCardFrame.tsx should export ${exportName}`);
    }
    if (!indexSource.includes(exportName)) {
      failures.push(`cli-tools/components/index.tsx should re-export ${exportName}`);
    }
  }
}

function checkManagedProfiles() {
  if (!fs.existsSync(files.profiles)) return;
  const source = fs.readFileSync(files.profiles, 'utf8');
  const requiredSnippets = [
    'MANAGED_CLI_TOOL_PROFILES',
    'toolId: "cline"',
    'toolId: "kilo"',
    'toolId: "external-executor"',
    'toolId: "droid"',
    'createManualConfigs',
    'ZavorthGateway',
    'isLocalOrCloudUrl',
    'toV1Url',
  ];

  for (const snippet of requiredSnippets) {
    if (!source.includes(snippet)) {
      failures.push(`managedCliToolProfiles.ts should preserve ${snippet}`);
    }
  }
}

function checkManagedWrappers() {
  const wrappers = [
    ['ClineToolCard.tsx', 'cline'],
    ['KiloToolCard.tsx', 'kilo'],
    ['ExternalExecutorToolCard.tsx', 'external-executor'],
    ['DroidToolCard.tsx', 'droid'],
  ];

  for (const [filename, profileKey] of wrappers) {
    const filePath = path.join(componentsRoot, filename);
    if (!fs.existsSync(filePath)) {
      failures.push(`${filename}: missing managed wrapper`);
      continue;
    }
    const source = fs.readFileSync(filePath, 'utf8');
    if (!source.includes('ManagedCliToolCard')) {
      failures.push(`${filename}: should render ManagedCliToolCard`);
    }
    const profileAccess = profileKey.includes('-')
      ? `MANAGED_CLI_TOOL_PROFILES["${profileKey}"]`
      : `MANAGED_CLI_TOOL_PROFILES.${profileKey}`;
    if (!source.includes(profileAccess)) {
      failures.push(`${filename}: should pass ${profileAccess}`);
    }
  }
}

function checkManagedCapabilities() {
  if (!fs.existsSync(files.managedCard)) return;
  const source = fs.readFileSync(files.managedCard, 'utf8');
  const requiredSnippets = [
    'ManualConfigModal',
    'ModelSelectModal',
    'handleApply',
    'handleReset',
    'handleRestoreBackup',
    'fetchBackups',
    'profile.createManualConfigs',
    'CliToolCardFrame',
  ];

  for (const snippet of requiredSnippets) {
    if (!source.includes(snippet)) {
      failures.push(`ManagedCliToolCard.tsx should preserve ${snippet}`);
    }
  }
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}
