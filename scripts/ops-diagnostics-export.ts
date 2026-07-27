#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import path from 'path';
import { DiagnosticsExporterService } from '../src/services/DiagnosticsExporterService.js';

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

async function main() {
  const argv = process.argv.slice(2);
  let explicitOutput = readFlexibleStringFlag(argv, 'output');
  if (!explicitOutput) {
    const oIndex = argv.indexOf('-o');
    if (oIndex >= 0 && argv[oIndex + 1]) {
      explicitOutput = argv[oIndex + 1];
    }
  }

  const projectRoot = path.resolve(path.dirname(import.meta.url.replace(/^file:\/\/\/.../, '')), '..');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultPath = path.join(process.cwd(), `diagnostics-export-${timestamp}.json`);
  const outputPath = explicitOutput ? path.resolve(explicitOutput) : defaultPath;

  console.log(`[zavorth-ops] Exporting sanitized diagnostics to: ${outputPath}`);

  try {
    const exporter = new DiagnosticsExporterService();
    const report = await exporter.export({
      projectRoot: process.cwd(),
      outputPath,
    });
    console.log(`[zavorth-ops] Diagnostics exported successfully!`);
    console.log(`[zavorth-ops] Logs gathered: ${report.logs.length}`);
    console.log(`[zavorth-ops] Exported at: ${report.exportedAt}`);
    process.exit(0);
  } catch (error: unknown) {
    const err = asErrorLike(error);

    console.error(`[zavorth-ops] Failed to export diagnostics: ${error?.message || String(error)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[zavorth-ops] Exporter script failed:', err);
  process.exit(1);
});
