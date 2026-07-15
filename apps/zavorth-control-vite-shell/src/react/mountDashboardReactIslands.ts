import { renderToStaticMarkup } from 'react-dom/server';
import {
  DASHBOARD_REACT_ISLANDS,
  DASHBOARD_REACT_ISLAND_VERSION,
  renderDashboardReactIsland,
  type DashboardReactIslandId,
} from './DashboardReactIslands';

export type MountDashboardReactIslandsResult = {
  version: typeof DASHBOARD_REACT_ISLAND_VERSION;
  mounted: DashboardReactIslandId[];
  skipped: Array<{ id: DashboardReactIslandId; reason: string }>;
};

export function mountDashboardReactIslands(
  root: ParentNode = typeof document !== 'undefined' ? document : (null as unknown as ParentNode),
): MountDashboardReactIslandsResult {
  const mounted: DashboardReactIslandId[] = [];
  const skipped: Array<{ id: DashboardReactIslandId; reason: string }> = [];

  if (!root || typeof (root as Document).getElementById !== 'function') {
    return {
      version: DASHBOARD_REACT_ISLAND_VERSION,
      mounted,
      skipped: DASHBOARD_REACT_ISLANDS.map((i) => ({ id: i.id, reason: 'no-document' })),
    };
  }

  const doc = root as Document;

  for (const island of DASHBOARD_REACT_ISLANDS) {
    const host = doc.getElementById(island.sectorElementId);
    if (!host) {
      skipped.push({ id: island.id, reason: 'host-missing' });
      continue;
    }
    // Do not clobber an island already painted (e.g. double-init).
    if (host.querySelector(`[data-react-dashboard-island="${island.id}"]`)) {
      skipped.push({ id: island.id, reason: 'already-mounted' });
      continue;
    }
    const tree = renderDashboardReactIsland(island.id);
    if (!tree) {
      skipped.push({ id: island.id, reason: 'no-component' });
      continue;
    }
    host.innerHTML = renderToStaticMarkup(tree);
    host.setAttribute('data-react-dashboard-host', island.id);
    mounted.push(island.id);
  }

  return { version: DASHBOARD_REACT_ISLAND_VERSION, mounted, skipped };
}

export function listDashboardReactIslandIds(): DashboardReactIslandId[] {
  return DASHBOARD_REACT_ISLANDS.map((island) => island.id);
}
