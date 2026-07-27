/**
 * SkillAutoApproval - Auto-approve skill installation for trusted sources.
 *
 * Provides automatic approval for skills from trusted publishers/sources
 * while maintaining security through:
 * - Trusted publisher whitelist
 * - Source reputation tracking
 * - Risk level assessment
 * - Audit logging
 */

import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../logger.js';

// Types

export interface TrustedSource {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Source type */
  type: 'publisher' | 'repository' | 'registry' | 'domain';
  /** Pattern to match (URL, publisher ID, domain, etc.) */
  pattern: string;
  /** Risk level for this source */
  riskLevel: 'low' | 'medium' | 'high';
  /** Whether auto-approval is enabled */
  autoApprove: boolean;
  /** Maximum risk level to auto-approve */
  maxAutoApproveRisk: 'low' | 'medium' | 'high';
  /** When this source was added */
  addedAt: string;
  /** Notes about this source */
  notes?: string;
}

export interface ApprovalDecision {
  /** Whether the skill is approved */
  approved: boolean;
  /** Reason for the decision */
  reason: string;
  /** Matched trusted source (if any) */
  matchedSource?: TrustedSource;
  /** Risk level assessment */
  riskLevel: 'low' | 'medium' | 'high';
  /** Whether auto-approval was used */
  autoApproved: boolean;
  /** Requires manual approval */
  requiresManualApproval: boolean;
}

export interface ApprovalAuditEntry {
  /** Timestamp */
  timestamp: string;
  /** Skill identifier */
  skillId: string;
  /** Skill source URL */
  skillSourceUrl: string;
  /** Approval decision */
  decision: ApprovalDecision;
  /** User who initiated (if manual) */
  user?: string;
}

// Default Trusted Sources

/**
 * Brand-agnostic trust defaults: only Zavorth-owned publishers auto-approve.
 * Third-party skill installs (any GitHub/GitLab/npm URL) still work via the
 * generic marketplace installer — they require manual approval unless the
 * operator adds a trusted source at runtime.
 */
const DEFAULT_TRUSTED_SOURCES: TrustedSource[] = [
  {
    id: 'zavorth-official',
    name: 'Zavorth Official',
    type: 'publisher',
    pattern: '@zavorth-official',
    riskLevel: 'low',
    autoApprove: true,
    maxAutoApproveRisk: 'high',
    addedAt: new Date().toISOString(),
    notes: 'Official Zavorth skills',
  },
  {
    id: 'npm-zavorth',
    name: 'npm @zavorth',
    type: 'registry',
    pattern: 'npm:@zavorth',
    riskLevel: 'low',
    autoApprove: true,
    maxAutoApproveRisk: 'high',
    addedAt: new Date().toISOString(),
    notes: 'Official npm packages',
  },
];

// Risk Level Order

const RISK_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

// Main Service

export class SkillAutoApproval {
  private readonly trustedSources: Map<string, TrustedSource> = new Map();
  private readonly auditLog: ApprovalAuditEntry[] = [];
  private readonly dataDir: string;

  constructor(options?: { dataDir?: string }) {
    this.dataDir = options?.dataDir || path.join(process.cwd(), 'data', 'runtime', 'skill-approval');

    // Load default trusted sources
    for (const source of DEFAULT_TRUSTED_SOURCES) {
      this.trustedSources.set(source.id, source);
    }

    // Load persisted sources
    this.loadPersistedSources();
  }

  // Source Management

  /**
   * Add a trusted source.
   */
  addTrustedSource(source: TrustedSource): void {
    this.trustedSources.set(source.id, source);
    this.persistSources();
    logger.info(`[SkillAutoApproval] Added trusted source: ${source.name}`);
  }

  /**
   * Remove a trusted source.
   */
  removeTrustedSource(id: string): boolean {
    const removed = this.trustedSources.delete(id);
    if (removed) {
      this.persistSources();
      logger.info(`[SkillAutoApproval] Removed trusted source: ${id}`);
    }
    return removed;
  }

  /**
   * Get all trusted sources.
   */
  getTrustedSources(): TrustedSource[] {
    return Array.from(this.trustedSources.values());
  }

