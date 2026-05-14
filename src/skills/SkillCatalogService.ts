import { SkillLoader } from './SkillLoader.js';
import type {
  SkillCatalogBundle,
  SkillCatalogEntry,
  SkillCatalogSnapshot,
} from './SkillCatalogContract.js';

type SkillCatalogRuntime = {
  now?: () => Date;
  skillLoader?: Pick<SkillLoader, 'loadAll'>;
};

export class SkillCatalogService {
  private readonly now: () => Date;
  private readonly skillLoader: Pick<SkillLoader, 'loadAll'>;

  constructor(runtime: SkillCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillLoader = runtime.skillLoader || new SkillLoader();
  }

  public listEntries(): SkillCatalogEntry[] {
    return this.skillLoader.loadAll({ quiet: true }).map((skill) => ({
      id: `skill:${skill.name}`,
      name: skill.name,
      description: skill.description,
      sourceId: skill.sourceId || null,
      sourceLabel: skill.sourceLabel || null,
      sourceTrust: skill.sourceTrust || null,
      license: skill.license || skill.provenance?.license || null,
      imported: skill.provenance?.imported === true,
      bundleTags: Array.isArray(skill.bundleTags) ? skill.bundleTags.slice() : [],
      supportFileCount: skill.supportFilePaths.length,
      dirPath: skill.dirPath,
      skillFilePath: skill.skillFilePath,
      searchText: this.normalizeSearchText([
        skill.name,
        skill.description,
        skill.sourceId || '',
        skill.sourceLabel || '',
        ...(skill.bundleTags || []),
        ...(skill.supportFilePaths || []),
      ]),
      provenance: skill.provenance || null,
      risk: skill.risk || skill.provenance?.risk || null,
      licensePolicy: skill.licensePolicy || skill.provenance?.licensePolicy || null,
      audit: skill.audit || skill.provenance?.audit || null,
      metadata: skill,
    }));
  }

  public buildSnapshot(): SkillCatalogSnapshot {
    const entries = this.listEntries();
    const bundles = this.buildBundles(entries);

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: entries.length,
        local: entries.filter((entry) => !entry.imported).length,
        imported: entries.filter((entry) => entry.imported).length,
        trusted: entries.filter((entry) => entry.sourceTrust === 'trusted').length,
        review: entries.filter((entry) => entry.sourceTrust === 'review').length,
        blocked: entries.filter((entry) => entry.sourceTrust === 'blocked').length,
        withSupportFiles: entries.filter((entry) => entry.supportFileCount > 0).length,
        bundled: bundles.length,
      },
      bundles,
      entries,
    };
  }

  private buildBundles(entries: SkillCatalogEntry[]): SkillCatalogBundle[] {
    const bundleMap = new Map<string, string[]>();

    for (const entry of entries) {
      for (const tag of entry.bundleTags) {
        if (!bundleMap.has(tag)) {
          bundleMap.set(tag, []);
        }
        bundleMap.get(tag)?.push(entry.name);
      }
    }

    return Array.from(bundleMap.entries())
      .map(([tag, skillNames]) => ({
        tag,
        skillCount: skillNames.length,
        skillNames: skillNames.slice().sort((left, right) => left.localeCompare(right, 'en-US')),
      }))
      .sort((left, right) => left.tag.localeCompare(right.tag, 'en-US'));
  }

  private normalizeSearchText(values: string[]): string {
    return values
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
  }
}
