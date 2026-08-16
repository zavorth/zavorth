/**
 * Zavorth Interactive Model Picker Modal.
 * Renders a categorized model selector matching the OpenCode / Zavorth TUI layout.
 */

import { TerminalTheme } from './TerminalTheme.js';
import {
  buildCliModelPicker,
  type CliModelPickerInput,
} from '../ZavorthCliModelPickerHelpers.js';
import type {
  ModelPickerFamilyOption,
  ModelPickerModelOption,
} from '../../services/providers/catalog/ModelPickerService.js';

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
   * Builds the list of model items grouped by provider from ModelPickerService.
   */
  static loadAvailableModels(input: CliModelPickerInput = {}): ModelPickerItem[] {
    const picker = buildCliModelPicker(input);
    const items: ModelPickerItem[] = [];

    // 1. Add Recent items if available
    if (picker.selected?.modelId) {
      items.push({
        id: picker.selected.modelId,
        name: picker.selected.modelId,
        provider: picker.selected.providerId || 'Zavorth',
        tag: 'Active',
        category: 'Recent',
      });
    }

    // 2. Group all models from families and routes
    for (const family of picker.families) {
      const category = family.label || family.vendorId || 'Other Providers';
      for (const route of family.routes) {
        for (const model of route.models) {
          const isFree = model.custom || model.source === 'local' || /free/i.test(model.label);
          const tag = isFree ? 'Free' : route.providerName || family.vendorId || '';
          items.push({
            id: model.modelId || model.id,
            name: model.label || model.modelId,
            provider: route.providerName || family.vendorId,
            tag,
            category,
          });
        }
      }
    }

    // 3. Fallback defaults if catalog is minimal
    if (items.length <= 1) {
      items.push(
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', tag: 'Hybrid Reasoning', category: 'Anthropic' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tag: 'Anthropic', category: 'Anthropic' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tag: 'OpenAI', category: 'OpenAI' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', tag: 'Google', category: 'Google' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tag: 'Free', category: 'Google' },
        { id: 'llama3.3:latest', name: 'Llama 3.3 70B', provider: 'Ollama', tag: 'Local', category: 'Ollama / Local' },
        { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder', provider: 'Ollama', tag: 'Local', category: 'Ollama / Local' },
        { id: 'deepseek-r1:latest', name: 'DeepSeek R1', provider: 'Ollama', tag: 'Local', category: 'Ollama / Local' },
        { id: 'grok-2-latest', name: 'Grok 2', provider: 'xAI', tag: 'xAI', category: 'xAI' }
      );
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

        if (isSelected) {
          lines.push(`${nameText}${padding}${tagText}`);
        } else {
          lines.push(`${nameText}${padding}${tagText}`);
        }
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
