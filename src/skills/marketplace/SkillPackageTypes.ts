export type SkillTrustLevel = 'verified' | 'trusted' | 'unknown' | 'suspicious';

export type SkillFileType = 'instruction' | 'script' | 'config' | 'reference' | 'template' | 'data' | 'other';

export type SkillFileEntry = {
  path: string;
  type: SkillFileType;
  size: number;
};

export type SkillPackageManifest = {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  minZavorthVersion: string;
  dependencies: string[];
  checksum: string;
  publishedAt: string;
  repository: string | null;
  files?: SkillFileEntry[];
};

export type SkillPackageSummary = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  source: 'local' | 'git' | 'file';
  sourceUrl: string | null;
  installedAt: string | null;
  checksum: string;
  rating: number;
  downloads: number;
  trustLevel: SkillTrustLevel;
  authorTrustScore: number;
  fileCount: number;
};

export type SkillPublishInput = {
  skillDir: string;
  repoUrl?: string;
  outputDir?: string;
};

export type SkillPublishResult = {
  success: boolean;
  skillId: string;
  version: string;
  location: 'local' | 'git' | 'file';
  message: string;
};

export type SkillInstallInput = {
  source: string;
  targetName?: string;
  force?: boolean;
};

export type SkillInstallResult = {
  success: boolean;
  skillId: string;
  installedPath: string;
  message: string;
};

export type SkillValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest: SkillPackageManifest | null;
};

export type SkillSearchResult = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  relevance: number;
  trustLevel: SkillTrustLevel;
  downloads: number;
  source: 'local' | 'github';
};

export type GitHubRepoInfo = {
  fullName: string;
  description: string;
  url: string;
  stars: number;
  updatedAt: string;
};

export const SKILL_CATEGORIES = [
  'coding', 'research', 'creative', 'devops', 'security',
  'data', 'automation', 'communication', 'productivity', 'other',
] as const;

export type SkillCategory = typeof SKILL_CATEGORIES[number];

export type VersionConstraint = {
  name: string;
  operator: '=' | '>=' | '<=' | '^' | '~' | '*';
  version: string;
};

export function parseVersionConstraint(constraint: string): VersionConstraint {
  const match = constraint.match(/^([a-zA-Z0-9_-]+)\s*([>=<^~*]+)\s*(.+)$/);
  if (match) {
    return { name: match[1], operator: match[2] as VersionConstraint['operator'], version: match[3].trim() };
  }
  return { name: constraint.trim(), operator: '*', version: '0.0.0' };
}

export function satisfiesVersion(installed: string, constraint: VersionConstraint): boolean {
  if (constraint.operator === '*') return true;
  const parts = installed.split('.').map(Number);
  const target = constraint.version.split('.').map(Number);
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  };
  const diff = compare(parts, target);
  switch (constraint.operator) {
    case '=': return diff === 0;
    case '>=': return diff >= 0;
    case '<=': return diff <= 0;
    case '^': return diff >= 0 && parts[0] === target[0];
    case '~': return diff >= 0 && parts[0] === target[0] && parts[1] === target[1];
    default: return true;
  }
}
