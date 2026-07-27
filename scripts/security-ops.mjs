#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

let BetterSqlite3 = null;
try {
  BetterSqlite3 = require('better-sqlite3');
} catch {
  BetterSqlite3 = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const rotationDir = path.join(runtimeDir, 'rotations');
const envPath = path.join(projectRoot, '.env');
const dbPath = path.join(projectRoot, 'data', 'zavorth.db');
const remotePublishConfigPath = path.join(projectRoot, 'config', 'remote-publish.json');

dotenv.config({ path: envPath });

const webTokenFile =
  process.env.ZAVORTH_WEB_AUTH_TOKEN_FILE || path.join(runtimeDir, 'web-api-token.txt');
const mailboxSecretFile =
  process.env.ZAVORTH_MAILBOX_SECRET_FILE || path.join(runtimeDir, 'mailbox-secret.key');
const dbKeyFile =
  process.env.ZAVORTH_DB_ENCRYPTION_KEY_FILE || path.join(runtimeDir, 'db-field.key');
const hostIdentityFile =
  process.env.ZAVORTH_HOST_IDENTITY_FILE || path.join(runtimeDir, 'authorized-host.json');
const auditReportFile =
  process.env.ZAVORTH_SECURITY_AUDIT_STATUS_FILE ||
  path.join(runtimeDir, 'security-audit-last.json');
const preflightReportFile =
  process.env.ZAVORTH_SECURITY_PREFLIGHT_STATUS_FILE ||
  path.join(runtimeDir, 'security-preflight-last.json');
const gapReportFile =
  process.env.ZAVORTH_SECURITY_GAP_REPORT_FILE ||
  path.join(runtimeDir, 'security-gap-report.json');
const gapReportMarkdownFile =
  process.env.ZAVORTH_SECURITY_GAP_REPORT_MARKDOWN_FILE ||
  path.join(runtimeDir, 'security-gap-report.md');
const doctorReportFile =
  process.env.ZAVORTH_SECURITY_DOCTOR_STATUS_FILE ||
  path.join(runtimeDir, 'security-doctor-last.json');
const mailboxInboxDir =
  process.env.ZAVORTH_MAILBOX_INBOX_DIR ||
  path.join(projectRoot, 'data', 'agent-bridge', 'mailbox', 'inbox');

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.md',
  '.mjs',
  '.txt',
  '.xml',
  '.yml',
  '.yaml',
  '.svg',
]);

const severityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const priorityBySeverity = {
  critical: 'P0',
  high: 'P0',
  medium: 'P1',
  low: 'P2',
  info: 'P2',
};

const forbiddenDeployPathPatterns = [
  /^\.env(?:\.|$)/i,
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(authorized-host\.json|mailbox-secret\.key|db-field\.key|web-api-token\.txt)$/i,
  /(^|\/)data\/runtime\//i,
  /(^|\/)data\/agent-bridge\//i,
  /\.(pem|pfx|p12|key)$/i,
];

const trackedSensitivePatterns = [
  /^\.env$/i,
  /^\.env\.(...!example$)/i,
  /^data\/runtime\//i,
  /^data\/agent-bridge\//i,
  /^data\/config-gitops\//i,
  /(^|\/)(authorized-host\.json|mailbox-secret\.key|db-field\.key|web-api-token\.txt)$/i,
  /\.(pem|pfx|p12|key)$/i,
];

const sensitiveRouteTargets = [
  {
    id: 'db_backups_root',
    path: 'src/zavorth-control/app/api/db-backups/route.ts',
    surface: 'db-backups',
  },
  {
    id: 'db_backups_export',
    path: 'src/zavorth-control/app/api/db-backups/export/route.ts',
    surface: 'db-backups-export',
  },
  {
    id: 'db_backups_export_all',
    path: 'src/zavorth-control/app/api/db-backups/exportAll/route.ts',
    surface: 'db-backups-export-all',
  },
  {
    id: 'logs_export',
    path: 'src/zavorth-control/app/api/logs/export/route.ts',
    surface: 'logs-export',
  },
  {
    id: 'mcp_sse',
    path: 'src/zavorth-control/app/api/mcp/sse/route.ts',
    surface: 'mcp-sse',
  },
  {
    id: 'keys_reveal',
    path: 'src/zavorth-control/app/api/keys/[id]/reveal/route.ts',
    surface: 'keys-reveal',
  },
];

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '""';
  }

  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }

  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

function spawn(command, args, cwd, capture = false) {
  const options = {
    cwd,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
    encoding: capture ? 'utf8' : undefined,
  };

  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')],
          options,
        )
      : spawnSync(command, args, options);

  if (result.status !== 0) {
    if (capture) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
      if (output) {
        process.stdout.write(`${output}\n`);
      }
    }

    if (result.error) {
      throw result.error;
    }

    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }

  return result;
}

function capture(command, args, cwd = projectRoot) {
  const result = spawn(command, args, cwd, true);
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, 'utf8');
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  return raw || null;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseEnvFile() {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(envPath, 'utf8'));
}

function isPlaceholderValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes('sua_chave') ||
    normalized.includes('seu_token') ||
    normalized.includes('seu_id') ||
    normalized.includes('aqui') ||
    normalized.includes('changeme') ||
    normalized.includes('placeholder') ||
    normalized.includes('example')
  );
}

function getTrackedFiles() {
  const output = capture('git', ['ls-files'], projectRoot);
  return output
    .split(/\r...\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readRemoteTargets() {
  const config = readJson(remotePublishConfigPath);
  const projects = config?.vercel?.projects || {};
  return Object.values(projects)
    .map((project) => ({
      name: String(project.projectName || 'unknown'),
      path: path.resolve(projectRoot, String(project.relativePath || '')),
    }))
    .filter((project) => project.path && project.path !== projectRoot);
}

function walkFiles(targetPath, bucket = [], rootPath = targetPath) {
  if (!fs.existsSync(targetPath)) {
    return bucket;
  }

  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    bucket.push({
      absolutePath: targetPath,
      relativePath: path.relative(rootPath, targetPath).replace(/\\/g, '/'),
      size: stats.size,
    });
    return bucket;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const next = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(next, bucket, rootPath);
      continue;
    }

    const childStats = fs.statSync(next);
    bucket.push({
      absolutePath: next,
      relativePath: path.relative(rootPath, next).replace(/\\/g, '/'),
      size: childStats.size,
    });
  }

  return bucket;
}

