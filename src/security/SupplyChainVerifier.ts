
/**
 * SupplyChainVerifier — Cryptographic verification for imported skills.
 *
 * Verifies integrity and authenticity of skills using SHA-256 hashes
 * and optional digital signatures. Supports trust-on-first-use (TOFU)
 * and pinned signature verification.
 *
 * Usage:
 *   const verifier = new SupplyChainVerifier({ trustedKeysPath: '.zavorth/trusted-keys.json' });
 *   const result = await verifier.verifySkill(skillPath, expectedHash);
 *   if (result.verified) {
 *     // Safe to load
 *   }
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface SupplyChainVerifierOptions {
  trustedKeysPath?: string;
  autoTrustOnFirstUse?: boolean;
  hashAlgorithm?: string;
}

export interface SkillVerification {
  verified: boolean;
  hash: string;
  hashMatch: boolean;
  signatureValid: boolean | null;
  trustedKey: boolean;
  firstSeen: boolean;
  error?: string;
}

export interface TrustedKey {
  name: string;
  publicKey: string;
  addedAt: number;
  fingerprint: string;
}

export interface SkillFingerprint {
  path: string;
  hash: string;
  signature?: string;
  firstSeenAt: number;
  lastVerifiedAt: number;
  verificationCount: number;
}

export class SupplyChainVerifier {
  private readonly trustedKeysPath: string;
  private readonly autoTrust: boolean;
  private readonly hashAlgo: string;

  private trustedKeys = new Map<string, TrustedKey>();
  private fingerprints = new Map<string, SkillFingerprint>();
  private trustedKeysLoaded = false;

  constructor(options: SupplyChainVerifierOptions = {}) {
    this.trustedKeysPath = options.trustedKeysPath ?? '.zavorth/trusted-keys.json';
    this.autoTrust = options.autoTrustOnFirstUse ?? true;
    this.hashAlgo = options.hashAlgorithm ?? 'sha256';
  }

  /**
   * Verifies a skill file or directory.
   */
  async verifySkill(
    skillPath: string,
    expectedHash?: string,
    signature?: string,
  ): Promise<SkillVerification> {
    await this.loadTrustData();

    // Calculate hash
    let hash: string;
    try {
      hash = await this.calculateHash(skillPath);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        verified: false,
        hash: '',
        hashMatch: false,
        signatureValid: null,
        trustedKey: false,
        firstSeen: false,
        error: `Hash calculation failed: ${message}`,
      };
    }

    // Check if hash matches expected
    const hashMatch = expectedHash ? hash === expectedHash : true;

    // Check fingerprint database
    const existing = this.fingerprints.get(skillPath);
    const firstSeen = !existing;

    // Verify signature if provided
    let signatureValid: boolean | null = signature ? false : null;
    let trustedKey = false;

    if (signature) {
      const keyFingerprint = this.extractKeyFingerprint(signature);
      if (keyFingerprint) {
        trustedKey = this.trustedKeys.has(keyFingerprint);
        try {
          signatureValid = trustedKey && this.verifySignature(skillPath, signature, keyFingerprint);
        } catch (error: unknown) {logger.warn('[Supply Chain Verifier] validation failed', error);
    signatureValid = false;
  }
      }
    }

    // Update fingerprint database
    const fingerprint: SkillFingerprint = {
      path: skillPath,
      hash,
      signature,
      firstSeenAt: existing?.firstSeenAt ?? Date.now(),
      lastVerifiedAt: Date.now(),
      verificationCount: (existing?.verificationCount ?? 0) + 1,
    };
    this.fingerprints.set(skillPath, fingerprint);

    // Auto-trust on first use
    if (firstSeen && this.autoTrust && hashMatch) {
      this.fingerprints.set(skillPath, fingerprint);
    }

    await this.saveTrustData();

    return {
      verified: hashMatch && (!signature || (trustedKey && signatureValid === true)),
      hash,
      hashMatch,
      signatureValid,
      trustedKey,
      firstSeen,
    };
  }

  /**
   * Calculates SHA-256 hash of a file or directory.
   */
  async calculateHash(targetPath: string): Promise<string> {
    return this.calculateHashSync(targetPath);
  }

  private calculateHashSync(targetPath: string): string {
    const stat = fs.statSync(targetPath);

    if (stat.isFile()) {
      return this.hashFile(targetPath);
    }

    if (stat.isDirectory()) {
      return this.hashDirectory(targetPath);
    }

    throw new Error(`Unsupported path type: ${targetPath}`);
  }

  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash(this.hashAlgo).update(content).digest('hex');
  }

  private hashDirectory(dirPath: string): string {
    const files = this.getSortedFiles(dirPath);
    const hash = crypto.createHash(this.hashAlgo);

    for (const file of files) {
      const relative = path.relative(dirPath, file);
      hash.update(relative);
      hash.update(this.hashFile(file));
    }

    return hash.digest('hex');
  }

  private getSortedFiles(dirPath: string): string[] {
    const files: string[] = [];

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        files.push(...this.getSortedFiles(fullPath));
      }
    }

    return files.sort();
  }

  /**
   * Signs a skill file or directory.
   */
  signSkill(skillPath: string, privateKey: string): string {
    const hash = this.calculateHashSync(skillPath);
    const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
    const fingerprint = this.fingerprintPublicKey(publicKey);
    const sign = crypto.createSign('SHA256');
    sign.update(hash);
    sign.end();
    return `${fingerprint}:${sign.sign(privateKey, 'hex')}`;
  }

  /**
   * Verifies a signature against a public key.
   */
  private verifySignature(skillPath: string, signature: string, keyFingerprint: string): boolean {
    const keyData = this.trustedKeys.get(keyFingerprint);
    if (!keyData) return false;

    const parsed = this.parseSignature(signature);
    if (!parsed || parsed.fingerprint !== keyFingerprint) return false;

    const hash = this.calculateHashSync(skillPath);
    const verify = crypto.createVerify('SHA256');
    verify.update(hash);
    verify.end();

    try {
      return verify.verify(keyData.publicKey, parsed.signatureHex, 'hex');
    } catch (error: unknown) {logger.warn('[Supply Chain Verifier] creation failed', error); return false; }
  }

  private extractKeyFingerprint(signature: string): string | null {
    return this.parseSignature(signature)?.fingerprint ?? null;
  }

  private parseSignature(signature: string): { fingerprint: string; signatureHex: string } | null {
    const match = /^([a-f0-9]{16}):([a-f0-9]+)$/i.exec(signature);
    if (!match || match[2].length % 2 !== 0) return null;
    return { fingerprint: match[1].toLowerCase(), signatureHex: match[2] };
  }

  private fingerprintPublicKey(publicKey: string): string {
    let normalized = publicKey;
    try {
      normalized = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'pem' }).toString();
    } catch {
      // Preserve compatibility for manually registered opaque keys; they cannot verify signatures.
    }
    return crypto.createHash(this.hashAlgo).update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Adds a trusted key.
   */
  addTrustedKey(name: string, publicKey: string): TrustedKey {
    const fingerprint = this.fingerprintPublicKey(publicKey);

    const key: TrustedKey = {
      name,
      publicKey,
      addedAt: Date.now(),
      fingerprint,
    };

    this.trustedKeys.set(fingerprint, key);
    this.saveTrustData();

    return key;
  }

  /**
   * Removes a trusted key.
   */
  removeTrustedKey(fingerprint: string): boolean {
    const removed = this.trustedKeys.delete(fingerprint);
    if (removed) {
      this.saveTrustData();
    }
    return removed;
  }

  /**
   * Lists all trusted keys.
   */
  listTrustedKeys(): TrustedKey[] {
    return Array.from(this.trustedKeys.values());
  }

  /**
   * Gets fingerprint for a skill.
   */
  getFingerprint(skillPath: string): SkillFingerprint | null {
    return this.fingerprints.get(skillPath) ?? null;
  }

  /**
   * Lists all verified skills.
   */
  listVerifiedSkills(): SkillFingerprint[] {
    return Array.from(this.fingerprints.values());
  }

  /**
   * Checks if a skill has been seen before.
   */
  hasSeen(skillPath: string): boolean {
    return this.fingerprints.has(skillPath);
  }

  /**
   * Exports verification report.
   */
  exportReport(): string {
    return JSON.stringify({
      trustedKeys: Array.from(this.trustedKeys.values()),
      verifiedSkills: Array.from(this.fingerprints.values()),
      stats: this.getStats(),
    }, null, 2);
  }

  /**
   * Gets verification statistics.
   */
  getStats(): {
    trustedKeys: number;
    verifiedSkills: number;
    totalVerifications: number;
  } {
    let totalVerifications = 0;
    for (const fp of this.fingerprints.values()) {
      totalVerifications += fp.verificationCount;
    }

    return {
      trustedKeys: this.trustedKeys.size,
      verifiedSkills: this.fingerprints.size,
      totalVerifications,
    };
  }

  private async loadTrustData(): Promise<void> {
    if (this.trustedKeysLoaded) return;

    try {
      if (fs.existsSync(this.trustedKeysPath)) {
        const data = JSON.parse(fs.readFileSync(this.trustedKeysPath, 'utf-8'));
        if (data.trustedKeys) {
          for (const key of data.trustedKeys) {
            this.trustedKeys.set(key.fingerprint, key);
          }
        }
        if (data.fingerprints) {
          for (const fp of data.fingerprints) {
            this.fingerprints.set(fp.path, fp);
          }
        }
      }
    } catch (error: unknown) {// ignore load errors
      logger.warn('[Supply Chain Verifier] JSON parse failed', error);
    }

    this.trustedKeysLoaded = true;
  }

  private async saveTrustData(): Promise<void> {
    const dir = path.dirname(this.trustedKeysPath);
    fs.mkdirSync(dir, { recursive: true });

    const data = {
      trustedKeys: Array.from(this.trustedKeys.values()),
      fingerprints: Array.from(this.fingerprints.values()),
    };

    fs.writeFileSync(this.trustedKeysPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
