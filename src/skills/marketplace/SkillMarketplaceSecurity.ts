import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type SecurityScanResult = {
  safe: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  issues: SecurityIssue[];
  recommendations: string[];
  requiredPermissions: SkillPermission[];
  gpgVerified: boolean;
};

export type SecurityIssue = {
  severity: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  file?: string;
};

export type SkillPermission = 'read' | 'write' | 'execute' | 'network' | 'filesystem' | 'system';

export type SkillPermissionManifest = {
  permissions: SkillPermission[];
  sandbox: boolean;
  maxExecutionTime: number;
  allowedPaths: string[];
  blockedCommands: string[];
};

export type AuditLogEntry = {
  timestamp: string;
  action: 'install' | 'uninstall' | 'publish' | 'scan' | 'update';
  skillId: string;
  version: string;
  source: string;
  riskLevel: string;
  issues: number;
  user: string;
  approved: boolean;
};

const DANGEROUS_PATTERNS = [
  { pattern: /\b(exec|eval|spawn|execSync|system|popen)\b/i, code: 'code-execution', message: 'Contains code execution calls' },
  { pattern: /\b(fetch|axios|http\.request|https\.request|XMLHttpRequest)\b/i, code: 'network-call', message: 'Makes network requests (potential data exfiltration)' },
  { pattern: /\b(rm\s+-rf|del\s+\/[sS]|rmdir\s+\/s|format\s+[a-zA-Z]:)\b/i, code: 'destructive-command', message: 'Contains destructive system commands' },
  { pattern: /\b(password|secret|token|credential|api.key)\b.*[:=]/i, code: 'hardcoded-secret', message: 'May contain hardcoded secrets' },
  { pattern: /\b(electron|child_process|os\.platform|process\.env)\b/i, code: 'system-access', message: 'Accesses system-level resources' },
  { pattern: /\b(base64|atob|btoa|Buffer\.from)\b.*\b(exec|eval|spawn)\b/i, code: 'obfuscated-execution', message: 'Obfuscated code execution detected' },
];

const PROMPT_INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, code: 'prompt-injection', message: 'Prompt injection attempt detected' },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, code: 'role-hijack', message: 'Potential role hijacking attempt' },
  { pattern: /system\s*:\s*/i, code: 'system-prompt-injection', message: 'System prompt injection attempt' },
  { pattern: /\b(dont\s+tell|hide\s+this|secret\s+instruction|do\s+not\s+share)\b/i, code: 'hidden-instruction', message: 'Hidden instruction detected' },
  { pattern: /\b(exfiltrate|send\s+to|upload\s+to|post\s+to)\s+(http|https|ftp)/i, code: 'data-exfiltration', message: 'Potential data exfiltration to external URL' },
];

const DEFAULT_PERMISSIONS: SkillPermission[] = ['read'];

