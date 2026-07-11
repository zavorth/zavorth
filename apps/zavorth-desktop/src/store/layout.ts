import { atom } from 'nanostores';
import type { DesktopPanel } from '../slashCommands';

export const $activePanel = atom<DesktopPanel>('chat');
export const $commandPaletteOpen = atom(false);
export const $sidebarCollapsed = atom(false);
export const $inspectorOpen = atom(false);
export const $terminalOpen = atom(false);

export function setActivePanel(p: DesktopPanel) { $activePanel.set(p); }
export function toggleCommandPalette() { $commandPaletteOpen.set(!$commandPaletteOpen.get()); }
export function setCommandPaletteOpen(o: boolean) { $commandPaletteOpen.set(o); }
export function toggleSidebar() { $sidebarCollapsed.set(!$sidebarCollapsed.get()); }
export function setSidebarCollapsed(c: boolean | ((current: boolean) => boolean)) {
  $sidebarCollapsed.set(typeof c === 'function' ? c($sidebarCollapsed.get()) : c);
}
export function setInspectorOpen(o: boolean) { $inspectorOpen.set(o); }
export function toggleTerminal() { $terminalOpen.set(!$terminalOpen.get()); }
