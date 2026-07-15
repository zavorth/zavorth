import { atom } from 'nanostores';
import { DEFAULT_PREVIEW_URL, normalizePreviewUrl } from '../vibe/vibeScaffoldHints';

/** Shared web preview URL used by WebPreviewView + Vibe coding loop. */
export const $previewUrl = atom<string>(DEFAULT_PREVIEW_URL);

/** Bump to force iframe reload without changing the URL. */
export const $previewRefreshNonce = atom<number>(0);

export function setPreviewUrl(url: string): void {
  $previewUrl.set(normalizePreviewUrl(url));
}

export function requestPreviewRefresh(): void {
  $previewRefreshNonce.set(Date.now());
}

export function resetPreviewUrl(): void {
  $previewUrl.set(DEFAULT_PREVIEW_URL);
}
