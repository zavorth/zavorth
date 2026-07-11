import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const includeUntracked = argv.includes('--include-untracked');
const workspaceRoot = process.cwd();

const MAX_FILE_BYTES = 1024 * 1024;
const ALLOWED_ENV_FILES = new Set([
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.local.example',
  '.env.production.example',
  '.env.development.example',
]);

// Intentional security-test fixtures contain fake token-shaped strings (xoxb, AIza, jwt, …).
// Exclude fixture trees so real secret detection stays enabled everywhere else.
const SKIP_SCAN_PREFIXES = [
  'tests/security/',
  // Code CLI unit tests use synthetic sk-/jwt/pem fixtures (not live secrets).
  'packages/code/cli/test/',
];

const SECRET_NAME_RE = /(?:^|[_\-.])(api[_\-.]?key|secret|token|password|passwd|pwd|private[_\-.]?key|client[_\-.]?secret|approval[_\-.]?pin)(?:$|[_\-.])/i;
const ENV_ASSIGNMENT_RE = /^\s*(?:export\s+)?(?:process\.env\.)?([A-Z][A-Z0-9_]{2,})\s*=\s*(['"]?)([^'"\s#][^'"\r\n#]*?)\2\s*(?:;|,)?\s*(?:#.*)?$/;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/;

const TOKEN_PATTERNS = [
  { id: 'openai', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { id: 'anthropic', pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { id: 'google-api', pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { id: 'telegram-bot', pattern: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/ },
  { id: 'discord-bot', pattern: /\bM[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/ },
  { id: 'github-token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b/ },
  { id: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { id: 'cloudflare-token', pattern: /\bcf[a-z]?_[A-Za-z0-9_-]{30,}\b/ },
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

const findings = [
  ...findForbiddenEnvFiles(),
  ...scanFiles(readCandidateFiles()),
];

const snapshot = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  includeUntracked,
  status: findings.length === 0 ? 'passed' : 'failed',
  findingCount: findings.length,
  findings,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[secret-guard] checking credentials in versioned files');
  if (findings.length === 0) {
    console.log('[secret-guard] ok no versioned secrets detected');
  } else {
    console.log(`[secret-guard] fail ${findings.length} possible secret finding(s)`);
    for (const finding of findings.slice(0, 20)) {
      console.log(`  - ${finding.file}:${finding.line} [${finding.rule}] ${finding.detail}`);
    }
  }
}

if (findings.length > 0) {
  process.exitCode = 1;
}

function readCandidateFiles() {
  const tracked = readGitPaths(['ls-files', '-z']);
  const untracked = includeUntracked
    ? readGitPaths(['ls-files', '--others', '--exclude-standard', '-z'])
    : [];
  return Array.from(new Set([...tracked, ...untracked]))
    .filter((relativePath) => relativePath && shouldScanPath(relativePath));
}

function readGitPaths(args) {
  const attempts = [
    ['git', args],
    ['git', ['--git-dir=.git', '--work-tree=.', ...args]],
  ];
  for (const [command, commandArgs] of attempts) {
    const result = readGitPathsWith(command, commandArgs);
    if (result) {
      return result;
    }
  }
  return [];
}

function readGitPathsWith(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 20 * 1024 * 1024,
    }).split('\0').filter(Boolean).map(normalizePath);
  } catch {
    return null;
  }
}

function findForbiddenEnvFiles() {
  return readGitPaths(['ls-files', '-z', '.env', '.env.*'])
    .filter((relativePath) => !ALLOWED_ENV_FILES.has(path.basename(relativePath)))
    .map((relativePath) => ({
      file: relativePath,
      line: 1,
      rule: 'tracked-env-file',
      detail: 'arquivo .env real nao pode ser versionado; use .env.example sem valores reais',
    }));
}

function scanFiles(files) {
  const results = [];
  for (const relativePath of files) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    let stat;
    try {
      stat = fs.statSync(absolutePath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
      continue;
    }
    const content = readTextFile(absolutePath);
    if (content === null) {
      continue;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const envFinding = scanEnvAssignment(relativePath, line, lineNumber);
      if (envFinding) {
        results.push(envFinding);
      }
      if (PRIVATE_KEY_RE.test(line)) {
        results.push({
          file: relativePath,
          line: lineNumber,
          rule: 'private-key',
          detail: 'bloco de chave privada detectado',
        });
      }
      for (const tokenPattern of TOKEN_PATTERNS) {
        const match = line.match(tokenPattern.pattern);
        if (match && !isAllowedExampleValue(match[0])) {
          results.push({
            file: relativePath,
            line: lineNumber,
            rule: tokenPattern.id,
            detail: maskSecret(match[0]),
          });
        }
      }
    });
  }
  return dedupeFindings(results);
}

function scanEnvAssignment(file, line, lineNumber) {
  const match = line.match(ENV_ASSIGNMENT_RE);
  if (!match) {
    return null;
  }
  const name = match[1];
  const quote = match[2];
  const value = match[3];
  const basename = path.basename(file);
  if (!basename.startsWith('.env') && !quote) {
    return null;
  }
  if (file.startsWith('tests/') && value.length < 32) {
    return null;
  }
  if (!SECRET_NAME_RE.test(name) || isAllowedExampleValue(value)) {
    return null;
  }
  return {
    file,
    line: lineNumber,
    rule: 'secret-env-assignment',
    detail: `${name}=${maskSecret(value)}`,
  };
}

function shouldScanPath(relativePath) {
  const normalized = normalizePath(relativePath);
  if (
    normalized.startsWith('node_modules/')
    || normalized.startsWith('.git/')
    || normalized.startsWith('dist/')
    || normalized.startsWith('dist-ops/')
    || normalized.startsWith('coverage/')
    || normalized.startsWith('.tmp/')
    || SKIP_SCAN_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    || normalized.endsWith('package-lock.json')
    || normalized.endsWith('pnpm-lock.yaml')
    || normalized.endsWith('yarn.lock')
  ) {
    return false;
  }
  const basename = path.basename(normalized);
  if (ALLOWED_ENV_FILES.has(basename)) {
    return true;
  }
  return /\.(?:[cm]?[jt]sx?|json|ya?ml|md|txt|env|example|sample|template|ps1|sh|mjs|cjs)$/i.test(normalized)
    || basename.startsWith('.env');
}

function readTextFile(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  if (buffer.includes(0)) {
    return null;
  }
  return buffer.toString('utf8');
}

function isAllowedExampleValue(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return true;
  }
  const normalized = value.toLowerCase();
  if (
    normalized.includes('example')
    || normalized.includes('placeholder')
    || normalized.includes('changeme')
    || normalized.includes('replace_me')
    || normalized.includes('redacted')
    || normalized.includes('presente')
    || normalized.includes('defina')
    || normalized.includes('cole')
    || normalized.includes('aqui')
    || normalized.includes('seu_')
    || normalized.includes('sua_')
    || normalized.includes('seu-')
    || normalized.includes('sua-')
    || normalized.includes('original')
    || normalized.includes('test')
    || normalized.includes('mock')
    || normalized.includes('fixture')
    || normalized.includes('sample')
    || normalized.includes('smoke')
    || normalized.includes('local')
    || normalized.includes('generated')
    || normalized.includes('health')
    || normalized.includes('do-not-leak')
    || normalized.includes('env')
    || normalized.includes('your_')
    || normalized.includes('your-')
    || normalized.includes('<')
    || normalized.includes('>')
    || normalized === 'test'
    || normalized === 'dummy'
    || normalized === 'fake'
  ) {
    return true;
  }
  if (/^(x+|0+|\*+|_+|-+)$/.test(normalized)) {
    return true;
  }
  return false;
}

function maskSecret(value) {
  const text = String(value);
  if (text.length <= 12) {
    return '<redacted>';
  }
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function dedupeFindings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.file}:${item.line}:${item.rule}:${item.detail}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizePath(value) {
  return String(value).replace(/\\/g, '/');
}