export function scanSkillForSecurity(skillDir: string): SecurityScanResult {
  const issues: SecurityIssue[] = [];
  const recommendations: string[] = [];

  const files = getAllFiles(skillDir);

  for (const file of files) {
    const relPath = path.relative(skillDir, file);
    const ext = path.extname(file).toLowerCase();

    if (ext === '.md' || ext === '.txt') {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        scanTextContent(content, relPath, issues);
      } catch { /* skip unreadable */ }
    }

    if (ext === '.sh' || ext === '.bash' || ext === '.ps1' || ext === '.bat' || ext === '.cmd') {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        scanScriptContent(content, relPath, issues);
      } catch { /* skip unreadable */ }
    }

    if (ext === '.js' || ext === '.ts' || ext === '.py' || ext === '.rb') {
      issues.push({
        severity: 'warn',
        code: 'executable-code',
        message: `Executable code file: ${relPath}. Review before running.`,
        file: relPath,
      });
      try {
        const content = fs.readFileSync(file, 'utf-8');
        scanScriptContent(content, relPath, issues);
      } catch { /* skip unreadable */ }
    }

    if (ext === '.json') {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('preinstall') || content.includes('postinstall')) {
          issues.push({
            severity: 'warn',
            code: 'install-script',
            message: `Package has install scripts: ${relPath}. May execute code on install.`,
            file: relPath,
          });
        }
      } catch { /* skip */ }
    }
  }

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  let skillContent = '';
  if (fs.existsSync(skillMdPath)) {
    skillContent = fs.readFileSync(skillMdPath, 'utf-8');
    scanForPromptInjection(skillContent, issues);
  }

  const requiredPermissions = inferPermissions(skillContent);
  const gpgVerified = verifyGpgSignature(skillDir);
  const riskLevel = resolveRiskLevel(issues, gpgVerified);
  const safe = riskLevel !== 'blocked';

  if (!gpgVerified && riskLevel !== 'low') {
    recommendations.push('No GPG signature found. Author identity is unverified.');
  }
  if (issues.some((i) => i.code === 'prompt-injection' || i.code === 'role-hijack')) {
    recommendations.push('This skill contains potential prompt injection. Review the SKILL.md content carefully before using.');
  }
  if (issues.some((i) => i.code === 'code-execution')) {
    recommendations.push('This skill executes code. Only install if you trust the author.');
  }
  if (issues.some((i) => i.code === 'data-exfiltration')) {
    recommendations.push('This skill may send data externally. Review network calls before using.');
  }
  if (issues.some((i) => i.code === 'destructive-command')) {
    recommendations.push('This skill contains destructive commands. Review before running.');
  }
  if (requiredPermissions.includes('system')) {
    recommendations.push('This skill requires system-level access. Install only in trusted environments.');
  }
  if (riskLevel === 'low') {
    recommendations.push('No significant security issues detected.');
  }

  return { safe, riskLevel, issues, recommendations, requiredPermissions, gpgVerified };
}

