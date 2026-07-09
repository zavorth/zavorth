import type { GitHubRepoInfo } from './SkillPackageTypes.js';

export async function searchGitHubRepos(query: string, token?: string): Promise<GitHubRepoInfo[]> {
  const searchQuery = `${query} zavorth skill in:description,readme`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=updated&per_page=10`;

  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];

    const data = await res.json() as { items: Array<{ full_name: string; description: string | null; html_url: string; stargazers_count: number; updated_at: string }> };
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
  const searches = [
    `${query} skill`,
    `${query} agent tool`,
    `zavorth ${query}`,
  ];

  const allResults: GitHubRepoInfo[] = [];
  const seen = new Set<string>();

  for (const q of searches) {
    const results = await searchGitHubRepos(q, token);
    for (const r of results) {
      if (!seen.has(r.fullName)) {
        seen.add(r.fullName);
        allResults.push(r);
      }
    }
  }

  return allResults.sort((a, b) => b.stars - a.stars);
}
