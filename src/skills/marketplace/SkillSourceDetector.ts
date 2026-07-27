import fs from 'node:fs';

export type SourceType =
  | 'git-repo'
  | 'git-url'
  | 'zip-url'
  | 'tarball-url'
  | 'npm-package'
  | 'registry-url'
  | 'github-search'
  | 'local-path'
  | 'local-file'
  | 'unknown';

export type DetectedSource = {
  type: SourceType;
  original: string;
  resolved: string;
  metadata: Record<string, string>;
};

const SOURCE_PATTERNS: Array<{ pattern: RegExp; type: SourceType }> = [
  { pattern: /^npm:(.+)/, type: 'npm-package' },
  { pattern: /^https?:\/\/github\.com\/[^/]+\/[^/]+(?:\/|$)/, type: 'git-repo' },
  { pattern: /^https?:\/\/gitlab\.com\/[^/]+\/[^/]+(?:\/|$)/, type: 'git-repo' },
  { pattern: /^https?:\/\/bitbucket\.org\/[^/]+\/[^/]+(?:\/|$)/, type: 'git-repo' },
  { pattern: /^https?:\/\/[^/]+\.git$/, type: 'git-url' },
  { pattern: /^git@[^:]+:[^/]+\/[^/]+\.git$/, type: 'git-url' },
  { pattern: /^https?:\/\/[^/]+\.zip$/i, type: 'zip-url' },
  { pattern: /^https?:\/\/[^/]+\.(?:tar\.gz|tgz)$/i, type: 'tarball-url' },
  { pattern: /^https?:\/\/[^/]+\/skills\/[^/]+/, type: 'registry-url' },
  { pattern: /^https?:\/\/[^/]+\/registry\/[^/]+/, type: 'registry-url' },
  { pattern: /^https?:\/\/registry\.npmjs\.org\/[^/]+/, type: 'npm-package' },
  { pattern: /^https?:\/\/[^/]+\/-\/[^/]+\.tgz$/, type: 'npm-package' },
  { pattern: /^https?:\/\/[^/]+\/archive\//, type: 'git-repo' },
];

export function detectSource(input: string): DetectedSource {
  const trimmed = input.trim();

  if (trimmed.startsWith('/') || trimmed.match(/^[A-Z]:\\/i) || trimmed.startsWith('~')) {
    try {
      const stat = fs.statSync(trimmed);
      if (stat.isFile()) {
        return { type: 'local-file', original: trimmed, resolved: trimmed, metadata: {} };
      }
      return { type: 'local-path', original: trimmed, resolved: trimmed, metadata: {} };
    } catch {
      return { type: 'local-path', original: trimmed, resolved: trimmed, metadata: {} };
    }
  }

  for (const { pattern, type } of SOURCE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type, original: trimmed, resolved: trimmed, metadata: {} };
    }
  }

  if (trimmed.includes('github.com') || trimmed.includes('gitlab.com') || trimmed.includes('bitbucket.org')) {
    return { type: 'git-repo', original: trimmed, resolved: trimmed.replace(/\/$/, '') + '.git', metadata: {} };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { type: 'git-url', original: trimmed, resolved: trimmed, metadata: {} };
  }

  return { type: 'unknown', original: trimmed, resolved: trimmed, metadata: {} };
}

export function getSourceHint(type: SourceType): string {
  switch (type) {
    case 'git-repo': return 'Git repository — will clone and discover skills';
    case 'git-url': return 'Git URL — will clone and discover skills';
    case 'zip-url': return 'ZIP archive — will download and extract';
    case 'tarball-url': return 'Tarball — will download and extract';
    case 'npm-package': return 'npm package — will extract skill from package';
    case 'registry-url': return 'Skill registry URL — will fetch and install from registry';
    case 'github-search': return 'GitHub search — will search repositories';
    case 'local-path': return 'local directory — will scan for skills';
    case 'local-file': return 'local file — will extract/install';
    case 'unknown': return 'Unknown source — will attempt Git clone';
  }
}
