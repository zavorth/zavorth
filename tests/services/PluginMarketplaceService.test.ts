import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PluginMarketplaceService, type Plugin } from '../../src/services/PluginMarketplaceService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-svc-'));

describe('PluginMarketplaceService', () => {
  let svc: PluginMarketplaceService;
  let dir: string;

  const samplePlugin: Omit<Plugin, 'installed' | 'downloads' | 'rating'> = {
    id: 'test-1',
    name: 'Test Plugin',
    description: 'A test plugin for unit testing',
    author: 'Test Author',
    version: '1.0.0',
    category: 'utility',
    tags: ['test', 'example'],
    screenshots: [],
    featured: true,
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    dir = tmpDir();
    svc = new PluginMarketplaceService({ dataDir: dir, pluginsDir: path.join(dir, 'plugins') });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('Register plugin', () => {
    it('registers a new plugin', async () => {
      const plugin = await svc.registerPlugin(samplePlugin);
      expect(plugin.id).toBe('test-1');
      expect(plugin.name).toBe('Test Plugin');
      expect(plugin.installed).toBe(false);
      expect(plugin.downloads).toBe(0);
      expect(plugin.rating).toBe(0);
    });

    it('overwrites existing plugin with same id', async () => {
      await svc.registerPlugin(samplePlugin);
      const updated = await svc.registerPlugin({ ...samplePlugin, name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('List plugins', () => {
    it('lists all plugins', async () => {
      await svc.registerPlugin(samplePlugin);
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', name: 'Plugin 2' });
      const plugins = await svc.listPlugins();
      expect(plugins.length).toBe(2);
    });

    it('filters by category', async () => {
      await svc.registerPlugin({ ...samplePlugin, category: 'development' });
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', category: 'security' });
      const plugins = await svc.listPlugins({ category: 'development' });
      expect(plugins.length).toBe(1);
      expect(plugins[0].category).toBe('development');
    });

    it('filters by featured', async () => {
      await svc.registerPlugin({ ...samplePlugin, featured: true });
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', featured: false });
      const plugins = await svc.listPlugins({ featured: true });
      expect(plugins.length).toBe(1);
      expect(plugins[0].featured).toBe(true);
    });

    it('paginates results', async () => {
      for (let i = 0; i < 10; i++) {
        await svc.registerPlugin({ ...samplePlugin, id: `p${i}`, name: `Plugin ${i}` });
      }
      const page1 = await svc.listPlugins({ limit: 3, offset: 0 });
      const page2 = await svc.listPlugins({ limit: 3, offset: 3 });
      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('Search plugins', () => {
    it('searches by name', async () => {
      await svc.registerPlugin({ ...samplePlugin, name: 'Security Scanner' });
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', name: 'Code Editor' });
      const results = await svc.searchPlugins('security');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Security Scanner');
    });

    it('searches by description', async () => {
      await svc.registerPlugin({
        ...samplePlugin,
        description: 'A tool for analyzing code',
      });
      const results = await svc.searchPlugins('analyzing');
      expect(results.length).toBe(1);
    });

    it('searches by tags', async () => {
      await svc.registerPlugin({
        ...samplePlugin,
        tags: ['ai', 'machine-learning'],
      });
      const results = await svc.searchPlugins('machine');
      expect(results.length).toBe(1);
    });

    it('returns empty for no match', async () => {
      await svc.registerPlugin(samplePlugin);
      const results = await svc.searchPlugins('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('Get plugin details', () => {
    it('gets plugin by id', async () => {
      await svc.registerPlugin(samplePlugin);
      const plugin = await svc.getPlugin('test-1');
      expect(plugin).not.toBeNull();
      expect(plugin?.name).toBe('Test Plugin');
    });

    it('returns null for nonexistent plugin', async () => {
      const plugin = await svc.getPlugin('nonexistent');
      expect(plugin).toBeNull();
    });
  });

  describe('Install and uninstall', () => {
    it('installs a plugin', async () => {
      await svc.registerPlugin(samplePlugin);
      const result = await svc.installPlugin('test-1');
      expect(result.success).toBe(true);
      expect(result.pluginId).toBe('test-1');
    });

    it('returns error for nonexistent plugin install', async () => {
      const result = await svc.installPlugin('nonexistent');
      expect(result.success).toBe(false);
    });

    it('uninstalls a plugin', async () => {
      await svc.registerPlugin(samplePlugin);
      await svc.installPlugin('test-1');
      const result = await svc.uninstallPlugin('test-1');
      expect(result.success).toBe(true);
      const plugin = await svc.getPlugin('test-1');
      expect(plugin?.installed).toBe(false);
    });
  });

  describe('Rate plugins', () => {
    it('rates a plugin', async () => {
      await svc.registerPlugin(samplePlugin);
      const review = await svc.ratePlugin('test-1', 5, 'Great plugin');
      expect(review).not.toBeNull();
      expect(review?.rating).toBe(5);
      expect(review?.comment).toBe('Great plugin');
    });

    it('calculates average rating', async () => {
      await svc.registerPlugin(samplePlugin);
      await svc.ratePlugin('test-1', 5, 'Great');
      await svc.ratePlugin('test-1', 3, 'OK');
      const plugin = await svc.getPlugin('test-1');
      expect(plugin?.rating).toBe(4);
    });

    it('returns null for nonexistent plugin rating', async () => {
      const result = await svc.ratePlugin('nonexistent', 5);
      expect(result).toBeNull();
    });
  });

  describe('Get reviews', () => {
    it('gets reviews for plugin', async () => {
      await svc.registerPlugin(samplePlugin);
      await svc.ratePlugin('test-1', 5, 'Great');
      await svc.ratePlugin('test-1', 3, 'OK');
      const reviews = await svc.getReviews('test-1');
      expect(reviews.length).toBe(2);
    });
  });

  describe('Categories', () => {
    it('gets categories', async () => {
      await svc.registerPlugin({ ...samplePlugin, category: 'development' });
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', category: 'security' });
      const categories = await svc.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.find(c => c.id === 'development')?.count).toBe(1);
    });
  });

  describe('Featured plugins', () => {
    it('gets featured plugins', async () => {
      await svc.registerPlugin({ ...samplePlugin, featured: true });
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', featured: false });
      const featured = await svc.getFeatured();
      expect(featured.length).toBe(1);
      expect(featured[0].featured).toBe(true);
    });
  });

  describe('Stats', () => {
    it('gets marketplace stats', async () => {
      await svc.registerPlugin(samplePlugin);
      await svc.registerPlugin({ ...samplePlugin, id: 'p2', name: 'Plugin 2' });
      const stats = await svc.getStats();
      expect(stats.totalPlugins).toBe(2);
      expect(stats.topCategories).toBeDefined();
    });
  });

  describe('Persistence', () => {
    it('persists plugins to disk', async () => {
      await svc.registerPlugin(samplePlugin);
      const pluginsFile = path.join(dir, 'plugins.json');
      expect(fs.existsSync(pluginsFile)).toBe(true);
      const data = JSON.parse(fs.readFileSync(pluginsFile, 'utf-8'));
      expect(data.length).toBe(1);
      expect(data[0].id).toBe('test-1');
    });

    it('loads persisted plugins on init', async () => {
      await svc.registerPlugin(samplePlugin);
      const svc2 = new PluginMarketplaceService({ dataDir: dir, pluginsDir: path.join(dir, 'plugins') });
      const plugin = await svc2.getPlugin('test-1');
      expect(plugin).not.toBeNull();
    });
  });
});
