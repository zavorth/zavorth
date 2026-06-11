import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(resolve(root, 'src', 'App.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'src', 'styles.css'), 'utf8');
const main = readFileSync(resolve(root, 'electron', 'main.cjs'), 'utf8');
const appLines = app.split(/\r?\n/).length;

const requiredFiles = [
  'src/shell/DesktopShell.tsx',
  'src/navigation/DesktopSidebar.tsx',
  'src/navigation/DesktopStatusbar.tsx',
  'src/navigation/DesktopTopbar.tsx',
  'src/apiClient.ts',
  'src/composer/DesktopCommandBar.tsx',
  'src/thread/ThreadView.tsx',
  'src/thread/InlineActivityStrip.tsx',
  'src/panels/DesktopInspector.tsx',
  'src/overlays/CommandPalette.tsx',
  'src/primitives/desktopPrimitives.tsx',
  'src/modelCatalog.ts',
];

function readIfExists(relativePath) {
  const fullPath = resolve(root, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
}

const sourceText = [
  app,
  css,
  ...requiredFiles.map(readIfExists),
].join('\n');

const requiredAppMarkers = [
  'sidebarCollapsed',
  'inspectorOpen',
  'commandPaletteOpen',
  'DesktopShell',
  'dispatchRuntimeStateAction',
  'requestRuntimeInstrument',
  'onRuntimeStateAction',
];

const requiredCssMarkers = [
  '.zvd-sidebar',
  '.zvd-sidebar.is-collapsed',
  '.zvd-topbar',
  '.zvd-topbar-title',
  '.zvd-inspector',
  '.zvd-command-palette',
  '.zvd-composer-shell',
  '.zvd-activity-strip',
  '.zvd-project-card',
  '.zvd-project-root',
  '.zvd-sidebar-chats',
  '.zvd-model-popover',
  '.zvd-provider-add',
  '.zvd-workspace-scope-row',
  '.zvd-workspace-popover',
  '.zvd-suggestion-stack',
  '.zvd-ambient-field',
  '.theme-dark.zvd-app',
];

const requiredSkinMarkers = [
  'Zavorth',
  'Novo chat',
  'Pesquisar',
  'Projetos locais',
  'Chats',
  'No que vamos trabalhar?',
  'Planeje, revise ou entregue uma tarefa com runtime local',
  'Personalizado',
  'Inteligência',
  'Colocar mais providers',
  'Selecionar pasta...',
  'Modelo',
  'GPT-5',
  'Claude Sonnet',
  'Zavorth Core',
];

const requiredRuntimeInstrumentMarkers = [
  '/api/experience/runtime-state/action',
  "operate('gateway', 'sync'",
  "operate('session'",
  "operate('context', 'open'",
  "operate('agents', 'sync'",
  'zavorth-desktop-statusbar',
];

const forbiddenMarkers = [
  'zvd-panel--quiet',
  'zvd-tool-card',
  'Today in Zavorth',
  'Overview',
  'function DesktopSidebar',
  'function DesktopTopbar',
  'function DesktopCommandBar',
  'function InlineActivityStrip',
  'function DesktopInspector',
  'function CommandPalette',
  'function ApprovalsPanel',
  'function MemoryPanel',
  'function SkillsPanel',
  'function ChannelsPanel',
  'function SettingsPanel',
  'function PanelScaffold',
  'function EmptyPanel',
];

const missing = [
  ...requiredFiles.filter(file => !existsSync(resolve(root, file))),
  ...requiredAppMarkers.filter(marker => !app.includes(marker)),
  ...requiredCssMarkers.filter(marker => !css.includes(marker)),
  ...requiredSkinMarkers.filter(marker => !sourceText.includes(marker)),
  ...requiredRuntimeInstrumentMarkers.filter(marker => !sourceText.includes(marker)),
  ...[
    'nodeCommand',
    'runtimeCommand',
    'sourceHostBin',
    'tsxBin',
    "'src', 'host.ts'",
    'pathToFileURL(tsxBin).href',
    'hostBin',
    "'dist', 'host.js'",
    'ZAVORTH_NODE_BINARY',
    'npm_node_execpath',
    'X-Zavorth-Desktop-Bridge',
  ].filter(marker => !main.includes(marker)),
];

const forbidden = forbiddenMarkers.filter(marker => app.includes(marker) || css.includes(marker));

if (appLines > 520) {
  console.error(`App.tsx should stay orchestration-only. Current lines: ${appLines}; limit: 520.`);
  process.exit(1);
}

if (missing.length > 0 || forbidden.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing Desktop Shell v1 markers:\n- ${missing.join('\n- ')}`);
  }
  if (forbidden.length > 0) {
    console.error(`Forbidden dashboard-style markers remain:\n- ${forbidden.join('\n- ')}`);
  }
  process.exit(1);
}

console.log('Desktop Shell v1 structure looks ready.');
