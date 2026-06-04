#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const normalizeLineEndings = (text) => text.replace(/\r\n?/g, '\n');

const files = {
  globals: 'src/ai-gateway/app/globals.css',
  page: 'src/ai-gateway/app/(zavorthControl)/control/page.tsx',
  assets: 'src/ai-gateway/app/(zavorthControl)/control/ControlPageAssets.tsx',
  source: 'src/ai-gateway/app/(zavorthControl)/control/legacyDashboardSource.ts',
  surfaces: 'src/ai-gateway/app/(zavorthControl)/control/ZavorthControlSurfaces.tsx',
  overlays: 'src/ai-gateway/app/(zavorthControl)/control/ZavorthControlOverlays.tsx',
  chatCss: 'src/ai-gateway/public/zavorth-control-vite-shell/styles/chat.css',
  pagesCss: 'src/ai-gateway/public/zavorth-control-vite-shell/styles/pages.css',
  overlaysCss: 'src/ai-gateway/public/zavorth-control-vite-shell/styles/overlays.css',
  appJs: 'src/ai-gateway/public/zavorth-control-vite-shell/scripts/app.js',
  runtimeBridge: 'src/ai-gateway/public/zavorth-control-vite-shell/scripts/runtime-bridge.js',
  viteApp: 'apps/zavorth-control-vite-shell/index.html',
  viteAppTs: 'apps/zavorth-control-vite-shell/src/app.ts',
  viteApprovalArtifactCardsTs: 'apps/zavorth-control-vite-shell/src/approval-artifact-cards.ts',
  viteChatRendererTs: 'apps/zavorth-control-vite-shell/src/chat-renderer.ts',
  viteChatSurfaceRenderersTs: 'apps/zavorth-control-vite-shell/src/chat-surface-renderers.ts',
  viteComposerAttachmentsTs: 'apps/zavorth-control-vite-shell/src/composer-attachments.ts',
  viteComposerEventWiringTs: 'apps/zavorth-control-vite-shell/src/composer-event-wiring.ts',
  viteComposerSettingsTs: 'apps/zavorth-control-vite-shell/src/composer-settings.ts',
  viteConversationExportTs: 'apps/zavorth-control-vite-shell/src/conversation-export.ts',
  viteControlSheetsTs: 'apps/zavorth-control-vite-shell/src/control-sheets.ts',
  viteDashboardLiveViewTs: 'apps/zavorth-control-vite-shell/src/dashboard-live-view.ts',
  viteGuidedFlowCardsTs: 'apps/zavorth-control-vite-shell/src/guided-flow-cards.ts',
  viteHtmlUtilsTs: 'apps/zavorth-control-vite-shell/src/html-utils.ts',
  viteLocalPreviewResponsesTs: 'apps/zavorth-control-vite-shell/src/local-preview-responses.ts',
  viteNeuralFeedInteractionsTs: 'apps/zavorth-control-vite-shell/src/neural-feed-interactions.ts',
  viteOverlayControllerTs: 'apps/zavorth-control-vite-shell/src/overlay-controller.ts',
  viteAppJs: 'apps/zavorth-control-vite-shell/public/scripts/app.js',
  vitePagesTs: 'apps/zavorth-control-vite-shell/src/pages.ts',
  viteRuntimeArtifactUtilsTs: 'apps/zavorth-control-vite-shell/src/runtime-artifact-utils.ts',
  viteRuntimeAuthSessionTs: 'apps/zavorth-control-vite-shell/src/runtime-auth-session.ts',
  viteRuntimeBridgeTs: 'apps/zavorth-control-vite-shell/src/runtime-bridge.ts',
  viteRuntimeHttpTs: 'apps/zavorth-control-vite-shell/src/runtime-http.ts',
  viteRuntimeModelProfileTs: 'apps/zavorth-control-vite-shell/src/runtime-model-profile.ts',
  viteRuntimeOperationsPanelsTs: 'apps/zavorth-control-vite-shell/src/runtime-operations-panels.ts',
  viteRuntimeProviderPanelsTs: 'apps/zavorth-control-vite-shell/src/runtime-provider-panels.ts',
  viteRuntimeRefreshTs: 'apps/zavorth-control-vite-shell/src/runtime-refresh.ts',
  viteRuntimeRealtimeTs: 'apps/zavorth-control-vite-shell/src/runtime-realtime.ts',
  viteRuntimeRunReplayTs: 'apps/zavorth-control-vite-shell/src/runtime-run-replay.ts',
  viteRuntimeSessionUiTs: 'apps/zavorth-control-vite-shell/src/runtime-session-ui.ts',
  viteShellNavigationTs: 'apps/zavorth-control-vite-shell/src/shell-navigation.ts',
  viteSignalTransmitterTs: 'apps/zavorth-control-vite-shell/src/signal-transmitter.ts',
  viteSkillsPopoverTs: 'apps/zavorth-control-vite-shell/src/skills-popover.ts',
  viteTextUtilsTs: 'apps/zavorth-control-vite-shell/src/text-utils.ts',
  viteThemeTs: 'apps/zavorth-control-vite-shell/src/theme.ts',
  viteTraceRendererTs: 'apps/zavorth-control-vite-shell/src/trace-renderer.ts',
  viteTraceUtilsTs: 'apps/zavorth-control-vite-shell/src/trace-utils.ts',
  viteVoiceDictationTs: 'apps/zavorth-control-vite-shell/src/voice-dictation.ts',
};

