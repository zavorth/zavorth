import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SkillPackageManifest, SkillValidationResult } from './SkillPackageTypes.js';

export function validateSkillPackage(skillDir: string): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let manifest: SkillPackageManifest | null = null;

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    errors.push('SKILL.md not found');
    return { valid: false, errors, warnings, manifest: null };
  }

  const manifestPath = path.join(skillDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest.json not found');
    return { valid: false, errors, warnings, manifest: null };
  }

  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(raw) as SkillPackageManifest;
  } catch {
    errors.push('manifest.json is not valid JSON');
    return { valid: false, errors, warnings, manifest: null };
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('manifest.json: "name" is required and must be a string');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('manifest.json: "version" is required and must be a string');
  }
  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('manifest.json: "description" is required');
  }
  if (!manifest.author || typeof manifest.author !== 'string') {
    errors.push('manifest.json: "author" is required');
  }
  if (!manifest.category || typeof manifest.category !== 'string') {
    warnings.push('manifest.json: "category" is recommended');
  }
  if (!Array.isArray(manifest.tags)) {
    warnings.push('manifest.json: "tags" should be an array');
  }

  const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
  const computedChecksum = `sha256:${crypto.createHash('sha256').update(skillContent).digest('hex')}`;

  if (manifest.checksum && manifest.checksum !== computedChecksum) {
    warnings.push(`Checksum mismatch: expected ${computedChecksum}, got ${manifest.checksum}`);
  }
  manifest.checksum = computedChecksum;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
  };
}

export function computeSkillChecksum(skillDir: string): string {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}
