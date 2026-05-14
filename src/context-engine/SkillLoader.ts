/**
 * SkillLoader — Ponte entre SkillScanner e Cognitive Firewall
 *
 * Este módulo:
 * 1. Usa o SkillScanner para descobrir skills nos diretórios configurados
 * 2. Lê os manifestos e extrai as categorias de firewall de cada skill
 * 3. Atualiza o ToolGatekeeper com o mapeamento dinâmico Intent => Tools
 *
 * No boot do Zavorth, basta chamar:
 *   const loader = new SkillLoader();
 *   const stats = loader.loadAll();
 *   console.log(stats);
 *
 * Resultado: O Cognitive Firewall agora sabe quais tools pertencem a cada
 * categoria de intenção, sem necessidade de hardcoding.
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
   * Escaneia os diretórios padrão do Zavorth e carrega todos os manifestos.
   *
   * @param basePath - Raiz do projeto Zavorth
   * @returns Estatísticas do carregamento
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
   * Recarrega todos os manifestos e atualiza o estado interno (útil ao criar uma skill dinamicamente).
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
   * Retorna conteúdo TOOLS.md para uma skill específica (para injetar no prompt do LLM).
   */
  public getToolsMarkdown(skillId: string): string | null {
    const manifest = this.loadedManifests.find((m) => m.id === skillId);
    return manifest?.toolsMarkdown || null;
  }
}
