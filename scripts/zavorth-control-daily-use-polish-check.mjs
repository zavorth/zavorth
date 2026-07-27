import { existsSync, readFileSync } from 'node:fs';

const files = {
  panel: 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlOperationsPanel.tsx',
  shell: 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
  chat: 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlChatSurface.tsx',
  contextRail: 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlContextRail.tsx',
  adapter: 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
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
const shell = existsSync(files.shell) ? readFileSync(files.shell, 'utf8') : '';
const chat = existsSync(files.chat) ? readFileSync(files.chat, 'utf8') : '';
const contextRail = existsSync(files.contextRail) ? readFileSync(files.contextRail, 'utf8') : '';
const adapter = existsSync(files.adapter) ? readFileSync(files.adapter, 'utf8') : '';
const packageJson = existsSync(files.packageJson) ? readFileSync(files.packageJson, 'utf8') : '';
const chatBranch = shell.includes('case "chat"') ? shell.slice(shell.indexOf('case "chat"')) : '';

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
    id: 'shell:chat-first',
    status: chatBranch &&
      shell.includes('ZavorthControlChatSurface') &&
      shell.includes('ZavorthControlContextRail') &&
      chatBranch.indexOf('<ZavorthControlContextRail') > chatBranch.indexOf('<ZavorthControlChatSurface') &&
      !shell.includes('<ZavorthControlOnboardingPanel') &&
      !shell.includes('<ZavorthControlMissionBrief') &&
      !shell.includes('<ZavorthControlStateCard') ? 'passed' : 'failed',
    summary: 'Opening dashboard remains chat-first; setup and status details live behind contextual surfaces.',
  },
  {
    id: 'chat:compact-run-controls',
    status: [
      'ZavorthControlEmptyChatGreeting',
      'data-active-run-state',
      'In progress',
      'Stop',
      'Queue',
      'View receipt',
    ].every((needle) => chat.includes(needle)) &&
      !/missing conectar/i.test(chat) &&
      !/provider mesh|policy broker|transaction plane/i.test(chat) ? 'passed' : 'failed',
    summary: 'Chat surface owns natural empty greeting, stop, queue and receipt controls without setup nagging.',
  },
  {
    id: 'rail:context-only',
    status: [
      'ZavorthControlTaskTimeline',
      'ZavorthControlMemoryCenter',
      'ZavorthControlSkillCatalog',
      'ZavorthControlSetupGuides',
      'projection-only',
      'Editar',
      'Esquecer',
      'Nunca aprender isso',
      'Testar skill',
      'Promote',
      'Open configuration',
    ].every((needle) => contextRail.includes(needle)) &&
      !contextRail.includes('fetch(') &&
      !/missing conectar/i.test(contextRail) ? 'passed' : 'failed',
    summary: 'Memory, skills, setup and timeline are reviewable from a discrete projection-only rail.',
  },
  {
    id: 'dock:quiet-sector-navigation',
    status: [
      'onSelectSector',
      'aria-pressed={activeSectorId === sector.id}',
      'Chat',
      'Memory',
      'Skills',
      'Setup',
      'Workspace',
      'Gateway',
      'activeSectorId={activeSectorId}',
      'onSelectSector={handleSelectSector}',
    ].every((needle) => shell.includes(needle)) ? 'passed' : 'failed',
    summary: 'Memory, skills, setup, workspace and gateway are reachable through quiet navigation, not first-screen cards.',
  },
  {
    id: 'language:profile-projection',
    status: [
      'profileLanguageFrom',
      'emptyGreeting',
      'Preview de diff e comando',
      'Review com evidence',
      'profileLanguage',
    ].every((needle) => adapter.includes(needle)) &&
      chat.includes('viewModel.profileLanguage?.emptyGreeting') ? 'passed' : 'failed',
    summary: 'Chat copy is projected by experience profile instead of hardcoded as one-size-fits-all language.',
  },
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
