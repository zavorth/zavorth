/**
 * SkillLoader — Ponte entre SkillScanner e Cognitive Firewall
 *
 * This module:
 * 1. Uses SkillScanner to discover skills in configured directories
 * 2. Reads manifests and extracts firewall categories for each skill
 * 3. Updates ToolGatekeeper with the dynamic Intent => Tools mapping
 *
 * No boot do Zavorth, basta chamar:
 *   const loader = new SkillLoader();
 *   const stats = loader.loadAll();
 *   console.log(stats);
 *
 * Resultado: O Cognitive Firewall agora sabe quais tools pertencem a cada
 * intent category, without hardcoding.
 */

import * as path from 'path';
import { SkillScanner, type SkillManifest } from '../context-engine/SkillScanner.js';
import type { IntentCategory } from '../cognitive-firewall/IntentClassifier.js';
import { setDynamicIntentToolMap } from '../cognitive-firewall/ToolGatekeeper.js';

export interface SkillLoadResult {
  totalSkills: number;
  totalTools: number;
  skillIds: string[];
  categoryMap: Record<string, string[]>;
}

export class SkillLoader {
  private readonly scanner = new SkillScanner();
  private loadedManifests: SkillManifest[] = [];

  /**
   * Scans Zavorth default directories and loads every manifest.
   *
   * @param basePath - Raiz do projeto Zavorth
   * @returns Loading statistics
   */
  public loadAll(basePath?: string): SkillLoadResult {
    const root = basePath || process.cwd();

    const directories = [
      path.join(root, 'src', 'skills'),
      path.join(root, 'skill-library'),
    ];

    this.loadedManifests = this.scanner.scan(directories);

    // Construir o mapa de categoria => tool names para o Cognitive Firewall
    const categoryMap: Record<string, string[]> = {};
    let totalTools = 0;

    for (const manifest of this.loadedManifests) {
      const category = String(
        manifest.metadata?.firewall_category || 'full_toolset',
      );

      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }

      for (const tool of manifest.toolDefinitions) {
        if (tool.name) {
          categoryMap[category].push(tool.name);
          totalTools++;
        }
      }
    }

    const result: SkillLoadResult = {
      totalSkills: this.loadedManifests.length,
      totalTools,
      skillIds: this.loadedManifests.map((m) => m.id),
      categoryMap,
    };

    setDynamicIntentToolMap(categoryMap);

    console.log(`[SkillLoader] Carregadas ${result.totalSkills} skills com ${result.totalTools} tools`);
    for (const [category, tools] of Object.entries(categoryMap)) {
      console.log(`  [${category}] => ${tools.join(', ')}`);
    }

    return result;
  }

  /**
   * Reloads all manifests and updates internal state, useful when creating a skill dynamically.
   */
  public reload(basePath?: string): SkillLoadResult {
    console.log('[SkillLoader] Recarregando skills dinamicamente...');
    this.loadedManifests = [];
    return this.loadAll(basePath);
  }

  /**
   * Retorna todos os manifestos carregados.
   */
  public getManifests(): SkillManifest[] {
    return this.loadedManifests;
  }

  /**
   * Retorna os nomes de tools que pertencem a uma categoria de firewall.
   */
  public getToolsForCategory(category: IntentCategory): string[] {
    const allNames: string[] = [];
    for (const manifest of this.loadedManifests) {
      if (manifest.metadata?.firewall_category === category) {
        for (const tool of manifest.toolDefinitions) {
          if (tool.name) allNames.push(tool.name);
        }
      }
    }
    return allNames;
  }

  /**
   * Returns TOOLS.md content for a specific skill, for LLM prompt injection.
   */
  public getToolsMarkdown(skillId: string): string | null {
    const manifest = this.loadedManifests.find((m) => m.id === skillId);
    return manifest?.toolsMarkdown || null;
  }
}
