import { translate } from './locale';
import { isPrimaryDashboardSector, sectorLabel } from './dashboard-surface-registry';

export function initDockNavigation(options: {
  coreFrame: HTMLElement | null;
  dockNodes: NodeListOf<HTMLElement>;
  sectors: NodeListOf<HTMLElement>;
  bridgeCurrent: HTMLElement | null;
  onOverviewActivated?: () => void;
}) {
  const { dockNodes, sectors, bridgeCurrent, onOverviewActivated } = options;
  const dockMore = document.getElementById('dock-more');
  const dockMoreTrigger = document.getElementById('dock-more-trigger') as HTMLButtonElement | null;
  const dockMorePanel = document.getElementById('dock-more-panel');

  function setMoreOpen(open: boolean) {
    if (!dockMore || !dockMoreTrigger || !dockMorePanel) return;
    dockMore.classList.toggle('is-open', open);
    dockMoreTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      dockMorePanel.removeAttribute('hidden');
    } else {
      dockMorePanel.setAttribute('hidden', '');
    }
  }

  function syncMoreActive(sectorId: string) {
    if (!dockMore || !dockMoreTrigger) return;
    const secondaryActive = Boolean(sectorId) && !isPrimaryDashboardSector(sectorId);
    dockMore.classList.toggle('has-active', secondaryActive);
    dockMoreTrigger.classList.toggle('active', secondaryActive);
  }

  function activateSector(sectorId: string, activeNode?: HTMLElement | null) {
    if (!sectorId) return;

    dockNodes.forEach((dockNode) => dockNode.classList.remove('active'));
    if (activeNode) {
      activeNode.classList.add('active');
    } else {
      const match = Array.from(dockNodes).find((node) => node.dataset.sector === sectorId);
      match?.classList.add('active');
    }

    sectors.forEach((sector) => sector.classList.remove('active'));
    const target = document.getElementById(`sector-${sectorId}`);
    if (target) target.classList.add('active');

    if (bridgeCurrent) bridgeCurrent.textContent = translate(sectorLabel(sectorId));
    syncMoreActive(sectorId);
    if (isPrimaryDashboardSector(sectorId)) setMoreOpen(false);
    if (sectorId === 'overview') requestAnimationFrame(() => onOverviewActivated?.());
  }

  dockNodes.forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const sectorId = node.dataset.sector || '';
      activateSector(sectorId, node);
      if (!isPrimaryDashboardSector(sectorId)) setMoreOpen(false);
    });
  });

  dockMoreTrigger?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = dockMoreTrigger.getAttribute('aria-expanded') !== 'true';
    setMoreOpen(open);
  });

  document.addEventListener('click', (event) => {
    if (!dockMore?.classList.contains('is-open')) return;
    const target = event.target;
    if (target instanceof Node && dockMore.contains(target)) return;
    setMoreOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMoreOpen(false);
  });

  const initialActive = document.querySelector('.dock-node.active[data-sector]') as HTMLElement | null;
  syncMoreActive(initialActive?.dataset.sector || 'terminal');
  setMoreOpen(false);
}
