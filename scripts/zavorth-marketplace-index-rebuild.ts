/**
 * Rebuilds config/marketplace-index.json by scanning skill-library/native/
 * for all skill directories and categorizing them.
 *
 * Usage:
 *   npx tsx scripts/zavorth-marketplace-index-rebuild.ts           # writes index
 *   npx tsx scripts/zavorth-marketplace-index-rebuild.ts --check     # validates only
 *   npx tsx scripts/zavorth-marketplace-index-rebuild.ts --json       # outputs JSON summary
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface SkillEntry {
  dir: string;
  categories: string[];
  hasSkillMd: boolean;
}

interface Category {
  id: string;
  label: string;
  description: string;
  skillCount: number;
}

interface MarketIndex {
  schemaVersion: string;
  categories: Category[];
  remoteRegistry: null;
  skills: SkillEntry[];
  generatedAt: string;
}

// ── Category definitions ─────────────────────────────────────

const CATEGORY_RULES: Array<{
  id: string;
  label: string;
  description: string;
  matchers: RegExp[];
}> = [
  {
    id: 'development',
    label: 'Development',
    description: 'Code review, testing, debugging, frameworks',
    matchers: [
      /code-review|code-cli|dev-workbench|figma-to-code|screenshot-to-code|react-flow|zustand|shadcn-component|static-html|theme-customizer|design-system|workflow-designer|interactive-debugging|subagent-development|agent-orchestrator|devops-docker|git-workflow|package-runtime|workspace-scope/i,
    ],
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Web search, analysis, summarization, academic',
    matchers: [
      /research|arxiv|wikipedia|osint|market-research|survey|web-research|web-feed|prompt-evolution|academic|patent|web-artifacts|wiki/i,
    ],
  },
  {
    id: 'productivity',
    label: 'Productivity',
    description: 'Tasks, calendar, reminders, project management',
    matchers: [
      /task|meeting|content-calendar|personal-finance|resume|business-writer|presentation|content-calendar|workflow|taskflow|task-inbox|app-launcher|system-power|dnd|obsidian|notion|linear|jira|trello|todoist|asana/i,
    ],
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Image, audio, video generation and editing',
    matchers: [
      /media|audio|video|music|meme|podcast|animation|remotion|blender|3d-model|canva|figma|design|image|screenshot|watermark|diagram|svg|static-html-optim/i,
    ],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Auditing, scanning, hardening, penetration testing',
    matchers: [
      /security|vulnerability|penetration|redteam|injection|compliance|blockchain-audit|static-security|credential-vault|api-security/i,
    ],
  },
  {
    id: 'devops',
    label: 'DevOps',
    description: 'Docker, Kubernetes, Terraform, deployment, CI/CD',
    matchers: [
      /docker|kubernetes|terraform|ansible|argocd|istio|prometheus|grafana|kafka|spark|airflow|cloud|aws|gcp|azure|netlify|cloudflare|tunnel|deploy|ops-runtime|monitoring|prometheus|alerting|etl|pipeline|ops/i,
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Email, messaging, notifications, social media',
    matchers: [
      /discord|slack|telegram|whatsapp|email|social|communication|meeting-facilitator|channel-response|message|notification|webhook|community/i,
    ],
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Databases, analytics, visualization, BI',
    matchers: [
      /data|sql|postgres|clickhouse|dbt|pandas|jupyter|dataset|data-story|data-science|analytics|airtable|insight|query|sql-visualiz/i,
    ],
  },
  {
    id: 'ai-ml',
    label: 'AI & Machine Learning',
    description: 'Training, fine-tuning, inference, RAG, agents',
    matchers: [
      /ml-|mlflow|wandb|vllm|tensorrt|unsloth|axolotl|peft|lora|fine-tune|model-fine|model-routing|model|rag|dspy|prompt-optimizer|cognitive-prompt|multiagent-swarm|agent-evaluator|ai-safety|physical-ai|rag-builder|ml-experiment|spark-optim/i,
    ],
  },
  {
    id: 'finance-legal',
    label: 'Finance & Legal',
    description: 'Financial modeling, trading, contracts, compliance',
    matchers: [
      /finance|dcf|lbo|merger|stock|trader|hyperliquid|transaction|stripe|patent-search|contract|compliance|financial/i,
    ],
  },
  {
    id: 'creative',
    label: 'Creative & Design',
    description: 'Branding, design kits, visual identity, aesthetics',
    matchers: [
      /brand-kit|aesthetic|figma|canva|diagram-generator|animation-maker|meme|music-composer|speech-tts|podcast|video-editor|video-intelligence|nft-creator|meme-generator/i,
    ],
  },
  {
    id: 'blockchain',
    label: 'Blockchain & Web3',
    description: 'EVM, Solana, NFTs, smart contracts',
    matchers: [
      /blockchain|evm|solana|nft|web3|hyperliquid|smart-contract/i,
    ],
  },
];

// ── Scanning ─────────────────────────────────────────────────

function scanNativeSkills(nativeDir: string): SkillEntry[] {
  const entries = fs.readdirSync(nativeDir, { withFileTypes: true });
  const skills: SkillEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'README.md') continue;

    const skillPath = path.join(nativeDir, entry.name);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const hasSkillMd = fs.existsSync(skillMdPath);

    const categories = classifySkill(entry.name);

    skills.push({
      dir: entry.name,
      categories,
      hasSkillMd,
    });
  }

  return skills.sort((a, b) => a.dir.localeCompare(b.dir));
}

function classifySkill(dirName: string): string[] {
  const matched: string[] = [];
  for (const rule of CATEGORY_RULES) {
    for (const matcher of rule.matchers) {
      if (matcher.test(dirName)) {
        if (!matched.includes(rule.id)) {
          matched.push(rule.id);
        }
        break;
      }
    }
  }
  // If no category matched, default to "development" (catch-all for dev tools)
  if (matched.length === 0) {
    matched.push('development');
  }
  return matched;
}

function countByCategory(skills: SkillEntry[]): Category[] {
  const counts = new Map<string, number>();

  for (const rule of CATEGORY_RULES) {
    counts.set(rule.id, 0);
  }

  for (const skill of skills) {
    for (const cat of skill.categories) {
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  }

  return CATEGORY_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    description: rule.description,
    skillCount: counts.get(rule.id) || 0,
  }));
}

// ── Check / diff ─────────────────────────────────────────────

function normalizeCategoriesList(categories: Category[] | undefined): string {
  return (categories || [])
    .map((c) => `${c.id}\t${c.label}\t${c.description}\t${c.skillCount}`)
    .sort()
    .join('\n');
}

function normalizeSkillsList(skills: SkillEntry[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of skills || []) {
    const cats = [...(skill.categories || [])].sort().join(',');
    map.set(skill.dir, `${cats}|${skill.hasSkillMd ? '1' : '0'}`);
  }
  return map;
}

/**
 * Structural equality for the marketplace index (ignores generatedAt).
 * Catches skill adds/removes, category reassignment, hasSkillMd drift,
 * schema bumps, and category metadata changes — not just total counts.
 */
