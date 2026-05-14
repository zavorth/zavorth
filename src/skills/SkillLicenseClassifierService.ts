import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { SkillSourceRegistryEntry } from '../services/SkillSourceRegistryService.js';

type SkillLicenseClassification = {
  license: string | null;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
};

type SkillLicenseClassifierRuntime = {
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

const LICENSE_FILENAMES = ['LICENSE.txt', 'LICENSE.md', 'LICENSE', 'license.txt', 'license.md'];

export class SkillLicenseClassifierService {
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: SkillLicenseClassifierRuntime = {}) {
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public classifySkillDirectory(
    skillDirPath: string,
    source: Pick<SkillSourceRegistryEntry, 'license'> | null = null,
  ): SkillLicenseClassification {
    const frontmatter = this.readFrontmatter(skillDirPath);
    const externalSource = this.readJsonFile(path.join(skillDirPath, 'EXTERNAL_SOURCE.json'));
    const metadata = this.readJsonFile(path.join(skillDirPath, 'metadata.json'));
    const omniEnhanced = this.readJsonFile(path.join(skillDirPath, 'OMNI_ENHANCED.json'));

    for (const fileName of LICENSE_FILENAMES) {
      const filePath = path.join(skillDirPath, fileName);
      if (!this.existsSyncImpl(filePath)) {
        continue;
      }
      const content = this.readFileSyncImpl(filePath, 'utf8');
      const detected = this.detectLicenseFromText(content);
      if (detected) {
        return {
          license: detected,
          confidence: 'high',
          evidence: [`license-file:${fileName}`],
        };
      }
    }

    const externalSpdx = this.normalizeLicenseValue(externalSource?.source_license_spdx);
    if (externalSpdx) {
      return {
        license: externalSpdx,
        confidence: 'high',
        evidence: ['EXTERNAL_SOURCE.json:source_license_spdx'],
      };
    }

    const frontmatterLicense = this.normalizeLicenseValue(frontmatter?.license);
    if (frontmatterLicense) {
      return {
        license: frontmatterLicense,
        confidence: 'medium',
        evidence: ['SKILL.md:frontmatter.license'],
      };
    }

    const metadataLicense = this.normalizeLicenseValue(metadata?.license || metadata?.source_license_spdx);
    if (metadataLicense) {
      return {
        license: metadataLicense,
        confidence: 'medium',
        evidence: ['metadata.json:license'],
      };
    }

    const omniLicense = this.normalizeLicenseValue(omniEnhanced?.license || omniEnhanced?.source_license_spdx);
    if (omniLicense) {
      return {
        license: omniLicense,
        confidence: 'low',
        evidence: ['OMNI_ENHANCED.json:license'],
      };
    }

    const sourceLicense = this.normalizeLicenseValue(source?.license);
    if (sourceLicense) {
      return {
        license: sourceLicense,
        confidence: 'low',
        evidence: ['source-registry:license'],
      };
    }

    return {
      license: null,
      confidence: 'low',
      evidence: [],
    };
  }

  private readFrontmatter(skillDirPath: string): Record<string, unknown> | null {
    const skillFilePath = path.join(skillDirPath, 'SKILL.md');
    if (!this.existsSyncImpl(skillFilePath)) {
      return null;
    }

    const raw = this.readFileSyncImpl(skillFilePath, 'utf8').replace(/^\uFEFF/, '');
    const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return null;
    }
    try {
      const parsed = yaml.load(match[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fallback abaixo
    }

    const fields: Record<string, unknown> = {};
    for (const line of match[1].split(/\r?\n/)) {
      const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
      if (!fieldMatch) {
        continue;
      }
      const rawValue = String(fieldMatch[2] || '').trim();
      fields[fieldMatch[1]] = (
        (rawValue.startsWith('"') && rawValue.endsWith('"'))
        || (rawValue.startsWith('\'') && rawValue.endsWith('\''))
      )
        ? rawValue.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, '\'').trim()
        : rawValue.replace(/\\"/g, '"').replace(/\\'/g, '\'').trim();
    }
    return fields;
  }

  private readJsonFile(filePath: string): Record<string, any> | null {
    try {
      if (!this.existsSyncImpl(filePath)) {
        return null;
      }
      const parsed = JSON.parse(this.readFileSyncImpl(filePath, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : null;
    } catch {
      return null;
    }
  }

  private detectLicenseFromText(content: string): string | null {
    const normalized = content.toLowerCase();
    if (normalized.includes('apache license') && normalized.includes('version 2.0')) {
      return 'Apache-2.0';
    }
    if (normalized.includes('mit license')) {
      return 'MIT';
    }
    if (normalized.includes('creative commons attribution 4.0')) {
      return 'CC-BY-4.0';
    }
    return null;
  }

  private normalizeLicenseValue(value: unknown): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }
    if (/^apache(?:-|\s*)2(?:\.0)?$/i.test(normalized) || /^apache[-\s]?license/i.test(normalized)) {
      return 'Apache-2.0';
    }
    if (/^mit$/i.test(normalized)) {
      return 'MIT';
    }
    if (/^cc[\s-]*by(?:[\s-]*4(?:\.0)?)?$/i.test(normalized) || /creative commons/i.test(normalized)) {
      return 'CC-BY-4.0';
    }
    return normalized;
  }
}
