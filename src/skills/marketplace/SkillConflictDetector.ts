import fs from 'node:fs';
import path from 'node:path';

export type ConflictResult = {
  hasConflicts: boolean;
  conflicts: Conflict[];
};

export type Conflict = {
  type: 'tool-override' | 'permission-clash' | 'name-collision';
  skill1: string;
  skill2: string;
  detail: string;
  severity: 'warning' | 'error';
};

export function detectConflicts(skillsDir: string): ConflictResult {
  const conflicts: Conflict[] = [];
  const skillNames = new Map<string, string[]>();
  const toolOwners = new Map<string, string[]>();
  const permissionSets = new Map<string, string[]>();

  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      const content = fs.readFileSync(skillMdPath, 'utf-8');

      const nameMatch = content.match(/^---\s*\n[\s\S]*...name:\s*["']...([^\s"']+)/m);
      if (nameMatch) {
        const name = nameMatch[1];
        if (skillNames.has(name)) {
          skillNames.get(name)!.push(entry.name);
        } else {
          skillNames.set(name, [entry.name]);
        }
      }

      const toolRefs = content.match(/`([a-z_]+)`/g) || [];
      for (const ref of toolRefs) {
        const tool = ref.replace(/`/g, '');
        if (toolOwners.has(tool)) {
          toolOwners.get(tool)!.push(entry.name);
        } else {
          toolOwners.set(tool, [entry.name]);
        }
      }

      const perms = extractPermissions(content);
      permissionSets.set(entry.name, perms);
    }
  } catch { /* skip */ }

  for (const [name, dirs] of skillNames) {
    if (dirs.length > 1) {
      conflicts.push({
        type: 'name-collision',
        skill1: dirs[0],
        skill2: dirs[1],
        detail: `Multiple skills use name "${name}": ${dirs.join(', ')}`,
        severity: 'warning',
      });
    }
  }

  for (const [tool, owners] of toolOwners) {
    if (owners.length > 1) {
      conflicts.push({
        type: 'tool-override',
        skill1: owners[0],
        skill2: owners[1],
        detail: `Both skills reference tool "${tool}"`,
        severity: 'warning',
      });
    }
  }

  const skills = Array.from(permissionSets.entries());
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const [s1, p1] = skills[i];
      const [s2, p2] = skills[j];
      const clash = p1.filter((p) => p === 'execute' && p2.includes('execute'));
      if (clash.length > 0 && hasOverlappingFocus(s1, s2, skillNames)) {
        conflicts.push({
          type: 'permission-clash',
          skill1: s1,
          skill2: s2,
          detail: `Both skills require execute permission with overlapping focus`,
          severity: 'warning',
        });
      }
    }
  }

  return { hasConflicts: conflicts.length > 0, conflicts };
}

function extractPermissions(content: string): string[] {
  const perms: string[] = [];
  if (/\b(read|view|inspect)\b/i.test(content)) perms.push('read');
  if (/\b(write|create|save|patch)\b/i.test(content)) perms.push('write');
  if (/\b(exec|run|execute|terminal|shell)\b/i.test(content)) perms.push('execute');
  if (/\b(fetch|http|url|api)\b/i.test(content)) perms.push('network');
  return perms;
}

function hasOverlappingFocus(s1: string, s2: string, _skillNames: Map<string, string[]>): boolean {
  const focusWords = ['test', 'review', 'security', 'docs', 'code', 'deploy', 'debug'];
  const lower1 = s1.toLowerCase();
  const lower2 = s2.toLowerCase();
  return focusWords.some((w) => lower1.includes(w) && lower2.includes(w));
}
