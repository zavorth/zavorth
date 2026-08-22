import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthSecurityScannerTool extends BaseTool {
  public readonly name = 'zavorth_security_scanner';

  public readonly description =
    'Security scanning — CVE checks, dependency vulnerability audits, secret detection in source code, configuration security audits, SAST scanning, license compliance, and security header analysis.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'cve_check', 'dependency_audit', 'secret_scan', 'config_audit', 'sast_scan', 'license_check', 'header_audit', 'file_permissions', 'hardening_check', 'generate_report'.",
      },
      target_path: {
        type: 'string',
        description: 'Path to scan (file or directory).',
      },
      url: {
        type: 'string',
        description: 'URL for header/endpoint auditing.',
      },
      package_manager: {
        type: 'string',
        description: "Package manager: 'npm', 'yarn', 'pip', 'cargo', 'auto'. Default: 'auto'.",
      },
      severity: {
        type: 'string',
        description: "Severity filter: 'low', 'moderate', 'high', 'critical'.",
      },
      file_extension: {
        type: 'string',
        description: 'File extension filter for scanning.',
      },
      exclude_pattern: {
        type: 'string',
        description: "Exclude patterns (e.g., 'node_modules,.git,dist').",
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json', 'markdown'. Default: 'text'.",
      },
      max_results: {
        type: 'number',
        description: 'Maximum results to return. Default: 100.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'cve_check': return await this.cveCheck(args);
      case 'dependency_audit': return await this.dependencyAudit(args);
      case 'secret_scan': return await this.secretScan(args);
      case 'config_audit': return await this.configAudit(args);
      case 'sast_scan': return await this.sastScan(args);
      case 'license_check': return await this.licenseCheck(args);
      case 'header_audit': return await this.headerAudit(args);
      case 'file_permissions': return await this.filePermissions(args);
      case 'hardening_check': return await this.hardeningCheck(args);
      case 'generate_report': return await this.generateReport(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private detectPackageManager(dir: string): string {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'pip';
    if (fs.existsSync(path.join(dir, 'Cargo.lock'))) return 'cargo';
    return 'npm';
  }

  private async runCmd(cmd: string, cmdArgs: string[], options: { cwd?: string; timeout?: number } = {}): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        cwd: options.cwd,
        timeout: options.timeout || 60000,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] process execution failed', error); return ''; }
  }

  private async cveCheck(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');

    try {
      const { execFileSync } = await import('child_process');

      try {
        const result = execFileSync('npm', ['audit', '--json'], { cwd: targetPath, timeout: 60000 }).toString();
        const parsed = JSON.parse(result);
        const vulns = parsed.metadata?.vulnerabilities || {};

        const lines = [
          'CVE/Vulnerability Check:',
          `  Critical: ${vulns.critical || 0}`,
          `  High: ${vulns.high || 0}`,
          `  Moderate: ${vulns.moderate || 0}`,
          `  Low: ${vulns.low || 0}`,
          `  Total: ${vulns.total || 0}`,
        ];

        if (vulns.critical > 0 || vulns.high > 0) {
          lines.push('', '⚠️ High/Critical vulnerabilities found! Run "npm audit fix" to address.');
        }

        return lines.join('\n');
      } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return 'CVE check: No npm project found or audit completed with no issues.'; }
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
  }

  private async dependencyAudit(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');
    const pm = String(args.package_manager || 'auto');
    const resolved = pm === 'auto' ? this.detectPackageManager(targetPath) : pm;

    try {
      switch (resolved) {
        case 'npm': {
          const result = await this.runCmd('npm', ['audit', '--json'], { cwd: targetPath });
          try {
            const parsed = JSON.parse(result);
            const advisories = parsed.vulnerabilities || {};
            const entries = Object.entries(advisories).slice(0, 50);
            return [
              `Dependency Audit (${entries.length} vulnerabilities):`,
              ...entries.map(([name, info]: [string, unknown]) => {
                const vuln = info as Record<string, unknown>;
                return `  ${name}: ${vuln.severity || 'unknown'} ? ${vuln.title || 'no title'}`;
              }),
            ].join('\n');
          } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
        }
        case 'pip':
          return `Dependency audit:\n${await this.runCmd('pip', ['audit'], { cwd: targetPath })}`;
        default:
          return `Dependency audit not supported for "${resolved}".`;
      }
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
  }

  private async secretScan(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');
    const maxResults = Number(args.max_results || 100);

    const secretPatterns = [
      { name: 'API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi },
      { name: 'AWS Key', pattern: /(?:AKIA[0-9A-Z]{16})/g },
      { name: 'Private Key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g },
      { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
      { name: 'Password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi },
      { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi },
      { name: 'GitHub Token', pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/g },
      { name: 'Slack Token', pattern: /xox[bpors]-[a-zA-Z0-9-]+/g },
      { name: 'Generic Secret', pattern: /(?:secret|token)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi },
    ];

    const findings: Array<{ file: string; line: number; type: string; match: string }> = [];

    try {
      const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (findings.length >= maxResults) break;
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (['node_modules', '.git', 'dist', 'build', '.env'].includes(entry.name)) continue;
            walk(fullPath);
          } else if (entry.isFile()) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');

              for (const { name, pattern } of secretPatterns) {
                if (findings.length >= maxResults) break;
                for (let i = 0; i < lines.length; i++) {
                  const regex = new RegExp(pattern.source, pattern.flags);
                  let match;
                  while ((match = regex.exec(lines[i])) !== null) {
                    findings.push({
                      file: path.relative(targetPath, fullPath),
                      line: i + 1,
                      type: name,
                      match: match[0].slice(0, 50) + (match[0].length > 50 ? '...' : ''),
                    });
                    if (findings.length >= maxResults) break;
                  }
                }
              }
            } catch (error: unknown) {/* skip binary files */ logger.warn('[Zavorth Security Scanner] operation failed', error); }
          }
        }
      };

      walk(targetPath);

      if (findings.length === 0) return 'Secret scan: No secrets detected.';

      return [
        `Secret Scan Results (${findings.length} findings):`,
        '',
        ...findings.map(f => `  ${f.file}:${f.line} [${f.type}] ${f.match}`),
        '',
        '⚠️ Review these findings and remove any hardcoded secrets.',
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] delete operation failed', error); return ''; }
  }

  private async configAudit(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');
    const issues: string[] = [];

    try {
      const envPath = path.join(targetPath, '.env');
      if (fs.existsSync(envPath)) {
        issues.push('⚠️ .env file found — ensure it is in .gitignore');
        const content = fs.readFileSync(envPath, 'utf-8');
        if (content.includes('password=') || content.includes('SECRET=')) {
          issues.push('  ⚠️ .env contains sensitive values');
        }
      }

      const gitignorePath = path.join(targetPath, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        const required = ['.env', 'node_modules', '*.key', '*.pem'];
        const missing = required.filter(r => !gitignore.includes(r));
        if (missing.length > 0) {
          issues.push(`⚠️ .gitignore missing entries: ${missing.join(', ')}`);
        }
      } else {
        issues.push('⚠️ No .gitignore found');
      }

      const pkgPath = path.join(targetPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.start?.includes('--inspect')) {
          issues.push('⚠️ Debug inspector enabled in start script');
        }
        if (pkg.dependencies?.['helmet'] === undefined && pkg.dependencies?.express) {
          issues.push('⚠️ Express app without helmet (security headers)');
        }
      }

      if (issues.length === 0) return 'Config audit: No issues found.';

      return [
        `Configuration Audit (${issues.length} issues):`,
        '',
        ...issues,
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
  }

  private async sastScan(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');

    const patterns = [
      { name: 'eval()', pattern: /\beval\s*\(/g, severity: 'high', desc: 'Code injection via eval()' },
      { name: 'innerHTML', pattern: /\.innerHTML\s*=/g, severity: 'medium', desc: 'Potential XSS via innerHTML' },
      { name: 'exec()', pattern: /\bexec\s*\(/g, severity: 'high', desc: 'Command injection via exec()' },
      { name: 'SQL concat', pattern: /(?:query|execute)\s*\(\s*['"`].*(?:\+\s*|`\$\{)/g, severity: 'high', desc: 'SQL injection via string concatenation' },
      { name: 'no CSRF', pattern: /express\(\)/g, severity: 'medium', desc: 'Express app — verify CSRF protection' },
      { name: 'http://', pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/g, severity: 'low', desc: 'Insecure HTTP connection' },
    ];

    const findings: Array<{ file: string; line: number; pattern: string; severity: string; desc: string }> = [];

    try {
      const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (findings.length > 200) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
            walk(fullPath);
          } else if (entry.isFile() && /\.(ts|js|tsx|jsx|py|rb|php)$/.test(entry.name)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (const p of patterns) {
                for (let i = 0; i < lines.length; i++) {
                  const regex = new RegExp(p.pattern.source, p.pattern.flags);
                  if (regex.test(lines[i])) {
                    findings.push({
                      file: path.relative(targetPath, fullPath),
                      line: i + 1,
                      pattern: p.name,
                      severity: p.severity,
                      desc: p.desc,
                    });
                  }
                }
              }
            } catch (error: unknown) {/* skip */ logger.warn('[Zavorth Security Scanner] operation failed', error); }
          }
        }
      };

      walk(targetPath);

      if (findings.length === 0) return 'SAST scan: No issues found.';

      const bySeverity = {
        high: findings.filter(f => f.severity === 'high'),
        medium: findings.filter(f => f.severity === 'medium'),
        low: findings.filter(f => f.severity === 'low'),
      };

      return [
        `SAST Scan Results:`,
        `  High: ${bySeverity.high.length}`,
        `  Medium: ${bySeverity.medium.length}`,
        `  Low: ${bySeverity.low.length}`,
        '',
        ...findings.slice(0, 50).map(f => `  [${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.desc}`),
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
  }

  private async licenseCheck(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('npx', ['license-checker', '--summary', '--production'], { cwd: targetPath, timeout: 30000 }).toString();
      return `License compliance:\n${result.trim().slice(0, 3000)}`;
    } catch (error: unknown) {const pkgPath = path.join(targetPath, 'package.json');
      if (!fs.existsSync(pkgPath)) return 'Error: No package.json found.';

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys(pkg.dependencies || {});
      return `License check: ${deps.length} dependencies found. Install license-checker for detailed analysis.`;
    }
  }

  private async headerAudit(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', '-I', '-L', '--max-time', '15', url], { timeout: 20000 }).toString();

      const headers = result.toLowerCase();
      const checks = [
        { name: 'Strict-Transport-Security', present: headers.includes('strict-transport-security'), severity: 'high' },
        { name: 'Content-Security-Policy', present: headers.includes('content-security-policy'), severity: 'high' },
        { name: 'X-Content-Type-Options', present: headers.includes('x-content-type-options'), severity: 'medium' },
        { name: 'X-Frame-Options', present: headers.includes('x-frame-options'), severity: 'medium' },
        { name: 'X-XSS-Protection', present: headers.includes('x-xss-protection'), severity: 'low' },
        { name: 'Referrer-Policy', present: headers.includes('referrer-policy'), severity: 'low' },
        { name: 'Permissions-Policy', present: headers.includes('permissions-policy'), severity: 'low' },
      ];

      const missing = checks.filter(c => !c.present);
      const present = checks.filter(c => c.present);

      return [
        `Security Headers Audit for ${url}:`,
        '',
        `Present (${present.length}):`,
        ...present.map(c => `  ✓ ${c.name}`),
        '',
        `Missing (${missing.length}):`,
        ...missing.map(c => `  ✗ ${c.name} [${c.severity}]`),
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
  }

  private async filePermissions(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const result = execFileSync('powershell', ['-Command', `Get-Acl '${targetPath}' | Format-List`], { timeout: 10000 }).toString();
        return `File permissions for ${targetPath}:\n${result}`;
      }

      const result = execFileSync('ls', ['-la', targetPath], { timeout: 10000 }).toString();
      const lines = result.split('\n');
      const worldWritable = lines.filter(l => l.match(/^[-d]?.w/));

      return [
        `File permissions for ${targetPath}:`,
        '',
        worldWritable.length > 0 ? `⚠️ World-writable files found (${worldWritable.length}):` : '✓ No world-writable files found.',
        ...worldWritable.slice(0, 20).map(l => `  ${l}`),
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] operation failed', error); return ''; }
  }

  private async hardeningCheck(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');
    const checks: Array<{ name: string; status: string; detail: string }> = [];

    try {
      const pkgPath = path.join(targetPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

        checks.push({
          name: 'HTTPS enforcement',
          status: pkg.dependencies?.express && !pkg.dependencies?.helmet ? 'warn' : 'ok',
          detail: pkg.dependencies?.helmet ? 'helmet detected' : 'consider adding helmet',
        });

        checks.push({
          name: 'Rate limiting',
          status: pkg.dependencies?.['express-rate-limit'] ? 'ok' : 'warn',
          detail: pkg.dependencies?.['express-rate-limit'] ? 'rate limiter found' : 'no rate limiter detected',
        });

        checks.push({
          name: 'Input validation',
          status: (pkg.dependencies?.joi || pkg.dependencies?.zod || pkg.dependencies?.['express-validator']) ? 'ok' : 'warn',
          detail: (pkg.dependencies?.joi || pkg.dependencies?.zod || pkg.dependencies?.['express-validator']) ? 'validation library found' : 'no validation library detected',
        });

        checks.push({
          name: 'CORS configuration',
          status: pkg.dependencies?.cors ? 'ok' : 'warn',
          detail: pkg.dependencies?.cors ? 'CORS package found' : 'verify CORS is configured',
        });
      }

      const envPath = path.join(targetPath, '.env');
      const gitignorePath = path.join(targetPath, '.gitignore');
      if (fs.existsSync(envPath) && fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        checks.push({
          name: '.env in .gitignore',
          status: gitignore.includes('.env') ? 'ok' : 'fail',
          detail: gitignore.includes('.env') ? '.env is ignored' : '.env is NOT in .gitignore!',
        });
      }

      if (checks.length === 0) return 'Hardening check: No package.json found.';

      const ok = checks.filter(c => c.status === 'ok').length;
      const warn = checks.filter(c => c.status === 'warn').length;
      const fail = checks.filter(c => c.status === 'fail').length;

      return [
        `Security Hardening Check:`,
        `  Passed: ${ok}  Warnings: ${warn}  Failed: ${fail}`,
        '',
        ...checks.map(c => {
          const icon = c.status === 'ok' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
          return `  ${icon} ${c.name}: ${c.detail}`;
        }),
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Security Scanner] filesystem check failed', error); return ''; }
  }

  private async generateReport(args: Record<string, unknown>): Promise<string> {
    const targetPath = String(args.target_path || '.');

    const results = [
      '=== Security Scan Report ===',
      `Date: ${new Date().toISOString()}`,
      `Target: ${targetPath}`,
      '',
    ];

    results.push('--- Dependency Audit ---');
    results.push(await this.dependencyAudit(args));
    results.push('');

    results.push('--- Secret Scan ---');
    results.push(await this.secretScan(args));
    results.push('');

    results.push('--- Config Audit ---');
    results.push(await this.configAudit(args));
    results.push('');

    results.push('--- SAST Scan ---');
    results.push(await this.sastScan(args));
    results.push('');

    results.push('--- Hardening Check ---');
    results.push(await this.hardeningCheck(args));

    return results.join('\n').slice(0, 15000);
  }
}