function collectSecretValues() {
  const envEntries = parseEnvFile();
  const collected = [];

  for (const [name, value] of Object.entries(envEntries)) {
    if (!/(TOKEN|KEY|SECRET|PASSWORD|PIN|AUTH)/i.test(name)) {
      continue;
    }

    const normalized = String(value || '').trim();
    if (normalized.length < 8 || isPlaceholderValue(normalized)) {
      continue;
    }

    collected.push({
      source: `env:${name}`,
      value: normalized,
    });
  }

  for (const [label, filePath] of [
    ['runtime:web-token', webTokenFile],
    ['runtime:mailbox-secret', mailboxSecretFile],
    ['runtime:db-key', dbKeyFile],
  ]) {
    const content = readText(filePath);
    if (content && content.length >= 8) {
      collected.push({
        source: label,
        value: content,
      });
    }
  }

  const deduped = new Map();
  for (const entry of collected) {
    if (!deduped.has(entry.value)) {
      deduped.set(entry.value, entry);
    }
  }

  return Array.from(deduped.values());
}

function isTrackedSensitiveFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (normalized === '.env.example') {
    return false;
  }

  return trackedSensitivePatterns.some((pattern) => pattern.test(normalized));
}

function normalizeRelativePath(target) {
  return String(target || '').replace(/\\/g, '/');
}

function resolveRepoPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return path.join(projectRoot, normalized);
}

function readRepoFile(relativePath) {
  const absolutePath = resolveRepoPath(relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, 'utf8');
}

function getLineMatches(relativePath, matchers) {
  const content = readRepoFile(relativePath);
  if (!content) {
    return [];
  }

  const normalizedMatchers = Array.isArray(matchers) ? matchers : [matchers];
  const lines = content.split(/\r...\n/);
  const matches = [];

  lines.forEach((line, index) => {
    const matched = normalizedMatchers.some((matcher) => {
      if (typeof matcher === 'string') {
        return line.includes(matcher);
      }

      matcher.lastIndex = 0;
      return matcher.test(line);
    });

    if (matched) {
      matches.push({
        file: normalizeRelativePath(relativePath),
        line: index + 1,
        snippet: line.trim(),
      });
    }
  });

  return matches;
}

function getFirstLineMatch(relativePath, matchers) {
  return getLineMatches(relativePath, matchers)[0] || null;
}

function severityToPriority(severity) {
  return priorityBySeverity[severity] || 'P2';
}

function createFinding(input) {
  return {
    id: input.id,
    area: input.area,
    severity: input.severity,
    priority: severityToPriority(input.severity),
    title: input.title,
    detail: input.detail,
    remediation: input.remediation || null,
    autoFixable: input.autoFixable === true,
    fixCommand: input.fixCommand || null,
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
  };
}

