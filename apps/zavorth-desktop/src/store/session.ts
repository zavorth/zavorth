import { atom, computed } from 'nanostores';
import type { ChatMessage, ExperienceSnapshot } from '../apiClient';
import type { RuntimeStatus, BootEvent } from '../global';
import { fallbackStatus } from '../appRuntimeState';

export const $status = atom<RuntimeStatus>(fallbackStatus);
export const $snapshot = atom<ExperienceSnapshot | null>(null);
export const $messages = atom<ChatMessage[]>([]);
export const $busy = atom(false);
export const $notice = atom('');
export const $selectedModel = atom('zavorth:core');
export const $effort = atom('medium');
export const $experienceProfile = atom('personal');
/** Explicit session override used after create/switch until home snapshot catches up. */
export const $sessionIdOverride = atom<string | null>(null);
export const $sessionId = computed([$snapshot, $sessionIdOverride], (s, override) => {
  const fromOverride = String(override || '').trim();
  if (fromOverride) return fromOverride;
  return String(s?.sessionId || '').trim() || 'desktop-main';
});
export const $events = atom<BootEvent[]>([]);

// Actions
export function setStatus(s: RuntimeStatus) { $status.set(s); }
export function setMessages(m: ChatMessage[]) { $messages.set(m); }
export function setBusy(b: boolean) { $busy.set(b); }
export function setNotice(n: string) { $notice.set(n); }
export function setSelectedModel(m: string) { $selectedModel.set(m); }
export function setEffort(e: string) { $effort.set(e); }
export function setExperienceProfile(p: string) { $experienceProfile.set(p); }
export function addEvent(e: BootEvent) { $events.set([e, ...$events.get()].slice(0, 8)); }
export function setSnapshot(s: ExperienceSnapshot | null) {
  $snapshot.set(s);
  const nextId = String(s?.sessionId || '').trim();
  if (nextId && $sessionIdOverride.get() === nextId) {
    $sessionIdOverride.set(null);
  }
}
export function setSessionIdOverride(id: string | null) {
  $sessionIdOverride.set(id ? String(id).trim() || null : null);
}
export { fallbackStatus };