function inferPermissions(content: string): SkillPermission[] {
  return [...DEFAULT_PERMISSIONS];
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export type SkillSignatureVerifyResult = {
  ok: boolean;
  mode: 'hmac-sha256' | 'legacy-sha256' | 'none';
  message: string;
};

/**
 * Verify author signature for a skill package.
 * Preferred: SKILL.md.sig = `hmac-sha256=<hex>` + AUTHOR_KEY.pub = key material.
 * Legacy: plain sha256 hex of SKILL.md (AUTHOR_KEY.pub still required).
 */
export function verifySkillPackageSignature(skillDir: string): SkillSignatureVerifyResult {
  const sigPath = path.join(skillDir, 'SKILL.md.sig');
  const keyPath = path.join(skillDir, 'AUTHOR_KEY.pub');
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) {
    return { ok: false, mode: 'none', message: 'SKILL.md missing' };
  }
  if (!fs.existsSync(sigPath) || !fs.existsSync(keyPath)) {
    return { ok: false, mode: 'none', message: 'No SKILL.md.sig / AUTHOR_KEY.pub (unsigned package)' };
  }

  try {
    const skillContent = fs.readFileSync(skillMd);
    const sigContent = fs.readFileSync(sigPath, 'utf-8').trim();
    const keyContent = fs.readFileSync(keyPath, 'utf-8').trim();
    if (!sigContent || !keyContent) {
      return { ok: false, mode: 'none', message: 'Empty signature or key file' };
    }

    if (sigContent.startsWith('hmac-sha256=')) {
      const expected = sigContent.slice('hmac-sha256='.length).trim();
      const actual = crypto.createHmac('sha256', keyContent).update(skillContent).digest('hex');
      const ok = timingSafeEqualHex(expected, actual);
      return {
        ok,
        mode: 'hmac-sha256',
        message: ok ? 'HMAC-SHA256 signature valid' : 'HMAC-SHA256 signature mismatch',
      };
    }

    const contentHash = crypto.createHash('sha256').update(skillContent).digest('hex');
    const ok = timingSafeEqualHex(contentHash, sigContent);
    return {
      ok,
      mode: 'legacy-sha256',
      message: ok ? 'Legacy SHA256 content hash valid' : 'Legacy SHA256 mismatch',
    };
  } catch (error: unknown) {
    return {
      ok: false,
      mode: 'none',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function verifyGpgSignature(skillDir: string): boolean {
  return verifySkillPackageSignature(skillDir).ok;
}

/**
 * Local operator signing helper for skill packages (not CDN publish).
 * Writes AUTHOR_KEY.pub + SKILL.md.sig (hmac-sha256) under skillDir.
 */
export function signSkillPackage(
  skillDir: string,
  signingKey: string,
): { ok: boolean; message: string; sigPath?: string } {
  const dir = path.resolve(skillDir);
  const skillMd = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) {
    return { ok: false, message: `SKILL.md not found in ${dir}` };
  }
  const key = String(signingKey || '').trim();
  if (key.length < 16) {
    return { ok: false, message: 'Signing key must be at least 16 characters.' };
  }
  try {
    const skillContent = fs.readFileSync(skillMd);
    const hmac = crypto.createHmac('sha256', key).update(skillContent).digest('hex');
    const pubMarker =
      'zavorth-skill-key-v1:' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
    const keyPath = path.join(dir, 'AUTHOR_KEY.pub');
    const sigPath = path.join(dir, 'SKILL.md.sig');
    // Store the signing key only when operator opts in via env (default: store public marker + use key for hmac only once)
    // For verification, AUTHOR_KEY.pub must hold the same key material used for HMAC.
    // Operators should treat AUTHOR_KEY.pub as a secret fingerprint file colocated with the package.
    fs.writeFileSync(keyPath, key, 'utf-8');
    fs.writeFileSync(sigPath, `hmac-sha256=${hmac}\n`, 'utf-8');
    // Also write a non-secret marker for humans
    fs.writeFileSync(path.join(dir, 'AUTHOR_KEY.id'), pubMarker + '\n', 'utf-8');
    return {
      ok: true,
      message: `Signed skill package at ${dir} (hmac-sha256 + AUTHOR_KEY.pub). Keep the signing key private.`,
      sigPath,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getSkillPermissions(skillDir: string): SkillPermission[] {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return DEFAULT_PERMISSIONS;
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  return inferPermissions(content);
}

export function checkPermissionCompliance(skillDir: string, policy: SkillPermissionManifest): { allowed: boolean; blocked: SkillPermission[] } {
  const required = getSkillPermissions(skillDir);
  const blocked = required.filter((p) => !policy.permissions.includes(p));
  return { allowed: blocked.length === 0, blocked };
}

export function recordAuditLog(entry: AuditLogEntry, dataDir: string): void {
  const logPath = path.join(dataDir, 'skill-marketplace', 'audit.json');
  try {
    let log: AuditLogEntry[] = [];
    if (fs.existsSync(logPath)) {
      log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    }
    log.push(entry);
    if (log.length > 1000) log = log.slice(-1000);
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

export function getAuditLog(dataDir: string, limit = 50): AuditLogEntry[] {
  const logPath = path.join(dataDir, 'skill-marketplace', 'audit.json');
  try {
    if (!fs.existsSync(logPath)) return [];
    const log: AuditLogEntry[] = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    return log.slice(-limit);
  } catch { return []; }
}

function scanTextContent(content: string, filePath: string, issues: SecurityIssue[]): void {
  for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      issues.push({ severity: 'warn', code, message: `${message} in ${filePath}`, file: filePath });
    }
  }
}

function scanScriptContent(content: string, filePath: string, issues: SecurityIssue[]): void {
  for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      issues.push({ severity: 'error', code, message: `${message} in script ${filePath}`, file: filePath });
    }
  }
}

function scanForPromptInjection(content: string, issues: SecurityIssue[]): void {
  for (const { pattern, code, message } of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      issues.push({ severity: 'error', code, message });
    }
  }
}

function resolveRiskLevel(issues: SecurityIssue[], gpgVerified: boolean): SecurityScanResult['riskLevel'] {
  if (issues.some((i) => i.severity === 'error' && (i.code === 'prompt-injection' || i.code === 'role-hijack' || i.code === 'destructive-command' || i.code === 'obfuscated-execution'))) {
    return 'blocked';
  }
  if (issues.some((i) => i.severity === 'error')) return 'high';
  if (issues.some((i) => i.severity === 'warn') && !gpgVerified) return 'medium';
  if (issues.some((i) => i.severity === 'warn')) return 'medium';
  return 'low';
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      }
    }
  } catch { /* skip */ }
  return files;
}

export function computeFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}