const contents = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)]),
);

const requiredTokens = [
  '--color-primary',
  '--color-accent',
  '--color-bg',
  '--color-surface',
  '--color-border',
  '--color-text-main',
  '--shadow-soft',
  '--shadow-elevated',
];

const requiredMarkers = [
  ['globals', '@source "../app/(zavorthControl)"'],
  ['page', 'ControlPageClient'],
  ['assets', 'VITE_SHELL_PUBLIC_PATH = "/zavorth-control-vite-shell"'],
  ['assets', 'readViteModuleScriptSrc'],
  ['assets', '<Script type="module" src={readViteModuleScriptSrc()} strategy="afterInteractive" crossOrigin="anonymous" />'],
  ['source', '"public", "zavorth-control-vite-shell", "index.html"'],
  ['surfaces', 'agent-os-live-summary'],
  ['overlays', 'ZavorthControlToolSheet'],
  ['overlays', 'ZavorthControlTraceSheet'],
  ['chatCss', '.compose-context-bar'],
  ['chatCss', '.compose-settings-presets'],
  ['chatCss', '.tool-sheet__state'],
  ['chatCss', '.trace-sheet__flow'],
  ['chatCss', '.zavorth-export-menu'],
  ['pagesCss', '.agent-os-live-summary'],
  ['overlaysCss', '.zavorth-unlock-actions'],
  ['appJs', 'openExportMenu'],
  ['appJs', 'ensureComposerPresets'],
  ['appJs', 'updateToolSheetState'],
  ['viteApp', 'type="module" src="/src/app.ts"'],
  ['viteApp', 'type="module" src="/src/pages.ts"'],
  ['viteApp', 'type="module" src="/src/runtime-bridge.ts"'],
  ['viteAppTs', 'export function initControlApp'],
  ['viteAppTs', 'initControlApp();'],
  ['viteAppTs', 'openExportMenu'],
  ['viteAppTs', 'ensureComposerPresets'],
  ['viteAppTs', 'window.ZavorthControlChat'],
  ['viteAppTs', "import { buildConversationStateCard, buildEchoDividerHtml, buildEchoGroupHtml, buildThinkingStateHtml } from './chat-renderer'"],
  ['viteAppTs', "import { createChatSurfaceRenderers, removeRemoteMeshApprovalCard as removeRemoteMeshApprovalCardNode } from './chat-surface-renderers'"],
  ['viteAppTs', "import { attachmentKindLabel, attachmentReadyLabel, readAttachmentFile } from './composer-attachments'"],
  ['viteAppTs', "import { bindAttachmentTray, bindComposeInputEvents, bindComposerContextBar"],
  ['viteAppTs', "import { composerPresetSettings, composerSettingLabel, getComposePlaceholder"],
  ['viteAppTs', "import { exportConversation, getExportMenuHtml } from './conversation-export'"],
  ['viteAppTs', "import { createControlSheets } from './control-sheets'"],
  ['viteAppTs', "import { createDashboardLiveView } from './dashboard-live-view'"],
  ['viteAppTs', "import { createOverlayController } from './overlay-controller'"],
  ['viteAppTs', "import { createLocalPreviewResponses } from './local-preview-responses'"],
  ['viteAppTs', "import { bindNeuralFeedInteractions } from './neural-feed-interactions'"],
  ['viteAppTs', "import { createSignalTransmitter } from './signal-transmitter'"],
  ['viteAppTs', "import { renderTraceTimelineHtml } from './trace-renderer'"],
  ['viteAppTs', "import { compactTraceText, normalizeTraceCapability, normalizeTraceEvent"],
  ['viteAppTs', "import { buildSkillOptions, buildSkillPopoverHtml, promptForSkill, skillFromOption } from './skills-popover'"],
  ['viteAppTs', "import { bindVoiceDictation } from './voice-dictation'"],
  ['viteAppTs', "import { initDockNavigation } from './shell-navigation'"],
  ['viteAppTs', "import { initThemeToggle } from './theme'"],
  ['viteAppTs', "import { escapeHtml, renderMarkdown, sanitizeRenderedHtml } from './html-utils'"],
  ['viteApprovalArtifactCardsTs', 'export function buildApprovalCard'],
  ['viteApprovalArtifactCardsTs', 'export function buildRemoteMeshApprovalCard'],
  ['viteApprovalArtifactCardsTs', 'export function buildArtifactCard'],
  ['viteApprovalArtifactCardsTs', 'zavorth-approval-card'],
  ['viteApprovalArtifactCardsTs', 'zavorth-artifact-card'],
  ['viteChatRendererTs', 'export function buildEchoGroupHtml'],
  ['viteChatRendererTs', 'export function buildConversationStateCard'],
  ['viteChatRendererTs', 'echo-action-row'],
  ['viteChatSurfaceRenderersTs', 'export function createChatSurfaceRenderers'],
  ['viteChatSurfaceRenderersTs', 'export function normalizeApprovalScopeLabel'],
  ['viteComposerAttachmentsTs', 'export async function readAttachmentFile'],
  ['viteComposerAttachmentsTs', 'export function attachmentKindLabel'],
  ['viteComposerEventWiringTs', 'export function bindComposeInputEvents'],
  ['viteComposerEventWiringTs', 'export function bindToolSheetActions'],
  ['viteComposerEventWiringTs', 'export function createHiddenFileInput'],
  ['viteComposerSettingsTs', 'export function readComposerSettings'],
  ['viteComposerSettingsTs', 'export function composerPresetSettings'],
  ['viteConversationExportTs', 'export function collectTranscriptMarkdown'],
  ['viteConversationExportTs', 'export function exportConversation'],
  ['viteConversationExportTs', 'export function getExportMenuHtml'],
  ['viteControlSheetsTs', 'export function createControlSheets'],
  ['viteControlSheetsTs', 'updateToolSheetState'],
  ['viteDashboardLiveViewTs', 'export function createDashboardLiveView'],
  ['viteDashboardLiveViewTs', 'data-dashboard-runtime-title'],
  ['viteGuidedFlowCardsTs', 'export function shouldHandlePersonalDayFlow'],
  ['viteGuidedFlowCardsTs', 'export function buildDeveloperReviewCards'],
  ['viteGuidedFlowCardsTs', 'export function buildBusinessAuditCards'],
  ['viteHtmlUtilsTs', 'export function sanitizeRenderedHtml'],
  ['viteHtmlUtilsTs', 'export function renderMarkdown'],
  ['viteLocalPreviewResponsesTs', 'export function createLocalPreviewResponses'],
  ['viteLocalPreviewResponsesTs', 'generateCoreResponse'],
  ['viteNeuralFeedInteractionsTs', 'export function bindNeuralFeedInteractions'],
  ['viteNeuralFeedInteractionsTs', 'data-zavorth-approval-decision'],
  ['viteNeuralFeedInteractionsTs', 'data-zavorth-remote-mesh-action'],
  ['viteOverlayControllerTs', 'export function createOverlayController'],
  ['viteOverlayControllerTs', 'function openCoreModal'],
  ['viteOverlayControllerTs', 'function dismissOverlays'],
  ['viteShellNavigationTs', 'export function initDockNavigation'],
  ['viteSignalTransmitterTs', 'export function createSignalTransmitter'],
  ['viteSignalTransmitterTs', 'Runtime failed'],
  ['viteSignalTransmitterTs', 'Local preview runtime'],
  ['viteSkillsPopoverTs', 'export function buildSkillOptions'],
  ['viteSkillsPopoverTs', 'export function buildSkillPopoverHtml'],
  ['viteSkillsPopoverTs', 'compose-skill-option'],
  ['viteTextUtilsTs', 'export function messageFromCaughtError'],
  ['viteThemeTs', 'export function initThemeToggle'],
  ['viteTraceRendererTs', 'export function renderTraceTimelineHtml'],
  ['viteTraceRendererTs', 'trace-sheet__flow'],
  ['viteTraceUtilsTs', 'export function normalizeTraceEvent'],
  ['viteTraceUtilsTs', 'export function traceEventMatchesQuery'],
  ['viteVoiceDictationTs', 'export function bindVoiceDictation'],
  ['viteVoiceDictationTs', 'voice-overlay'],
  ['viteAppJs', 'openExportMenu'],
  ['vitePagesTs', 'export function initControlPages'],
  ['vitePagesTs', 'initControlPages();'],
  ['vitePagesTs', 'agent-os-live-summary'],
  ['viteRuntimeArtifactUtilsTs', 'export function createRuntimeArtifactUtils'],
  ['viteRuntimeArtifactUtilsTs', 'extractArtifacts'],
  ['viteRuntimeAuthSessionTs', 'export function createRuntimeAuthSession'],
  ['viteRuntimeAuthSessionTs', 'authHeaders'],
  ['viteRuntimeBridgeTs', 'export function initRuntimeBridge'],
  ['viteRuntimeBridgeTs', "import { basename, createRuntimeArtifactUtils, extensionOf } from './runtime-artifact-utils'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeAuthSession } from './runtime-auth-session'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeHttp, messageFromCaughtError, messageFromErrorPayload } from './runtime-http'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeModelProfile, normalizeModelProfile } from './runtime-model-profile'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeOperationsPanels } from './runtime-operations-panels'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeProviderPanels } from './runtime-provider-panels'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeRefresh } from './runtime-refresh'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeRealtime } from './runtime-realtime'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeRunReplay } from './runtime-run-replay'"],
  ['viteRuntimeBridgeTs', "import { createRuntimeSessionUi } from './runtime-session-ui'"],
  ['viteRuntimeBridgeTs', 'initRuntimeBridge();'],
  ['viteRuntimeBridgeTs', 'window.ZavorthRuntimeBridge'],
  ['viteRuntimeHttpTs', 'export function createRuntimeHttp'],
  ['viteRuntimeHttpTs', 'export function messageFromCaughtError'],
  ['viteRuntimeModelProfileTs', 'export function createRuntimeModelProfile'],
  ['viteRuntimeModelProfileTs', 'export function normalizeModelProfile'],
  ['viteRuntimeOperationsPanelsTs', 'export function createRuntimeOperationsPanels'],
  ['viteRuntimeOperationsPanelsTs', 'updateUsage'],
  ['viteRuntimeOperationsPanelsTs', 'updateNodes'],
  ['viteRuntimeProviderPanelsTs', 'export function createRuntimeProviderPanels'],
  ['viteRuntimeProviderPanelsTs', 'updateProviderModelCatalog'],
  ['viteRuntimeProviderPanelsTs', 'updateProviderActivation'],
  ['viteRuntimeRefreshTs', 'export function createRuntimeRefresh'],
  ['viteRuntimeRefreshTs', 'canAttemptProtectedSnapshot'],
  ['viteRuntimeRefreshTs', 'authRequired: true'],
  ['viteRuntimeRealtimeTs', 'export function createRuntimeRealtime'],
  ['viteRuntimeRealtimeTs', 'startFetchEventStream'],
  ['viteRuntimeRunReplayTs', 'export function createRuntimeRunReplay'],
  ['viteRuntimeRunReplayTs', 'wireRunReplayRows'],
  ['viteRuntimeSessionUiTs', 'export function createRuntimeSessionUi'],
  ['viteRuntimeSessionUiTs', 'renderApprovalsFromPayload'],
  ['runtimeBridge', 'zavorth-copy-token-command'],
  ['runtimeBridge', 'data-tools-live-count'],
  ['runtimeBridge', 'data-memory-live-files'],
];

