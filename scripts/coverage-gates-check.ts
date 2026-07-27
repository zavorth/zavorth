import fs from 'node:fs';
import path from 'node:path';

type CoverageMetric = {
  total: number;
  covered: number;
  pct: number;
};

type FileCoverage = {
  file: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
};

type CoverageReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed' | 'skipped';
    lines: number;
    statements: number;
    branches: number;
    functions: number;
    filesBelowThreshold: number;
  };
  thresholds: {
    lines: number;
    statements: number;
    branches: number;
    functions: number;
  };
  failingFiles: FileCoverage[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requireReport = argv.includes('--require-report');
const workspaceRoot = process.cwd();

function parseThreshold(argName: string, defaultValue: number): number {
  const arg = argv.find((a) => a.startsWith(`--${argName}=`));
  return arg ? parseFloat(arg.split('=')[1]) : defaultValue;
}

const thresholds = {
  lines: parseThreshold('lines', 40),
  statements: parseThreshold('statements', 40),
  branches: parseThreshold('branches', 30),
  functions: parseThreshold('functions', 40),
};

const coveragePath = [
  path.join(workspaceRoot, 'coverage', 'jest', 'coverage-summary.json'),
  path.join(workspaceRoot, 'coverage', 'coverage-summary.json'),
].find((candidate) => fs.existsSync(candidate));

if (!coveragePath) {
  const report: CoverageReport = {
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    summary: {
      status: 'skipped',
      lines: 0,
      statements: 0,
      branches: 0,
      functions: 0,
      filesBelowThreshold: 0,
    },
    thresholds,
    failingFiles: [],
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[coverage-gates] ERROR: coverage/coverage-summary.json not found');
    console.log('[coverage-gates] Run tests with coverage first: npx jest --coverage');
  }
  if (requireReport) process.exitCode = 1;
  process.exit();
}

const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

const total = coverageData.total || {};
const overallLines = total.lines?.pct ?? 0;
const overallStatements = total.statements?.pct ?? 0;
const overallBranches = total.branches?.pct ?? 0;
const overallFunctions = total.functions?.pct ?? 0;

const failingFiles: FileCoverage[] = [];

for (const [filePath, data] of Object.entries(coverageData)) {
  if (filePath === 'total') continue;
  const fileData = data as any;
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

  const linesPct = fileData.lines?.pct ?? 0;
  const statementsPct = fileData.statements?.pct ?? 0;
  const branchesPct = fileData.branches?.pct ?? 0;
  const functionsPct = fileData.functions?.pct ?? 0;

  if (linesPct < thresholds.lines || statementsPct < thresholds.statements || branchesPct < thresholds.branches || functionsPct < thresholds.functions) {
    failingFiles.push({
      file: relPath,
      lines: { total: fileData.lines?.total ?? 0, covered: fileData.lines?.covered ?? 0, pct: linesPct },
      statements: { total: fileData.statements?.total ?? 0, covered: fileData.statements?.covered ?? 0, pct: statementsPct },
      branches: { total: fileData.branches?.total ?? 0, covered: fileData.branches?.covered ?? 0, pct: branchesPct },
      functions: { total: fileData.functions?.total ?? 0, covered: fileData.functions?.covered ?? 0, pct: functionsPct },
    });
  }
}

const overallPassed =
  overallLines >= thresholds.lines &&
  overallStatements >= thresholds.statements &&
  overallBranches >= thresholds.branches &&
  overallFunctions >= thresholds.functions;

const report: CoverageReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: overallPassed ? 'passed' : 'failed',
    lines: overallLines,
    statements: overallStatements,
    branches: overallBranches,
    functions: overallFunctions,
    filesBelowThreshold: failingFiles.length,
  },
  thresholds,
  failingFiles,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[coverage-gates] checking coverage thresholds');
  console.log(`[coverage-gates] lines:      ${overallLines.toFixed(1)}% (threshold: ${thresholds.lines}%) ${overallLines >= thresholds.lines ? 'ok' : 'FAIL'}`);
  console.log(`[coverage-gates] statements: ${overallStatements.toFixed(1)}% (threshold: ${thresholds.statements}%) ${overallStatements >= thresholds.statements ? 'ok' : 'FAIL'}`);
  console.log(`[coverage-gates] branches:   ${overallBranches.toFixed(1)}% (threshold: ${thresholds.branches}%) ${overallBranches >= thresholds.branches ? 'ok' : 'FAIL'}`);
  console.log(`[coverage-gate]  functions:  ${overallFunctions.toFixed(1)}% (threshold: ${thresholds.functions}%) ${overallFunctions >= thresholds.functions ? 'ok' : 'FAIL'}`);

  if (failingFiles.length > 0) {
    console.log(`\n[coverage-gates] files below threshold (${failingFiles.length}):`);
    for (const file of failingFiles.slice(0, 20)) {
      const issues: string[] = [];
      if (file.lines.pct < thresholds.lines) issues.push(`lines:${file.lines.pct.toFixed(1)}%`);
      if (file.statements.pct < thresholds.statements) issues.push(`stmts:${file.statements.pct.toFixed(1)}%`);
      if (file.branches.pct < thresholds.branches) issues.push(`branches:${file.branches.pct.toFixed(1)}%`);
      if (file.functions.pct < thresholds.functions) issues.push(`funcs:${file.functions.pct.toFixed(1)}%`);
      console.log(`  - ${file.file}: ${issues.join(', ')}`);
    }
    if (failingFiles.length > 20) {
      console.log(`  ? and ${failingFiles.length - 20} more`);
    }
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
