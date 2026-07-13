/**
 * Evidence-based skill trust (no competitor brand allowlists).
 *
 * Profiles:
 * - safe: local / signed / Zavorth-owned only; remote first-seen denied without force
 * - daily: remote ok with preview + min score; consent for first-seen domains
 * - power: operator profile; lower floor; still receipts; force optional
 *
 * Owner may add trusted domains/publishers at runtime (generic patterns).
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthSkillSourceKind,
  ZavorthSkillTrustScore,
  ZavorthTrustScoreBand,
} from '../contracts/skill/ZavorthSkillWorkerMeshContract.js';

export type SkillTrustProfileId = 'safe' | 'daily' | 'power';

export type SkillTrustEvidence = {
  sourceRaw: string;
  sourceKind: ZavorthSkillSourceKind;
  local: boolean;
  validPackage: boolean;
  hasSkillMd: boolean;
  hasManifest: boolean;
  /** From package validator / security scan */
  securityRisk: 'low' | 'medium' | 'high' | 'blocked' | 'unknown';
  /** manifest.checksum present and matches (when validated) */
  checksumPinned?: boolean;
  /** Optional gpg / signature flag from security scan */
  signatureVerified?: boolean;
  secretLikePresent?: boolean;
  /** Author / publisher fields from manifest (presence only) */
  author?: string | null;
  publisher?: string | null;
  /** Optional low-weight public metrics (never sole decider) */
  publicStars?: number | null;
};

export type SkillTrustPolicyDecision = {
  profile: SkillTrustProfileId;
  score: ZavorthSkillTrustScore;
  /** Materialize allowed under this profile (ignoring consent). */
  allowApply: boolean;
  /** Human must pass consent=true (unless autoConsentEligible). */
  requireConsent: boolean;
  /** May apply without explicit consent when policy says so. */
  autoConsentEligible: boolean;
  reasons: string[];
};

export type OwnerTrustedEntry = {
  id: string;
  kind: 'domain' | 'publisher' | 'registry-prefix';
  /** e.g. github.com/myorg/ or @my-org or npm:@my-scope */
  pattern: string;
  addedAt: string;
  notes?: string;
};

export type SkillTrustScoreServiceRuntime = {
  projectRoot?: string;
  storePath?: string;
  profile?: SkillTrustProfileId | string | null;
  now?: () => Date;
};

const PROFILE_DEFAULTS: Record<
  SkillTrustProfileId,
  { minScoreApply: number; minScoreAuto: number; allowRemote: boolean; remoteFirstSeenRequiresConsent: boolean }
> = {
  safe: {
    minScoreApply: 0.55,
    minScoreAuto: 0.85,
    allowRemote: false,
    remoteFirstSeenRequiresConsent: true,
  },
  daily: {
    minScoreApply: 0.4,
    minScoreAuto: 0.75,
    allowRemote: true,
    remoteFirstSeenRequiresConsent: true,
  },
  power: {
    minScoreApply: 0.25,
    minScoreAuto: 0.7,
    allowRemote: true,
    remoteFirstSeenRequiresConsent: false,
  },
};

/** Official Zavorth patterns only (product-owned, not third-party brands). */
const ZAVORTH_OWNED_PATTERNS = [
  '@zavorth-official',
  '@zavorth',
  'npm:@zavorth',
  'zavorth-official',
  'zavorth-core',
  'author:zavorth',
];

export class SkillTrustScoreService {
  private readonly storePath: string;
  private readonly now: () => Date;
  private readonly profile: SkillTrustProfileId;
  private ownerTrusted: OwnerTrustedEntry[] = [];

  constructor(runtime: SkillTrustScoreServiceRuntime = {}) {
    const root = runtime.projectRoot || process.cwd();
    this.storePath =
      runtime.storePath ||
      path.join(root, 'data', 'runtime', 'skill-trust', 'owner-trusted.json');
    this.now = runtime.now || (() => new Date());
    this.profile = normalizeProfile(
      runtime.profile || process.env.ZAVORTH_SKILL_TRUST_PROFILE || 'daily',
    );
    this.loadOwnerTrusted();
  }

