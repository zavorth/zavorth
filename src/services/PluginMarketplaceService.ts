import { asErrorLike } from '../utils/errorLike';
﻿import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';

export type PluginCategory =
  | 'development'
  | 'productivity'
  | 'security'
  | 'media'
  | 'data'
  | 'automation'
  | 'integration'
  | 'communication'
  | 'analytics'
  | 'utility';

export type Plugin = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: PluginCategory;
  tags: string[];
  rating: number;
  downloads: number;
  screenshots: string[];
  installed: boolean;
  featured: boolean;
  updatedAt: string;
};

export type PluginCategoryInfo = {
  id: PluginCategory;
  name: string;
  description: string;
  icon: string;
  count: number;
};

export type PluginReview = {
  id: string;
  pluginId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type InstallResult = {
  success: boolean;
  pluginId: string;
  message: string;
  path: string;
};

export type MarketplaceStats = {
  totalPlugins: number;
  totalInstalls: number;
  topCategories: Array<{ category: PluginCategory; count: number }>;
};

export type PluginUpdateInfo = {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
};

export type PluginFilter = {
  category?: PluginCategory;
  tags?: string[];
  minRating?: number;
  featured?: boolean;
  installed?: boolean;
  sortBy?: 'name' | 'rating' | 'downloads' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type PluginMarketplaceOptions = {
  registryUrl?: string;
  pluginsDir?: string;
  dataDir?: string;
  now?: () => Date;
};

const CATEGORY_DEFINITIONS: Array<{
  id: PluginCategory;
  name: string;
  description: string;
  icon: string;
}> = [
  { id: 'development', name: 'Development', description: 'Code editing, debugging, and dev tools', icon: '{}' },
  { id: 'productivity', name: 'Productivity', description: 'Task management, scheduling, and efficiency', icon: '[]' },
  { id: 'security', name: 'Security', description: 'Auditing, scanning, and protection tools', icon: '{}' },
  { id: 'media', name: 'Media', description: 'Image, video, and audio processing', icon: '<>' },
  { id: 'data', name: 'Data', description: 'Database, analytics, and data processing', icon: '##' },
  { id: 'automation', name: 'Automation', description: 'Workflow automation and scripting', icon: '>>' },
  { id: 'integration', name: 'Integration', description: 'Third-party service connectors', icon: '<>' },
  { id: 'communication', name: 'Communication', description: 'Messaging, notifications, and chat', icon: '@' },
  { id: 'analytics', name: 'Analytics', description: 'Monitoring, metrics, and reporting', icon: '{}' },
  { id: 'utility', name: 'Utility', description: 'General-purpose helpers and tools', icon: '*' },
];

export class PluginMarketplaceService {
  private readonly registryUrl: string;
  private readonly pluginsDir: string;
  private readonly dataDir: string;
  private readonly now: () => Date;
  private plugins: Map<string, Plugin> = new Map();
  private reviews: Map<string, PluginReview[]> = new Map();
  private initialized = false;

  constructor(options: PluginMarketplaceOptions = {}) {
    this.registryUrl = options.registryUrl || 'https://registry.zavorth.dev/plugins';
    this.pluginsDir = options.pluginsDir || path.join(process.cwd(), 'plugins');
    this.dataDir = options.dataDir || path.join(process.cwd(), '.zavorth', 'marketplace');
    this.now = options.now || (() => new Date());
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.loadLocalData();
    this.initialized = true;
  }

  private async loadLocalData(): Promise<void> {
    try {
      const pluginsFile = path.join(this.dataDir, 'plugins.json');
      if (fs.existsSync(pluginsFile)) {
        const data: Plugin[] = JSON.parse(fs.readFileSync(pluginsFile, 'utf-8'));
        for (const plugin of data) {
          this.plugins.set(plugin.id, plugin);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[PluginMarketplace] Failed to load plugins catalog: ${message}`);
    }

    try {
      const reviewsFile = path.join(this.dataDir, 'reviews.json');
      if (fs.existsSync(reviewsFile)) {
        const data: PluginReview[] = JSON.parse(fs.readFileSync(reviewsFile, 'utf-8'));
        for (const review of data) {
          const list = this.reviews.get(review.pluginId) || [];
          list.push(review);
          this.reviews.set(review.pluginId, list);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[PluginMarketplace] Failed to load reviews: ${message}`);
    }
  }

  private async persistData(): Promise<void> {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      const pluginsFile = path.join(this.dataDir, 'plugins.json');
      fs.writeFileSync(pluginsFile, JSON.stringify(Array.from(this.plugins.values()), null, 2), 'utf-8');
      const reviewsFile = path.join(this.dataDir, 'reviews.json');
      const allReviews: PluginReview[] = [];
      this.reviews.forEach((list) => {
        for (const r of list) allReviews.push(r);
      });
      fs.writeFileSync(reviewsFile, JSON.stringify(allReviews, null, 2), 'utf-8');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[PluginMarketplace] Failed to persist marketplace data: ${message}`);
    }
  }

  private matchesFilter(plugin: Plugin, filter: PluginFilter): boolean {
    if (filter.category && plugin.category !== filter.category) return false;
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some((t) => plugin.tags.includes(t));
      if (!hasTag) return false;
    }
    if (filter.minRating !== undefined && plugin.rating < filter.minRating) return false;
    if (filter.featured !== undefined && plugin.featured !== filter.featured) return false;
    if (filter.installed !== undefined && plugin.installed !== filter.installed) return false;
    return true;
  }

  private sortPlugins(plugins: Plugin[], sortBy: string, sortOrder: string): Plugin[] {
    const sorted = [...plugins];
    const dir = sortOrder === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'rating':
          return (a.rating - b.rating) * dir;
        case 'downloads':
          return (a.downloads - b.downloads) * dir;
        case 'updatedAt':
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
        default:
          return 0;
      }
    });
    return sorted;
  }

  public async listPlugins(filter?: PluginFilter): Promise<Plugin[]> {
    await this.ensureInitialized();
    let results = Array.from(this.plugins.values());

    if (filter) {
      results = results.filter((p) => this.matchesFilter(p, filter));
      const sortBy = filter.sortBy || 'downloads';
      const sortOrder = filter.sortOrder || 'desc';
      results = this.sortPlugins(results, sortBy, sortOrder);

      if (filter.offset !== undefined) {
        results = results.slice(filter.offset);
      }
      if (filter.limit !== undefined) {
        results = results.slice(0, filter.limit);
      }
    }

    return results;
  }

  public async searchPlugins(query: string): Promise<Plugin[]> {
    await this.ensureInitialized();
    const lowerQuery = query.toLowerCase();
    return Array.from(this.plugins.values()).filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(lowerQuery);
      const descMatch = p.description.toLowerCase().includes(lowerQuery);
      const tagMatch = p.tags.some((t) => t.toLowerCase().includes(lowerQuery));
      const authorMatch = p.author.toLowerCase().includes(lowerQuery);
      return nameMatch || descMatch || tagMatch || authorMatch;
    });
  }

  public async getPlugin(id: string): Promise<Plugin | null> {
    await this.ensureInitialized();
    return this.plugins.get(id) || null;
  }

  public async installPlugin(id: string): Promise<InstallResult> {
    await this.ensureInitialized();
    const plugin = this.plugins.get(id);

    if (!plugin) {
      return { success: false, pluginId: id, message: 'Plugin not found', path: '' };
    }

    if (plugin.installed) {
      return { success: false, pluginId: id, message: 'Plugin already installed', path: '' };
    }

    const installPath = path.join(this.pluginsDir, plugin.id);
    try {
      fs.mkdirSync(installPath, { recursive: true });
      const manifestPath = path.join(installPath, 'plugin.json');
      fs.writeFileSync(manifestPath, JSON.stringify({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        author: plugin.author,
        description: plugin.description,
        category: plugin.category,
        tags: plugin.tags,
        installedAt: this.now().toISOString(),
      }, null, 2), 'utf-8');

      plugin.installed = true;
      plugin.downloads += 1;
      this.plugins.set(id, plugin);
      await this.persistData();

      return { success: true, pluginId: id, message: 'Plugin installed successfully', path: installPath };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Plugin Marketplace] load operation failed', error);
    const message = err instanceof Error ? err.message : 'Unknown installation error';
      return { success: false, pluginId: id, message, path: installPath };
  }
  }

  public async uninstallPlugin(id: string): Promise<InstallResult> {
    await this.ensureInitialized();
    const plugin = this.plugins.get(id);

    if (!plugin) {
      return { success: false, pluginId: id, message: 'Plugin not found', path: '' };
    }

    if (!plugin.installed) {
      return { success: false, pluginId: id, message: 'Plugin is not installed', path: '' };
    }

    const installPath = path.join(this.pluginsDir, plugin.id);
    try {
      if (fs.existsSync(installPath)) {
        fs.rmSync(installPath, { recursive: true, force: true });
      }

      plugin.installed = false;
      this.plugins.set(id, plugin);
      await this.persistData();

      return { success: true, pluginId: id, message: 'Plugin uninstalled successfully', path: installPath };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Plugin Marketplace] filesystem operation failed', error);
    const message = err instanceof Error ? err.message : 'Unknown uninstallation error';
      return { success: false, pluginId: id, message, path: installPath };
  }
  }

  public async ratePlugin(id: string, rating: number, comment?: string): Promise<PluginReview | null> {
    await this.ensureInitialized();
    const plugin = this.plugins.get(id);

    if (!plugin) return null;
    if (rating < 1 || rating > 5) return null;

    const clampedRating = Math.round(rating);
    const review: PluginReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      pluginId: id,
      userId: 'local',
      rating: clampedRating,
      comment: comment || '',
      createdAt: this.now().toISOString(),
    };

    const list = this.reviews.get(id) || [];
    list.push(review);
    this.reviews.set(id, list);

    // Recalculate average rating
    const totalRating = list.reduce((sum, r) => sum + r.rating, 0);
    plugin.rating = Math.round((totalRating / list.length) * 10) / 10;
    this.plugins.set(id, plugin);

    await this.persistData();
    return review;
  }

  public async getReviews(pluginId: string): Promise<PluginReview[]> {
    await this.ensureInitialized();
    return this.reviews.get(pluginId) || [];
  }

  public async getCategories(): Promise<PluginCategoryInfo[]> {
    await this.ensureInitialized();
    const counts = new Map<PluginCategory, number>();
    this.plugins.forEach((plugin) => {
      counts.set(plugin.category, (counts.get(plugin.category) || 0) + 1);
    });

    return CATEGORY_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      count: counts.get(def.id) || 0,
    }));
  }

  public async getFeatured(): Promise<Plugin[]> {
    await this.ensureInitialized();
    return Array.from(this.plugins.values()).filter((p) => p.featured);
  }

  public async checkUpdates(): Promise<PluginUpdateInfo[]> {
    await this.ensureInitialized();
    const installed = Array.from(this.plugins.values()).filter((p) => p.installed);
    return installed.map((p) => ({
      pluginId: p.id,
      currentVersion: p.version,
      latestVersion: p.version,
      updateAvailable: false,
    }));
  }

  public async getStats(): Promise<MarketplaceStats> {
    await this.ensureInitialized();
    const allPlugins = Array.from(this.plugins.values());
    const totalInstalls = allPlugins.reduce((sum, p) => sum + p.downloads, 0);

    const categoryCounts = new Map<PluginCategory, number>();
    for (const plugin of allPlugins) {
      categoryCounts.set(plugin.category, (categoryCounts.get(plugin.category) || 0) + 1);
    }

    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalPlugins: allPlugins.length,
      totalInstalls,
      topCategories,
    };
  }

  public async registerPlugin(plugin: Omit<Plugin, 'installed' | 'downloads' | 'rating'>): Promise<Plugin> {
    await this.ensureInitialized();
    const fullPlugin: Plugin = {
      ...plugin,
      installed: false,
      downloads: 0,
      rating: 0,
    };
    this.plugins.set(plugin.id, fullPlugin);
    await this.persistData();
    return fullPlugin;
  }

  public async fetchRemotePlugins(): Promise<Plugin[]> {
    await this.ensureInitialized();
    // Placeholder for remote registry fetch
    // In production this would HTTP GET from this.registryUrl
    return Array.from(this.plugins.values()).filter((p) => !p.installed);
  }
}
