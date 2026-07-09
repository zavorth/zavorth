/**
 * Mobile trust rail — bottom sheet instead of hiding the rail entirely.
 */

const MQ = '(max-width: 900px)';

export function initTrustRailMobile(): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.zavorthTrustRailMobile === '1') return;
  document.documentElement.dataset.zavorthTrustRailMobile = '1';

  ensureMobileChrome();
  bindEvents();
  syncMode();

  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia(MQ);
    const onChange = () => {
      syncMode();
      if (!mql.matches) closeSheet();
    };
    mql.addEventListener?.('change', onChange);
    // Safari legacy
    mql.addListener?.(onChange);
  }
}

export function openTrustRailSheet(): void {
  const rail = document.getElementById('trust-rail');
  const shade = document.getElementById('trust-rail-shade');
  const fab = document.getElementById('trust-rail-fab');
  if (!rail) return;
  rail.classList.add('is-sheet-open');
  rail.setAttribute('aria-hidden', 'false');
  shade?.classList.add('is-open');
  shade?.setAttribute('aria-hidden', 'false');
  fab?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('trust-sheet-open');
}

export function closeTrustRailSheet(): void {
  const rail = document.getElementById('trust-rail');
  const shade = document.getElementById('trust-rail-shade');
  const fab = document.getElementById('trust-rail-fab');
  rail?.classList.remove('is-sheet-open');
  rail?.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');
  shade?.classList.remove('is-open');
  shade?.setAttribute('aria-hidden', 'true');
  fab?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('trust-sheet-open');
}

function isMobile(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(MQ).matches;
}

function syncMode(): void {
  const rail = document.getElementById('trust-rail');
  const fab = document.getElementById('trust-rail-fab');
  const shade = document.getElementById('trust-rail-shade');
  if (!rail) return;

  if (isMobile()) {
    document.documentElement.classList.add('trust-rail-mobile');
    fab?.removeAttribute('hidden');
    shade?.removeAttribute('hidden');
    if (!rail.classList.contains('is-sheet-open')) {
      rail.setAttribute('aria-hidden', 'true');
    }
  } else {
    document.documentElement.classList.remove('trust-rail-mobile');
    fab?.setAttribute('hidden', '');
    shade?.setAttribute('hidden', '');
    shade?.classList.remove('is-open');
    rail.classList.remove('is-sheet-open');
    rail.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('trust-sheet-open');
  }
}

function ensureMobileChrome(): void {
  const rail = document.getElementById('trust-rail');
  if (!rail) return;

  // Header with close for sheet mode
  let header = rail.querySelector<HTMLElement>('.trust-rail__header');
  if (!header) {
    header = document.createElement('div');
    header.className = 'trust-rail__header';
    header.innerHTML = '<strong>Trust</strong>';
    rail.prepend(header);
  }
  if (!header.querySelector('[data-trust-sheet-close]')) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'trust-rail__close';
    close.setAttribute('data-trust-sheet-close', '');
    close.setAttribute('aria-label', 'Close trust panel');
    close.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    header.appendChild(close);
  }

  // Handle bar for sheet affordance
  if (!rail.querySelector('.trust-rail__handle')) {
    const handle = document.createElement('div');
    handle.className = 'trust-rail__handle';
    handle.setAttribute('aria-hidden', 'true');
    rail.prepend(handle);
  }

  // FAB
  if (!document.getElementById('trust-rail-fab')) {
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'trust-rail-fab';
    fab.className = 'trust-rail-fab';
    fab.setAttribute('aria-label', 'Open trust panel');
    fab.setAttribute('aria-controls', 'trust-rail');
    fab.setAttribute('aria-expanded', 'false');
    fab.hidden = true;
    fab.innerHTML = `
      <span class="trust-rail-fab__label">Trust</span>
      <span class="trust-rail-fab__badge" data-attention-count hidden></span>
    `;
    document.body.appendChild(fab);
  }

  // Shade
  if (!document.getElementById('trust-rail-shade')) {
    const shade = document.createElement('div');
    shade.id = 'trust-rail-shade';
    shade.className = 'trust-rail-shade';
    shade.setAttribute('aria-hidden', 'true');
    shade.hidden = true;
    document.body.appendChild(shade);
  }
}

function bindEvents(): void {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('#trust-rail-fab')) {
      event.preventDefault();
      if (document.getElementById('trust-rail')?.classList.contains('is-sheet-open')) {
        closeTrustRailSheet();
      } else {
        openTrustRailSheet();
      }
      return;
    }

    if (target.closest('[data-trust-sheet-close]')) {
      event.preventDefault();
      closeTrustRailSheet();
      return;
    }

    if (target.closest('#trust-rail-shade')) {
      closeTrustRailSheet();
      return;
    }

    // After navigating from a trust action on mobile, close sheet
    if (
      isMobile()
      && target.closest('#trust-rail [data-dashboard-sector], #trust-rail [data-dashboard-doctor]')
    ) {
      window.setTimeout(() => closeTrustRailSheet(), 80);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTrustRailSheet();
  });
}
