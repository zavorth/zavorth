import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PluginMarketplacePanel from '../src/views/panels/PluginMarketplacePanel';

const MOCK_PLUGINS = [
  {
    id: 'zavorth-ai-safety',
    name: 'AI Safety Researcher',
    description: 'AI safety, alignment testing, red teaming',
    version: '1.0.0',
    author: 'Zavorth',
    category: 'ai-safety',
    tags: ['safety', 'alignment'],
    downloads: 150,
    rating: 4.5,
    reviews: 12,
    installed: true,
    enabled: true,
  },
  {
    id: 'zavorth-vision',
    name: 'Vision Service',
    description: 'Image analysis, OCR, object identification',
    version: '2.1.0',
    author: 'Zavorth',
    category: 'multimodal',
    tags: ['vision', 'ocr'],
    downloads: 320,
    rating: 4.8,
    reviews: 25,
    installed: true,
    enabled: true,
  },
  {
    id: 'zavorth-analytics',
    name: 'Usage Analytics',
    description: 'Usage tracking, cost analysis, quality metrics',
    version: '1.5.0',
    author: 'Zavorth',
    category: 'analytics',
    tags: ['analytics', 'cost'],
    downloads: 80,
    rating: 3.9,
    reviews: 8,
    installed: false,
    enabled: false,
  },
  {
    id: 'zavorth-edge',
    name: 'Edge Computing Specialist',
    description: 'Edge deployment, IoT, embedded systems',
    version: '1.0.0',
    author: 'Zavorth',
    category: 'edge-computing',
    tags: ['edge', 'iot'],
    downloads: 45,
    rating: 4.2,
    reviews: 5,
    installed: false,
    enabled: false,
  },
];

const FEATURED_PLUGINS = MOCK_PLUGINS.slice(0, 2);
const CATEGORIES = ['ai-safety', 'analytics', 'edge-computing', 'multimodal'];

