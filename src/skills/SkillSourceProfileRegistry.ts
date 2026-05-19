import type {
  ZavorthUniversalSkillSourceProfile,
  ZavorthUniversalSkillSourceProfileId,
} from '../contracts/ZavorthUniversalSkillIntakeContract.js';

const PROFILES: ZavorthUniversalSkillSourceProfile[] = [
  {
    id: 'omni-skill',
    label: 'Omni-style skill',
    priority: 100,
    description: 'Skill directory with SKILL.md plus imported provenance or enhanced metadata.',
    entrypointPatterns: ['SKILL.md', 'OMNI_ENHANCED.json', 'EXTERNAL_SOURCE.json', 'metadata.json'],
    notes: ['Imported provenance is preserved as evidence; no upstream scripts are executed.'],
  },
  {
    id: 'codex-skill',
    label: 'Codex-compatible skill',
    priority: 95,
    description: 'Skill directory shaped like a Codex skill with frontmatter and optional support material.',
    entrypointPatterns: ['SKILL.md', '.codex/skills/**/SKILL.md'],
    notes: ['Detected by source path hints or Codex-compatible SKILL.md structure.'],
  },
  {
    id: 'agent-skill',
    label: 'Agent skill',
    priority: 90,
    description: 'Agent-oriented skill directory with SKILL.md and agent support files.',
    entrypointPatterns: ['SKILL.md', 'agents/*.md'],
    notes: ['Agent support files are treated as untrusted instructions until imported through policy.'],
  },
  {
    id: 'mcp-tool-pack',
    label: 'MCP tool pack',
    priority: 85,
    description: 'Manifest-driven tool/resource pack that can later be exposed as governed MCP capability metadata.',
    entrypointPatterns: ['manifest.json', 'mcp.json', 'TOOLS.md'],
    notes: ['Intent model only inventories the pack; live tool exposure remains denied by default.'],
  },
  {
    id: 'agent-extension',
    label: 'Agent extension',
    priority: 80,
    description: 'Generic agent extension or plugin bundle described by extension/plugin metadata.',
    entrypointPatterns: ['*.plugin.json', 'extension.json', 'package.json'],
    notes: ['Extension source names are normalized into Zavorth-owned manifests.'],
  },
  {
    id: 'plugin-manifest',
    label: 'Plugin manifest',
    priority: 75,
    description: 'Generic plugin manifest with declared actions, capabilities or tools.',
    entrypointPatterns: ['plugin.json', '*.plugin.json', 'manifest.json'],
    notes: ['Plugin code is never loaded during preview.'],
  },
  {
    id: 'json-yaml-catalog',
    label: 'JSON/YAML catalog',
    priority: 70,
    description: 'Catalog file listing one or more skills or capabilities.',
    entrypointPatterns: ['catalog.json', 'catalog.yaml', 'skills.json', 'registry.json'],
    notes: ['Catalog entries become preview candidates, not trusted runtime objects.'],
  },
  {
    id: 'skill-md',
    label: 'SKILL.md',
    priority: 60,
    description: 'Standard skill directory containing a SKILL.md entrypoint.',
    entrypointPatterns: ['SKILL.md'],
    notes: ['The most portable source profile for authored skills.'],
  },
  {
    id: 'generic-markdown',
    label: 'Generic markdown skill',
    priority: 10,
    description: 'Single markdown document that can be inspected as a possible skill recipe.',
    entrypointPatterns: ['*.md'],
    notes: ['Generic markdown is previewed conservatively and requires later approval before import.'],
  },
];

export class SkillSourceProfileRegistry {
  public listProfiles(): ZavorthUniversalSkillSourceProfile[] {
    return PROFILES.slice().sort((left, right) => right.priority - left.priority);
  }

  public getProfile(id: ZavorthUniversalSkillSourceProfileId): ZavorthUniversalSkillSourceProfile {
    const profile = PROFILES.find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown skill source profile: ${id}`);
    }
    return profile;
  }
}
