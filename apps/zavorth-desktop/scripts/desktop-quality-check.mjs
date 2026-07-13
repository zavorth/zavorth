/**
 * Structural checks for desktop polish (no browser required).
 * Validates design system, IA, trust surfaces, command center, onboarding, a11y markers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  const full = resolve(root, rel);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

const checks = [];

function requireFile(rel) {
  const body = read(rel);
  if (body == null) {
    fail(`missing file ${rel}`);
    return '';
  }
  ok(`file ${rel}`);
  return body;
}

function requireMarkers(label, body, markers) {
  for (const marker of markers) {
    if (!body.includes(marker)) {
      fail(`${label}: missing marker ${JSON.stringify(marker)}`);
    } else {
      checks.push(true);
    }
  }
}

const designMd = requireFile('DESIGN.md');
const qualityMd = read('QUALITY.md');
if (qualityMd == null) {
  fail('missing file QUALITY.md');
} else {
  ok('file QUALITY.md');
}

const designCss = requireFile('src/styles/design-system.css');
const stylesCss = requireFile('src/styles.css');
const tokens = requireFile('src/designSystem/desktopTokens.ts');
const primitivesUi = requireFile('src/primitives/ui.tsx');
const navConfig = requireFile('src/navigation/navConfig.ts');
const sidebar = requireFile('src/navigation/DesktopSidebar.tsx');
const shell = requireFile('src/shell/DesktopShell.tsx');
const thread = requireFile('src/thread/ThreadView.tsx');
const approvalCard = requireFile('src/thread/InThreadApprovalCard.tsx');
const receiptChip = requireFile('src/thread/ReceiptChip.tsx');
const messageWindow = requireFile('src/thread/messageWindow.ts');
const review = requireFile('src/views/panels/ReviewView.tsx');
const proof = requireFile('src/views/panels/ReceiptsPanel.tsx');
const cc = requireFile('src/command-center/CommandCenterOverlay.tsx');
const domainCards = requireFile('src/command-center/domainCards.ts');
const onboarding = requireFile('src/components/OnboardingOverlay.tsx');
const onboardingLib = requireFile('src/onboarding/desktopOnboarding.ts');
const i18n = requireFile('src/i18n.ts');
const banner = requireFile('src/components/RuntimeSetupBanner.tsx');
const readiness = requireFile('src/desktop-state/readiness.ts');
const lazyPanel = requireFile('src/lib/lazyPanel.tsx');
const workspaceView = requireFile('src/views/DesktopWorkspaceView.tsx');
const fileTreeVirtual = requireFile('src/lib/fileTreeVirtual.ts');
const virtualFileTree = requireFile('src/components/VirtualFileTree.tsx');

requireMarkers('brand', `${designCss}\n${tokens}\n${designMd}`, [
  '#00e88f',
  '#060809',
  'Kael',
]);

requireMarkers('primitives', primitivesUi, [
  'export const Button',
  'EmptyState',
  'StatusBadge',
  'ListRow',
  'SearchField',
  'Loader',
  'Kbd',
]);
for (const name of ['EmptyState', 'StatusBadge', 'ListRow', 'SearchField', 'Loader', 'Kbd']) {
  const re = new RegExp(`export\\s+(const|function)\\s+${name}\\b`);
  if (!re.test(primitivesUi)) {
    fail(`primitives: missing export for ${name}`);
  } else {
    ok(`primitives export ${name}`);
  }
}

requireMarkers('design-system css', designCss, [
  '--zvd-text-xs',
  '--zvd-text-xl',
  '.zvd-btn',
  '.zvd-empty',
  '.zvd-skip-link',
  'prefers-reduced-motion',
  ':focus-visible',
  '.zvd-sidebar-nav-primary',
]);

requireMarkers('navConfig', navConfig, [
  "PRIMARY_PANELS",
  "'chat'",
  "'approvals'",
  "'receipts'",
  "'files'",
  'SECONDARY_PANELS',
  'PANEL_NAV_GROUPS',
]);

requireMarkers('sidebar', sidebar, [
  'PRIMARY_PANELS',
  'SECONDARY_PANELS',
  'zvd-sidebar-more',
  'nav.review',
  'nav.proof',
  'onOpenCommandCenter',
]);

requireMarkers('thread', thread, [
  'ReceiptChip',
  'InlineActivityStrip',
  'thread.suggestion4',
  'windowMessages',
]);

requireMarkers('approval card', approvalCard, [
  'zvd-approval-card',
  'onDecide',
  "'once'",
  "'deny'",
]);

requireMarkers('receipt chip', receiptChip, [
  'thread.proofChip',
  'zvd-receipt-chip',
  'onClick',
]);
requireMarkers('thread proof wiring', thread, [
  'onOpenProof',
  'ReceiptChip',
]);

requireMarkers('message window', messageWindow, [
  'windowMessages',
  'DEFAULT_MESSAGE_WINDOW',
  'nextMessageWindow',
]);

requireMarkers('review hub', review, [
  'nav.review',
  'learning',
  'zvd-review-tabs',
]);

requireMarkers('proof hub', proof, [
  'nav.proof',
  'zvd-proof-timeline',
]);

requireMarkers('command center', cc, [
  'CommandCenterOverlay',
  'buildCommandCenterItems',
  'zvd-cc-',
]);

requireMarkers('domain cards', domainCards, [
  'hero:constellation',
  'hero:skills',
  'hero:channels',
  'hero:automations',
  'hero:agents',
  'hero:power',
  'hero:product',
  'DOMAIN_HERO_CARDS',
]);

requireMarkers('onboarding', `${onboarding}\n${onboardingLib}`, [
  'provider',
  'trust',
  'channel',
  'first-ask',
  'DESKTOP_ONBOARDING_STORAGE_KEY',
  'DESKTOP_TRUST_MODE_KEY',
  'onStartWithSuggestion',
]);

requireMarkers('a11y shell', shell, [
  'zvd-skip-link',
  'a11y.skipToContent',
  'id="zvd-main-content"',
  'commandCenterOpen',
  'is-chat-focus',
]);

requireMarkers('a11y i18n', i18n, [
  'a11y.skipToContent',
  'nav.review',
  'nav.proof',
  'cc.title',
  'onboarding.welcomeTitle',
]);

requireMarkers('density', `${designCss}\n${stylesCss}\n${shell}`, [
  'density-compact',
  'density-comfortable',
  '--zvd-control-h',
]);

requireMarkers('runtime banner', banner, [
  'zvd-runtime-banner',
  'runtime.start',
]);

requireMarkers('readiness', readiness, [
  'live',
  'needs_setup',
  'available',
  'blocked',
  'Catalog support',
]);

const uiSources = [
  designMd,
  primitivesUi,
  navConfig,
  sidebar,
  thread,
  approvalCard,
  review,
  proof,
  cc,
  domainCards,
  onboarding,
  i18n,
].join('\n');

const forbidden = [/\bopenclaw\b/i, /\bhermes-agent\b/i, /\bclawhub\b/i];
for (const re of forbidden) {
  if (re.test(uiSources)) {
    fail(`forbidden brand leak matching ${re}`);
  }
}
ok('no forbidden third-party agent brands in polish surfaces');

requireMarkers('lazy panel helper', lazyPanel, [
  'PanelSuspense',
  'lazyNamed',
  'a11y.loadingPanel',
]);
requireMarkers('lazy workspace panels', workspaceView, [
  'lazyNamed',
  'PanelSuspense',
  'MemoryView',
  'SkillsView',
  'AutomationsPanel',
]);
requireMarkers('density classes', designCss, [
  'density-comfortable',
  'density-compact',
]);
requireMarkers('virtual file tree helpers', fileTreeVirtual, [
  'flattenVisibleFileTree',
  'windowFileTreeRows',
  'DEFAULT_FILE_ROW_HEIGHT',
]);
requireMarkers('virtual file tree UI', virtualFileTree, [
  'VirtualFileTree',
  'zvd-vfile-tree',
  'role="tree"',
]);
requireMarkers('virtual file tree css', designCss, [
  '.zvd-vfile-tree',
  '.zvd-vfile-row',
]);

const composerStatus = requireFile('src/composer/composerStatus.ts');
const composerQueue = requireFile('src/composer/composerQueue.ts');
const planCard = requireFile('src/thread/planCard.ts');
const openFromChat = requireFile('src/thread/openFromChat.ts');
const streamIsolation = requireFile('src/thread/streamIsolation.ts');
const sessionChrome = requireFile('src/session/sessionChrome.ts');
const reviewRailModel = requireFile('src/shell/reviewRailModel.ts');
const terminalTabs = requireFile('src/shell/terminalTabs.ts');
const hunkApproval = requireFile('src/trust/hunkApproval.ts');
const trustedOperator = requireFile('src/trust/trustedOperator.ts');
const runTimeline = requireFile('src/thread/runTimeline.ts');
const agentStrip = requireFile('src/agents/agentStrip.ts');
const domainWizards = requireFile('src/command-center/domainWizards.ts');
const hunkReviewCard = requireFile('src/thread/HunkReviewCard.tsx');
const runTimelineUi = requireFile('src/thread/RunTimeline.tsx');
const agentStripUi = requireFile('src/thread/AgentStrip.tsx');
const domainWizardOverlay = requireFile('src/command-center/DomainWizardOverlay.tsx');
const topbar = requireFile('src/navigation/DesktopTopbar.tsx');
requireMarkers('composer status', composerStatus, ['deriveComposerStatus', 'ComposerPhase']);
requireMarkers('composer queue', composerQueue, ['enqueuePrompt', 'nextAutoSubmit', 'MAX_QUEUE_LENGTH']);
requireMarkers('plan card', planCard, ['parsePlanFromText', 'planFromApproval']);
requireMarkers('open from chat', openFromChat, ['extractOpenTargets', 'preferFileTarget']);
requireMarkers('stream isolation', streamIsolation, ['sliceStreamingMessages']);
requireMarkers('session chrome', sessionChrome, ['pinSession', 'archiveSession', 'sortSessionsForSidebar']);
requireMarkers('review rail model', reviewRailModel, ['buildReviewRailModel', 'buildReviewShipBar']);
requireMarkers('terminal tabs', terminalTabs, ['ensureDefaultTabs', 'addTerminalTab']);
requireMarkers('thread plan wiring', thread, ['PlanCardView', 'sliceStreamingMessages', 'onOpenPath']);
requireMarkers('composer bar wiring', requireFile('src/composer/DesktopCommandBar.tsx'), [
  'ComposerStatusStack',
  'ContextMeterBar',
  'onQueuePrompt',
]);
requireMarkers('hunk approval', hunkApproval, ['parseUnifiedDiff', 'applyHunkDecision', 'buildHunkReceipt']);
requireMarkers('trusted operator', trustedOperator, ['loadTrustedOperator', 'saveTrustedOperator', 'toggleTrustedOperator', 'TRUSTED_OPERATOR_KEY']);
requireMarkers('run timeline', runTimeline, ['buildRunTimeline', 'compactRunTimeline']);
requireMarkers('agent strip', agentStrip, ['buildAgentStrip', 'agentStripVisible']);
requireMarkers('domain wizards', domainWizards, ['DOMAIN_WIZARDS', 'getWizard', 'wizardIdFromHero']);
requireMarkers('hunk review ui', hunkReviewCard, ['HunkReviewCard', 'onHunkReceipt', 'thread.hunkApproveAll']);
requireMarkers('run timeline ui', runTimelineUi, ['RunTimeline', 'compactRunTimeline', 'zvd-run-timeline']);
requireMarkers('agent strip ui', agentStripUi, ['AgentStrip', 'buildAgentStrip', 'zvd-agent-strip']);
requireMarkers('domain wizard ui', domainWizardOverlay, ['DomainWizardOverlay', 'getWizard', 'onFinish']);
requireMarkers('topbar trust badge', topbar, ['zvd-trust-badge', 'trustedOperator', 'onToggleTrustedOperator']);
requireMarkers('thread trust surfaces', thread, ['HunkReviewCard', 'RunTimeline', 'AgentStrip', 'looksLikeUnifiedDiff']);
requireMarkers('shell trust wiring', shell, ['loadTrustedOperator', 'toggleTrustedOperator', 'onToggleTrustedOperator', 'subagents']);
requireMarkers('command center wizard wiring', cc, ['DomainWizardOverlay', 'wizardIdFromHero']);
requireMarkers('trust surfaces css', designCss, [
  '.zvd-trust-badge',
  '.zvd-hunk-review',
  '.zvd-run-timeline',
  '.zvd-agent-strip',
  '.zvd-wizard-overlay',
]);
requireMarkers('trust i18n', i18n, [
  'trust.operator.on',
  'thread.hunkReviewTitle',
  'thread.timeline.title',
  'thread.agent.stripTitle',
  'wizard.absorb.title',
]);

const constellationLayout = requireFile('src/constellation/constellationLayout.ts');
const constellationOverlay = requireFile('src/constellation/ConstellationOverlay.tsx');
const automationsModel = requireFile('src/views/panels/automationsModel.ts');
const automationsPanel = requireFile('src/views/panels/AutomationsPanel.tsx');
requireMarkers('constellation layout', constellationLayout, [
  'layoutConstellation',
  'buildConstellationFromRuntime',
  'filterConstellationNodes',
  'ConstellationDomain',
]);
requireMarkers('constellation overlay', constellationOverlay, [
  'ConstellationOverlay',
  'zvd-constellation-overlay',
  'buildConstellationFromRuntime',
  'onOpenDomain',
]);
requireMarkers('automations model', automationsModel, [
  'mapScheduledTasks',
  'mergeAutomationJobs',
  'filterAutomationJobs',
  'selectAutomationJob',
]);
requireMarkers('automations panel', automationsPanel, [
  'AutomationsPanel',
  'zvd-automation-layout',
  'statusLabel',
  'zvd-capability-empty',
]);
requireMarkers('constellation shell wiring', shell, [
  'ConstellationOverlay',
  'constellationOpen',
  "action.type === 'constellation'",
  'onOpenDomain',
]);
requireMarkers('constellation css', designCss, [
  '.zvd-constellation-overlay',
  '.zvd-constellation-panel',
]);
requireMarkers('automations premium css', requireFile('src/styles/premium-shell.css'), [
  '.zvd-automation-layout',
  '.zvd-automation-row',
  '.zvd-automation-create',
]);
requireMarkers('constellation i18n', i18n, [
  'constellation.title',
  'automations.title',
  'cc.hero.constellation.title',
]);
requireMarkers('marketplace secondary nav', navConfig, [
  "'marketplace'",
  'SECONDARY_PANELS',
]);

const electronMain = requireFile('electron/main.cjs');
const electronPreload = requireFile('electron/preload.cjs');
const globalTypes = requireFile('src/global.d.ts');
const codeBridgeModule = requireFile('electron/code-bridge.cjs');
requireMarkers('Code Bridge main wiring', electronMain, [
  "require('./code-bridge.cjs')",
  "ipcMain.handle('zavorth:code-bridge:summary'",
  'startCodeBridgeHeartbeat',
  'stopCodeBridgeHeartbeat',
]);
requireMarkers('Code Bridge preload and types', `${electronPreload}\n${globalTypes}`, [
  'getCodeBridgeSummary',
  'CodeBridgeSummary',
  'CodeBridgeCheck',
]);
requireMarkers('Code Bridge renderer wiring', shell, [
  'useCodeBridge',
  'CodeBridgeChecksPanel',
  'codeBridgeOpen',
]);
requireMarkers('Code Bridge self-contained heartbeat', codeBridgeModule, [
  'writeJsonAtomic',
  'startCodeBridgeHeartbeat',
  'getCodeBridgeSummary',
]);
requireMarkers('automation persistence and sweep safety', requireFile('electron/desktop-automations.cjs'), [
  'temporaryPath',
  'createAutomationSweepRunner',
  'activeSweep',
  'buildAutomationHistoryLogs',
]);
requireMarkers('workboard batch sync', requireFile('src/workboard/workboardRuntimeSync.ts'), [
  "input.operation === 'sync-board'",
  'input.board.cards.map',
]);

if (!/prefers-reduced-motion/.test(`${designCss}\n${stylesCss}`)) {
  fail('prefers-reduced-motion missing');
} else {
  ok('prefers-reduced-motion present');
}

if (process.exitCode) {
  console.error('\nDesktop quality check failed.');
  process.exit(1);
}

console.log('\nDesktop quality check passed.');
