/**
 * SkillScanner - dynamic skill autodiscovery.
 *
 * Each skill is a folder with a manifest (TOOLS.md or manifest.json).
 * The scanner discovers skills automatically without manual registration in code.
 *
 * It scans `skill-library` and `src/skills` looking for:
 * - `TOOLS.md` files with an LLM-readable description
 * - `manifest.json` files with JSON Schema tool definitions
 * - `*.skill.ts` files with executable implementations
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SkillManifest {
  /** Unique skill ID, usually the folder name. */
  id: string;
  /** Absolute path to the skill folder. */
  directory: string;
  /** TOOLS.md content for the LLM to read. */
  toolsMarkdown: string | null;
  /** JSON Schema tool definitions for prompt injection. */
  toolDefinitions: any[];
  /** Main implementation file path. */
  entryPoint: string | null;
  /** Extra manifest metadata. */
  metadata: Record<string, unknown>;
}

export class SkillScanner {
  /**
   * Scans one or more directories for skills with manifests.
   */
  public scan(directories: string[]): SkillManifest[] {
    const manifests: SkillManifest[] = [];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(dir, entry.name);
        const manifest = this.readSkillManifest(entry.name, skillDir);
        if (manifest) {
          manifests.push(manifest);
        }
      }
    }

    console.log(`[SkillScanner] Discovered ${manifests.length} skills in ${directories.length} directories`);
    return manifests;
  }

  /**
   * Reads a single skill manifest from its folder.
   */
  private readSkillManifest(id: string, directory: string): SkillManifest | null {
    const toolsMdPath = path.join(directory, 'TOOLS.md');
    const manifestJsonPath = path.join(directory, 'manifest.json');
    const skillTsPath = path.join(directory, `${id}.skill.ts`);
    const indexTsPath = path.join(directory, 'index.ts');

    const hasToolsMd = fs.existsSync(toolsMdPath);
    const hasManifestJson = fs.existsSync(manifestJsonPath);

    if (!hasToolsMd && !hasManifestJson) {
      return null;
    }

    let toolsMarkdown: string | null = null;
    let toolDefinitions: any[] = [];
    let metadata: Record<string, unknown> = {};

    if (hasToolsMd) {
      try {
        toolsMarkdown = fs.readFileSync(toolsMdPath, 'utf8');
      } catch (error: unknown) {toolsMarkdown = null;
      }
    }

    if (hasManifestJson) {
      try {
        const raw = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
        toolDefinitions = raw.tools || raw.toolDefinitions || [];
        metadata = raw.metadata || raw;
      } catch (error: unknown) {// Invalid manifest, ignore it.
      }
    }

    let entryPoint: string | null = null;
    if (fs.existsSync(skillTsPath)) {
      entryPoint = skillTsPath;
    } else if (fs.existsSync(indexTsPath)) {
      entryPoint = indexTsPath;
    }

    return {
      id,
      directory,
      toolsMarkdown,
      toolDefinitions,
      entryPoint,
      metadata,
    };
  }
}