function diffMarketplaceIndex(existing: MarketIndex, expected: MarketIndex): string[] {
  const failures: string[] = [];

  if (existing.schemaVersion !== expected.schemaVersion) {
    failures.push(
      `schemaVersion: existing=${JSON.stringify(existing.schemaVersion)} expected=${JSON.stringify(expected.schemaVersion)}`,
    );
  }

  if ((existing.remoteRegistry ?? null) !== (expected.remoteRegistry ?? null)) {
    failures.push(
      `remoteRegistry: existing=${JSON.stringify(existing.remoteRegistry)} expected=${JSON.stringify(expected.remoteRegistry)}`,
    );
  }

  const existingCats = normalizeCategoriesList(existing.categories);
  const expectedCats = normalizeCategoriesList(expected.categories);
  if (existingCats !== expectedCats) {
    const existingIds = new Set((existing.categories || []).map((c) => c.id));
    const expectedIds = new Set((expected.categories || []).map((c) => c.id));
    for (const id of expectedIds) {
      if (!existingIds.has(id)) failures.push(`category missing in index: ${id}`);
    }
    for (const id of existingIds) {
      if (!expectedIds.has(id)) failures.push(`category stale in index: ${id}`);
    }
    for (const exp of expected.categories || []) {
      const got = (existing.categories || []).find((c) => c.id === exp.id);
      if (!got) continue;
      if (got.skillCount !== exp.skillCount) {
        failures.push(`category ${exp.id} skillCount: existing=${got.skillCount} expected=${exp.skillCount}`);
      }
      if (got.label !== exp.label) {
        failures.push(`category ${exp.id} label: existing=${JSON.stringify(got.label)} expected=${JSON.stringify(exp.label)}`);
      }
      if (got.description !== exp.description) {
        failures.push(`category ${exp.id} description drift`);
      }
    }
  }

  const existingSkills = normalizeSkillsList(existing.skills);
  const expectedSkills = normalizeSkillsList(expected.skills);

  if (existingSkills.size !== expectedSkills.size) {
    failures.push(`skills count: existing=${existingSkills.size} expected=${expectedSkills.size}`);
  }

  for (const [dir, signature] of expectedSkills) {
    if (!existingSkills.has(dir)) {
      failures.push(`skill missing in index: ${dir}`);
      continue;
    }
    if (existingSkills.get(dir) !== signature) {
      failures.push(
        `skill ${dir} metadata drift: existing=${existingSkills.get(dir)} expected=${signature}`,
      );
    }
  }
  for (const dir of existingSkills.keys()) {
    if (!expectedSkills.has(dir)) {
      failures.push(`skill stale in index: ${dir}`);
    }
  }

  return failures;
}

