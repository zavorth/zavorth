import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { VendorReleaseReportService } from '../src/services/VendorReleaseReportService.js';

async function main(): Promise<void> {
  const service = new VendorReleaseReportService();
  const snapshot = service.buildSnapshot();
  const markdown = service.renderMarkdown();
  const outputDir = path.join(config.projectRoot, 'data', 'release', 'vendors');
  const jsonPath = path.join(outputDir, 'vendor-release-report.json');
  const markdownPath = path.join(outputDir, 'vendor-release-report.md');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.writeFileSync(markdownPath, markdown, 'utf8');

  console.log([
    'Zavorth Vendor Release Report',
    `JSON: ${jsonPath}`,
    `Markdown: ${markdownPath}`,
    `Vendors: ${snapshot.summary.total}`,
    `Updates available: ${snapshot.summary.updateAvailable}`,
  ].join('\n'));
}

main().catch((error) => {
  console.error(`[vendor-release-report] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
