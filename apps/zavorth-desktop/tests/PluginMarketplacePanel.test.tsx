import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ComponentType } from 'react';
import {
  renderUI,
  cleanupUI,
  click,
  typeText,
  queryAllByText,
  queryByText,
  getByText,
  getByPlaceholderText,
  getTab,
} from './helpers/uiHarness';
import type { PluginItem, PluginMarketplacePanelProps } from '../src/views/panels/PluginMarketplacePanel';

vi.mock('@tabler/icons-react', () => {
  const createIconStub = () => {
    const Icon = () => null;
    return Icon;
  };
  return Object.fromEntries(
    [
      'IconStar',
      'IconStarFilled',
      'IconDownload',
      'IconTrash',
      'IconRefresh',
      'IconCategory',
      'IconPlug',
      'IconShieldCheck',
      'IconClock',
      'IconUsers',
      'IconChevronRight',
      'IconX',
      'IconCheck',
      'IconAlertTriangle',
      'IconExternalLink',
    ].map(name => [name, createIconStub()]),
  );
});

const MOCK_PLUGINS: PluginItem[] = [
  {
    id: 'zavorth-ai-safety',
    name: 'AI Safety Researcher',
    description: 'AI safety, alignment testing, red teaming',
    author: 'Zavorth',
    version: '1.0.0',
    category: 'productivity',
    status: 'installed',
    rating: 4.5,
    reviewCount: 12,
    downloads: 150,
    featured: true,
    tags: ['safety', 'alignment'],
  },
  {
    id: 'zavorth-vision',
    name: 'Vision Service',
    description: 'Image analysis, OCR, object identification',
    author: 'Zavorth',
    version: '2.1.0',
    category: 'development',
    status: 'installed',
    rating: 4.8,
    reviewCount: 25,
    downloads: 320,
    featured: true,
    tags: ['vision', 'ocr'],
  },
  {
    id: 'zavorth-analytics',
    name: 'Usage Analytics',
    description: 'Usage tracking, cost analysis, quality metrics',
    author: 'Zavorth',
    version: '1.5.0',
    category: 'analytics',
    status: 'available',
    rating: 3.9,
    reviewCount: 8,
    downloads: 80,
    tags: ['analytics', 'cost'],
  },
  {
    id: 'zavorth-edge',
    name: 'Edge Computing Specialist',
    description: 'Edge deployment, IoT, embedded systems',
    author: 'Zavorth',
    version: '1.0.0',
    category: 'security',
    status: 'available',
    rating: 4.2,
    reviewCount: 5,
    downloads: 45,
    tags: ['edge', 'iot'],
  },
];

type MarketplacePanelComponent = ComponentType<PluginMarketplacePanelProps>;

async function loadPanelModule(): Promise<MarketplacePanelComponent> {
  // The panel keeps its UI state in module-level nanostores atoms; resetting the
  // module registry gives every test a pristine store without mocking nanostores.
  vi.resetModules();
  const { default: PluginMarketplacePanel } = await import('../src/views/panels/PluginMarketplacePanel');
  return PluginMarketplacePanel;
}

async function renderMarketplace(overrides: Partial<PluginMarketplacePanelProps> = {}) {
  const PluginMarketplacePanel = await loadPanelModule();
  const onInstall = vi.fn();
  const onUninstall = vi.fn();
  const onUpdate = vi.fn();
  const container = renderUI(
    <PluginMarketplacePanel
      plugins={MOCK_PLUGINS}
      onInstall={onInstall}
      onUninstall={onUninstall}
      onUpdate={onUpdate}
      {...overrides}
    />,
  );
  return { onInstall, onUninstall, onUpdate, container };
}

async function switchTab(container: HTMLElement, namePattern: RegExp): Promise<void> {
  click(getTab(container, namePattern));
}

function pluginCard(container: HTMLElement, pluginName: string): HTMLElement {
  const nameEl = queryAllByText(container, pluginName)[0];
  const card = nameEl?.closest('article');
  if (!card) throw new Error(`Card for "${pluginName}" not rendered`);
  return card;
}

beforeEach(() => {
  cleanupUI();
});

afterEach(() => {
  cleanupUI();
});

