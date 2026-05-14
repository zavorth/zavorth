/**
 * SkillScanner — Auto-Descoberta Dinâmica de Skills (Modelo ExternalExecutor TOOLS.md)
 *
 * No ExternalExecutor, cada Skill é uma pasta com um manifesto (TOOLS.md ou manifest.json).
 * O agente "descobre" as skills automaticamente sem registro manual no código.
 *
 * Este módulo escaneia o diretório `skill-library` e `src/skills` procurando:
 * - Arquivos `TOOLS.md` (descrição legível pelo LLM)
 * - Arquivos `manifest.json` (definições de tool em JSON Schema)
 * - Arquivos `*.skill.ts` (implementações executáveis)
 *
 * Ao adicionar uma nova skill, basta criar uma pasta com os arquivos acima.
 * O Scanner descobre tudo automaticamente no boot.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SkillManifest {
  /** ID único da skill (nome da pasta) */
  id: string;
  /** Caminho absoluto da pasta da skill */
  directory: string;
  /** Conteúdo do TOOLS.md (para o LLM ler) */
  toolsMarkdown: string | null;
  /** Definições de tools em JSON Schema (para injection no prompt) */
  toolDefinitions: any[];
  /** Caminho do arquivo de implementação principal */
  entryPoint: string | null;
  /** Metadata extra do manifesto */
  metadata: Record<string, unknown>;
}

export class SkillScanner {
  /**
   * Escaneia um ou mais diretórios procurando skills com manifestos.
   *
   * @param directories - Lista de diretórios para escanear
   * @returns Lista de manifestos descobertos
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

    console.log(`[SkillScanner] Descobertas ${manifests.length} skills em ${directories.length} diretório(s)`);
    return manifests;
  }

  /**
   * Lê o manifesto de uma skill individual a partir da sua pasta.
   */
  private readSkillManifest(id: string, directory: string): SkillManifest | null {
    const toolsMdPath = path.join(directory, 'TOOLS.md');
    const manifestJsonPath = path.join(directory, 'manifest.json');
    const skillTsPath = path.join(directory, `${id}.skill.ts`);
    const indexTsPath = path.join(directory, 'index.ts');

    // Precisa ter pelo menos um manifesto (TOOLS.md ou manifest.json)
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
      } catch {
        toolsMarkdown = null;
      }
    }

    if (hasManifestJson) {
      try {
        const raw = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
        toolDefinitions = raw.tools || raw.toolDefinitions || [];
        metadata = raw.metadata || raw;
      } catch {
        // Manifesto inválido, ignorar
      }
    }

    // Descobrir o entry point
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
