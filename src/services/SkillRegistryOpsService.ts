/**
 * Skill registry ops: sign/verify packages and export a local registry index for CI/CDN dry-run.
 * Production CDN hosting still needs secrets + deploy; this is the code path CI wires to.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  signSkillPackage,
  verifySkillPackageSignature,
  scanSkillForSecurity,
} from '../skills/marketplace/SkillMarketplaceSecurity.js';
import { validateSkillPackage } from '../skills/marketplace/SkillPackageValidator.js';
import {
  assertTrustedGitSource,
  getTrustedSkillGitDomains,
} from '../skills/marketplace/SkillGitRegistry.js';

export const ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA = 'zavorth.skill-registry-index/v1' as const;
export const ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA = 'zavorth.skill-publish-plan/v1' as const;

export type SkillRegistryIndexEntry = {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  relativePath: string;
  signed: boolean;
  signatureMode: string;
  riskLevel: string;
  checksumSha256: string | null;
};

export type SkillRegistryIndex = {
  schemaVersion: typeof ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA;
  generatedAt: string;
  registryBaseUrl: string | null;
  trustedGitDomains: string[];
  skills: SkillRegistryIndexEntry[];
};

/** Dry-run publish plan artifact (never pushes). */
export type SkillPublishPlan = {
  schemaVersion: typeof ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA;
  generatedAt: string;
  dryRun: true;
  wouldPush: boolean;
  ok: boolean;
  skillDir: string;
  skillId: string | null;
  signed: boolean;
  signatureMode: string;
  packageValid: boolean;
  packageErrors: string[];
  riskLevel: string;
  repoUrl: string | null;
  repoAllowed: boolean;
  trustedGitDomains: string[];
  messages: string[];
  nextSteps: string[];
};

export type SkillRegistryOpsRuntime = {
  projectRoot?: string;
  skillsDir?: string;
  now?: () => Date;
};

export class SkillRegistryOpsService {
  private readonly projectRoot: string;
  private readonly skillsDir: string;
  private readonly now: () => Date;

  constructor(runtime: SkillRegistryOpsRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.skillsDir = runtime.skillsDir || path.join(this.projectRoot, 'skills');
    this.now = runtime.now || (() => new Date());
  }

  public listTrustedDomains(env: NodeJS.ProcessEnv = process.env): string[] {
    return getTrustedSkillGitDomains(env);
  }

  public assertRegistryUrl(url: string, env: NodeJS.ProcessEnv = process.env) {
    return assertTrustedGitSource(url, env);
  }

  public sign(skillDir: string, signingKey: string) {
    return signSkillPackage(skillDir, signingKey);
  }

  public verify(skillDir: string) {
    const validation = validateSkillPackage(skillDir);
    const signature = verifySkillPackageSignature(skillDir);
    const security = scanSkillForSecurity(skillDir);
    return {
      path: path.resolve(skillDir),
      packageValid: validation.valid,
      packageErrors: validation.errors,
      signature,
      security: {
        riskLevel: security.riskLevel,
        gpgVerified: security.gpgVerified,
        issues: security.issues.length,
      },
      ok: validation.valid && signature.ok && security.riskLevel !== 'blocked',
    };
  }

  /**
   * Scan skillsDir (one level deep) and build a registry index JSON document.
   */
  public exportIndex(options: {
    registryBaseUrl?: string | null;
    env?: NodeJS.ProcessEnv;
  } = {}): SkillRegistryIndex {
    const env = options.env || process.env;
    const baseUrl =
      String(options.registryBaseUrl || env.ZAVORTH_SKILL_REGISTRY_URL || '').trim() || null;
    if (baseUrl) {
      const trust = assertTrustedGitSource(baseUrl, env);
      if (!trust.ok) {
        throw new Error(trust.message);
      }
    }

    const skills: SkillRegistryIndexEntry[] = [];
    if (fs.existsSync(this.skillsDir)) {
      const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        if (ent.name.startsWith('.')) continue;
        const skillPath = path.join(this.skillsDir, ent.name);
        const skillMd = path.join(skillPath, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;

        const validation = validateSkillPackage(skillPath);
        const signature = verifySkillPackageSignature(skillPath);
        const security = scanSkillForSecurity(skillPath);
        let checksum: string | null = null;
        try {
          checksum = crypto.createHash('sha256').update(fs.readFileSync(skillMd)).digest('hex');
        } catch {
          checksum = null;
        }

        skills.push({
          id: ent.name,
          name: validation.manifest?.name || ent.name,
          version: validation.manifest?.version || null,
          description: validation.manifest?.description || null,
          relativePath: ent.name,
          signed: signature.ok,
          signatureMode: signature.mode,
          riskLevel: security.riskLevel,
          checksumSha256: checksum,
        });
      }
    }

    skills.sort((a, b) => a.id.localeCompare(b.id));

    return {
      schemaVersion: ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA,
      generatedAt: this.now().toISOString(),
      registryBaseUrl: baseUrl,
      trustedGitDomains: getTrustedSkillGitDomains(env),
      skills,
    };
  }

