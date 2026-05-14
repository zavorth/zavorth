import { writeQaJsonReport } from '../QaSupport.js';
import {
  buildReliabilityCompatReport,
  renderReliabilityCompatReport,
} from './ReliabilityCompat.js';

const report = buildReliabilityCompatReport();
const reportPath = writeQaJsonReport('reliability-compat.json', report);

console.log(renderReliabilityCompatReport(report));
console.log(`[qa] reliability compat salvo em ${reportPath}`);

if (report.status !== 'passed') {
  process.exit(1);
}