const forbiddenVisibleCopy = [
  'Telegram',
  'telegram',
  'Aprovações',
  'Memória',
  'Configurações',
  'Enviar',
];

const failures = [];

const syncedAssetPairs = [
  ['apps/zavorth-control-vite-shell/public/scripts/app.js', 'src/ai-gateway/public/zavorth-control-vite-shell/scripts/app.js'],
  ['apps/zavorth-control-vite-shell/public/styles/chat.css', 'src/ai-gateway/public/zavorth-control-vite-shell/styles/chat.css'],
  ['apps/zavorth-control-vite-shell/public/styles/pages.css', 'src/ai-gateway/public/zavorth-control-vite-shell/styles/pages.css'],
  ['apps/zavorth-control-vite-shell/public/styles/overlays.css', 'src/ai-gateway/public/zavorth-control-vite-shell/styles/overlays.css'],
];

for (const token of requiredTokens) {
  if (!contents.globals.includes(token)) failures.push(`missing global token ${token}`);
}

for (const [key, marker] of requiredMarkers) {
  if (!contents[key].includes(marker)) failures.push(`missing ${key} marker ${marker}`);
}

for (const [source, target] of syncedAssetPairs) {
  if (normalizeLineEndings(read(source)) !== normalizeLineEndings(read(target))) {
    failures.push(`Vite source is not synced to ${target}`);
  }
}

const publicText = [
  contents.surfaces,
  contents.overlays,
  contents.appJs,
  contents.runtimeBridge,
].join('\n');

for (const copy of forbiddenVisibleCopy) {
  if (publicText.includes(copy)) failures.push(`forbidden dashboard copy still present: ${copy}`);
}

if (contents.assets.includes('ControlInlineScript') || contents.assets.includes('runWhenShellExists')) {
  failures.push('control boot still uses legacy inline script loading instead of the Vite module asset');
}

if (failures.length) {
  console.error('[zavorthControl-design-system] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorthControl-design-system] passed');
console.log(`tokens=${requiredTokens.length} markers=${requiredMarkers.length}`);