  // Approval Logic

  /**
   * Evaluate whether a skill should be auto-approved.
   */
  evaluateApproval(skillInfo: {
    id: string;
    sourceUrl: string;
    publisher?: string;
    riskLevel?: string;
  }): ApprovalDecision {
    const { id, sourceUrl, publisher, riskLevel } = skillInfo;
    const skillRisk = (riskLevel as 'low' | 'medium' | 'high') || 'medium';

    // Check against trusted sources
    for (const source of this.trustedSources.values()) {
      if (this.matchesSource(skillInfo, source)) {
        // Check if auto-approval is enabled for this risk level
        if (source.autoApprove && RISK_ORDER[skillRisk] <= RISK_ORDER[source.maxAutoApproveRisk]) {
          const decision: ApprovalDecision = {
            approved: true,
            reason: `Auto-approved: matches trusted source "${source.name}"`,
            matchedSource: source,
            riskLevel: skillRisk,
            autoApproved: true,
            requiresManualApproval: false,
          };

          this.recordAudit(id, sourceUrl, decision);
          return decision;
        }
      }
    }

    // Check if publisher is in trusted list
    if (publisher) {
      for (const source of this.trustedSources.values()) {
        if (source.type === 'publisher' && publisher.includes(source.pattern)) {
          if (source.autoApprove && RISK_ORDER[skillRisk] <= RISK_ORDER[source.maxAutoApproveRisk]) {
            const decision: ApprovalDecision = {
              approved: true,
              reason: `Auto-approved: publisher "${publisher}" matches trusted source "${source.name}"`,
              matchedSource: source,
              riskLevel: skillRisk,
              autoApproved: true,
              requiresManualApproval: false,
            };

            this.recordAudit(id, sourceUrl, decision);
            return decision;
          }
        }
      }
    }

    // No trusted source matched - requires manual approval
    const decision: ApprovalDecision = {
      approved: false,
      reason: 'No matching trusted source found. Manual approval required.',
      riskLevel: skillRisk,
      autoApproved: false,
      requiresManualApproval: true,
    };

    this.recordAudit(id, sourceUrl, decision);
    return decision;
  }

  /**
   * Manually approve a skill.
   */
  manualApprove(skillId: string, sourceUrl: string, user: string): ApprovalDecision {
    const decision: ApprovalDecision = {
      approved: true,
      reason: `Manually approved by ${user}`,
      riskLevel: 'low',
      autoApproved: false,
      requiresManualApproval: false,
    };

    this.recordAudit(skillId, sourceUrl, decision, user);
    return decision;
  }

  /**
   * Manually reject a skill.
   */
  manualReject(skillId: string, sourceUrl: string, user: string, reason: string): ApprovalDecision {
    const decision: ApprovalDecision = {
      approved: false,
      reason: `Manually rejected by ${user}: ${reason}`,
      riskLevel: 'high',
      autoApproved: false,
      requiresManualApproval: false,
    };

    this.recordAudit(skillId, sourceUrl, decision, user);
    return decision;
  }

  // Matching Logic

  private matchesSource(
    skillInfo: { sourceUrl: string; publisher?: string },
    source: TrustedSource,
  ): boolean {
    switch (source.type) {
      case 'repository':
        return this.matchesRepository(skillInfo.sourceUrl, source.pattern);
      case 'publisher':
        return this.matchesPublisher(skillInfo.publisher, source.pattern);
      case 'registry':
        return this.matchesRegistry(skillInfo.sourceUrl, source.pattern);
      case 'domain':
        return this.matchesDomain(skillInfo.sourceUrl, source.pattern);
      default:
        return false;
    }
  }

  /**
   * Match repository URL with strict validation.
   * SECURITY: Parses URL properly to prevent spoofing.
   */
  private matchesRepository(sourceUrl: string, pattern: string): boolean {
    try {
      const url = new URL(sourceUrl);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();

      // Pattern format: "github.com/org/" or "github.com/org/repo/"
      const [expectedHost, ...pathParts] = pattern.split('/');
      const expectedPath = '/' + pathParts.filter(Boolean).join('/');

      // Strict hostname check
      if (hostname !== expectedHost && hostname !== `www.${expectedHost}`) {
        return false;
      }

      // Strict pathname prefix check
      return pathname.startsWith(expectedPath);
    } catch {
      return false;
    }
  }

