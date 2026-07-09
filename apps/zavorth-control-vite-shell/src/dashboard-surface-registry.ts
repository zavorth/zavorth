export type DashboardSectorId =
  | 'terminal'
  | 'overview'
  | 'nodes'
  | 'dreams'
  | 'canvas'
  | 'skills'
  | 'agents'
  | 'usage'
  | 'config'
  | 'channels'
  | 'sales-os'
  | 'instances'
  | 'sessions'
  | 'docs'
  | 'cron';

export type DashboardCapabilityPlacement = {
  id: string;
  label: string;
  detail: string;
  sector: DashboardSectorId;
  state: 'live' | 'ready' | 'setup' | 'gated';
};

export type DashboardSector = {
  id: DashboardSectorId;
  label: string;
  summary: string;
  visible: boolean;
};

export const DASHBOARD_SURFACE_VERSION = 'zavorth-control-surface/2026-05-31';

export const PRIMARY_DASHBOARD_SURFACE = {
  id: 'zavorth-control-vite-shell',
  source: 'apps/zavorth-control-vite-shell',
  publicRoute: '/zavorth-control-vite-shell',
  role: 'canonical-user-dashboard',
  note: 'Daily dashboard surface for chat, runtime, memory, tools, models, settings, canvas, and runtime adapters.',
} as const;

/** Primary dock order (≤5 sectors; "More" is UI-only, not a sector). */
export const PRIMARY_DASHBOARD_SECTOR_IDS: DashboardSectorId[] = [
  'terminal',
  'overview',
  'sales-os',
  'instances',
  'config',
];

/** Command Center / More dock targets — stay in DOM, not primary dock items. */
export const MORE_DASHBOARD_SECTOR_IDS: DashboardSectorId[] = [
  'channels',
  'nodes',
  'dreams',
  'skills',
  'agents',
  'usage',
  'canvas',
  'cron',
  'sessions',
];

export const DASHBOARD_SECTORS: DashboardSector[] = [
  { id: 'terminal', label: 'Inbox', visible: true, summary: 'Chat, prompt queue, slash commands, steering, exports, files, and approvals.' },
  { id: 'overview', label: 'Work', visible: true, summary: 'Current run, trace, Gantt, replay, lifecycle events, and decisions.' },
  { id: 'nodes', label: 'Memory', visible: false, summary: 'Mnemos recall, fact vault, provenance, trusted folders, and forget/promote/correct.' },
  { id: 'dreams', label: 'Learning', visible: false, summary: 'Session hooks, learning candidates, consolidation, and review before promotion.' },
  { id: 'canvas', label: 'Canvas', visible: false, summary: 'A2UI renderer, sandbox preview, mutation gate, diffs, and receipts.' },
  { id: 'skills', label: 'Tools', visible: false, summary: 'Tool library, git/review commands, constitution importer, and governed actions.' },
  { id: 'agents', label: 'Agents', visible: false, summary: 'Runtime adapters, ACP adapter, sandbox posture, execution preview, and receipts.' },
  { id: 'usage', label: 'Models', visible: false, summary: 'Provider routes, model readiness, streaming proof, usage, and fallback state.' },
  { id: 'config', label: 'Settings', visible: true, summary: 'Language, engines, trusted folders, provider diagnostics, and advanced JSON.' },
  { id: 'channels', label: 'Channels', visible: false, summary: 'Web, CLI, remote, and team channels.' },
  { id: 'sales-os', label: 'Review', visible: true, summary: 'Approval scopes, receipts, revocation, and break-glass policy.' },
  { id: 'instances', label: 'Proof', visible: true, summary: 'Past work, receipts, decisions, and rollback guidance.' },
  { id: 'sessions', label: 'Sessions', visible: false, summary: 'Session timeline and handoff context.' },
  { id: 'docs', label: 'Docs', visible: false, summary: 'Short references for setup, models, memory, tools, and safe execution.' },
  { id: 'cron', label: 'Cron', visible: false, summary: 'Scheduled work, monitors, and reminders.' },
];

