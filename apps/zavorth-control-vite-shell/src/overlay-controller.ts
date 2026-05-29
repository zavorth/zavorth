type OverlayControllerOptions = {
  coreFrame: HTMLElement | null;
  sanitizeTrustedHtml: (html: string) => string;
  onDismiss?: () => void;
  onActivateSector?: (sectorId: string) => void;
};

export function createOverlayController(options: OverlayControllerOptions) {
  const overlayShade = document.getElementById('overlay-shade');
  const cmdPalette = document.getElementById('cmd-palette');
  const cmdInput = document.getElementById('cmd-input') as HTMLInputElement | null;
  const mobileDrawer = document.getElementById('mobile-drawer');
  const drawerItems = document.querySelectorAll<HTMLElement>('.mobile-drawer__item[data-drawer-sector]');
  const coreModal = document.getElementById('core-modal');
  let overlayOpenedAt = 0;

  function getOverlayShade() {
    return overlayShade;
  }

  function markOverlayOpened() {
    overlayOpenedAt = Date.now();
  }

  function openPalette() {
    overlayShade?.classList.add('active');
    markOverlayOpened();
    closeMobileDrawer(false);
    cmdPalette?.classList.add('active');
    cmdInput?.focus();
  }

  function openMobileDrawer() {
    if (!mobileDrawer || !overlayShade) return;
    overlayShade.classList.add('active');
    markOverlayOpened();
    mobileDrawer.classList.add('active');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    options.coreFrame?.classList.add('drawer-open');
  }

  function closeMobileDrawer(clearShade = true) {
    if (!mobileDrawer) return;
    mobileDrawer.classList.remove('active');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    options.coreFrame?.classList.remove('drawer-open');
    if (clearShade) overlayShade?.classList.remove('active');
  }

  function syncDrawerActive(sectorId: string | undefined) {
    drawerItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.drawerSector === sectorId);
    });
  }

  function dismissOverlays() {
    overlayShade?.classList.remove('active');
    cmdPalette?.classList.remove('active');
    coreModal?.classList.remove('active');
    options.onDismiss?.();
    closeMobileDrawer(false);
  }

  function openCoreModal(title: string, content: string) {
    const titleNode = document.getElementById('core-modal-title');
    const bodyNode = document.getElementById('core-modal-body');
    if (titleNode) titleNode.textContent = title;
    if (bodyNode) bodyNode.innerHTML = options.sanitizeTrustedHtml(content);
    overlayShade?.classList.add('active');
    markOverlayOpened();
    coreModal?.classList.add('active');
  }

  function bind() {
    document.getElementById('search-btn')?.addEventListener('click', openPalette);
    document.getElementById('search-trigger')?.addEventListener('click', openPalette);
    document.getElementById('mobile-menu-trigger')?.addEventListener('click', openMobileDrawer);
    document.getElementById('mobile-drawer-close')?.addEventListener('click', () => closeMobileDrawer());
    document.getElementById('mobile-drawer-search')?.addEventListener('click', openPalette);
    document.getElementById('core-modal-close')?.addEventListener('click', dismissOverlays);
    document.getElementById('core-modal-cancel')?.addEventListener('click', dismissOverlays);

    drawerItems.forEach((item) => {
      item.addEventListener('click', () => {
        const sectorId = item.dataset.drawerSector || '';
        options.onActivateSector?.(sectorId);
        syncDrawerActive(sectorId);
        closeMobileDrawer();
      });
    });

    overlayShade?.addEventListener('click', () => {
      if (Date.now() - overlayOpenedAt < 320) return;
      dismissOverlays();
    });
  }

  return {
    bind,
    closeMobileDrawer,
    dismissOverlays,
    getOverlayShade,
    markOverlayOpened,
    openCoreModal,
    openMobileDrawer,
    openPalette,
    syncDrawerActive,
  };
}