function sortFindings(findings) {
  return [...findings].sort((left, right) => {
    const severityDelta = (severityRank[left.severity] ?? 99) - (severityRank[right.severity] ?? 99);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function bucketFindings(findings) {
  const buckets = {
    P0: [],
    P1: [],
    P2: [],
  };

  for (const finding of sortFindings(findings)) {
    const priority = finding.priority || 'P2';
    buckets[priority] = buckets[priority] || [];
    buckets[priority].push(finding);
  }

  return buckets;
}

function buildSecuritySummaryFromFindings(findings) {
  const buckets = bucketFindings(findings);
  const total = findings.length;
  if (!total) {
    return 'No problema relevante detectado.';
  }

  return `${buckets.P0.length} P0, ${buckets.P1.length} P1 and ${buckets.P2.length} P2 em ${total} finding(s).`;
}

function buildLegacyMessages(findings) {
  const failures = [];
  const warnings = [];

  for (const finding of findings) {
    const message = `${finding.title} (${finding.id})`;
    if (finding.priority === 'P0') {
      failures.push(message);
    } else {
      warnings.push(message);
    }
  }

  return { failures, warnings };
}

function detectRouteGuard(relativePath) {
  const content = readRepoFile(relativePath);
  if (!content) {
    return {
      status: 'missing-file',
      evidence: [],
    };
  }

  if (content.includes('requireStrictManagementAuth(')) {
    return {
      status: 'strict',
      evidence: getLineMatches(relativePath, 'requireStrictManagementAuth('),
    };
  }

  if (content.includes('requireManagementAuth(')) {
    return {
      status: 'conditional',
      evidence: getLineMatches(relativePath, 'requireManagementAuth('),
    };
  }

  const hasConditional =
    content.includes('isAuthRequired(')
    || content.includes('await isAuthRequired(')
    || content.includes('isAuthenticated(')
    || content.includes('await isAuthenticated(');

  if (hasConditional) {
    return {
      status: 'conditional',
      evidence: getLineMatches(relativePath, [/isAuthRequired\(/, /isAuthenticated\(/]),
    };
  }

  return {
    status: 'missing',
    evidence: [],
  };
}

function readSettingsSnapshot() {
  const snapshot = {
    available: false,
    dbFile: dbPath,
    requireLogin: null,
    setupComplete: null,
    hasPassword: null,
    mcpEnabled: null,
    mcpTransport: null,
    errors: [],
  };

  if (!fs.existsSync(dbPath)) {
    snapshot.errors.push('local database has not been materialized yet.');
    return snapshot;
  }

  if (!BetterSqlite3) {
    snapshot.errors.push('better-sqlite3 is not available para read direta of the state.');
    return snapshot;
  }

  let db = null;
  try {
    db = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'settings'").all();
    const settings = {
      requireLogin: true,
    };

    for (const row of rows) {
      const key = typeof row?.key === 'string' ? row.key : null;
      const rawValue = typeof row?.value === 'string' ? row.value : null;
      if (!key || rawValue === null) {
        continue;
      }

      try {
        settings[key] = JSON.parse(rawValue);
      } catch {
        settings[key] = rawValue;
      }
    }

    snapshot.available = true;
    snapshot.requireLogin =
      typeof settings.requireLogin === 'boolean' ? settings.requireLogin : null;
    snapshot.setupComplete =
      typeof settings.setupComplete === 'boolean' ? settings.setupComplete : null;
    snapshot.hasPassword =
      Boolean(typeof settings.password === 'string' && settings.password.trim())
      || Boolean(process.env.INITIAL_PASSWORD);
    snapshot.mcpEnabled = settings.mcpEnabled === true;
    snapshot.mcpTransport =
      typeof settings.mcpTransport === 'string' ? settings.mcpTransport : null;
  } catch (error) {
    snapshot.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // noop
      }
    }
  }

  return snapshot;
}

function getResolvedWebRuntime() {
  return {
    host: process.env.ZAVORTH_WEB_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1'),
    port: parseInt(process.env.ZAVORTH_WEB_PORT || process.env.PORT || '3000', 10),
    fromPortEnv: Boolean(process.env.PORT) && !process.env.ZAVORTH_WEB_HOST,
  };
}

function addBaselineFindings(findings, context) {
  const trackedSensitiveFiles = getTrackedFiles().filter(isTrackedSensitiveFile);
  const zavorthControlAuthSource = process.env.ZAVORTH_WEB_AUTH_TOKEN ? 'env'
    : process.env.ZAVORTH_HIGH_RISK_APPROVAL_PIN ? 'pin'
      : readText(webTokenFile) ? 'runtime-file'
        : 'missing';
  const mailboxSource = process.env.ZAVORTH_MAILBOX_SECRET ? 'env'
    : readText(mailboxSecretFile) ? 'runtime-file'
      : 'missing';
  const dbSource = process.env.ZAVORTH_DB_ENCRYPTION_KEY ? 'env'
    : readText(dbKeyFile) ? 'runtime-file'
      : 'missing';

  if (zavorthControlAuthSource === 'pin') {
    findings.push(createFinding({
      id: 'zavorthControl_auth_reuses_high_risk_pin',
      area: 'web-auth',
      severity: 'medium',
      title: 'Web panel reuses the high-risk PIN as a token',
      detail: 'The web token is coupled to the same high-risk approval secret, increasing impact in case of leakage.',
      remediation: 'Generate a dedicated web token and remove PIN reuse.',
      evidence: [
        {
          file: '.env',
          line: null,
          snippet: 'ZAVORTH_HIGH_RISK_APPROVAL_PIN is sendo usado como fallback of the token web.',
        },
      ],
    }));
  }

  if (zavorthControlAuthSource === 'missing') {
    findings.push(createFinding({
      id: 'zavorthControl_auth_missing',
      area: 'web-auth',
      severity: 'high',
      title: 'Dedicated web token material was not found',
      detail: 'Without token material, the runtime depends on more permissive states or late provisioning.',
      remediation: 'Generate a dedicated local token for the web panel immediately.',
      autoFixable: true,
      fixCommand: 'npm run security:fix',
      evidence: [
        {
          file: normalizeRelativePath(path.relative(projectRoot, webTokenFile)),
          line: null,
          snippet: 'Web token file is missing.',
        },
      ],
    }));
  }

  if (mailboxSource === 'missing') {
    findings.push(createFinding({
      id: 'mailbox_secret_missing',
      area: 'secrets',
      severity: 'medium',
      title: 'Mailbox secret has not been materialized yet',
      detail: 'A mailbox fica without secret local persistido, o que reduz previsibilidade operational and dificulta rotaction.',
      remediation: 'Materializar um secret dedicado para a mailbox.',
      autoFixable: true,
      fixCommand: 'npm run security:fix',
      evidence: [
        {
          file: normalizeRelativePath(path.relative(projectRoot, mailboxSecretFile)),
          line: null,
          snippet: 'Mailbox secret file is missing.',
        },
      ],
    }));
  }

  if (dbSource === 'missing') {
    findings.push(createFinding({
      id: 'db_encryption_key_missing',
      area: 'storage',
      severity: 'medium',
      title: 'local database encryption key has not been materialized',
      detail: 'without a key local materializada, a postura de protection em repouso fica incompleta or dependente de bootstrap futuro.',
      remediation: 'Provisionar uma key dedicada para encryption local of the database.',
      evidence: [
        {
          file: normalizeRelativePath(path.relative(projectRoot, dbKeyFile)),
          line: null,
          snippet: 'Encryption key file is missing.',
        },
      ],
    }));
  }

  if (!fs.existsSync(hostIdentityFile)) {
    findings.push(createFinding({
      id: 'host_identity_missing',
      area: 'host-auth',
      severity: 'low',
      title: 'Host identity/authorization has not been materialized yet',
      detail: 'Host auth exists in the runtime, but the identity file still was not generated ahead of time.',
      remediation: 'Materializar a identidade of the host local para estabilizar a readiness operational.',
      autoFixable: true,
      fixCommand: 'npm run security:fix',
      evidence: [
        {
          file: normalizeRelativePath(path.relative(projectRoot, hostIdentityFile)),
          line: null,
          snippet: 'Host identity file is missing.',
        },
      ],
    }));
  }

  if (trackedSensitiveFiles.length > 0) {
    findings.push(createFinding({
      id: 'tracked_sensitive_files',
      area: 'repository',
      severity: 'critical',
      title: 'Sensitive files are tracked by git',
      detail: 'Versioned sensitive secrets and artifacts increase leakage risk and make rollback/clone dangerous.',
      remediation: 'Remover os files of the versionamento, regenerar os secrets and ajustar o ignore of the repository.',
      evidence: trackedSensitiveFiles.map((file) => ({
        file,
        line: null,
        snippet: 'Sensitive file tracked by git.',
      })),
    }));
  }

  context.zavorthControlAuthSource = zavorthControlAuthSource;
  context.mailboxSource = mailboxSource;
  context.dbSource = dbSource;
  context.trackedSensitiveFiles = trackedSensitiveFiles;
}

function addAuthTopologyFindings(findings, context) {
  const apiAuthEvidence = getLineMatches(
    'src/zavorth-control/shared/utils/apiAuth.ts',
    [/settings\.requireLogin === false/, /!settings\.password && !process\.env\.INITIAL_PASSWORD/],
  );
  const proxyEvidence = getLineMatches(
    'src/zavorth-control/proxy.ts',
    [/const authRequired = await isAuthRequired\(\)/, /if \(!authRequired\) \{/],
  );
  const settings = context.settings;
  const runtimeNoLogin = settings.available && settings.requireLogin === false;
  const onboardingOpen =
    settings.available && settings.setupComplete === false && settings.hasPassword === false;

  if (apiAuthEvidence.length > 0 && proxyEvidence.length > 0) {
    findings.push(createFinding({
      id: 'conditional_global_auth_bypass',
      area: 'web-auth',
      severity: runtimeNoLogin ? 'critical' : 'high',
      title: 'Auth global pode ser desligada for every a Management API',
      detail: runtimeNoLogin ? 'O database indica requireLogin=false in the state current, o que coloca a API de gerenciamento in mode efetivamente aberto para todas as routes que dependem only of the middleware global.'
        : onboardingOpen ? 'Em onboarding without password, a Management API pode entrar in mode without auth para routes que dependem only of the middleware global.'
          : 'A topologia current permite que a auth global deixe de proteger routes de gerenciamento in states without password or with requireLogin=false.',
      remediation: 'Separate sensitive routes from onboarding, require local auth for critical surfaces, and remove global bypass for administrative endpoints.',
      evidence: [...apiAuthEvidence, ...proxyEvidence],
    }));
  }

  const routeStatuses = sensitiveRouteTargets.map((target) => ({
    ...target,
    guard: detectRouteGuard(target.path),
  }));
  const missingRoutes = routeStatuses.filter((entry) => entry.guard.status === 'missing');
  const conditionalRoutes = routeStatuses.filter((entry) => entry.guard.status === 'conditional');

  if (missingRoutes.length > 0) {
    findings.push(createFinding({
      id: 'sensitive_routes_missing_local_auth',
      area: 'web-surface',
      severity: runtimeNoLogin ? 'critical' : 'high',
      title: 'Sensitive routes do not have local authentication guards',
      detail: 'Essas routes dependem only of the middleware global. when a auth global relaxa, endpoints de backup, logs or MCP ficam expostos alem of the esperado.',
      remediation: 'Adicionar guardas locais estritas para routes administractives and de exportaction de dados.',
      evidence: missingRoutes.flatMap((route) => {
        const line = getFirstLineMatch(route.path, [/export async function/, /async function guardEnabled/]);
        return [
          line || {
            file: route.path,
            line: null,
            snippet: `Sensitive route without requireManagementAuth/isAuthenticated: ${route.surface}`,
          },
        ];
      }),
    }));
  }

  if (conditionalRoutes.length > 0) {
    findings.push(createFinding({
      id: 'sensitive_routes_conditional_auth',
      area: 'web-surface',
      severity: runtimeNoLogin ? 'high' : 'medium',
      title: 'Sensitive routes use a conditional guard that turns off with global auth',
      detail: 'Mesmo when a route chama um helper de auth, o helper current devolve permission nula se o runtime entrar em state without login.',
      remediation: 'Create a strict administrative guard for high-impact surfaces, separate from the onboarding/fresh-install flow.',
      evidence: conditionalRoutes.flatMap((route) => route.guard.evidence.slice(0, 2)),
    }));
  }

  const mcpRoute = routeStatuses.find((entry) => entry.id === 'mcp_sse');
  if (mcpRoute && mcpRoute.guard.status === 'missing') {
    const mcpEnabledNow = settings.available && settings.mcpEnabled === true && settings.mcpTransport === 'sse';
    findings.push(createFinding({
      id: 'mcp_sse_surface_unguarded',
      area: 'mcp',
      severity: mcpEnabledNow ? 'critical' : 'high',
      title: 'A surface MCP/SSE does not have auth local',
      detail: mcpEnabledNow ? 'O state current indica MCP habilitado via SSE, and a route does not have auth local. Isso transforma uma surface de tools em risk operational imediato.'
        : 'An MCP/SSE route depends only on enable/transport state and does not require local auth on its own.',
      remediation: 'Adicionar auth administractive estrita in the route MCP/SSE and tratar this surface como equivalente a access operador.',
      evidence: [
        ...(mcpRoute.guard.evidence || []),
        ...getLineMatches(mcpRoute.path, [/settings\.mcpEnabled/, /transport !== 'sse'/]),
      ],
    }));
  }

  context.routeStatuses = routeStatuses;
}

function addSurfaceHardeningFindings(findings, context) {
  const webRuntimeEvidence = getLineMatches(
    'src/config/sections/webRuntimeConfig.ts',
    /process\.env\.PORT \... '0\.0\.0\.0' : '127\.0\.0\.1'/,
  );
  const runtime = context.webRuntime;

  if (webRuntimeEvidence.length > 0) {
    findings.push(createFinding({
      id: 'web_host_defaults_to_all_interfaces_on_port_env',
      area: 'web-surface',
      severity: runtime.fromPortEnv ? 'high' : 'medium',
      title: 'Web host cai em 0.0.0.0 when PORT is present',
      detail: runtime.fromPortEnv ? `No state current, o host resolvido is em ${runtime.host}:${runtime.port} porque PORT foi detectado without ZAVORTH_WEB_HOST explicit.`
        : 'O runtime contains um default que amplia o bind para todas as interfaces in environments with PORT definido.',
      remediation: 'Switch the default to loopback and require explicit bind for remote exposure.',
      evidence: webRuntimeEvidence,
    }));
  }

  const queryTokenEvidence = getLineMatches(
    'src/services/WebAppSecurityService.ts',
    [/searchParams\.get\('token'\)/, /return bearer \|\| headerToken \|\| queryToken/],
  );
  const queryTokenTestEvidence = getLineMatches(
    'tests/services/WebAppSecurityService.test.ts',
    /accepts the query token only for authorized websocket upgrades/,
  );
  if (queryTokenEvidence.length > 0) {
    findings.push(createFinding({
      id: 'websocket_query_token_enabled',
      area: 'websocket-auth',
      severity: 'medium',
      title: 'Upgrade WebSocket aceita token in the query string',
      detail: 'Tokens in URLs can leak through logs, history, proxies, and troubleshooting screenshots. For agent surfaces, a dedicated header is safer.',
      remediation: 'Remover token por query string and aceitar only Authorization or header dedicado.',
      evidence: [...queryTokenEvidence, ...queryTokenTestEvidence],
    }));
  }

  const classicEvidence = getLineMatches(
    'src/domain/surface/presentation/zavorthControl/ZavorthControlClassicAccessService.ts',
    [/isLoopbackAddress/, /\|\| deps\.authService\.validate/],
  );
  if (classicEvidence.length > 0) {
    findings.push(createFinding({
      id: 'classic_loopback_auth_bypass',
      area: 'legacy-surface',
      severity: 'medium',
      title: 'surface legada /classic aceita loopback como bypass de auth',
      detail: 'That assumption only works in purely local environments. With reverse proxies, local bridges, or tunnels, loopback trust can hide a weaker boundary.',
      remediation: 'Remover o bypass por loopback in surfaces administractives or isola-lo estritamente a um socket local controlado.',
      evidence: classicEvidence,
    }));
  }

  const workspaceEvidence = getLineMatches(
    'src/config/sections/runtimePathConfig.ts',
    /workspaceRoot: process\.env\.WORKSPACE_ROOT \|\| path\.resolve\(projectRoot, '\.\.', '\.\.'\)/,
  );
  const workspaceResolverEvidence = getLineMatches(
    'src/security/WorkspaceResolver.ts',
    [/config\.workspaceRoot/, /config\.defaultWorkspace/],
  );
  if (workspaceEvidence.length > 0) {
    findings.push(createFinding({
      id: 'workspace_root_broader_than_repo',
      area: 'workspace-boundary',
      severity: 'medium',
      title: 'Default approved workspace is broader than the Zavorth repository',
      detail: `The resolved workspace root climbs to ${path.resolve(projectRoot, '..', '..')}, expanding the area tools and agents may treat as approved.`,
      remediation: 'Restringir o default ao repository current and exigir allowlists explicit para areas adicionais.',
      evidence: [...workspaceEvidence, ...workspaceResolverEvidence],
    }));
  }
}

function addRuntimeSettingsFindings(findings, context) {
  const settings = context.settings;
  if (!settings.available) {
    return;
  }

  if (settings.requireLogin === false) {
    findings.push(createFinding({
      id: 'runtime_require_login_disabled',
      area: 'runtime-config',
      severity: 'critical',
      title: 'O runtime current is with requireLogin=false',
      detail: 'No state current of the database, a Management API and o zavorthControl podem cair em postura aberta demais para surfaces administractives.',
      remediation: 'Reactivate requireLogin, separate the onboarding flow, and require local auth in sensitive routes.',
      evidence: [
        {
          file: normalizeRelativePath(path.relative(projectRoot, dbPath)),
          line: null,
          snippet: 'settings.requireLogin = false',
        },
      ],
    }));
  }

  if (settings.setupComplete === true && settings.hasPassword === false) {
    findings.push(createFinding({
      id: 'runtime_setup_complete_without_password',
      area: 'runtime-config',
      severity: 'high',
      title: 'O runtime is marcado como setupComplete without password efetiva',
      detail: 'Esse state amplia risk de trusting onboarding finished enquanto o runtime segue with auth fraca or desactiveda.',
      remediation: 'Exigir password/token efetivo before considerar o setup completo in surfaces administractives.',
      evidence: [
        {
          file: normalizeRelativePath(path.relative(projectRoot, dbPath)),
          line: null,
          snippet: 'settings.setupComplete = true and no password/token efetivo detectado',
        },
      ],
    }));
  }
}

function buildAuditCore(options = {}) {
  const findings = [];
  const settings = readSettingsSnapshot();
  const context = {
    settings,
    webRuntime: getResolvedWebRuntime(),
    trackedSensitiveFiles: [],
    routeStatuses: [],
    zavorthControlAuthSource: 'missing',
    mailboxSource: 'missing',
    dbSource: 'missing',
  };

  addBaselineFindings(findings, context);
  addAuthTopologyFindings(findings, context);
  addSurfaceHardeningFindings(findings, context);

  if (options.deep) {
    addRuntimeSettingsFindings(findings, context);
  }

  const sortedFindings = sortFindings(findings);
  const { failures, warnings } = buildLegacyMessages(sortedFindings);
  const counts = {
    total: sortedFindings.length,
    critical: sortedFindings.filter((entry) => entry.severity === 'critical').length,
    high: sortedFindings.filter((entry) => entry.severity === 'high').length,
    medium: sortedFindings.filter((entry) => entry.severity === 'medium').length,
    low: sortedFindings.filter((entry) => entry.severity === 'low').length,
    info: sortedFindings.filter((entry) => entry.severity === 'info').length,
    p0: sortedFindings.filter((entry) => entry.priority === 'P0').length,
    p1: sortedFindings.filter((entry) => entry.priority === 'P1').length,
    p2: sortedFindings.filter((entry) => entry.priority === 'P2').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    ok: counts.p0 === 0,
    summary: buildSecuritySummaryFromFindings(sortedFindings),
    mode: options.deep ? 'deep' : 'standard',
    repoRoot: projectRoot,
    runtime: {
      webHost: context.webRuntime.host,
      webPort: context.webRuntime.port,
      zavorthControlAuthSource: context.zavorthControlAuthSource,
      mailboxSource: context.mailboxSource,
      dbSource: context.dbSource,
      settings,
    },
    routeAuth: context.routeStatuses.map((entry) => ({
      id: entry.id,
      path: entry.path,
      surface: entry.surface,
      guard: entry.guard.status,
    })),
    counts,
    findings: sortedFindings,
    warnings,
    failures,
    fixesApplied: [],
  };
}

function backupFile(filePath, prefix) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  ensureDir(rotationDir);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const backupPath = path.join(rotationDir, `${prefix}-${stamp}.bak`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function rotateWebToken(force = false) {
  const authSource = process.env.ZAVORTH_WEB_AUTH_TOKEN ? 'env'
    : process.env.ZAVORTH_HIGH_RISK_APPROVAL_PIN ? 'pin'
      : 'runtime-file';

  if (authSource !== 'runtime-file' && !force) {
    return {
      rotated: false,
      activeSource: authSource,
      tokenFile: webTokenFile,
      note: 'Token file is not the active source. Use --force to rotate anyway.',
    };
  }

  const previousBackup = backupFile(webTokenFile, 'web-api-token');
  ensureDir(path.dirname(webTokenFile));
  const nextToken = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(webTokenFile, nextToken, 'utf8');
  return {
    rotated: true,
    activeSource: authSource,
    tokenFile: webTokenFile,
    backup: previousBackup,
  };
}

function rotateMailboxSecret(force = false) {
  if (process.env.ZAVORTH_MAILBOX_SECRET && !force) {
    return {
      rotated: false,
      activeSource: 'env',
      secretFile: mailboxSecretFile,
      note: 'The mailbox is using ZAVORTH_MAILBOX_SECRET. Use --force to rotate the local file anyway.',
    };
  }

  const pendingEntries = fs.existsSync(mailboxInboxDir)
    ? fs.readdirSync(mailboxInboxDir).filter(Boolean)
    : [];
  if (pendingEntries.length > 0 && !force) {
    throw new Error(
      `There are pending messages in the mailbox (${pendingEntries.length}). Use --force to rotate anyway.`,
    );
  }

  const previousBackup = backupFile(mailboxSecretFile, 'mailbox-secret');
  ensureDir(path.dirname(mailboxSecretFile));
  const nextSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(mailboxSecretFile, nextSecret, 'utf8');
  return {
    rotated: true,
    activeSource: process.env.ZAVORTH_MAILBOX_SECRET ? 'env' : 'runtime-file',
    secretFile: mailboxSecretFile,
    backup: previousBackup,
    pendingEntries,
  };
}

function materializeHostIdentity(force = false) {
  if (fs.existsSync(hostIdentityFile) && !force) {
    return {
      created: false,
      file: hostIdentityFile,
      note: 'Host identity file already exists.',
    };
  }

  const interfaces = os.networkInterfaces();
  const macs = Object.values(interfaces)
    .flat()
    .filter((entry) => Boolean(entry))
    .map((entry) => entry.mac || '')
    .filter((mac) => mac && mac !== '00:00:00:00:00:00')
    .sort();

  const fingerprint = crypto
    .createHash('sha256')
    .update([
      os.hostname(),
      os.platform(),
      os.arch(),
      os.release(),
      macs.join('|'),
    ].join('||'))
    .digest('hex');

  const payload = {
    fingerprint,
    hostname: os.hostname(),
    authorizedAt: new Date().toISOString(),
  };

  ensureDir(path.dirname(hostIdentityFile));
  fs.writeFileSync(hostIdentityFile, JSON.stringify(payload, null, 2), 'utf8');
  return {
    created: true,
    file: hostIdentityFile,
    fingerprint,
  };
}

function applySafeFixes(options = {}) {
  const fixesApplied = [];

  try {
    if (!readText(webTokenFile) && !process.env.ZAVORTH_WEB_AUTH_TOKEN && !process.env.ZAVORTH_HIGH_RISK_APPROVAL_PIN) {
      fixesApplied.push({
        id: 'fix_web_token_missing',
        status: 'applied',
        result: rotateWebToken(options.force),
      });
    } else if (process.env.ZAVORTH_HIGH_RISK_APPROVAL_PIN && !process.env.ZAVORTH_WEB_AUTH_TOKEN) {
      fixesApplied.push({
        id: 'fix_web_token_missing',
        status: 'skipped',
        result: {
          note: 'PIN de alto risk remains the active source. O autofix does not overwrite env/approval pin.',
        },
      });
    }
  } catch (error) {
    fixesApplied.push({
      id: 'fix_web_token_missing',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    if (!readText(mailboxSecretFile) && !process.env.ZAVORTH_MAILBOX_SECRET) {
      fixesApplied.push({
        id: 'fix_mailbox_secret_missing',
        status: 'applied',
        result: rotateMailboxSecret(options.force),
      });
    }
  } catch (error) {
    fixesApplied.push({
      id: 'fix_mailbox_secret_missing',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    if (!fs.existsSync(hostIdentityFile)) {
      fixesApplied.push({
        id: 'fix_host_identity_missing',
        status: 'applied',
        result: materializeHostIdentity(options.force),
      });
    }
  } catch (error) {
    fixesApplied.push({
      id: 'fix_host_identity_missing',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (fixesApplied.length === 0) {
    fixesApplied.push({
      id: 'no_safe_fixes_applied',
      status: 'noop',
      result: {
        note: 'No autofix seguro era applicable in the state current.',
      },
    });
  }

  return fixesApplied;
}

function runAudit(options = {}) {
  const initial = buildAuditCore(options);
  if (!options.fix) {
    writeJson(auditReportFile, initial);
    return initial;
  }

  const fixesApplied = applySafeFixes(options);
  const rerun = buildAuditCore(options);
  rerun.fixesApplied = fixesApplied;
  rerun.preFixSummary = initial.summary;
  writeJson(auditReportFile, rerun);
  return rerun;
}

function runPreflight() {
  const secretValues = collectSecretValues();
  const trackedSensitiveFiles = getTrackedFiles().filter(isTrackedSensitiveFile);
  const remoteTargets = readRemoteTargets();
  const missingTargets = remoteTargets.filter((target) => !fs.existsSync(target.path));
  const forbiddenDeployFiles = [];
  const leakedSecrets = [];

  for (const target of remoteTargets) {
    if (!fs.existsSync(target.path)) {
      continue;
    }

    for (const entry of walkFiles(target.path)) {
      const relativeToProject = path.relative(projectRoot, entry.absolutePath).replace(/\\/g, '/');
      const normalized = relativeToProject.toLowerCase();
      if (forbiddenDeployPathPatterns.some((pattern) => pattern.test(normalized))) {
        forbiddenDeployFiles.push(relativeToProject);
      }

      const ext = path.extname(entry.absolutePath).toLowerCase();
      if (!textExtensions.has(ext) || entry.size > 2 * 1024 * 1024) {
        continue;
      }

      let content = '';
      try {
        content = fs.readFileSync(entry.absolutePath, 'utf8');
      } catch {
        content = '';
      }

      if (!content) {
        continue;
      }

      for (const secret of secretValues) {
        if (!secret.value || secret.value.length < 8) {
          continue;
        }

        if (content.includes(secret.value)) {
          leakedSecrets.push({
            file: relativeToProject,
            source: secret.source,
          });
        }
      }
    }
  }

  const findings = [];

  if (trackedSensitiveFiles.length > 0) {
    findings.push(createFinding({
      id: 'preflight_tracked_sensitive_files',
      area: 'release',
      severity: 'critical',
      title: 'Preflight found sensitive files tracked by git',
      detail: 'Versioned sensitive artifacts can leak to remote surfaces or third parties that clone the repository.',
      remediation: 'Remover of the versionamento and regenerar os secrets before of the publish.',
      evidence: trackedSensitiveFiles.map((file) => ({
        file,
        line: null,
        snippet: 'Sensitive file tracked by git.',
      })),
    }));
  }

  if (missingTargets.length > 0) {
    findings.push(createFinding({
      id: 'preflight_missing_remote_targets',
      area: 'release',
      severity: 'high',
      title: 'Expected remote targets were not prepared',
      detail: 'Remote publish must not continue when packaged surfaces still do not exist.',
      remediation: 'run remote:prepare before any publish.',
      evidence: missingTargets.map((entry) => ({
        file: normalizeRelativePath(path.relative(projectRoot, entry.path)),
        line: null,
        snippet: 'Target remote missing.',
      })),
    }));
  }

  if (forbiddenDeployFiles.length > 0) {
    findings.push(createFinding({
      id: 'preflight_forbidden_files_in_remote_surface',
      area: 'release',
      severity: 'critical',
      title: 'remote surface contains local or sensitive artifacts',
      detail: 'Runtime files, secrets, or local artifacts appeared in the prepared remote package.',
      remediation: 'Clean the remote surface and strengthen preflight before deploy.',
      evidence: forbiddenDeployFiles.map((file) => ({
        file,
        line: null,
        snippet: 'local/sensitive file found in the remote surface.',
      })),
    }));
  }

  if (leakedSecrets.length > 0) {
    findings.push(createFinding({
      id: 'preflight_materialized_secrets_leaked',
      area: 'release',
      severity: 'critical',
      title: 'materialized secrets appeared in the remote surface',
      detail: 'Locally materialized token/key values were found inside the artifact prepared for publish.',
      remediation: 'Block publish, clean the artifacts, and rotate affected secrets.',
      evidence: leakedSecrets.map((entry) => ({
        file: entry.file,
        line: null,
        snippet: `secret local vazou a partir de ${entry.source}.`,
      })),
    }));
  }

  if (secretValues.length === 0) {
    findings.push(createFinding({
      id: 'preflight_no_materialized_secrets_detected',
      area: 'release',
      severity: 'low',
      title: 'No materialized secret was found for leakage scanning',
      detail: 'The preflight did not find enough materialized secrets to validate content leakage.',
      remediation: 'Confirm expected secrets come from environment or files and review preflight coverage.',
      evidence: [],
    }));
  }

  const sortedFindings = sortFindings(findings);
  const { failures, warnings } = buildLegacyMessages(sortedFindings);
  const report = {
    generatedAt: new Date().toISOString(),
    ok: sortedFindings.every((entry) => entry.priority !== 'P0'),
    summary: buildSecuritySummaryFromFindings(sortedFindings),
    checkedTargets: remoteTargets.map((target) => ({
      name: target.name,
      path: target.path,
      exists: fs.existsSync(target.path),
    })),
    secretValueCount: secretValues.length,
    trackedSensitiveFiles,
    forbiddenDeployFiles,
    leakedSecrets,
    findings: sortedFindings,
    warnings,
    failures,
  };

  writeJson(preflightReportFile, report);
  return report;
}

function buildGapReportFromAudit(audit) {
  const buckets = bucketFindings(audit.findings || []);
  const report = {
    generatedAt: new Date().toISOString(),
    ok: audit.ok,
    summary: audit.summary,
    source: {
      mode: audit.mode,
      auditReportFile,
    },
    priorities: {
      P0: buckets.P0.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        remediation: finding.remediation,
        autoFixable: finding.autoFixable,
        evidence: finding.evidence,
      })),
      P1: buckets.P1.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        remediation: finding.remediation,
        autoFixable: finding.autoFixable,
        evidence: finding.evidence,
      })),
      P2: buckets.P2.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        remediation: finding.remediation,
        autoFixable: finding.autoFixable,
        evidence: finding.evidence,
      })),
    },
  };

  writeJson(gapReportFile, report);
  writeText(gapReportMarkdownFile, renderGapReportMarkdown(report));
  return report;
}

function renderGapReportMarkdown(report) {
  const lines = [];
  lines.push('# Zavorth Security Gap Report');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push('');
  lines.push(`Resumo: ${report.summary}`);
  lines.push('');

  for (const priority of ['P0', 'P1', 'P2']) {
    const items = report.priorities[priority] || [];
    lines.push(`## ${priority}`);
    lines.push('');
    if (!items.length) {
      lines.push('No finding in this prioridade.');
      lines.push('');
      continue;
    }

    for (const item of items) {
      lines.push(`### ${item.title}`);
      lines.push('');
      lines.push(`- id: ${item.id}`);
      lines.push(`- severidade: ${item.severity}`);
      lines.push(`- autofix: ${item.autoFixable ? 'yes' : 'not'}`);
      if (item.remediation) {
        lines.push(`- remediation: ${item.remediation}`);
      }
      if (item.evidence?.length) {
        lines.push('- evidence:');
        for (const evidence of item.evidence.slice(0, 4)) {
          const line = typeof evidence.line === 'number' ? `:${evidence.line}` : '';
          lines.push(`  - ${evidence.file}${line} -> ${evidence.snippet}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function runDoctor(options = {}) {
  const audit = runAudit({
    deep: true,
    fix: options.fix,
    force: options.force,
  });
  const preflight = runPreflight();
  const gapReport = buildGapReportFromAudit(audit);

  const nextSteps = [];
  for (const finding of audit.findings.slice(0, 8)) {
    nextSteps.push({
      id: finding.id,
      priority: finding.priority,
      title: finding.title,
      remediation: finding.remediation,
      fixCommand: finding.fixCommand,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: audit.ok && preflight.ok,
    summary: `audit: ${audit.summary} | preflight: ${preflight.summary}`,
    audit: {
      ok: audit.ok,
      summary: audit.summary,
      mode: audit.mode,
      counts: audit.counts,
      fixesApplied: audit.fixesApplied,
      reportFile: auditReportFile,
    },
    preflight: {
      ok: preflight.ok,
      summary: preflight.summary,
      reportFile: preflightReportFile,
    },
    gapReport: {
      file: gapReportFile,
      markdownFile: gapReportMarkdownFile,
      summary: gapReport.summary,
      priorities: {
        P0: gapReport.priorities.P0.length,
        P1: gapReport.priorities.P1.length,
        P2: gapReport.priorities.P2.length,
      },
    },
    nextSteps,
  };

  writeJson(doctorReportFile, report);
  return report;
}

function printFinding(finding) {
  const label = finding.priority === 'P0' ? 'BLOCK' : finding.priority === 'P1' ? 'WARN ' : 'INFO ';
  console.log(
    `[security] ${label} ${finding.priority}/${String(finding.severity || '').toUpperCase()} ${finding.title} [${finding.id}]`,
  );
  if (finding.evidence?.length) {
    const evidence = finding.evidence[0];
    const line = typeof evidence.line === 'number' ? `:${evidence.line}` : '';
    console.log(`[security]       ${evidence.file}${line} -> ${evidence.snippet}`);
  }
  if (finding.remediation) {
    console.log(`[security]       fix: ${finding.remediation}`);
  }
}

function printAuditLikeReport(title, report) {
  console.log(`[security] ${title}`);
  console.log(`[security] ${report.summary}`);
  for (const finding of report.findings || []) {
    printFinding(finding);
  }
  if (report.fixesApplied?.length) {
    console.log('[security] autofix:');
    for (const entry of report.fixesApplied) {
      console.log(`[security]   - ${entry.id}: ${entry.status}`);
    }
  }
}

function printDoctorReport(report) {
  console.log('[security] doctor');
  console.log(`[security] ${report.summary}`);
  console.log(
    `[security] gap report: ${report.gapReport.priorities.P0} P0, ${report.gapReport.priorities.P1} P1, ${report.gapReport.priorities.P2} P2`,
  );
  console.log(`[security] audit report: ${report.audit.reportFile}`);
  console.log(`[security] gap report json: ${report.gapReport.file}`);
  console.log(`[security] gap report md: ${report.gapReport.markdownFile}`);
  if (report.nextSteps.length > 0) {
    console.log('[security] proximos passos:');
    for (const step of report.nextSteps) {
      console.log(`- ${step.priority} ${step.title}`);
      if (step.remediation) {
        console.log(`  ${step.remediation}`);
      }
    }
  }
}

function printGapReport(report) {
  console.log('[security] gap-report');
  console.log(`[security] ${report.summary}`);
  for (const priority of ['P0', 'P1', 'P2']) {
    const items = report.priorities[priority] || [];
    if (!items.length) {
      continue;
    }
    console.log(`[security] ${priority}:`);
    for (const item of items) {
      console.log(`- ${item.title} [${item.id}]`);
    }
  }
  console.log(`[security] json: ${gapReportFile}`);
  console.log(`[security] md: ${gapReportMarkdownFile}`);
}

function parseArgs(argv) {
  const [command = 'audit', ...rest] = argv;
  const args = new Set(rest);
  return {
    command,
    force: args.has('--force'),
    strict: args.has('--strict'),
    deep: args.has('--deep'),
    fix: args.has('--fix') || args.has('--repair'),
    asJson: args.has('--json'),
  };
}

function printHelp() {
  console.log('usage: node scripts/security-ops.mjs <audit|preflight|fix|doctor|gap-report|rotate-web-token|rotate-mailbox-secret> [--deep] [--fix] [--force] [--strict] [--json]');
  console.log('');
  console.log('Comandos:');
  console.log('  audit        Runtime/repository security audit.');
  console.log('  audit --deep Auditoria ampliada with read of the state local and priorizaction P0/P1/P2.');
  console.log('  fix          Aplica only autofixes seguros (token web, mailbox secret, host identity).');
  console.log('  doctor       Runs deep audit + preflight + gap-report and saves everything in data/runtime/.');
  console.log('  gap-report   Generates the security backlog as JSON + Markdown from the current audit.');
  console.log('  preflight    Checks secret leakage in the prepared remote surface.');
}

function main() {
  const argv = parseArgs(process.argv.slice(2));

  if (argv.command === 'help' || argv.command === '--help' || argv.command === '-h') {
    printHelp();
    return;
  }

  if (argv.command === 'audit' || argv.command === 'status') {
    const report = runAudit({
      deep: argv.deep,
      fix: argv.fix,
      force: argv.force,
    });
    if (argv.asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printAuditLikeReport(argv.deep ? 'audit --deep' : 'audit', report);
    }
    if (!report.ok && argv.strict) {
      process.exitCode = 1;
    }
    return;
  }

  if (argv.command === 'fix') {
    const report = runAudit({
      deep: true,
      fix: true,
      force: argv.force,
    });
    if (argv.asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printAuditLikeReport('fix', report);
    }
    if (!report.ok && argv.strict) {
      process.exitCode = 1;
    }
    return;
  }

  if (argv.command === 'gap-report') {
    const audit = runAudit({ deep: true });
    const report = buildGapReportFromAudit(audit);
    if (argv.asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printGapReport(report);
    }
    if (!report.ok && argv.strict) {
      process.exitCode = 1;
    }
    return;
  }

  if (argv.command === 'doctor') {
    const report = runDoctor({
      fix: argv.fix,
      force: argv.force,
    });
    if (argv.asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printDoctorReport(report);
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (argv.command === 'preflight') {
    const report = runPreflight();
    if (argv.asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printAuditLikeReport('preflight', report);
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (argv.command === 'rotate-web-token') {
    const result = rotateWebToken(argv.force);
    console.log(`[security] web token ${result.rotated ? 'rotated' : 'not alterado'}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (argv.command === 'rotate-mailbox-secret') {
    const result = rotateMailboxSecret(argv.force);
    console.log(`[security] mailbox secret ${result.rotated ? 'rotated' : 'not alterado'}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`Unknown security command: ${argv.command}`);
}

main();