// ── Main ─────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isJson = args.includes('--json');

  const repoRoot = process.cwd();
  const nativeDir = path.join(repoRoot, 'skill-library', 'native');
  const indexFile = path.join(repoRoot, 'config', 'marketplace-index.json');

  if (!fs.existsSync(nativeDir)) {
    console.error(`[marketplace-rebuild] skill-library/native/ not found at ${nativeDir}`);
    process.exit(1);
  }

  const skills = scanNativeSkills(nativeDir);
  const categories = countByCategory(skills);

  const index: MarketIndex = {
    schemaVersion: 'zavorth.marketplace-index/v2',
    categories,
    remoteRegistry: null,
    skills,
    generatedAt: new Date().toISOString(),
  };

  if (isJson) {
    // Output summary as JSON (without the full skills list)
    const summary = {
      totalSkills: skills.length,
      categories: categories,
      skillsWithoutCategory: skills.filter((s) => s.categories.length === 1 && s.categories[0] === 'development' && !/dev|code|workbench|debug/.test(s.dir)).map((s) => s.dir),
      skillsWithoutSkillMd: skills.filter((s) => !s.hasSkillMd).map((s) => s.dir),
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`[marketplace-rebuild] Scanned ${skills.length} skills in skill-library/native/`);
  console.log('');
  console.log('Category distribution:');
  for (const cat of categories) {
    console.log(`  ${cat.id.padEnd(20)} ${String(cat.skillCount).padStart(4)}  ${cat.label}`);
  }
  console.log('');

  const uncategorized = skills.filter(
    (s) => s.categories.length === 1 && s.categories[0] === 'development' && !/dev|code|workbench|debug|test|repo|prompt|security|audit|memory|provider|dashboard|user-onboard|channel|incident|document|governed/i.test(s.dir),
  );
  if (uncategorized.length > 0) {
    console.log(`Skills defaulting to "development" (manual review suggested):`);
    for (const s of uncategorized) {
      console.log(`  - ${s.dir}`);
    }
    console.log('');
  }

  if (isCheck) {
    if (!fs.existsSync(indexFile)) {
      console.error(`[marketplace-rebuild] CHECK FAILED — missing index at ${indexFile}`);
      process.exit(1);
    }

    let existing: MarketIndex;
    try {
      existing = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as MarketIndex;
    } catch (error) {
      console.error(
        `[marketplace-rebuild] CHECK FAILED — unreadable index JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exit(1);
    }

    const failures = diffMarketplaceIndex(existing, index);
    if (failures.length === 0) {
      console.log(
        `[marketplace-rebuild] CHECK PASSED — index is current (${skills.length} skills, ${categories.length} categories)`,
      );
      process.exit(0);
    }

    console.error(`[marketplace-rebuild] CHECK FAILED — index is stale (${failures.length} drift item(s)):`);
    for (const failure of failures.slice(0, 40)) {
      console.error(`  - ${failure}`);
    }
    if (failures.length > 40) {
      console.error(`  … and ${failures.length - 40} more`);
    }
    console.error('[marketplace-rebuild] Run: npm run zavorth:marketplace-index-rebuild');
    process.exit(1);
  }

  // Write the updated index
  const output = JSON.stringify(index, null, 2) + '\n';
  fs.writeFileSync(indexFile, output, 'utf8');
  console.log(`[marketplace-rebuild] Wrote ${indexFile}`);
  console.log(`[marketplace-rebuild] Schema version: ${index.schemaVersion}`);
}

main();
