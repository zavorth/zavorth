import * as fs from 'node:fs';
import * as path from 'node:path';

function classifyFile(name: string, relativePath: string): string {
  if (name === 'SOUL.md' || name === 'IDENTITY.md') return 'identity';
  if (name === 'SKILL.md') return 'skill';
  if (relativePath.startsWith('memory/') || relativePath.startsWith('memory\\')) return 'memory';
  if (name === 'mcp.json') return 'mcp';
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'config';
  return 'unknown';
}

function scanDir(dir: string, base: string): any[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const items: any[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      items.push(...scanDir(fullPath, base));
    } else {
      const relativePath = path.relative(base, fullPath).split(path.sep).join('/');
      items.push({ relativePath, kind: classifyFile(entry.name, relativePath), source: 'rule' });
    }
  }
  return items;
}

export class DeepHomeImportPlannerService {
  async buildPlan({ sourcePath, smart, provider }: { sourcePath: string; smart: boolean; provider?: any }) {
    let items = scanDir(sourcePath, sourcePath);
    let llmUsed = false;

    if (smart && provider) {
      for (const item of items) {
        if (item.kind === 'unknown') {
          const response = await provider.chat();
          const classifications = JSON.parse(response.content);
          const match = classifications.find((c: any) => c.path === item.relativePath);
          if (match) {
            item.kind = match.kind;
            item.source = 'llm';
            llmUsed = true;
          }
        }
      }
    }

    const summary = {
      total: items.length,
      identity: items.filter((i: any) => i.kind === 'identity').length,
      skill: items.filter((i: any) => i.kind === 'skill').length,
      memory: items.filter((i: any) => i.kind === 'memory').length,
      mcp: items.filter((i: any) => i.kind === 'mcp').length,
    };

    const ontology = [...new Set(items.map((i: any) => i.kind))];

    return { summary, items, llmUsed, ontology };
  }
}
