#!/usr/bin/env node
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/render-report.js <security-audit.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const groups = { critical: [], high: [], medium: [], low: [] };
for (const f of data.findings || []) groups[f.severity].push(f);

function renderFinding(f) {
  return [
    `#### ${f.title}`,
    `- Severity: ${f.severity}`,
    `- Confidence: ${f.confidence}`,
    `- Status: ${f.status}`,
    `- Evidence: ${f.evidence}`,
    `- Impact: ${f.impact}`,
    `- Files: ${f.affectedFiles.join(', ')}`,
    `- Recommended fix: ${f.recommendedFix}`,
    ''
  ].join('\n');
}

let out = '';
out += '# Security Audit Report\n\n';
out += `- Framework detected: ${data.framework}\n`;
out += `- Total findings: ${data.summary.total}\n`;
out += `- Critical: ${data.summary.critical}, High: ${data.summary.high}, Medium: ${data.summary.medium}, Low: ${data.summary.low}\n\n`;
out += '## Executive summary\n';
out += 'This report is evidence-oriented. Findings marked probable or manual-review should be validated in source context before remediation planning is finalized.\n\n';
for (const sev of ['critical', 'high', 'medium', 'low']) {
  out += `## ${sev[0].toUpperCase() + sev.slice(1)}\n\n`;
  if (groups[sev].length === 0) out += '_No findings._\n\n';
  else for (const f of groups[sev]) out += renderFinding(f);
}
out += '## Manual review checklist\n\n';
out += '- Verify authz on admin and privileged routes.\n';
out += '- Verify whether raw queries are parameterized upstream.\n';
out += '- Verify whether shared sanitization utilities are applied before dangerous HTML or LLM calls.\n';
out += '- Verify token handling and public env variables in client bundles.\n';
console.log(out);
