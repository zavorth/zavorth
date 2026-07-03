/**
 * Secrets Validator — FASE-01 Security Hardening
 *
 * Validates that required secrets are configured with strong values.
 * Called during server initialization (fail-fast on missing or weak secrets).
 *
 * @module secretsValidator
 */

interface SecretRule {
  name: string;
  minLength: number;
  required: boolean;
  description: string;
  generateHint: string;
}

interface ValidationIssue {
  name: string;
  issue: string;
  hint: string;
}

interface ValidationWarning {
  name: string;
  issue: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
}

interface Logger {
  warn(message: string): void;
  error(message: string): void;
}

const KNOWN_WEAK_SECRETS: string[] = [
  "ZavorthGateway-default-secret-change-me",
  "change-me-to-a-long-random-secret",
  "endpoint-proxy-api-key-secret",
  "change-me-storage-encryption-key",
  "your-secret-here",
  "secret",
  "password",
  "changeme",
];

const SECRET_RULES: SecretRule[] = [
  {
    name: "JWT_SECRET",
    minLength: 32,
    required: false,
    description: "JWT signing secret for zavorthControl authentication (auto-generated if not set)",
    generateHint: "openssl rand -base64 48",
  },
  {
    name: "API_KEY_SECRET",
    minLength: 16,
    required: true,
    description: "HMAC secret for API key CRC generation",
    generateHint: "openssl rand -hex 32",
  },
];

/**
 * Validate all required secrets.
 */
export function validateSecrets(): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  for (const rule of SECRET_RULES) {
    const value = process.env[rule.name];

    // Missing entirely
    if (!value || value.trim() === "") {
      if (rule.required) {
        errors.push({
          name: rule.name,
          issue: `Required environment variable "${rule.name}" is not set.`,
          hint: `Generate with: ${rule.generateHint}`,
        });
      }
      continue;
    }

    // Too short
    if (value.length < rule.minLength) {
      errors.push({
        name: rule.name,
        issue: `"${rule.name}" is too short (${value.length} chars, minimum ${rule.minLength}).`,
        hint: `Generate with: ${rule.generateHint}`,
      });
      continue;
    }

    // Known weak value
    if (KNOWN_WEAK_SECRETS.includes(value.toLowerCase())) {
      warnings.push({
        name: rule.name,
        issue: `"${rule.name}" appears to use a default/weak value. Please generate a strong secret.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate secrets and terminate process if critical ones are missing.
 * Should be called during server initialization (fail-fast).
 */
export function enforceSecrets(logger: Logger = console): void {
  const result = validateSecrets();

  // Print warnings (non-fatal)
  for (const w of result.warnings) {
    logger.warn(`⚠️  [SECURITY] ${w.issue}`);
  }

  // If there are errors, print them and exit
  if (!result.valid) {
    logger.error("");
    logger.error("═══════════════════════════════════════════════════");
    logger.error("  ❌  SECURITY: Missing required secrets");
    logger.error("═══════════════════════════════════════════════════");
    for (const e of result.errors) {
      logger.error(`  • ${e.issue}`);
      logger.error(`    → ${e.hint}`);
    }
    logger.error("");
    logger.error("  Set these in your .env file or environment.");
    logger.error("  See .env.example for reference.");
    logger.error("═══════════════════════════════════════════════════");
    logger.error("");
    throw new Error(`Missing required secrets: ${result.errors.map((e) => e.issue).join(', ')}`);
  }
}
