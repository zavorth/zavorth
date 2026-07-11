#!/usr/bin/env node
/**
 * scripts/merge-coverage.ts
 *
 * Unified Code Coverage Report
 *
 * Este script lê o relatório de cobertura JSON gerado pelo Jest em
 * `coverage/jest/coverage-final.json`, processa os dados usando
 * `istanbul-lib-coverage`, `istanbul-lib-report` e `istanbul-reports`
 * e gera um relatório HTML consolidado em `coverage/index.html` além
 * de um sumário em texto no terminal.
 *
 * Uso:
 *   npm run coverage:merge
 *   npx tsx scripts/merge-coverage.ts
 *   npx tsx scripts/merge-coverage.ts --json   (saída JSON do sumário)
 *
 * Quando Vitest for adicionado ao projeto, inclua sua fonte na lista SOURCES.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

const JSON_FLAG = process.argv.includes('--json');

// ────────────────────────────────────────────────────────────────────────────
// Utilitários de cor para o terminal
// ────────────────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function colorPct(pct: number): string {
  const s = pct.toFixed(2) + '%';
  if (pct >= 80) return c.green + s + c.reset;
  if (pct >= 50) return c.yellow + s + c.reset;
  return c.red + s + c.reset;
}

// ────────────────────────────────────────────────────────────────────────────
// Fontes de cobertura disponíveis
// Para adicionar Vitest no futuro, inclua uma nova entrada nesta lista.
// ────────────────────────────────────────────────────────────────────────────
interface CoverageSource {
  name: string;
  jsonPath: string;
}

const SOURCES: CoverageSource[] = [
  {
    name: 'jest',
    jsonPath: path.join(ROOT, 'coverage', 'jest', 'coverage-final.json'),
  },
  // Exemplo para adicionar Vitest quando configurado:
  // { name: 'vitest', jsonPath: path.join(ROOT, 'coverage', 'vitest', 'coverage-final.json') },
];

// ────────────────────────────────────────────────────────────────────────────
// Estrutura de sumário de cobertura
// ────────────────────────────────────────────────────────────────────────────
interface CoverageSummaryEntry {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummary {
  statements: CoverageSummaryEntry;
  branches: CoverageSummaryEntry;
  functions: CoverageSummaryEntry;
  lines: CoverageSummaryEntry;
}

// ────────────────────────────────────────────────────────────────────────────
// Função principal
// ────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (!JSON_FLAG) {
    console.log(`\n${c.bold}${c.cyan}╔═══════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.bold}${c.cyan}║  Zavorth · Unified Code Coverage Report  ║${c.reset}`);
    console.log(`${c.bold}${c.cyan}╚═══════════════════════════════════════════════════╝${c.reset}\n`);
  }

  // Verificar se pelo menos uma fonte existe
  const availableSources = SOURCES.filter((s) => {
    const exists = fs.existsSync(s.jsonPath);
    if (!exists && !JSON_FLAG) {
      console.warn(`${c.yellow}⚠  Fonte "${s.name}" não encontrada: ${s.jsonPath}${c.reset}`);
      console.warn(`${c.dim}   Execute "npx jest --coverage" para gerar os dados de cobertura.${c.reset}\n`);
    }
    return exists;
  });

  if (availableSources.length === 0) {
    if (JSON_FLAG) {
      process.stdout.write(JSON.stringify({
        ok: false,
        error: 'Nenhum arquivo de cobertura encontrado. Execute "npm run coverage:collect" primeiro.',
      }, null, 2) + '\n');
    } else {
      console.error(`${c.red}✖  Nenhum arquivo de cobertura encontrado.${c.reset}`);
      console.error(`${c.dim}   Execute primeiro: npm run coverage:collect${c.reset}\n`);
    }
    process.exit(1);
  }

  // Carregar dependências Istanbul via require (módulos CJS — transitivas do Jest)
  const libCoverage = require('istanbul-lib-coverage') as typeof import('istanbul-lib-coverage');
  const libReport = require('istanbul-lib-report') as typeof import('istanbul-lib-report');
  const reports = require('istanbul-reports') as typeof import('istanbul-reports');


  // Criar o mapa de cobertura mesclado
  const coverageMap = libCoverage.createCoverageMap({});

  for (const source of availableSources) {
    if (!JSON_FLAG) {
      console.log(`${c.dim}📂 Carregando cobertura de "${source.name}"...${c.reset}`);
    }
    const raw = JSON.parse(fs.readFileSync(source.jsonPath, 'utf8'));
    coverageMap.merge(raw);
  }

  // Criar diretório de saída
  const outDir = path.join(ROOT, 'coverage');
  fs.mkdirSync(outDir, { recursive: true });

  // Criar contexto de relatório
  const context = libReport.createContext({
    dir: outDir,
    coverageMap,
  });

  // Gerar relatório HTML consolidado
  const htmlReport = reports.create('html', { subdir: '.', skipEmpty: false } as any);
  (htmlReport as any).execute(context);

  // Gerar relatório LCOV consolidado
  const lcovReport = reports.create('lcov', {});
  (lcovReport as any).execute(context);

  // Coletar sumário de cobertura total
  const summary: CoverageSummary = coverageMap.getCoverageSummary().toJSON() as CoverageSummary;
  const htmlPath = path.join(outDir, 'index.html');
  const lcovPath = path.join(outDir, 'lcov.info');

  if (JSON_FLAG) {
    // Saída em JSON estruturado para automação (CI, etc.)
    process.stdout.write(JSON.stringify({
      ok: true,
      sources: availableSources.map((s) => s.name),
      summary,
      htmlReport: htmlPath,
      lcovReport: lcovPath,
    }, null, 2) + '\n');
    return;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Exibição do sumário formatado no terminal
  // ────────────────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}📊 Sumário de Cobertura Consolidado:${c.reset}\n`);

  const rows: Array<[string, CoverageSummaryEntry]> = [
    ['Statements', summary.statements],
    ['Branches',   summary.branches],
    ['Functions',  summary.functions],
    ['Lines',      summary.lines],
  ];

  const nameWidth = 14;
  console.log(`${c.bold}  ${'Métrica'.padEnd(nameWidth)} ${'Total'.padStart(7)} ${'Coberto'.padStart(9)} ${'Cobertura'.padStart(12)}${c.reset}`);
  console.log(`  ${'─'.repeat(nameWidth + 32)}`);

  for (const [name, entry] of rows) {
    const pctStr = colorPct(entry.pct);
    console.log(`  ${name.padEnd(nameWidth)} ${String(entry.total).padStart(7)} ${String(entry.covered).padStart(9)}   ${pctStr}`);
  }

  console.log();

  // Cobertura média geral
  const avgPct = (summary.statements.pct + summary.branches.pct + summary.functions.pct + summary.lines.pct) / 4;
  const badge = avgPct >= 80 ? '🟢 APROVADO' : avgPct >= 50 ? '🟡 PARCIAL' : '🔴 INSUFICIENTE';
  console.log(`  ${c.bold}Cobertura Geral: ${colorPct(avgPct)} ${badge}${c.reset}`);
  console.log();

  console.log(`${c.green}✅ Relatório HTML gerado em:${c.reset}  ${c.bold}${htmlPath}${c.reset}`);
  console.log(`${c.green}✅ Relatório LCOV gerado em:${c.reset}  ${c.bold}${lcovPath}${c.reset}`);
  const fontesList = availableSources.map((s) => `"${s.name}"`).join(', ');
  console.log(`${c.dim}   Fontes mescladas: ${fontesList}${c.reset}\n`);
}

main().catch((err) => {
  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }, null, 2) + '\n');
  } else {
    console.error(`\n❌ Erro ao gerar relatório de cobertura:`, err);
  }
  process.exit(1);
});
