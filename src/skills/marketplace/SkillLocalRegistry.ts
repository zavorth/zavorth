import fs from 'node:fs';
import path from 'node:path';
import type { SkillPackageManifest, SkillPackageSummary, SkillTrustLevel } from './SkillPackageTypes.js';
import { asErrorLike } from '../../utils/errorLike';

type AuthorTrustData = {
  [author: string]: { installs: number; ratings: number[]; trustScore: number };
};

type RegistryData = {
  version: number;
  updatedAt: string;
  entries: SkillPackageSummary[];
  authorTrust: AuthorTrustData;
};

const REGISTRY_VERSION = 1;

export class SkillLocalRegistry {
  private readonly registryPath: string;
  private data: RegistryData;

  constructor(options?: { dataDir?: string }) {
    const dataDir = options?.dataDir || path.join(process.cwd(), 'data', 'runtime', 'skill-marketplace');
    this.registryPath = path.join(dataDir, 'registry.json');
    this.data = this.load();
  }

  private load(): RegistryData {
    try {
      if (fs.existsSync(this.registryPath)) {
        const raw = fs.readFileSync(this.registryPath, 'utf-8');
        const parsed = JSON.parse(raw) as RegistryData;
        if (parsed.version === REGISTRY_VERSION && Array.isArray(parsed.entries)) {
          return parsed;
        }
      }
    } catch { /* ignore corrupt files */ }
    return { version: REGISTRY_VERSION, updatedAt: new Date().toISOString(), entries: [], authorTrust: {} };
  }

  private save(): void {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.data.updatedAt = new Date().toISOString();
    const lockPath = this.registryPath + '.lock';
    const payload = JSON.stringify(this.data, null, 2);
    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const fd = fs.openSync(lockPath, 'wx'); // exclusive create — fails if lock exists
        try {
          fs.writeFileSync(this.registryPath, payload, 'utf-8');
          return;
        } finally {
          fs.closeSync(fd);
          try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        }
      } catch (error: unknown) { const err = asErrorLike(error); if (err?.code === 'EEXIST' && attempt < maxRetries - 1) {
          // Lock held by another process — wait briefly then retry
          const start = Date.now();
          while (Date.now() - start < 500) { /* busy-wait up to 500ms */ }
          continue;
        }
        // Fallback: write without lock (last resort)
        try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        fs.writeFileSync(this.registryPath, payload, 'utf-8');
        return;
      }
    }
  }

  addEntry(manifest: SkillPackageManifest, source: 'local' | 'git' | 'file', sourceUrl: string | null): SkillPackageSummary {
    const existing = this.data.entries.findIndex((e) => e.id === manifest.name);
    const trustLevel = this.resolveTrustLevel(manifest.author, source);
    const authorScore = this.getAuthorTrustScore(manifest.author);
    const entry: SkillPackageSummary = {
      id: manifest.name,
      name: manifest.name,
      description: manifest.description,
      author: manifest.author,
      version: manifest.version,
      category: manifest.category || 'other',
      tags: manifest.tags || [],
      source,
      sourceUrl,
      installedAt: null,
      checksum: manifest.checksum,
      rating: 0,
      downloads: 0,
      trustLevel,
      authorTrustScore: authorScore,
      fileCount: manifest.files?.length || 0,
    };
    if (existing >= 0) {
      this.data.entries[existing] = entry;
    } else {
      this.data.entries.push(entry);
    }
    this.save();
    return entry;
  }

  removeEntry(id: string): boolean {
    const idx = this.data.entries.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    this.data.entries.splice(idx, 1);
    this.save();
    return true;
  }

  markInstalled(id: string): void {
    const entry = this.data.entries.find((e) => e.id === id);
    if (entry) {
      entry.installedAt = new Date().toISOString();
      entry.downloads += 1;
      this.save();
    }
  }

  markUninstalled(id: string): void {
    const entry = this.data.entries.find((e) => e.id === id);
    if (entry) {
      entry.installedAt = null;
      this.save();
    }
  }

  search(query: string, filters?: { category?: string; tags?: string[] }): SkillPackageSummary[] {
    const q = query.toLowerCase();
    return this.data.entries.filter((e) => {
      const matchesQuery = !q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q));
      const matchesCategory = !filters?.category || e.category === filters.category;
      const matchesTags = !filters?.tags || filters.tags.length === 0 || filters.tags.some((t) => e.tags.includes(t));
      return matchesQuery && matchesCategory && matchesTags;
    });
  }

  getEntry(id: string): SkillPackageSummary | undefined {
    return this.data.entries.find((e) => e.id === id);
  }

  listInstalled(): SkillPackageSummary[] {
    return this.data.entries.filter((e) => e.installedAt !== null);
  }

  listAll(): SkillPackageSummary[] {
    return [...this.data.entries];
  }

  updateStats(id: string, stats: { downloads?: number; rating?: number }): void {
    const entry = this.data.entries.find((e) => e.id === id);
    if (entry) {
      if (stats.downloads !== undefined) entry.downloads = stats.downloads;
      if (stats.rating !== undefined) {
        entry.rating = stats.rating;
        this.updateAuthorTrust(entry.author, stats.rating);
      }
      this.save();
    }
  }

  private resolveTrustLevel(author: string, source: 'local' | 'git' | 'file'): SkillTrustLevel {
    const score = this.getAuthorTrustScore(author);
    if (source === 'local') return 'trusted';
    if (score >= 0.8) return 'verified';
    if (score >= 0.5) return 'trusted';
    if (score > 0) return 'unknown';
    return 'unknown';
  }

  getAuthorTrustScore(author: string): number {
    const data = this.data.authorTrust[author];
    if (!data || data.ratings.length === 0) return 0;
    const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    const installBonus = Math.min(data.installs / 10, 0.3);
    return Math.min(1, (avgRating / 5) * 0.7 + installBonus + 0.2);
  }

  private updateAuthorTrust(author: string, rating: number): void {
    if (!this.data.authorTrust[author]) {
      this.data.authorTrust[author] = { installs: 0, ratings: [], trustScore: 0 };
    }
    const data = this.data.authorTrust[author];
    data.ratings.push(rating);
    if (data.ratings.length > 50) data.ratings = data.ratings.slice(-50);
    data.trustScore = this.getAuthorTrustScore(author);
  }

  getTrustSummary(): { total: number; verified: number; trusted: number; unknown: number } {
    const entries = this.data.entries;
    return {
      total: entries.length,
      verified: entries.filter((e) => e.trustLevel === 'verified').length,
      trusted: entries.filter((e) => e.trustLevel === 'trusted').length,
      unknown: entries.filter((e) => e.trustLevel === 'unknown').length,
    };
  }
}
