import type { GitHubRepoInfo } from './SkillPackageTypes.js';

/**
 * Generic GitHub repository search for skill-like packages.
 * Uses the user query plus neutral keywords only (no third-party product names).
 */
export async function searchGitHubRepos(query: string, token?: string): Promise<GitHubRepoInfo[]> {
  const q = String(query || '').trim();
  if (!q) return [];
  const searchQuery = `${q} skill in:name,description,readme`;
  const url = `https://api.github.com/search/repositories...q=${encodeURIComponent(searchQuery)}&sort=updated&per_page=10`;

  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      items: Array<{
        full_name: string;
        description: string | null;
        html_url: string;
        stargazers_count: number;
        updated_at: string;
      }>;
    };
    return (data.items || []).map((item) => ({
      fullName: item.full_name,
      description: item.description || '',
      url: item.html_url,
      stars: item.stargazers_count,
      updatedAt: item.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function searchGitHubReposBroad(query: string, token?: string): Promise<GitHubRepoInfo[]> {
  const q = String(query || '').trim();
  if (!q) return [];
  // Neutral expansions only — user keywords drive discovery.
  const searches = [`${q} skill`, `${q} agent skill`, `${q} tool pack`];

  const allResults: GitHubRepoInfo[] = [];
  const seen = new Set<string>();

  for (const search of searches) {
    const results = await searchGitHubRepos(search, token);
    for (const r of results) {
      if (!seen.has(r.fullName)) {
        seen.add(r.fullName);
        allResults.push(r);
      }
    }
  }

  return allResults.sort((a, b) => b.stars - a.stars);
}
