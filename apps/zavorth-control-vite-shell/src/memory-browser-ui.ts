/**
 * Mnemos memory browser helper (P2-18) — compact search filter over [data-memory-list].
 */

export function applyMemorySearchFilter(root: ParentNode = document) {
  const section = root.querySelector('#sector-nodes') || root;
  const input = section.querySelector<HTMLInputElement>('[data-memory-search]');
  const list = section.querySelector<HTMLElement>('[data-memory-list]');
  if (!list) return;
  const query = String(input?.value || '').trim().toLowerCase();
  list.querySelectorAll<HTMLElement>('[data-memory-item]').forEach((item) => {
    const haystack = String(item.getAttribute('data-memory-search-text') || item.textContent || '').toLowerCase();
    item.hidden = Boolean(query) && !haystack.includes(query);
  });
}

export function initMemoryBrowserUi(root: ParentNode = document) {
  if (document.documentElement.dataset.zavorthMemoryBrowserBound === '1') return;
  document.documentElement.dataset.zavorthMemoryBrowserBound = '1';

  document.addEventListener('input', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.matches?.('[data-memory-search]')) return;
    applyMemorySearchFilter(root);
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const searchBtn = target?.closest?.('[data-memory-search-run]');
    if (!searchBtn) return;
    event.preventDefault();
    applyMemorySearchFilter(root);
  });

  applyMemorySearchFilter(root);
}