describe('PluginMarketplacePanel', () => {
  describe('Renders featured plugins', () => {
    it('renders the featured plugins section', async () => {
      const { container } = await renderMarketplace();
      expect(getByText(container, 'Featured Plugins')).toBeTruthy();
    });

    it('displays featured plugin names', async () => {
      const { container } = await renderMarketplace();
      expect(getByText(container, 'AI Safety Researcher')).toBeTruthy();
      expect(getByText(container, 'Vision Service')).toBeTruthy();
    });

    it('displays featured plugin download counts', async () => {
      const { container } = await renderMarketplace();
      expect(getByText(container, '150')).toBeTruthy();
      expect(getByText(container, '320')).toBeTruthy();
    });
  });

  describe('Renders plugin list', () => {
    it('renders only the featured pair on the default tab', async () => {
      // Current contract: the featured rail lists featured plugins and the
      // grid below it excludes them, leaving the default view to just the rail.
      const { container } = await renderMarketplace();
      expect(getByText(container, 'AI Safety Researcher')).toBeTruthy();
      expect(getByText(container, 'Vision Service')).toBeTruthy();
      expect(queryByText(container, 'Usage Analytics')).toBeNull();
      expect(queryByText(container, 'Edge Computing Specialist')).toBeNull();
    });

    it('displays plugin descriptions', async () => {
      const { container } = await renderMarketplace();
      expect(queryByText(container, /AI safety, alignment/)).not.toBeNull();
      expect(queryByText(container, /Image analysis, OCR/)).not.toBeNull();
    });

    it('displays plugin versions', async () => {
      const { container } = await renderMarketplace();
      expect(queryAllByText(container, 'v1.0.0').length).toBeGreaterThanOrEqual(1);
      expect(getByText(container, 'v2.1.0')).toBeTruthy();
    });

    it('displays plugin authors', async () => {
      const { container } = await renderMarketplace();
      expect(queryAllByText(container, 'Zavorth').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Filters by category', () => {
    it('renders category navigation buttons when switching to the Categories tab', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /categories/i);

      expect(getByText(container, 'All')).toBeTruthy();
      expect(getByText(container, 'Productivity')).toBeTruthy();
      expect(getByText(container, 'Development')).toBeTruthy();
      expect(getByText(container, 'Analytics')).toBeTruthy();
      expect(getByText(container, 'Security')).toBeTruthy();
    });

    it('filters plugins when a category is selected', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /categories/i);
      click(getByText(container, 'Development'));

      expect(getByText(container, 'Vision Service')).toBeTruthy();
      expect(queryByText(container, 'Usage Analytics')).toBeNull();
      expect(queryByText(container, 'Edge Computing Specialist')).toBeNull();
    });

    it('shows all plugins when "All" category is selected', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /categories/i);
      click(getByText(container, 'Development'));
      expect(queryByText(container, 'Usage Analytics')).toBeNull();

      click(getByText(container, 'All'));
      expect(getByText(container, 'Usage Analytics')).toBeTruthy();
      expect(getByText(container, 'Edge Computing Specialist')).toBeTruthy();
    });

    it('highlights the active category button', async () => {
      // The redesigned category nav marks selection with an is-active class
      // instead of the retired tablist aria-selected attribute.
      const { container } = await renderMarketplace();
      await switchTab(container, /categories/i);

      const developmentButton = getByText(container, 'Development').closest('button');
      if (!developmentButton) throw new Error('Development category button not rendered');
      click(developmentButton);

      expect(developmentButton.classList.contains('is-active')).toBe(true);
      expect(getByText(container, 'All').closest('button')?.classList.contains('is-active')).toBe(false);
    });

    it('hides categories that have no plugins', async () => {
      // Replaces the retired "empty category" empty-state coverage: the category
      // nav now auto-hides zero-count categories instead of rendering them.
      const { container } = await renderMarketplace({ plugins: [MOCK_PLUGINS[0]] });
      await switchTab(container, /categories/i);

      expect(getByText(container, 'Productivity')).toBeTruthy();
      expect(queryByText(container, 'Analytics')).toBeNull();
      expect(queryByText(container, 'Security')).toBeNull();
    });
  });

  describe('Searches plugins', () => {
    it('renders a search input', async () => {
      const { container } = await renderMarketplace();
      expect(getByPlaceholderText(container, 'Search plugins...')).toBeTruthy();
    });

    it('filters plugins by name on search', async () => {
      // The featured rail intentionally stays unfiltered, so name filtering is
      // asserted on the All Plugins tab where only the filtered grid renders.
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);
      typeText(getByPlaceholderText(container, 'Search plugins...'), 'Vision');

      expect(getByText(container, 'Vision Service')).toBeTruthy();
      expect(queryByText(container, 'AI Safety Researcher')).toBeNull();
      expect(queryByText(container, 'Usage Analytics')).toBeNull();
    });

    it('filters plugins by description keyword', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);
      typeText(getByPlaceholderText(container, 'Search plugins...'), 'embedded');

      expect(getByText(container, 'Edge Computing Specialist')).toBeTruthy();
      expect(queryByText(container, 'Vision Service')).toBeNull();
    });

    it('searches case-insensitively', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);
      typeText(getByPlaceholderText(container, 'Search plugins...'), 'VISION');

      expect(getByText(container, 'Vision Service')).toBeTruthy();
    });

    it('clears search results when input is cleared', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);
      const input = getByPlaceholderText(container, 'Search plugins...');

      typeText(input, 'Vision');
      expect(queryByText(container, 'Usage Analytics')).toBeNull();

      typeText(input, '');
      expect(getByText(container, 'Usage Analytics')).toBeTruthy();
    });
  });

  describe('Shows plugin details', () => {
    it('shows details modal when a plugin is clicked', async () => {
      const { container } = await renderMarketplace();
      click(getByText(container, 'AI Safety Researcher'));

      expect(container.querySelector('.zvd-pm-modal')).not.toBeNull();
      expect(queryByText(container, /AI safety, alignment testing/)).not.toBeNull();
      expect(queryByText(container, /by Zavorth/)).not.toBeNull();
    });

    it('displays tags in the details view', async () => {
      const { container } = await renderMarketplace();
      click(getByText(container, 'Vision Service'));

      expect(getByText(container, 'vision')).toBeTruthy();
      expect(getByText(container, 'ocr')).toBeTruthy();
    });

    it('closes details when the close button is clicked', async () => {
      const { container } = await renderMarketplace();
      click(getByText(container, 'AI Safety Researcher'));
      expect(container.querySelector('.zvd-pm-modal')).not.toBeNull();

      const closeButton = container.querySelector('.zvd-pm-modal-close');
      if (!closeButton) throw new Error('Modal close button not rendered');
      click(closeButton);

      expect(container.querySelector('.zvd-pm-modal')).toBeNull();
    });

    it('closes details when clicking outside the modal', async () => {
      // Escape-to-close was dropped in the modal redesign; the supported close
      // affordances are the X button and a backdrop click.
      const { container } = await renderMarketplace();
      click(getByText(container, 'AI Safety Researcher'));
      expect(container.querySelector('.zvd-pm-modal')).not.toBeNull();

      const backdrop = container.querySelector('.zvd-pm-modal-backdrop');
      if (!backdrop) throw new Error('Modal backdrop not rendered');
      click(backdrop);

      expect(container.querySelector('.zvd-pm-modal')).toBeNull();
    });
  });

  describe('Handles install/uninstall', () => {
    it('shows install buttons only for uninstalled plugins', async () => {
      const { container } = await renderMarketplace();
      // Available plugins surface outside the featured rail, so the default
      // view renders no install actions until the All Plugins tab is active.
      expect(queryAllByText(container, 'Install')).toHaveLength(0);

      await switchTab(container, /all plugins/i);
      expect(queryAllByText(container, 'Install')).toHaveLength(2);
    });

    it('calls onInstall with the plugin id when install button is clicked', async () => {
      const { onInstall, container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);

      const card = pluginCard(container, 'Usage Analytics');
      const installButton = card.querySelector<HTMLButtonElement>('.zvd-pm-btn.is-install');
      if (!installButton) throw new Error('Install button not rendered');
      click(installButton);

      expect(onInstall).toHaveBeenCalledTimes(1);
      expect(onInstall).toHaveBeenCalledWith('zavorth-analytics');
    });

    it('shows uninstall option for installed plugins', async () => {
      const { container } = await renderMarketplace();

      const card = pluginCard(container, 'AI Safety Researcher');
      expect(card.querySelector('.zvd-pm-btn.is-uninstall')).not.toBeNull();

      click(getByText(container, 'AI Safety Researcher'));
      expect(getByText(container, 'Uninstall')).toBeTruthy();
    });

    it('calls onUninstall when uninstall button is clicked', async () => {
      const { onUninstall, container } = await renderMarketplace();

      click(getByText(container, 'AI Safety Researcher'));
      click(getByText(container, 'Uninstall'));

      expect(onUninstall).toHaveBeenCalledWith('zavorth-ai-safety');
    });

    it('shows installed badge on installed plugins', async () => {
      const { container } = await renderMarketplace();
      expect(queryAllByText(container, 'Installed').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Shows ratings', () => {
    // Interactive rating coverage was removed by design: StarRating became
    // display-only and the onRate panel prop was retired entirely.
    it('displays star ratings for each plugin', async () => {
      const { container } = await renderMarketplace();
      expect(container.querySelectorAll('.zvd-pm-star').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.zvd-pm-star.is-filled').length).toBeGreaterThan(0);
    });

    it('displays review counts', async () => {
      const { container } = await renderMarketplace();
      expect(getByText(container, '(12)')).toBeTruthy();
      expect(getByText(container, '(25)')).toBeTruthy();
    });

    it('displays the numeric rating summary inside plugin details', async () => {
      const { container } = await renderMarketplace();
      click(getByText(container, 'AI Safety Researcher'));

      expect(queryByText(container, /4\.5 \(12 reviews\)/)).not.toBeNull();
    });

    it('displays download counts for each plugin', async () => {
      const { container } = await renderMarketplace();
      expect(getByText(container, '150')).toBeTruthy();
      expect(getByText(container, '320')).toBeTruthy();
    });
  });

  describe('Handles empty states', () => {
    it('shows empty state when no plugins match search', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);
      typeText(getByPlaceholderText(container, 'Search plugins...'), 'zzzznonexistent');

      expect(queryByText(container, /no plugins/i)).not.toBeNull();
      expect(queryByText(container, /Try a different search term/)).not.toBeNull();
    });

    it('shows empty state when plugins array is empty', async () => {
      const { container } = await renderMarketplace({ plugins: [] });

      expect(queryByText(container, /no plugins/i)).not.toBeNull();
      expect(queryByText(container, /No plugins available/)).not.toBeNull();
    });
  });

  describe('Tab switching', () => {
    it('renders tab navigation', async () => {
      const { container } = await renderMarketplace();
      expect(getTab(container, /^Featured/)).toBeTruthy();
      expect(getTab(container, /All Plugins/)).toBeTruthy();
      expect(getTab(container, /Categories/)).toBeTruthy();
      expect(getTab(container, /Installed/)).toBeTruthy();
    });

    it('shows featured plugins by default', async () => {
      const { container } = await renderMarketplace();
      expect(getByText(container, 'AI Safety Researcher')).toBeTruthy();
      expect(getByText(container, 'Vision Service')).toBeTruthy();
    });

    it('switches to All Plugins tab', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);

      expect(getByText(container, 'Usage Analytics')).toBeTruthy();
      expect(getByText(container, 'Edge Computing Specialist')).toBeTruthy();
      expect(getByText(container, 'AI Safety Researcher')).toBeTruthy();
    });

    it('switches back to Featured tab', async () => {
      const { container } = await renderMarketplace();
      await switchTab(container, /all plugins/i);
      await switchTab(container, /^Featured/);

      expect(getByText(container, 'AI Safety Researcher')).toBeTruthy();
      expect(getByText(container, 'Featured Plugins')).toBeTruthy();
    });

    it('highlights the active tab', async () => {
      const { container } = await renderMarketplace();
      const featuredTab = getTab(container, /^Featured/);
      const allTab = getTab(container, /All Plugins/);
      expect(featuredTab.getAttribute('aria-selected')).toBe('true');

      click(allTab);

      expect(allTab.getAttribute('aria-selected')).toBe('true');
      expect(featuredTab.getAttribute('aria-selected')).toBe('false');
    });
  });
});