  public writeIndex(
    outputPath: string,
    options: { registryBaseUrl?: string | null; env?: NodeJS.ProcessEnv } = {},
  ): { ok: true; path: string; count: number } | { ok: false; message: string } {
    try {
      const index = this.exportIndex(options);
      const out = path.resolve(outputPath);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(index, null, 2) + '\n', 'utf8');
      return { ok: true, path: out, count: index.skills.length };
    } catch (error: unknown) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Dry-run publish plan for CI/CLI (does not push).
   */
  public planPublish(input: {
    skillDir: string;
    repoUrl?: string | null;
    env?: NodeJS.ProcessEnv;
  }): SkillPublishPlan {
    const env = input.env || process.env;
    const skillDir = path.resolve(input.skillDir);
    const verification = this.verify(skillDir);
    const messages: string[] = [];
    messages.push(verification.signature.message);
    if (!verification.packageValid) {
      messages.push(`package errors: ${verification.packageErrors.join('; ')}`);
    }

    let skillId: string | null = null;
    try {
      const manifestPath = path.join(skillDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: string };
        if (raw?.name) skillId = String(raw.name);
      }
    } catch {
      skillId = null;
    }
    if (!skillId) skillId = path.basename(skillDir);

    let repoAllowed = true;
    const repoUrl = String(input.repoUrl || '').trim() || null;
    if (repoUrl) {
      const trust = assertTrustedGitSource(repoUrl, env);
      repoAllowed = trust.ok;
      messages.push(trust.ok ? `repo allowed: ${repoUrl}` : trust.message);
    } else {
      messages.push('no --repo: local sign/export only (no git push)');
    }

    const ok = verification.ok && repoAllowed;
    const wouldPush = Boolean(repoUrl) && repoAllowed;
    const nextSteps: string[] = [];
    if (!verification.packageValid) {
      nextSteps.push('Fix package validation errors (SKILL.md + manifest.json required fields).');
    }
    if (!verification.signature.ok) {
      nextSteps.push(
        'Sign the package: zavorth skill sign <dir> (ZAVORTH_SKILL_SIGNING_KEY or --key).',
      );
    }
    if (repoUrl && !repoAllowed) {
      nextSteps.push(
        'Use an allowlisted host or add it via ZAVORTH_SKILL_TRUSTED_DOMAINS (operator only).',
      );
    }
    if (ok && wouldPush) {
      nextSteps.push(
        'Operator publish (live push): zavorth skill publish <name> --repo <url>',
      );
      nextSteps.push('Or export index only: zavorth skill registry-export');
    } else if (ok && !repoUrl) {
      nextSteps.push('Export registry index: zavorth skill registry-export');
      nextSteps.push('Optional live publish: zavorth skill publish <name> --repo <trusted-url>');
    }

    return {
      schemaVersion: ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA,
      generatedAt: this.now().toISOString(),
      dryRun: true,
      wouldPush,
      ok,
      skillDir,
      skillId,
      signed: verification.signature.ok,
      signatureMode: verification.signature.mode,
      packageValid: verification.packageValid,
      packageErrors: verification.packageErrors,
      riskLevel: verification.security.riskLevel,
      repoUrl,
      repoAllowed,
      trustedGitDomains: getTrustedSkillGitDomains(env),
      messages,
      nextSteps,
    };
  }

  public writePublishPlan(
    outputPath: string,
    input: { skillDir: string; repoUrl?: string | null; env?: NodeJS.ProcessEnv },
  ):
    | { ok: true; path: string; plan: SkillPublishPlan }
    | { ok: false; message: string; plan?: SkillPublishPlan } {
    try {
      const plan = this.planPublish(input);
      const out = path.resolve(outputPath);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(plan, null, 2) + '\n', 'utf8');
      return { ok: true, path: out, plan };
    } catch (error: unknown) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