export const DASHBOARD_CAPABILITY_PLACEMENTS: DashboardCapabilityPlacement[] = [
  { id: 'prompt.queue', label: 'Prompt queue', detail: 'Submit, steer, retry, cancel, replace, and export prompts from the composer.', sector: 'terminal', state: 'live' },
  { id: 'slash.commands', label: 'Slash commands', detail: '/side, /btw, /new, /export, /steer and git/review helpers are discoverable.', sector: 'terminal', state: 'live' },
  { id: 'trace.replay', label: 'Trace + replay', detail: 'Runtime events, lifecycle hooks, Gantt timing, and replay share one timeline.', sector: 'overview', state: 'live' },
  { id: 'approval.receipts', label: 'Approvals', detail: 'Risky work stays previewed, scoped, approved, and receipt-backed.', sector: 'overview', state: 'live' },
  { id: 'memory.mnemos', label: 'Mnemos recall', detail: 'FTS5 recall, provenance, confidence, forget, promote, and correct run through memory contracts.', sector: 'nodes', state: 'live' },
  { id: 'memory.trustedFolders', label: 'Trusted folders', detail: 'Folder scopes use real settings contracts and fall back to manual path entry when browsers hide paths.', sector: 'nodes', state: 'live' },
  { id: 'learning.hooks', label: 'Learning hooks', detail: 'Session lifecycle candidates are visible before anything becomes durable memory.', sector: 'dreams', state: 'live' },
  { id: 'canvas.a2ui', label: 'A2UI renderer', detail: 'Agent UI components render inside Z-Canvas with sandbox preview and receipts.', sector: 'canvas', state: 'live' },
  { id: 'mutation.gate', label: 'Mutation gate', detail: 'Disk changes require preview, approval, and receipt before apply.', sector: 'canvas', state: 'live' },
  { id: 'git.workflow', label: 'Git/review', detail: '/branch, /commit, /pr and zavorth review route through governed workflow services.', sector: 'skills', state: 'live' },
  { id: 'constitution.importer', label: 'Constitution importer', detail: 'CLAUDE.md and AGENTS.md import through preview, approval, and origin registry.', sector: 'skills', state: 'live' },
  { id: 'external.acp', label: 'ACP adapter', detail: 'Generic ACP channels are Zavorth-native and use a neutral runtime-adapter contract.', sector: 'agents', state: 'live' },
  { id: 'external.registry', label: 'Runtime adapters', detail: 'Profiles, sandbox posture, previewed execution, and receipts live in the Agents tab.', sector: 'agents', state: 'live' },
  { id: 'providers.streaming', label: 'Provider streaming', detail: 'Model routes expose setup, base URL, default model, native streaming, and canary status.', sector: 'usage', state: 'ready' },
  { id: 'settings.doctor', label: 'Setup doctor', detail: 'Provider, engine, folder, and language readiness stay folded into everyday settings.', sector: 'config', state: 'ready' },
];

export const LEGACY_DASHBOARD_SURFACE_MAP = [
  { legacy: 'src/zavorth-control/app/(dashboard)', canonicalSector: 'terminal', reason: 'Legacy Next dashboard should delegate daily chat/control to the Vite shell.' },
  { legacy: 'src/zavorth-control/app/(zavorthControl)', canonicalSector: 'overview', reason: 'Legacy control route maps to the Work overview in the canonical shell.' },
  { legacy: 'src/zavorth-control/public/zavorth-control-vite-shell', canonicalSector: 'overview', reason: 'Built static copy of the same canonical Vite shell.' },
  { legacy: 'apps/zavorth-control-vite-shell', canonicalSector: 'overview', reason: 'Primary editable dashboard source.' },
] as const;

export function sectorLabel(id: string) {
  return DASHBOARD_SECTORS.find((sector) => sector.id === id)?.label || id;
}

export function sectorSummary(id: string) {
  return DASHBOARD_SECTORS.find((sector) => sector.id === id)?.summary || '';
}

export function sectorCapabilities(id: string) {
  return DASHBOARD_CAPABILITY_PLACEMENTS.filter((capability) => capability.sector === id);
}

export function visibleDashboardSectors() {
  return DASHBOARD_SECTORS.filter((sector) => sector.visible);
}

export function primaryDashboardSectors() {
  return PRIMARY_DASHBOARD_SECTOR_IDS
    .map((id) => DASHBOARD_SECTORS.find((sector) => sector.id === id))
    .filter((sector): sector is DashboardSector => Boolean(sector));
}

export function moreDashboardSectors() {
  return MORE_DASHBOARD_SECTOR_IDS
    .map((id) => DASHBOARD_SECTORS.find((sector) => sector.id === id))
    .filter((sector): sector is DashboardSector => Boolean(sector));
}

export function isPrimaryDashboardSector(id: string) {
  return (PRIMARY_DASHBOARD_SECTOR_IDS as string[]).includes(id);
}
