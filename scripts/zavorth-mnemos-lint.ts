#!/usr/bin/env tsx
import { ZavorthMnemosLintService } from '../src/services/ZavorthMnemosLintService.js';

const args = new Set(process.argv.slice(2));
const json = args.has('--json');
const service = new ZavorthMnemosLintService();
const snapshot = service.lint();

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  console.log(`Mnemos lint: ${snapshot.status}`);
  console.log(`Pages: ${snapshot.summary.pages}`);
  console.log(`Findings: ${snapshot.summary.findings} (critical ${snapshot.summary.critical}, errors ${snapshot.summary.errors}, warnings ${snapshot.summary.warnings})`);
  for (const finding of snapshot.findings.slice(0, 12)) {
    const page = finding.pagePath ? ` ${finding.pagePath}` : '';
    console.log(`- [${finding.severity}] ${finding.kind}${page}: ${finding.summary}`);
  }
  if (snapshot.findings.length > 12) {
    console.log(`- ? ${snapshot.findings.length - 12} more findings`);
  }
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}
