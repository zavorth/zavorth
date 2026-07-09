import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  reviews: number;
  created_at: string;
  updated_at: string;
  installed: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PluginReview {
  id: string;
  plugin_id: string;
  user: string;
  rating: number;
  comment: string;
  created_at: string;
}

export class ZavorthPluginMarketplaceService {
  private readonly storageDir: string;
  private plugins: Map<string, MarketplacePlugin> = new Map();
  private reviews: PluginReview[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'plugin-marketplace');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadData();
    this.initBuiltinPlugins();
  }

  private loadData(): void {
    try {
      const p = path.join(this.storageDir, 'plugins.json');
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (Array.isArray(data)) for (const plugin of data) this.plugins.set(plugin.id, plugin);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Plugin Marketplace] JSON parse failed', error); }
    try {
      const r = path.join(this.storageDir, 'reviews.json');
      if (fs.existsSync(r)) this.reviews = JSON.parse(fs.readFileSync(r, 'utf-8'));
    } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Plugin Marketplace] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }
        fs.writeFileSync(path.join(this.storageDir, 'plugins.json'), JSON.stringify(Array.from(this.plugins.values()), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'reviews.json'), JSON.stringify(this.reviews, null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[Zavorth Plugin Marketplace] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  private initBuiltinPlugins(): void {
    if (this.plugins.size > 0) return;
    const builtins: Array<Omit<MarketplacePlugin, 'created_at' | 'updated_at'>> = [
      { id: 'zavorth-ai-safety', name: 'AI Safety Researcher', description: 'AI safety, alignment testing, red teaming', version: '1.0.0', author: 'Zavorth', category: 'ai-safety', tags: ['safety', 'alignment', 'red-team'], downloads: 0, rating: 0, reviews: 0, installed: true, enabled: true, config: {} },
      { id: 'zavorth-physical-ai', name: 'Physical AI Engineer', description: 'Physical AI, robotics, sensor fusion, digital twins', version: '1.0.0', author: 'Zavorth', category: 'physical-ai', tags: ['robotics', 'sensor-fusion', 'digital-twin'], downloads: 0, rating: 0, reviews: 0, installed: true, enabled: true, config: {} },
      { id: 'zavorth-edge-computing', name: 'Edge Computing Specialist', description: 'Edge deployment, IoT, embedded systems, WASM', version: '1.0.0', author: 'Zavorth', category: 'edge-computing', tags: ['edge', 'iot', 'embedded', 'wasm'], downloads: 0, rating: 0, reviews: 0, installed: true, enabled: true, config: {} },
      { id: 'zavorth-llm-router', name: 'LLM Router', description: 'Per-task model routing, fallback chains, cost budget', version: '1.0.0', author: 'Zavorth', category: 'llm-services', tags: ['llm', 'routing', 'cost-optimization'], downloads: 0, rating: 0, reviews: 0, installed: true, enabled: true, config: {} },
      { id: 'zavorth-vision', name: 'Vision Service', description: 'Image analysis, OCR, object identification via multi-provider', version: '1.0.0', author: 'Zavorth', category: 'multimodal', tags: ['vision', 'ocr', 'image-analysis'], downloads: 0, rating: 0, reviews: 0, installed: true, enabled: true, config: {} },
      { id: 'zavorth-analytics', name: 'Usage Analytics', description: 'Usage tracking, cost analysis, quality metrics', version: '1.0.0', author: 'Zavorth', category: 'analytics', tags: ['analytics', 'cost', 'quality'], downloads: 0, rating: 0, reviews: 0, installed: true, enabled: true, config: {} },
    ];
    for (const p of builtins) {
      this.plugins.set(p.id, { ...p, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    this.scheduleFlush();
  }

  public search(query: string, category?: string): string {
    let results = Array.from(this.plugins.values());
    if (category) results = results.filter((p) => p.category === category);
    if (query) {
      const q = query.toLowerCase();
      results = results.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
      );
    }
    if (results.length === 0) return 'No plugins found.';
    return ['Search Results:', ...results.map((p) => `  ${p.id}: ${p.name} [${p.category}] v${p.version} (${p.rating}★)`)].join('\n');
  }

  public getPlugin(pluginId: string): string {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return `Error: plugin "${pluginId}" not found.`;
    return [
      `Plugin: ${plugin.name}`,
      `  ID: ${plugin.id}`,
      `  Description: ${plugin.description}`,
      `  Version: ${plugin.version}`,
      `  Author: ${plugin.author}`,
      `  Category: ${plugin.category}`,
      `  Tags: ${plugin.tags.join(', ')}`,
      `  Downloads: ${plugin.downloads}`,
      `  Rating: ${plugin.rating}★ (${plugin.reviews} reviews)`,
      `  Installed: ${plugin.installed ? 'Yes' : 'No'}`,
      `  Enabled: ${plugin.enabled ? 'Yes' : 'No'}`,
    ].join('\n');
  }

  public installPlugin(pluginId: string): string {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return `Error: plugin "${pluginId}" not found.`;
    if (plugin.installed) return `Plugin "${plugin.name}" is already installed.`;
    plugin.installed = true;
    plugin.enabled = true;
    plugin.downloads++;
    plugin.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `Plugin "${plugin.name}" installed successfully.`;
  }

  public uninstallPlugin(pluginId: string): string {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return `Error: plugin "${pluginId}" not found.`;
    if (!plugin.installed) return `Plugin "${plugin.name}" is not installed.`;
    plugin.installed = false;
    plugin.enabled = false;
    plugin.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `Plugin "${plugin.name}" uninstalled.`;
  }

  public enablePlugin(pluginId: string): string {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return `Error: plugin "${pluginId}" not found.`;
    if (!plugin.installed) return `Error: plugin "${plugin.name}" is not installed.`;
    plugin.enabled = true;
    plugin.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `Plugin "${plugin.name}" enabled.`;
  }

  public disablePlugin(pluginId: string): string {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return `Error: plugin "${pluginId}" not found.`;
    plugin.enabled = false;
    plugin.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `Plugin "${plugin.name}" disabled.`;
  }

  public ratePlugin(pluginId: string, user: string, rating: number, comment: string): string {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return `Error: plugin "${pluginId}" not found.`;
    if (rating < 1 || rating > 5) return 'Error: rating must be between 1 and 5.';

    const review: PluginReview = {
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      plugin_id: pluginId, user, rating, comment,
      created_at: new Date().toISOString(),
    };
    this.reviews.push(review);

    const pluginReviews = this.reviews.filter((r) => r.plugin_id === pluginId);
    plugin.rating = pluginReviews.reduce((s, r) => s + r.rating, 0) / pluginReviews.length;
    plugin.reviews = pluginReviews.length;
    plugin.updated_at = new Date().toISOString();
    this.scheduleFlush();

    return `Review submitted for "${plugin.name}": ${rating}★`;
  }

  public getReviews(pluginId: string): string {
    const pluginReviews = this.reviews.filter((r) => r.plugin_id === pluginId);
    if (pluginReviews.length === 0) return 'No reviews yet.';
    return ['Reviews:', ...pluginReviews.map((r) => `  ${r.user}: ${r.rating}★ - ${r.comment}`)].join('\n');
  }

  public listCategories(): string {
    const categories = new Set(Array.from(this.plugins.values()).map((p) => p.category));
    return ['Categories:', ...Array.from(categories).sort().map((c) => `  ${c}`)].join('\n');
  }

  public getFeatured(): string {
    const featured = Array.from(this.plugins.values())
      .sort((a, b) => b.rating - a.rating || b.downloads - a.downloads)
      .slice(0, 5);
    return ['Featured Plugins:', ...featured.map((p) => `  ${p.id}: ${p.name} (${p.rating}★, ${p.downloads} downloads)`)].join('\n');
  }

  public getTrending(): string {
    const trending = Array.from(this.plugins.values())
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5);
    return ['Trending Plugins:', ...trending.map((p) => `  ${p.id}: ${p.name} (${p.downloads} downloads)`)].join('\n');
  }

  public getStats(): string {
    const plugins = Array.from(this.plugins.values());
    const installed = plugins.filter((p) => p.installed).length;
    const avgRating = plugins.length > 0 ? plugins.reduce((s, p) => s + p.rating, 0) / plugins.length : 0;
    return [
      'Marketplace Stats:',
      `  Total plugins: ${plugins.length}`,
      `  Installed: ${installed}`,
      `  Avg rating: ${avgRating.toFixed(1)}★`,
      `  Total reviews: ${this.reviews.length}`,
    ].join('\n');
  }
}
