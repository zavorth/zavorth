import fs from 'node:fs';
import path from 'node:path';

type BudgetViolation = {
  file: string;
  lines: number;
  budget: number;
  domain: string;
};

type LocBudgetsReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed';
    totalFiles: number;
    violatingFiles: number;
    domainsChecked: number;
  };
  budgets: Record<string, number>;
  violations: BudgetViolation[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const workspaceRoot = process.cwd();

const DEFAULT_BUDGETS: Record<string, number> = {
  'src/providers/': 500,
  'src/tools/': 400,
  'src/services/': 800,
  'src/cli/': 600,
  'src/security/': 500,
  'tests/': 1300,
};

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.git', 'ai-gateway', 'web']);

function loadBudgets(): Record<string, number> {
  const budgetsPath = path.join(workspaceRoot, 'data', 'runtime', 'qa', 'loc-budgets.json');
  if (fs.existsSync(budgetsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
      const parsedBudgets: Record<string, number> = {};
      if (data.budgets && typeof data.budgets === 'object') {
        for (const [key, val] of Object.entries(data.budgets)) {
          if (val && typeof val === 'object' && 'maxLines' in val) {
            parsedBudgets[key] = (val as any).maxLines;
          } else if (typeof val === 'number') {
            parsedBudgets[key] = val;
          }
        }
      } else {
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'number') {
            parsedBudgets[key] = val;
          }
        }
      }
      return { ...DEFAULT_BUDGETS, ...parsedBudgets };
    } catch {
      return DEFAULT_BUDGETS;
    }
  }
  return DEFAULT_BUDGETS;
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...walk(full));
      }
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const budgets = loadBudgets();
const violations: BudgetViolation[] = [];

const directoriesToScan = new Set<string>();
for (const domain of Object.keys(budgets)) {
  const dir = path.join(workspaceRoot, domain);
  if (fs.existsSync(dir)) {
    directoriesToScan.add(dir);
  }
}

let totalFiles = 0;

for (const dir of directoriesToScan) {
  const files = walk(dir);
  for (const filePath of files) {
    const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).length;

    let domain = '';
    let budget = 0;
    for (const [domainPath, budgetValue] of Object.entries(budgets)) {
      if (relPath.startsWith(domainPath)) {
        domain = domainPath;
        budget = budgetValue;
        break;
      }
    }

    if (domain && lines > budget) {
      violations.push({
        file: relPath,
        lines,
        budget,
        domain,
      });
    }
    totalFiles++;
  }
}

const report: LocBudgetsReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: violations.length > 0 ? 'failed' : 'passed',
    totalFiles,
    violatingFiles: violations.length,
    domainsChecked: Object.keys(budgets).length,
  },
  budgets,
  violations: violations.sort((a, b) => b.lines - a.lines),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[loc-limits] checking lines-of-code budgets');
  console.log(`[loc-limits] domains checked: ${Object.keys(budgets).length}`);
  console.log(`[loc-limits] files scanned: ${totalFiles}`);

  console.log('\n[loc-limits] budgets:');
  for (const [domain, budget] of Object.entries(budgets)) {
    console.log(`  - ${domain}: ${budget} lines max per file`);
  }

  if (violations.length > 0) {
    console.log(`\n[loc-limits] violations (${violations.length}):`);
    for (const v of violations) {
      console.log(`  - ${v.file}: ${v.lines} lines (budget: ${v.budget}, excess: ${v.lines - v.budget})`);
    }
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
