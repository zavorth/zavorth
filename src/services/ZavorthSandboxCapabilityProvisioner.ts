import fs from 'node:fs';
import path from 'node:path';
import type { SkillMetadata } from '../skills/SkillLoader.js';
import { ZavorthPathCompactor } from '../skills/ZavorthPathCompactor.js';

export class ZavorthSandboxCapabilityProvisioner {
  public static provision(activeSkills: SkillMetadata[], sandboxWorkspacePath: string): void {
    const sandboxRoot = path.resolve(ZavorthPathCompactor.expand(sandboxWorkspacePath));
    if (!sandboxRoot || !fs.existsSync(sandboxRoot)) {
      return;
    }

    const targetBaseDir = path.join(sandboxRoot, '.zavorth', 'capabilities');
    fs.mkdirSync(targetBaseDir, { recursive: true });

    for (const skill of activeSkills) {
      if (!skill.dirPath) {
        continue;
      }

      const sourceDir = path.resolve(ZavorthPathCompactor.expand(skill.dirPath));
      if (!fs.existsSync(sourceDir)) {
        continue;
      }

      const safeSkillName = this.safeDirectoryName(skill.name);
      if (!safeSkillName) {
        continue;
      }

      const targetSkillDir = path.resolve(targetBaseDir, safeSkillName);
      if (!targetSkillDir.startsWith(path.resolve(targetBaseDir) + path.sep)) {
        continue;
      }

      fs.mkdirSync(targetSkillDir, { recursive: true });
      this.copyRecursive(sourceDir, targetSkillDir);
    }
  }

  private static copyRecursive(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private static safeDirectoryName(name: string): string {
    return String(name || '')
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/\.+/g, '.')
      .replace(/^[.-]+/g, '')
      .replace(/^\.+$/g, '')
      .slice(0, 120);
  }
}