  public getProfile(): SkillTrustProfileId {
    return this.profile;
  }

  public listOwnerTrusted(): OwnerTrustedEntry[] {
    return [...this.ownerTrusted];
  }

  public addOwnerTrusted(input: {
    kind: OwnerTrustedEntry['kind'];
    pattern: string;
    notes?: string;
    id?: string;
  }): OwnerTrustedEntry {
    const pattern = String(input.pattern || '').trim().toLowerCase();
    if (!pattern) {
      throw new Error('pattern is required');
    }
    const id =
      String(input.id || '').trim() ||
      `owner-${input.kind}-${pattern.replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
    const entry: OwnerTrustedEntry = {
      id,
      kind: input.kind,
      pattern,
      addedAt: this.now().toISOString(),
      notes: input.notes,
    };
    this.ownerTrusted = this.ownerTrusted.filter((e) => e.id !== id && e.pattern !== pattern);
    this.ownerTrusted.push(entry);
    this.persistOwnerTrusted();
    return entry;
  }

  public removeOwnerTrusted(idOrPattern: string): boolean {
    const key = String(idOrPattern || '').trim().toLowerCase();
    const before = this.ownerTrusted.length;
    this.ownerTrusted = this.ownerTrusted.filter(
      (e) => e.id.toLowerCase() !== key && e.pattern.toLowerCase() !== key,
    );
    if (this.ownerTrusted.length !== before) {
      this.persistOwnerTrusted();
      return true;
    }
    return false;
  }

  /**
   * Pure scoring from evidence — no network, no brand competitors.
   */
  public score(evidence: SkillTrustEvidence): ZavorthSkillTrustScore {
    let score = 0.12;
    const reasons: string[] = [];
    const signals: ZavorthSkillTrustScore['signals'] = [];

    const push = (id: string, present: boolean, weight: number, reason?: string) => {
      signals.push({ id, present, weight });
      if (present && reason) reasons.push(reason);
    };

    // Structure
    if (evidence.hasSkillMd) {
      score += 0.12;
      push('skill_md', true, 1, 'SKILL.md present');
    } else {
      push('skill_md', false, 1);
    }
    if (evidence.hasManifest) {
      score += 0.12;
      push('manifest', true, 1, 'manifest present');
    } else {
      push('manifest', false, 1);
    }
    if (evidence.validPackage) {
      score += 0.18;
      push('valid_package', true, 2, 'valid package structure');
    } else {
      push('valid_package', false, 2);
      reasons.push('package incomplete or invalid');
    }

    // Local vs remote
    if (evidence.local) {
      score += 0.18;
      push('local_path', true, 2, 'local source');
    } else {
      push('local_path', false, 2);
      reasons.push('remote source');
      score += 0.02;
    }

    // Checksum / signature (high weight)
    if (evidence.checksumPinned) {
      score += 0.14;
      push('checksum_pinned', true, 3, 'checksum pinned');
    } else {
      push('checksum_pinned', false, 3);
    }
    if (evidence.signatureVerified) {
      score += 0.16;
      push('signature_verified', true, 3, 'signature verified');
    } else {
      push('signature_verified', false, 3);
    }

    // Security scan
    const risk = evidence.securityRisk || 'unknown';
    if (risk === 'low') {
      score += 0.12;
      push('scan_clean', true, 2, 'security scan low risk');
    } else if (risk === 'medium') {
      score = Math.min(score, 0.58);
      push('scan_clean', false, 2);
      reasons.push('security medium risk');
    } else if (risk === 'high') {
      score = Math.min(score, 0.38);
      push('scan_clean', false, 2);
      reasons.push('security high risk');
    } else if (risk === 'blocked') {
      score = Math.min(score, 0.12);
      push('scan_clean', false, 3);
      reasons.push('security blocked');
    } else {
      push('scan_clean', false, 1);
      reasons.push('security not fully assessed');
    }

    if (evidence.secretLikePresent) {
      score = Math.min(score, 0.42);
      push('secret_like', true, 2, 'secret-like paths or hints (presence only)');
      reasons.push('secret-like material present (not values)');
    } else {
      push('secret_like', false, 1);
    }

    // Zavorth-owned (product) — not third-party brands
    const zavorthOwned = this.isZavorthOwned(evidence);
    if (zavorthOwned) {
      score += 0.2;
      push('zavorth_owned', true, 3, 'Zavorth-owned publisher/author pattern');
    } else {
      push('zavorth_owned', false, 1);
    }

    // Owner-trusted domain/publisher (generic runtime list)
    const ownerHit = this.matchOwnerTrusted(evidence);
    if (ownerHit) {
      score += 0.15;
      push('owner_trusted', true, 2, `owner-trusted: ${ownerHit.kind} ${ownerHit.pattern}`);
    } else {
      push('owner_trusted', false, 1);
      if (!evidence.local && !zavorthOwned) {
        push('first_seen_domain', true, 1);
        reasons.push('first-seen or untrusted remote identity');
      } else {
        push('first_seen_domain', false, 1);
      }
    }

    // Public stars: low weight only
    const stars = Number(evidence.publicStars || 0);
    if (Number.isFinite(stars) && stars > 0) {
      const bump = Math.min(0.05, Math.log10(stars + 1) / 40);
      score += bump;
      push('public_stars', true, 0.5, 'public stars (low weight)');
    } else {
      push('public_stars', false, 0.5);
    }

    score = Math.max(0, Math.min(1, score));
    const band = bandFromScore(score, risk);
    return {
      score,
      band,
      reasons: dedupe(reasons),
      signals,
    };
  }

  /**
   * Combine score + profile into apply/consent decision.
   */
  public evaluate(
    evidence: SkillTrustEvidence,
    options: { profile?: SkillTrustProfileId } = {},
  ): SkillTrustPolicyDecision {
    const profile = options.profile || this.profile;
    const defaults = PROFILE_DEFAULTS[profile];
    const score = this.score(evidence);
    const reasons: string[] = [`profile=${profile}`, ...score.reasons];
    const zavorthOwned = this.isZavorthOwned(evidence);
    const ownerHit = this.matchOwnerTrusted(evidence);

    let allowApply = score.score >= defaults.minScoreApply && score.band !== 'deny';
    let requireConsent = true;
    let autoConsentEligible = false;

    if (evidence.securityRisk === 'blocked') {
      allowApply = false;
      reasons.push('blocked by security scan');
    }

    if (!evidence.local && !defaults.allowRemote && !zavorthOwned && !ownerHit) {
      allowApply = false;
      reasons.push('safe profile rejects untrusted remote sources');
    }

    // First-seen remote under daily/safe always needs consent
    const firstSeenRemote =
      !evidence.local && !zavorthOwned && !ownerHit && defaults.remoteFirstSeenRequiresConsent;
    if (firstSeenRemote) {
      requireConsent = true;
      autoConsentEligible = false;
      reasons.push('first-seen remote requires explicit consent');
    }

    // Auto-consent only by policy/score — never by competitor brand strings
    if (
      allowApply &&
      score.band !== 'deny' &&
      score.band !== 'review' &&
      score.score >= defaults.minScoreAuto &&
      evidence.securityRisk !== 'high' &&
      evidence.securityRisk !== 'blocked' &&
      (zavorthOwned ||
        ownerHit ||
        (evidence.local && evidence.validPackage && evidence.securityRisk === 'low'))
    ) {
      autoConsentEligible = true;
      requireConsent = false;
      reasons.push('auto-consent eligible by evidence + policy');
    }

    // Power: still no silent apply for blocked/high unless force at pipeline layer
    if (profile === 'power' && evidence.local && evidence.validPackage && score.score >= 0.55) {
      if (evidence.securityRisk === 'low' || evidence.securityRisk === 'medium') {
        // still prefer consent for medium
        if (evidence.securityRisk === 'low' && score.score >= defaults.minScoreAuto) {
          autoConsentEligible = true;
          requireConsent = false;
        }
      }
    }

    if (!allowApply) {
      autoConsentEligible = false;
      requireConsent = true;
    }

    return {
      profile,
      score,
      allowApply,
      requireConsent,
      autoConsentEligible,
      reasons: dedupe(reasons),
    };
  }

  public formatDecisionText(decision: SkillTrustPolicyDecision): string {
    return [
      `Trust profile: ${decision.profile}`,
      `score=${decision.score.score.toFixed(2)} band=${decision.score.band}`,
      `allowApply=${decision.allowApply} requireConsent=${decision.requireConsent} autoConsent=${decision.autoConsentEligible}`,
      ...decision.reasons.map((r) => `  - ${r}`),
    ].join('\n');
  }

  // ---------------------------------------------------------------------------

  private isZavorthOwned(evidence: SkillTrustEvidence): boolean {
    // Structured fields only — never substring-match free-text source URLs (spoof vector).
    const author = String(evidence.author || '').trim().toLowerCase();
    const publisher = String(evidence.publisher || '').trim().toLowerCase();
    const scoped = [author, publisher].filter(Boolean);
    if (scoped.length === 0) return false;
    return scoped.some((field) =>
      ZAVORTH_OWNED_PATTERNS.some((p) => {
        const pat = p.toLowerCase();
        return field === pat || field === pat.replace(/^@/, '') || field === `@${pat.replace(/^@/, '')}`;
      }),
    );
  }

  private matchOwnerTrusted(evidence: SkillTrustEvidence): OwnerTrustedEntry | null {
    const raw = String(evidence.sourceRaw || '').toLowerCase();
    const pub = String(evidence.publisher || evidence.author || '').toLowerCase();
    let host = '';
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        host = new URL(raw).hostname.replace(/^www\./, '');
      }
    } catch {
      /* ignore */
    }

    for (const entry of this.ownerTrusted) {
      const pat = entry.pattern.toLowerCase();
      if (entry.kind === 'publisher' && pub && (pub === pat || pub.includes(pat) || pat.includes(pub))) {
        return entry;
      }
      if (entry.kind === 'domain') {
        if (host && (host === pat || host.endsWith(`.${pat}`) || raw.includes(pat))) {
          return entry;
        }
        if (raw.includes(pat)) return entry;
      }
      if (entry.kind === 'registry-prefix') {
        if (raw.startsWith(pat) || raw.includes(pat) || pub.startsWith(pat)) return entry;
      }
    }
    return null;
  }

  private loadOwnerTrusted(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        this.ownerTrusted = [];
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as {
        entries?: OwnerTrustedEntry[];
      };
      this.ownerTrusted = Array.isArray(raw.entries) ? raw.entries : [];
    } catch {
      this.ownerTrusted = [];
    }
  }

  private persistOwnerTrusted(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.writeFileSync(
        this.storePath,
        JSON.stringify(
          {
            version: 1,
            updatedAt: this.now().toISOString(),
            entries: this.ownerTrusted,
          },
          null,
          2,
        ),
        'utf8',
      );
    } catch {
      /* soft */
    }
  }
}

function normalizeProfile(raw: string | null | undefined): SkillTrustProfileId {
  const v = String(raw || 'daily').trim().toLowerCase();
  if (v === 'safe' || v === 'daily' || v === 'power') return v;
  return 'daily';
}

function bandFromScore(score: number, risk: string): ZavorthTrustScoreBand {
  if (risk === 'blocked' || score < 0.2) return 'deny';
  if (score < 0.45) return 'review';
  if (score < 0.75) return 'allow-with-preview';
  return 'allow';
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}
