/**
 * Zavorth Interactive Model Picker Modal.
 * Renders a categorized model selector matching the OpenCode / Zavorth TUI layout.
 */

import { TerminalTheme } from './TerminalTheme.js';
import {
  buildCliModelPicker,
  type CliModelPickerInput,
} from '../ZavorthCliModelPickerHelpers.js';
import { DynamicModelCatalogService } from '../../services/providers/catalog/DynamicModelCatalogService.js';

export interface ModelPickerItem {
  id: string;
  name: string;
  provider: string;
  tag: string;
  category: string;
  selected?: boolean;
}

export interface ModelPickerModalState {
  searchQuery: string;
  selectedIndex: number;
  items: ModelPickerItem[];
}

export class ModelPickerModal {
  /**
   * Builds the list of model items grouped by provider from DynamicModelCatalogService.
   */
  static loadAvailableModels(input: CliModelPickerInput = {}): ModelPickerItem[] {
    const items: ModelPickerItem[] = [];
    const seenIds = new Set<string>();

    // 1. Add Recent items if available from current session
    const picker = buildCliModelPicker(input);
    if (picker.selected?.modelId) {
      items.push({
        id: picker.selected.modelId,
        name: picker.selected.modelId,
        provider: picker.selected.providerId || 'Zavorth',
        tag: 'Active',
        category: 'Recent',
      });
      seenIds.add(picker.selected.modelId.toLowerCase());
    }

    // 2. Load all providers and models from DynamicModelCatalogService
    const providers = DynamicModelCatalogService.getAllProviders();
    for (const provider of providers) {
      const category = provider.name || provider.id;
      if (provider.models) {
        for (const [modelId, model] of Object.entries(provider.models)) {
          const key = modelId.toLowerCase();
          if (seenIds.has(key)) continue;

          const isLocal = provider.id === 'ollama' || provider.id === 'lm-studio' || model.open_weights;
          const isFree = isLocal || (model.cost?.input === 0 && model.cost?.output === 0);
          const hasReasoning = model.reasoning || model.reasoning_options?.length;

          let tag = provider.name;
          if (isLocal) tag = 'Local';
          else if (isFree) tag = 'Free';
          else if (hasReasoning) tag = 'Reasoning';

          items.push({
            id: model.id || modelId,
            name: model.name || model.id || modelId,
            provider: provider.name,
            tag,
            category,
          });
          seenIds.add(key);
        }
      }
    }

    return items;
  }

  /**
   * Filters items based on search query.
   */
  static filterItems(items: ModelPickerItem[], query: string): ModelPickerItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
    );
  }

  /**
   * Renders the interactive ASCII modal view matching the screenshot.
   */
  static renderModal(state: ModelPickerModalState): string {
    const lines: string[] = [];
    const width = 58;

    // Header
    const title = 'Select model';
    const esc = TerminalTheme.colors.dim('esc');
    const headerPad = ' '.repeat(Math.max(0, width - title.length - 3));
    lines.push(`${TerminalTheme.colors.bold(title)}${headerPad}${esc}`);
    lines.push('');

    // Search bar
    const searchLabel = TerminalTheme.colors.warning('S') + 'earch';
    const queryDisplay = state.searchQuery ? ` ${state.searchQuery}` : '';
    lines.push(`${searchLabel}${queryDisplay}`);
    lines.push('');

    // Filter items
    const filtered = this.filterItems(state.items, state.searchQuery);

    if (filtered.length === 0) {
      lines.push(TerminalTheme.colors.dim('  No models found matching your search.'));
    } else {
      let currentCategory = '';
      let renderedIndex = 0;

      for (let i = 0; i < filtered.length && renderedIndex < 14; i++) {
        const item = filtered[i];

        // Category header
        if (item.category !== currentCategory) {
          currentCategory = item.category;
          lines.push(TerminalTheme.colors.info(currentCategory));
        }

        const isSelected = i === state.selectedIndex;
        const nameText = isSelected
          ? TerminalTheme.colors.highlight(` ${item.name} `)
          : ` ${item.name}`;
        const tagText = item.tag ? TerminalTheme.colors.dim(item.tag) : '';
        const padding = ' '.repeat(Math.max(1, width - item.name.length - (item.tag?.length || 0) - 4));

        lines.push(`${nameText}${padding}${tagText}`);
        renderedIndex++;
      }
    }

    lines.push('');
    // Footer shortcuts
    const conn = `${TerminalTheme.colors.dim('Connect provider')} ${TerminalTheme.colors.dim('ctrl+a')}`;
    const fav = `${TerminalTheme.colors.dim('Favorite')} ${TerminalTheme.colors.dim('ctrl+f')}`;
    lines.push(`${conn}  ${fav}`);

    return lines.join('\n');
  }

  /**
   * Renders a clean non-interactive summary table for CLI output.
   */
  static renderCatalogTable(filterProvider?: string): string {
    const items = this.loadAvailableModels();
    const filtered = filterProvider
      ? items.filter((it) => it.provider.toLowerCase().includes(filterProvider.toLowerCase()) || it.category.toLowerCase().includes(filterProvider.toLowerCase()))
      : items;

    const lines: string[] = [];
    lines.push(TerminalTheme.colors.primary('=== Zavorth Connected Providers & Models ==='));
    lines.push('');

    const byCategory = new Map<string, ModelPickerItem[]>();
    for (const item of filtered) {
      const list = byCategory.get(item.category) || [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    for (const [category, group] of byCategory.entries()) {
      lines.push(TerminalTheme.colors.info(`[ ${category} ]`));
      for (const item of group) {
        const tag = item.tag ? ` (${item.tag})` : '';
        lines.push(`  • ${item.name}${TerminalTheme.colors.dim(tag)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
