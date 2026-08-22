import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SkillLocalRegistry } from './SkillLocalRegistry.js';

export type OutdatedSkill = {
  id: string;
  installedVersion: string;
  availableVersion: string;
  sourceUrl: string | null;
};

export class SkillUpdateChecker {
  private readonly registry: SkillLocalRegistry;

  constructor(options?: { dataDir?: string }) {
    this.registry = new SkillLocalRegistry(options);
  }

  findOutdated(): OutdatedSkill[] {
    const installed = this.registry.listInstalled();
    const outdated: OutdatedSkill[] = [];

    for (const skill of installed) {
      if (!skill.sourceUrl || skill.source === 'local') continue;

      const manifestPath = path.join(process.cwd(), 'skills', skill.id, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const remoteVersion = this.checkRemoteVersion(skill.sourceUrl, manifest.version);
        if (remoteVersion && remoteVersion !== manifest.version) {
          outdated.push({
            id: skill.id,
            installedVersion: manifest.version,
            availableVersion: remoteVersion,
            sourceUrl: skill.sourceUrl,
          });
        }
      } catch { /* skip */ }
    }

    return outdated;
  }

  private checkRemoteVersion(sourceUrl: string, _currentVersion: string): string | null {
    try {
      if (sourceUrl.includes('github.com')) {
        const match = sourceUrl.match(/github\.com\/([^/]+\/[^/]+)/);
        if (match) {
          const apiUrl = `https://api.github.com/repos/${match[1]}/releases/latest`;
          const res = execFileSync(
            'curl',
            ['-s', '-H', 'Accept: application/vnd.github.v3+json', apiUrl],
            { stdio: 'pipe', timeout: 5000, encoding: 'utf-8' }
          );
          const data = JSON.parse(res);
          return data.tag_name?.replace(/^v/, '') || null;
        }
      }
    } catch { /* skip */ }
    return null;
  }
}
