import { ArchitectureDependencyGraphService } from '../src/observability/ArchitectureDependencyGraphService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new ArchitectureDependencyGraphService();
  const snapshot = service.buildSnapshot();
  const violations = snapshot.violations;

  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      generatedAt: snapshot.generatedAt,
      status: violations.length === 0 ? 'passed' : 'failed',
      crossDomainEdges: snapshot.summary.crossDomainEdges,
      crossDomainViolations: snapshot.summary.crossDomainViolations,
      violations,
    }, null, 2)}\n`);
  } else {
    console.log('[architecture-boundary] checando imports entre domains oficiais');
    console.log(`[architecture-boundary] arestas auditadas: ${snapshot.summary.crossDomainEdges}`);
    console.log(`[architecture-boundary] violations: ${violations.length}`);
    for (const violation of violations.slice(0, 20)) {
      console.log(
        `- ${violation.importerDomain} -> ${violation.targetDomain}: `
        + `${violation.importerPath} importa ${violation.specifier}`,
      );
    }
  }

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    '[architecture-boundary] failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
