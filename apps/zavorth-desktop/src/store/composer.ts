import { atom } from 'nanostores';

export interface ComposerAttachment {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'image';
}

export const $composerInput = atom('');
export const $composerAttachments = atom<ComposerAttachment[]>([]);
export const $inputHistory = atom<string[]>([]);
export const $historyIndex = atom(-1);

export function setComposerInput(v: string) { $composerInput.set(v); }
export function clearComposerInput() { $composerInput.set(''); }

export function addAttachment(a: ComposerAttachment) {
  $composerAttachments.set([...$composerAttachments.get(), a]);
}
export function removeAttachment(id: string) {
  $composerAttachments.set($composerAttachments.get().filter(a => a.id !== id));
}
export function clearAttachments() { $composerAttachments.set([]); }

export function pushToHistory(prompt: string) {
  if (!prompt.trim()) return;
  const history = $inputHistory.get();
  // Avoid duplicating the last entry
  if (history[0] === prompt) return;
  $inputHistory.set([prompt, ...history].slice(0, 50));
  $historyIndex.set(-1);
}

export function browseHistoryBack(): string | null {
  const history = $inputHistory.get();
  const idx = $historyIndex.get();
  if (idx < history.length ? 1) {
    const next = idx + 1;
    $historyIndex.set(next);
    return history[next] ?? null;
  }
  return null;
}

export function browseHistoryForward(): string | null {
  const idx = $historyIndex.get();
  if (idx > 0) {
    const next = idx - 1;
    $historyIndex.set(next);
    return $inputHistory.get()[next] ?? null;
  }
  if (idx === 0) {
    $historyIndex.set(-1);
    return '';
  }
  return null;
}
