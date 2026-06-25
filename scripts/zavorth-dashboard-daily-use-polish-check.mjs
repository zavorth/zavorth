import { existsSync, readFileSync } from 'node:fs';

const files = {
  panel: 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlOperationsPanel.tsx',
  packageJson: 'package.json',
};

const rules = [];

for (const [id, file] of Object.entries(files)) {
  rules.push({
    id: `file:${id}`,
    status: existsSync(file) ? 'passed' : 'failed',
    summary: file,
  });
}

const panel = existsSync(files.panel) ? readFileSync(files.panel, 'utf8') : '';
const packageJson = existsSync(files.packageJson) ? readFileSync(files.packageJson, 'utf8') : '';

const order = [
  '<ZavorthControlActiveMissionPanel',
  '<ZavorthControlApprovalsPanel',
  '<ZavorthControlSensitiveActionFlowPanel',
  '<ZavorthControlVisualReceiptsPanel',
  '<ZavorthControlRunPanel',
  '<ZavorthControlDoctorPanel',
  '<ZavorthControlProviderCockpitPanel',
  '<ZavorthControlProviderPreferencePanel',
];

rules.push(
  {
    id: 'order:daily-use-first',
    status: isOrdered(panel, order) ? 'passed' : 'failed',
    summary: 'Right rail prioritizes mission, approvals, preview and receipts before provider/runtime support.',
  },
  {
    id: 'copy:daily-use-empty-states',
    status: [
      'Start with a normal request.',
      'No approvals waiting for you right now.',
      'Receipts appear after a mission',
      'Recovered context appears here only when it helps',
    ].every((needle) => panel.includes(needle)) ? 'passed' : 'failed',
    summary: 'Empty states explain the next useful action in daily-use language.',
  },
  {
    id: 'actions:approval-products',
    status: panel.includes('Allow once') && panel.includes('Deny') && panel.includes('Review before release') ? 'passed' : 'failed',
    summary: 'Approvals read as product action cards instead of raw technical controls.',
  },
  {
    id: 'safety:no-direct-fetch',
    status: !panel.includes('fetch(') && panel.includes('projection-only') && panel.includes('target blocked') ? 'passed' : 'failed',
    summary: 'Polished panel still does not fetch or execute target actions directly.',
  },
  {
    id: 'workspace:gate',
    status: packageJson.includes('zavorth:zavorthControl-daily-use-polish:check') ? 'passed' : 'failed',
    summary: 'Package scripts expose the daily-use polish certification gate.',
  },
);

const failed = rules.filter((rule) => rule.status !== 'passed');

console.log('[zavorthControl-daily-use-polish] certification');
for (const rule of rules) {
  console.log(`[zavorthControl-daily-use-polish] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
}

if (failed.length > 0) {
  console.error(`[zavorthControl-daily-use-polish] failed rules: ${failed.map((rule) => rule.id).join(', ')}`);
  process.exit(1);
}

function isOrdered(text, needles) {
  let cursor = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle);
    if (index < 0 || index <= cursor) {
      return false;
    }
    cursor = index;
  }
  return true;
}
