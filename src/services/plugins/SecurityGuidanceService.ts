import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

interface PolicyRule {
  id: string;
  category: string;
  rule: string;
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium';
  owasp_ref?: string;
  example_safe: string;
  example_unsafe: string;
  remediation: string;
}

export class SecurityGuidanceService extends BaseTool {
  public readonly name = 'zavorth_security_guidance';

  public readonly description =
    'Interactive security policy consultation, best practices, OWASP Top 10, and hardening guidance for Zavorth.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'query', 'check_code', 'list_categories', 'owasp_top10', 'hardening', 'audit_checklist'.",
      },
      topic: {
        type: 'string',
        description: 'Security topic to query (e.g., injection, auth, xss, ssrf, secrets).',
      },
      code_snippet: {
        type: 'string',
        description: 'Code snippet for security analysis.',
      },
      language: {
        type: 'string',
        description: "Code language: 'typescript', 'python', 'go', 'rust', 'generic'. Default: 'typescript'.",
      },
    },
    required: ['action'],
  };

  private readonly policies: PolicyRule[] = [
    { id: 'SEC-001', category: 'injection', rule: 'Never interpolate user input into shell commands. Use execFileSync with argument arrays.', severity: 'critical', owasp_ref: 'A03:2021', example_safe: "execFileSync('curl', ['-s', url])", example_unsafe: 'execSync(`curl ${url}`)', remediation: 'Replace execSync with execFileSync using array arguments.' },
    { id: 'SEC-002', category: 'injection', rule: 'Never interpolate user input into SQL queries. Use prepared statements or parameterized queries.', severity: 'critical', owasp_ref: 'A03:2021', example_safe: "db.query('SELECT * FROM users WHERE id = ...', [userId])", example_unsafe: "db.query(`SELECT * FROM users WHERE id = ${userId}`)", remediation: 'Use placeholders (...) or named parameters.' },
    { id: 'SEC-003', category: 'auth', rule: 'Always validate authentication tokens before processing requests. Verify expiration and signature.', severity: 'critical', owasp_ref: 'A07:2021', example_safe: 'verifyJwt(token, secret, { algorithms: ["HS256"] })', example_unsafe: 'if (token) { /* trusted */ }', remediation: 'Use JWT library with signature and expiration verification.' },
    { id: 'SEC-004', category: 'xss', rule: 'Always escape user output before rendering in HTML. Use appropriate escape functions.', severity: 'critical', owasp_ref: 'A03:2021', example_safe: 'escapeHtml(userInput)', example_unsafe: '`<div>${userInput}</div>`', remediation: 'Use HTML escape libraries or frameworks that auto-escape.' },
    { id: 'SEC-005', category: 'ssrf', rule: 'Validate input URLs against allowlist of trusted domains before making requests.', severity: 'high', owasp_ref: 'A10:2021', example_safe: 'if (!trustedDomains.includes(parsed.hostname)) throw', example_unsafe: 'fetch(userProvidedUrl)', remediation: 'Validate hostname against allowlist. Block private IPs and localhost.' },
    { id: 'SEC-006', category: 'secrets', rule: 'Never hardcode secrets, API keys, or tokens in code. Use environment variables or secret managers.', severity: 'critical', owasp_ref: 'A02:2021', example_safe: "process.env.API_KEY", example_unsafe: "const key = 'sk-1234...'", remediation: 'Move to .env, vault, or secret manager. Add .env to .gitignore.' },
    { id: 'SEC-007', category: 'path-traversal', rule: 'Validate that file paths do not escape the workspace. Use path.resolve and verify prefix.', severity: 'high', owasp_ref: 'A01:2021', example_safe: "if (!resolved.startsWith(workspaceRoot)) throw", example_unsafe: 'fs.readFileSync(userPath)', remediation: 'Use path.resolve and validate against workspace root.' },
    { id: 'SEC-008', category: 'deserialization', rule: 'Never use JSON.parse on user input without validation. Strip __proto__, constructor, prototype.', severity: 'high', owasp_ref: 'A08:2021', example_safe: 'sanitize(JSON.parse(input))', example_unsafe: 'Object.assign(target, JSON.parse(input))', remediation: 'Sanitize parsed data removing dangerous keys.' },
    { id: 'SEC-009', category: 'rate-limiting', rule: 'Implement rate limiting on public endpoints to prevent abuse and DoS.', severity: 'medium', owasp_ref: 'A04:2021', example_safe: 'rateLimiter.check(ip, 100, "1m")', example_unsafe: 'app.post("/api", handler)', remediation: 'Use rate limiting middleware with sliding window.' },
    { id: 'SEC-010', category: 'cors', rule: 'Configure restrictive CORS. Never use Access-Control-Allow-Origin: * in production.', severity: 'medium', owasp_ref: 'A05:2021', example_safe: "cors({ origin: ['https://app.example.com'] })", example_unsafe: "cors({ origin: '*' })", remediation: 'Specify allowed origins explicitly.' },
    { id: 'SEC-011', category: 'headers', rule: 'Configure security headers: CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security.', severity: 'medium', owasp_ref: 'A05:2021', example_safe: "helmet({ contentSecurityPolicy: true })", example_unsafe: 'no security headers', remediation: 'Use helmet.js or configure headers manually.' },
    { id: 'SEC-012', category: 'logging', rule: 'Never log sensitive data (passwords, tokens, PII). Use automatic redaction in logs.', severity: 'medium', owasp_ref: 'A09:2021', example_safe: 'logger.info("login", { user: redact(email) })', example_unsafe: 'logger.info("login", { password })', remediation: 'Implement PII redaction in all logs.' },
    { id: 'SEC-013', category: 'dependencies', rule: 'Audit dependencies regularly for CVEs. Use npm audit, Snyk, or Dependabot.', severity: 'medium', owasp_ref: 'A06:2021', example_safe: 'npm audit --production', example_unsafe: 'npm install without verification', remediation: 'Run npm audit in CI/CD and fix vulnerabilities.' },
    { id: 'SEC-014', category: 'input-validation', rule: 'Validate all user input on the server. Never trust only client-side validation.', severity: 'high', owasp_ref: 'A03:2021', example_safe: 'schema.parse(userInput)', example_unsafe: 'const data = req.body', remediation: 'Use zod, joi, or yup for schema validation.' },
    { id: 'SEC-015', category: 'encryption', rule: 'Use TLS for all communications. Never transmit sensitive data in plaintext.', severity: 'critical', owasp_ref: 'A02:2021', example_safe: 'https://api.example.com', example_unsafe: 'http://api.example.com', remediation: 'Force HTTPS. Use HSTS. Valid certificates.' },
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'query': return this.queryPolicy(args);
      case 'check_code': return this.checkCode(args);
      case 'list_categories': return this.listCategories();
      case 'owasp_top10': return this.owasTop10();
      case 'hardening': return this.hardeningGuide();
      case 'audit_checklist': return this.auditChecklist();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private queryPolicy(args: Record<string, unknown>): string {
    const topic = String(args.topic || '').toLowerCase();
    if (!topic) return 'Error: "topic" is required. for query.';

    const matched = this.policies.filter((p) =>
      p.category.includes(topic) ||
      p.rule.toLowerCase().includes(topic) ||
      (p.owasp_ref && p.owasp_ref.toLowerCase().includes(topic))
    );

    if (matched.length === 0) {
      return `No policies found for "${topic}". Use "list_categories" to see available categories.`;
    }

    const lines: string[] = [`Security policies for "${topic}" (${matched.length} found):`];
    for (const p of matched) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', warning: '⚠️', info: 'ℹ️' }[p.severity];
      lines.push('');
      lines.push(`${icon} ${p.id} [${p.category}]${p.owasp_ref ? ` (${p.owasp_ref})` : ''}`);
      lines.push(`  Rule: ${p.rule}`);
      lines.push(`  ✅ Safe: ${p.example_safe}`);
      lines.push(`  ❌ Unsafe: ${p.example_unsafe}`);
      lines.push(`  Remediation: ${p.remediation}`);
    }
    return lines.join('\n');
  }

  private checkCode(args: Record<string, unknown>): string {
    const code = String(args.code_snippet || '');
    if (!code) return 'Error: "code_snippet" is required.';

    const issues: Array<{ policy: PolicyRule; match: string }> = [];

    if (/execSync\s*\(/.test(code) && /\$\{|`\s*\+|\+\s*`/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-001')!, match: 'execSync with interpolation detected' });
    }

    if (/query\s*\([^)]*\$\{|query\s*\([^)]*`\+/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-002')!, match: 'Potential SQL injection' });
    }

    if (/(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]+['"]/i.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-006')!, match: 'Hardcoded secret detected' });
    }

    if (/\.innerHTML\s*=|dangerouslySetInnerHTML/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-004')!, match: 'Potential XSS via innerHTML' });
    }

    if (/fetch\s*\(\s*[a-zA-Z]/.test(code) && !/trusted|validated|allowed/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-005')!, match: 'Potential SSRF without URL validation' });
    }

    if (/JSON\.parse\s*\([^)]*\)/.test(code) && !/sanitize|validate|strip/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-008')!, match: 'JSON.parse without sanitization' });
    }

    if (/readFileSync\s*\([^)]*\+|readFile\s*\([^)]*\+/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-007')!, match: 'Potential path traversal' });
    }

    if (/\bhttp:\/\//.test(code) && !/localhost|127\.0\.0\.1/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-015')!, match: 'Non-HTTPS HTTP detected' });
    }

    if (issues.length === 0) {
      return 'No obvious security problem detected in the code snippet.';
    }

    const lines: string[] = [`⚠️ ${issues.length} security problem(s) detected:`];
    for (const { policy, match } of issues) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', warning: '⚠️', info: 'ℹ️' }[policy.severity];
      lines.push(`\n${icon} ${policy.id}: ${match}`);
      lines.push(`  Rule: ${policy.rule}`);
      lines.push(`  Remediation: ${policy.remediation}`);
    }
    return lines.join('\n');
  }

  private listCategories(): string {
    const categories = new Set(this.policies.map((p) => p.category));
    const lines: string[] = ['Available security categories:'];
    for (const cat of [...categories].sort()) {
      const count = this.policies.filter((p) => p.category === cat).length;
      lines.push(`  ${cat}: ${count} policy(ies)`);
    }
    return lines.join('\n');
  }

  private owasTop10(): string {
    return [
      'OWASP Top 10 (2021):',
      '',
      '  A01:2021 — Broken Access Control',
      '  A02:2021 — Cryptographic Failures',
      '  A03:2021 — Injection (SQL, XSS, Command)',
      '  A04:2021 — Insecure Design',
      '  A05:2021 — Security Misconfiguration',
      '  A06:2021 — Vulnerable and Outdated Components',
      '  A07:2021 — Identification and Authentication Failures',
      '  A08:2021 — Software and Data Integrity Failures',
      '  A09:2021 — Security Logging and Monitoring Failures',
      '  A10:2021 — Server-Side Request Forgery (SSRF)',
      '',
      'Use "query" with the ID (e.g., A03:2021) for details.',
    ].join('\n');
  }

  private hardeningGuide(): string {
    return [
      'Zavorth Hardening Guide:',
      '',
      '1. EXECUTION: Use execFileSync with arrays, never execSync with strings',
      '2. INPUT: Validate all input with schema (zod/joi). Sanitize paths.',
      '3. SECRETS: Environment variables, never hardcoded. Rotate periodically.',
      '4. NETWORK: HTTPS required. Restrictive CORS. Rate limiting.',
      '5. DEPENDENCIES: npm audit in CI. Update regularly. Lock files.',
      '6. LOGS: Never log passwords/tokens. PII redaction.',
      '7. AUTHENTICATION: JWT with verification. Short expiration. Refresh tokens.',
      '8. SANDBOX: Isolate code execution in containers/sandboxes.',
      '9. APPROVAL: Destructive actions require explicit approval.',
      '10. RECEIPTS: Every action generates an auditable receipt.',
    ].join('\n');
  }

  private auditChecklist(): string {
    const lines: string[] = ['Security Audit Checklist:', ''];
    for (const p of this.policies) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', warning: '⚠️', info: 'ℹ️' }[p.severity];
      lines.push(`  [ ] ${icon} ${p.id}: ${p.category} — ${p.rule.slice(0, 80)}`);
    }
    return lines.join('\n');
  }
}
