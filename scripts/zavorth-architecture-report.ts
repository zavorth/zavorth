import fs from 'node:fs';
import path from 'node:path';
import { ArchitectureRefactorScorecardService } from '../src/observability/ArchitectureRefactorScorecardService.js';

function readArgValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return null;
  }
  const candidate = String(argv[index + 1] || '').trim();
  return candidate || null;
}

function renderMarkdown() {
  const service = new ArchitectureRefactorScorecardService();
  const snapshot = service.buildSnapshot();
  const lines = [
    '# Architecture Scorecard',
    '',
    `- Generated at: ${snapshot.generatedAt}`,
    `- Posture: ${snapshot.summary.posture}`,
    `- Gate: ${snapshot.gate.status}`,
    '',
    '## Summary',
    '',
    `- Source files: ${snapshot.summary.totalSourceFiles}`,
    `- \`src/services\`: ${snapshot.summary.servicesFiles}`,
    `- \`src/domain\`: ${snapshot.summary.domainFiles}`,
    `- Control plane kit: ${snapshot.summary.controlPlaneFamiliesReady}/${snapshot.summary.controlPlaneFamiliesTotal}`,
    `- Presentation boundary: ${snapshot.summary.presentationSurfacesReady}/${snapshot.summary.presentationSurfacesTotal}`,
    `- Architecture docs: ${snapshot.summary.architectureDocsReady}/${snapshot.summary.architectureDocsTotal}`,
    `- Legacy hotspots frozen: ${snapshot.summary.legacyHotspotCount}`,
    `- Legacy hotspot regressions: ${snapshot.summary.legacyHotspotRegressionCount}`,
    `- Compatibility facades: ${snapshot.summary.compatibilityFacadeFiles}`,
    `- Cross-domain violations: ${snapshot.summary.domainDependencyViolations}`,
    '',
    '## Rules',
    '',
    ...snapshot.rules.map((entry) => `- \`${entry.id}\`: ${entry.status} | ${entry.summary}`),
    '',
    '## Top Files',
    '',
    ...snapshot.sourceSnapshots.topFilesByLines.map((entry) =>
      `- \`${entry.relativePath}\`: ${entry.lines} lines | ${entry.bytes} bytes`),
    '',
    '## Top Modules',
    '',
    ...snapshot.dependencyGraph.moduleHotspots.slice(0, 10).map((entry) =>
      `- \`${entry.id}\`: fan-out ${entry.fanOut} | fan-in ${entry.fanIn} | files ${entry.fileCount}`),
    '',
    '## Top Entrypoints',
    '',
    ...snapshot.dependencyGraph.entrypointHotspots.slice(0, 10).map((entry) =>
      `- \`${entry.path}\`: ${entry.kind} | fan-in ${entry.fanIn} | fan-out ${entry.fanOut}`),
    '',
    '## Domain Migration',
    '',
    ...snapshot.dependencyGraph.domainMigration.map((entry) =>
      `- \`${entry.id}\`: ${entry.stage} | ownership=${entry.ownershipReady ? 'ready' : 'pending'} | next=${entry.nextAction}`),
    '',
    '## Architecture Docs',
    '',
    ...snapshot.architectureDocs.map((entry) =>
      `- \`${entry.path}\`: ${entry.present ? 'present' : 'missing'} | ${entry.label}`),
    '',
    '## Actions',
    '',
    ...snapshot.actions.map((entry) =>
      `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
  ];
  return {
    snapshot,
    markdown: lines.join('\n'),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const outputFile = readArgValue(argv, '--write');
  const requirePass = argv.includes('--require-pass');
  const { snapshot, markdown } = renderMarkdown();

  if (outputFile) {
    const absolute = path.isAbsolute(outputFile) ? outputFile : path.join(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${markdown}\n`, 'utf8');
    console.log(`[architecture-report] wrote ${absolute}`);
  } else {
    process.stdout.write(`${markdown}\n`);
  }

  if (snapshot.gate.status === 'failed' || (requirePass && snapshot.gate.status !== 'passed')) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[architecture-report] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
