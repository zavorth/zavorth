import fs from 'node:fs';
import path from 'node:path';

export type SkillBundle = {
  id: string;
  name: string;
  description: string;
  author: string;
  skills: string[];
  tags: string[];
};

const BUNDLE_FILE = 'skill-bundles.json';

export class SkillBundleManager {
  private readonly bundlesPath: string;

  constructor(options?: { dataDir?: string }) {
    this.bundlesPath = path.join(options?.dataDir || path.join(process.cwd(), 'data'), 'skill-marketplace', BUNDLE_FILE);
  }

  private load(): SkillBundle[] {
    try {
      if (fs.existsSync(this.bundlesPath)) {
        return JSON.parse(fs.readFileSync(this.bundlesPath, 'utf-8'));
      }
    } catch { /* skip */ }
    return [];
  }

  private save(bundles: SkillBundle[]): void {
    const dir = path.dirname(this.bundlesPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.bundlesPath, JSON.stringify(bundles, null, 2), 'utf-8');
  }

  createBundle(id: string, name: string, description: string, skillIds: string[]): SkillBundle {
    const bundles = this.load();
    const bundle: SkillBundle = {
      id,
      name,
      description,
      author: 'local',
      skills: skillIds,
      tags: [],
    };
    const existing = bundles.findIndex((b) => b.id === id);
    if (existing >= 0) {
      bundles[existing] = bundle;
    } else {
      bundles.push(bundle);
    }
    this.save(bundles);
    return bundle;
  }

  getBundle(id: string): SkillBundle | undefined {
    return this.load().find((b) => b.id === id);
  }

  listBundles(): SkillBundle[] {
    return this.load();
  }

  removeBundle(id: string): boolean {
    const bundles = this.load();
    const idx = bundles.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    bundles.splice(idx, 1);
    this.save(bundles);
    return true;
  }

  getBundlesContaining(skillId: string): SkillBundle[] {
    return this.load().filter((b) => b.skills.includes(skillId));
  }
}
