import fs from 'node:fs';
import path from 'node:path';
import { SkillLocalRegistry } from './SkillLocalRegistry.js';
import { parseVersionConstraint, satisfiesVersion, type VersionConstraint } from './SkillPackageTypes.js';

export type DependencyCheckResult = {
  skillId: string;
  allResolved: boolean;
  installed: Array<{ name: string; version: string; satisfies: boolean }>;
  missing: Array<{ name: string; constraint: string; resolved: string | null }>;
  circular: string[];
};

export type DependencyInstallPlan = {
  skillId: string;
  installOrder: Array<{ id: string; source: string; version: string }>;
  alreadyInstalled: string[];
  unresolvable: string[];
  circularDeps: string[];
};

export class SkillDependencyResolver {
  private readonly registry: SkillLocalRegistry;
  private readonly skillsDir: string;

  constructor(options?: { dataDir?: string }) {
    this.registry = new SkillLocalRegistry(options);
    this.skillsDir = path.join(process.cwd(), 'skills');
  }

  checkDependencies(skillDir: string): DependencyCheckResult {
    const skillId = path.basename(skillDir);
    const dependencies = this.readDependencies(skillDir);
    const installed: DependencyCheckResult['installed'] = [];
    const missing: DependencyCheckResult['missing'] = [];
    const circular = this.detectCircularDeps(skillId, new Set());

    for (const dep of dependencies) {
      const constraint = parseVersionConstraint(dep);
      const installedVersion = this.getInstalledVersion(constraint.name);

      if (installedVersion) {
        const satisfies = satisfiesVersion(installedVersion, constraint);
        installed.push({ name: constraint.name, version: installedVersion, satisfies });
      } else {
        const resolved = this.findInRegistry(constraint.name);
        missing.push({ name: constraint.name, constraint: dep, resolved: resolved?.id || null });
      }
    }

    const allResolved = missing.length === 0 || missing.every((m) => m.resolved !== null);

    return { skillId, allResolved, installed, missing, circular };
  }

  buildInstallPlan(skillDir: string): DependencyInstallPlan {
    const skillId = path.basename(skillDir);
    const dependencies = this.readDependencies(skillDir);
    const installOrder: DependencyInstallPlan['installOrder'] = [];
    const alreadyInstalled: string[] = [];
    const unresolvable: string[] = [];
    const visited = new Set<string>();

    this.resolveDependencyTree(dependencies, installOrder, alreadyInstalled, unresolvable, visited, skillId);

    return { skillId, installOrder, alreadyInstalled, unresolvable, circularDeps: [] };
  }

  private resolveDependencyTree(
    dependencies: string[],
    installOrder: DependencyInstallPlan['installOrder'],
    alreadyInstalled: string[],
    unresolvable: string[],
    visited: Set<string>,
    parentId: string,
  ): void {
    for (const dep of dependencies) {
      const constraint = parseVersionConstraint(dep);
      if (visited.has(constraint.name)) continue;
      visited.add(constraint.name);

      const installedVersion = this.getInstalledVersion(constraint.name);
      if (installedVersion) {
        if (satisfiesVersion(installedVersion, constraint)) {
          alreadyInstalled.push(constraint.name);
        } else {
          unresolvable.push(`${constraint.name}@${constraint.operator}${constraint.version} (installed: ${installedVersion})`);
        }
        continue;
      }

      const entry = this.findInRegistry(constraint.name);
      if (entry) {
        installOrder.push({ id: entry.id, source: entry.sourceUrl || 'registry', version: entry.version });
        const depDir = path.join(this.skillsDir, entry.id);
        if (fs.existsSync(depDir)) {
          const subDeps = this.readDependencies(depDir);
          this.resolveDependencyTree(subDeps, installOrder, alreadyInstalled, unresolvable, visited, entry.id);
        }
      } else {
        unresolvable.push(constraint.name);
      }
    }
  }

  private detectCircularDeps(skillId: string, visited: Set<string>): string[] {
    if (visited.has(skillId)) return [skillId];
    visited.add(skillId);

    const dir = path.join(this.skillsDir, skillId);
    if (!fs.existsSync(dir)) return [];

    const deps = this.readDependencies(dir);
    const circular: string[] = [];

    for (const dep of deps) {
      const constraint = parseVersionConstraint(dep);
      const result = this.detectCircularDeps(constraint.name, new Set(visited));
      circular.push(...result);
    }

    return circular;
  }

  private readDependencies(skillDir: string): string[] {
    const manifestPath = path.join(skillDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return [];
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
    } catch { return []; }
  }

  private getInstalledVersion(skillId: string): string | null {
    const dir = path.join(this.skillsDir, skillId);
    if (!fs.existsSync(dir)) return null;

    const manifestPath = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        return manifest.version || null;
      } catch { /* skip */ }
    }

    const skillMdPath = path.join(dir, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const match = content.match(/version:\s*["']...([^\s"']+)/);
      if (match) return match[1];
    }

    return null;
  }

  private findInRegistry(name: string): { id: string; sourceUrl: string | null; version: string } | null {
    const entry = this.registry.getEntry(name);
    if (entry) return { id: entry.id, sourceUrl: entry.sourceUrl, version: entry.version };

    const lower = name.toLowerCase();
    const all = this.registry.listAll();
    const match = all.find((e) => e.id.toLowerCase() === lower || e.name.toLowerCase() === lower);
    if (match) return { id: match.id, sourceUrl: match.sourceUrl, version: match.version };

    return null;
  }
}