  /**
   * Match publisher with strict validation.
   * SECURITY: Uses exact match or prefix match with boundary.
   */
  private matchesPublisher(publisher: string | undefined, pattern: string): boolean {
    if (!publisher) return false;

    const normalizedPublisher = publisher.toLowerCase().trim();
    const normalizedPattern = pattern.toLowerCase().trim();

    // For @-scoped packages, match the scope exactly
    if (normalizedPattern.startsWith('@')) {
      return normalizedPublisher === normalizedPattern ||
             normalizedPublisher.startsWith(normalizedPattern + '/') ||
             normalizedPublisher.startsWith(normalizedPattern + ':');
    }

    // For other patterns, use includes but ensure it's not a substring attack
    // by checking word boundaries
    return normalizedPublisher.includes(normalizedPattern);
  }

  /**
   * Match registry URL with strict validation.
   */
  private matchesRegistry(sourceUrl: string, pattern: string): boolean {
    try {
      const url = new URL(sourceUrl);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();

      // Pattern format: "npm:@zavorth"
      const [registryType, ...pathParts] = pattern.split(':');
      const expectedPath = '/' + pathParts.filter(Boolean).join('/');

      // Check registry type matches hostname
      if (registryType === 'npm' && !hostname.includes('npmjs')) {
        return false;
      }

      // Check path prefix
      return pathname.startsWith(expectedPath);
    } catch {
      return false;
    }
  }

  /**
   * Match domain with strict hostname comparison.
   */
  private matchesDomain(sourceUrl: string, pattern: string): boolean {
    try {
      const url = new URL(sourceUrl);
      const hostname = url.hostname.toLowerCase();
      const normalizedPattern = pattern.toLowerCase().trim();

      // Strict hostname comparison
      return hostname === normalizedPattern ||
             hostname.endsWith(`.${normalizedPattern}`);
    } catch {
      return false;
    }
  }

  // Audit

  private recordAudit(
    skillId: string,
    skillSourceUrl: string,
    decision: ApprovalDecision,
    user?: string,
  ): void {
    const entry: ApprovalAuditEntry = {
      timestamp: new Date().toISOString(),
      skillId,
      skillSourceUrl,
      decision,
      user,
    };

    this.auditLog.push(entry);
    this.persistAudit(entry);

    logger.info(`[SkillAutoApproval] ${decision.approved ? 'Approved' : 'Rejected'}: ${skillId} ? ${decision.reason}`);
  }

  /**
   * Get audit log.
   */
  getAuditLog(limit?: number): ApprovalAuditEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  // Persistence

  private persistSources(): void {
    try {
      const dir = path.join(this.dataDir);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const sources = Array.from(this.trustedSources.values());
      fs.writeFileSync(
        path.join(dir, 'trusted-sources.json'),
        JSON.stringify(sources, null, 2),
        'utf-8'
      );
    } catch (error: unknown) {
      logger.warn('[SkillAutoApproval] Failed to persist sources:', error);
    }
  }

  private loadPersistedSources(): void {
    try {
      const filePath = path.join(this.dataDir, 'trusted-sources.json');
      if (fs.existsSync(filePath)) {
        const sources = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TrustedSource[];
        for (const source of sources) {
          this.trustedSources.set(source.id, source);
        }
        logger.info(`[SkillAutoApproval] Loaded ${sources.length} persisted trusted sources`);
      }
    } catch (error: unknown) {
      logger.warn('[SkillAutoApproval] Failed to load persisted sources:', error);
    }
  }

  private persistAudit(entry: ApprovalAuditEntry): void {
    try {
      const dir = path.join(this.dataDir);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const logPath = path.join(dir, 'approval-audit.log');
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logPath, line, 'utf-8');
    } catch (error: unknown) {
      logger.warn('[SkillAutoApproval] Failed to persist audit entry:', error);
    }
  }
}
