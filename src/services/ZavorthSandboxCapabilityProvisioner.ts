import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

      const targetSkillDir = path.resolve(targetBaseDir, this.uniqueDirectoryName(skill, safeSkillName));
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
  // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|...*\x00-\x1f]/g, '-')
      .replace(/\.+/g, '.')
      .replace(/^[.-]+/g, '')
      .replace(/^\.+$/g, '')
      .slice(0, 120);
  }

  private static uniqueDirectoryName(skill: SkillMetadata, safeSkillName: string): string {
    const stableId = [
      (skill as { id?: string }).id || '',
      skill.name || '',
      skill.dirPath || '',
      skill.skillFilePath || '',
    ].join('\0');
    const suffix = crypto.createHash('sha256').update(stableId).digest('hex').slice(0, 8);
    return `${safeSkillName.slice(0, 111)}-${suffix}`;
  }
}