function renderPanel(overrides: Record<string, unknown> = {}) {
  const onInstall = jest.fn();
  const onUninstall = jest.fn();
  const onRate = jest.fn();

  return {
    onInstall,
    onUninstall,
    onRate,
    ...render(
      <PluginMarketplacePanel
        plugins={MOCK_PLUGINS}
        featuredPlugins={FEATURED_PLUGINS}
        categories={CATEGORIES}
        onInstall={onInstall}
        onUninstall={onUninstall}
        onRate={onRate}
        {...overrides}
      />
    ),
  };
}

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe('PluginMarketplacePanel', () => {
  describe('Renders featured plugins', () => {
    it('renders the featured plugins section', () => {
      renderPanel();
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('displays featured plugin names', () => {
      renderPanel();
      expect(screen.getByText('AI Safety Researcher')).toBeInTheDocument();
      expect(screen.getByText('Vision Service')).toBeInTheDocument();
    });

    it('displays featured plugin ratings', () => {
      renderPanel();
      const featuredSection = screen.getByText('Featured').closest('section') || document.body;
      expect(within(featuredSection).getByText(/4\.5/)).toBeInTheDocument();
    });

    it('displays featured plugin download counts', () => {
      renderPanel();
      expect(screen.getByText(/150/)).toBeInTheDocument();
      expect(screen.getByText(/320/)).toBeInTheDocument();
    });
  });

  describe('Renders plugin list', () => {
    it('renders all plugins in the list', () => {
      renderPanel();
      expect(screen.getByText('AI Safety Researcher')).toBeInTheDocument();
      expect(screen.getByText('Vision Service')).toBeInTheDocument();
      expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
      expect(screen.getByText('Edge Computing Specialist')).toBeInTheDocument();
    });

    it('displays plugin descriptions', () => {
      renderPanel();
      expect(screen.getByText(/Image analysis, OCR/)).toBeInTheDocument();
      expect(screen.getByText(/Usage tracking/)).toBeInTheDocument();
    });

    it('displays plugin versions', () => {
      renderPanel();
      expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
      expect(screen.getByText(/v2\.1\.0/)).toBeInTheDocument();
    });

    it('displays plugin authors', () => {
      renderPanel();
      const authorElements = screen.getAllByText('Zavorth');
      expect(authorElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Filters by category', () => {
    it('renders category filter tabs', () => {
      renderPanel();
      CATEGORIES.forEach(cat => {
        expect(screen.getByText(cat)).toBeInTheDocument();
      });
    });

    it('filters plugins when a category is selected', async () => {
      const user = userEvent.setup();
      renderPanel();

      const categoryTab = screen.getByText('multimodal');
      await user.click(categoryTab);

      expect(screen.getByText('Vision Service')).toBeInTheDocument();
      expect(screen.queryByText('Usage Analytics')).not.toBeInTheDocument();
      expect(screen.queryByText('Edge Computing Specialist')).not.toBeInTheDocument();
    });

    it('shows all plugins when "All" category is selected', async () => {
      const user = userEvent.setup();
      renderPanel();

      const multimodalTab = screen.getByText('multimodal');
      await user.click(multimodalTab);

      expect(screen.queryByText('Usage Analytics')).not.toBeInTheDocument();

      const allTab = screen.getByText('All');
      await user.click(allTab);

      expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
      expect(screen.getByText('Edge Computing Specialist')).toBeInTheDocument();
    });

    it('highlights the active category tab', async () => {
      const user = userEvent.setup();
      renderPanel();

      const categoryTab = screen.getByText('ai-safety');
      await user.click(categoryTab);

      expect(categoryTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Searches plugins', () => {
    it('renders a search input', () => {
      renderPanel();
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('filters plugins by name on search', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText(/search/i);

      await user.type(input, 'Vision');

      expect(screen.getByText('Vision Service')).toBeInTheDocument();
      expect(screen.queryByText('AI Safety Researcher')).not.toBeInTheDocument();
      expect(screen.queryByText('Usage Analytics')).not.toBeInTheDocument();
    });

    it('filters plugins by description keyword', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText(/search/i);

      await user.type(input, 'robotics');

      expect(screen.getByText('Edge Computing Specialist')).toBeInTheDocument();
      expect(screen.queryByText('Vision Service')).not.toBeInTheDocument();
    });

    it('searches case-insensitively', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText(/search/i);

      await user.type(input, 'VISION');

      expect(screen.getByText('Vision Service')).toBeInTheDocument();
    });

    it('clears search results when input is cleared', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText(/search/i);

      await user.type(input, 'Vision');
      expect(screen.queryByText('Usage Analytics')).not.toBeInTheDocument();

      await user.clear(input);
      expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
    });
  });

  describe('Shows plugin details', () => {
    it('shows details panel when a plugin is clicked', async () => {
      const user = userEvent.setup();
      renderPanel();

      const pluginRow = screen.getByText('AI Safety Researcher');
      await user.click(pluginRow);

      expect(screen.getByText(/AI safety, alignment testing/)).toBeInTheDocument();
      expect(screen.getByText(/Zavorth/)).toBeInTheDocument();
    });

    it('displays tags in the details view', async () => {
      const user = userEvent.setup();
      renderPanel();

      const pluginRow = screen.getByText('Vision Service');
      await user.click(pluginRow);

      expect(screen.getByText('vision')).toBeInTheDocument();
      expect(screen.getByText('ocr')).toBeInTheDocument();
    });

    it('closes details when clicking outside or pressing Escape', async () => {
      const user = userEvent.setup();
      renderPanel();

      const pluginRow = screen.getByText('AI Safety Researcher');
      await user.click(pluginRow);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByText(/AI safety, alignment testing/)).not.toBeInTheDocument();
    });
  });

  describe('Handles install/uninstall', () => {
    it('shows install button for uninstalled plugins', () => {
      renderPanel();
      const installButtons = screen.getAllByText(/install/i);
      expect(installButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onInstall when install button is clicked', async () => {
      const { onInstall } = renderPanel();
      const user = userEvent.setup();

      const installButton = screen.getAllByText(/install/i)[0];
      await user.click(installButton);

      expect(onInstall).toHaveBeenCalledTimes(1);
    });

    it('shows uninstall option for installed plugins', async () => {
      renderPanel();
      const user = userEvent.setup();

      const pluginRow = screen.getByText('AI Safety Researcher');
      await user.click(pluginRow);

      expect(screen.getByText(/uninstall/i)).toBeInTheDocument();
    });

    it('calls onUninstall when uninstall button is clicked', async () => {
      const { onUninstall } = renderPanel();
      const user = userEvent.setup();

      const pluginRow = screen.getByText('AI Safety Researcher');
      await user.click(pluginRow);

      const uninstallButton = screen.getByText(/uninstall/i);
      await user.click(uninstallButton);

      expect(onUninstall).toHaveBeenCalledWith('zavorth-ai-safety');
    });

    it('shows installed badge on installed plugins', () => {
      renderPanel();
      const installedBadges = screen.getAllByText(/installed/i);
      expect(installedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Shows ratings', () => {
    it('displays star ratings for each plugin', () => {
      renderPanel();
      expect(screen.getByText(/4\.5/)).toBeInTheDocument();
      expect(screen.getByText(/4\.8/)).toBeInTheDocument();
    });

    it('displays review counts', () => {
      renderPanel();
      expect(screen.getByText(/12 reviews/)).toBeInTheDocument();
      expect(screen.getByText(/25 reviews/)).toBeInTheDocument();
    });

    it('allows rating an installed plugin', async () => {
      const { onRate } = renderPanel();
      const user = userEvent.setup();

      const pluginRow = screen.getByText('AI Safety Researcher');
      await user.click(pluginRow);

      const rateButton = screen.getByText(/rate/i);
      await user.click(rateButton);

      expect(onRate).toHaveBeenCalled();
    });

    it('displays download counts for each plugin', () => {
      renderPanel();
      expect(screen.getByText(/150/)).toBeInTheDocument();
      expect(screen.getByText(/320/)).toBeInTheDocument();
    });
  });

  describe('Handles empty states', () => {
    it('shows empty state when no plugins match search', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText(/search/i);

      await user.type(input, 'zzzznonexistent');

      expect(screen.getByText(/no plugins/i)).toBeInTheDocument();
    });

    it('shows empty state when category has no plugins', async () => {
      const user = userEvent.setup();
      renderPanel({ categories: ['empty-category'] });

      const categoryTab = screen.getByText('empty-category');
      await user.click(categoryTab);

      expect(screen.getByText(/no plugins/i)).toBeInTheDocument();
    });

    it('shows empty state when plugins array is empty', () => {
      renderPanel({ plugins: [], featuredPlugins: [] });
      expect(screen.getByText(/no plugins/i)).toBeInTheDocument();
    });
  });

  describe('Tab switching', () => {
    it('renders tab navigation', () => {
      renderPanel();
      expect(screen.getByText('Featured')).toBeInTheDocument();
      expect(screen.getByText('All Plugins')).toBeInTheDocument();
    });

    it('shows featured plugins by default', () => {
      renderPanel();
      expect(screen.getByText('AI Safety Researcher')).toBeInTheDocument();
      expect(screen.getByText('Vision Service')).toBeInTheDocument();
    });

    it('switches to All Plugins tab', async () => {
      const user = userEvent.setup();
      renderPanel();

      const allTab = screen.getByText('All Plugins');
      await user.click(allTab);

      expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
      expect(screen.getByText('Edge Computing Specialist')).toBeInTheDocument();
    });

    it('switches back to Featured tab', async () => {
      const user = userEvent.setup();
      renderPanel();

      const allTab = screen.getByText('All Plugins');
      await user.click(allTab);

      const featuredTab = screen.getByText('Featured');
      await user.click(featuredTab);

      expect(screen.getByText('AI Safety Researcher')).toBeInTheDocument();
    });

    it('highlights the active tab', async () => {
      const user = userEvent.setup();
      renderPanel();

      const allTab = screen.getByText('All Plugins');
      await user.click(allTab);

      expect(allTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
