import { translate } from './locale';
import { sectorLabel } from './dashboard-surface-registry';

export function initDockNavigation(options: {
  coreFrame: HTMLElement | null;
  dockNodes: NodeListOf<HTMLElement>;
  sectors: NodeListOf<HTMLElement>;
  bridgeCurrent: HTMLElement | null;
  onOverviewActivated?: () => void;
}) {
  const { dockNodes, sectors, bridgeCurrent, onOverviewActivated } = options;

  dockNodes.forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const sectorId = node.dataset.sector || '';

      dockNodes.forEach((dockNode) => dockNode.classList.remove('active'));
      node.classList.add('active');

      sectors.forEach((sector) => sector.classList.remove('active'));
      const target = document.getElementById(`sector-${sectorId}`);
      if (target) target.classList.add('active');

      if (bridgeCurrent) bridgeCurrent.textContent = translate(sectorLabel(sectorId));
      if (sectorId === 'overview') requestAnimationFrame(() => onOverviewActivated?.());
    });
  });
}
