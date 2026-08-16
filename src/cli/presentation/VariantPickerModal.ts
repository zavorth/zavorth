/**
 * Zavorth Model Variant / Reasoning Effort Picker Modal.
 * Renders an interactive variant selector matching the OpenCode / Zavorth TUI layout.
 */

import { TerminalTheme } from './TerminalTheme.js';
import type { OpenAiStyleReasoningEffort } from '../../providers/reasoningEffortPayload.js';

export interface VariantOption {
  id: OpenAiStyleReasoningEffort | 'default';
  label: string;
  description: string;
  isDefault?: boolean;
}

export interface VariantPickerModalState {
  searchQuery: string;
  selectedIndex: number;
  currentVariant: string;
  options: VariantOption[];
}

export class VariantPickerModal {
  static getAvailableVariants(): VariantOption[] {
    return [
      { id: 'default', label: 'Default', description: 'Standard model reasoning configuration' },
      { id: 'none', label: 'none', description: 'Thinking disabled for instant responses' },
      { id: 'low', label: 'low', description: 'Fast, lightweight reasoning' },
      { id: 'medium', label: 'medium', description: 'Standard balanced thinking budget (4k tokens)' },
      { id: 'high', label: 'high', description: 'Deep reasoning budget for complex architectures (10k tokens)' },
      { id: 'xhigh', label: 'xhigh', description: 'Maximum reasoning budget (16k tokens)' },
    ];
  }

  static filterOptions(options: VariantOption[], query: string): VariantOption[] {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q)
    );
  }

  /**
   * Renders the interactive ASCII variant picker modal view matching screenshot 2.
   */
  static renderModal(state: VariantPickerModalState): string {
    const lines: string[] = [];
    const width = 46;

    // Header
    const title = 'Select variant';
    const esc = TerminalTheme.colors.dim('esc');
    const headerPad = ' '.repeat(Math.max(0, width - title.length - 3));
    lines.push(`${TerminalTheme.colors.bold(title)}${headerPad}${esc}`);
    lines.push('');

    // Search bar
    const searchLabel = TerminalTheme.colors.warning('S') + 'earch';
    const queryDisplay = state.searchQuery ? ` ${state.searchQuery}` : '';
    lines.push(`${searchLabel}${queryDisplay}`);
    lines.push('');

    const filtered = this.filterOptions(state.options, state.searchQuery);

    if (filtered.length === 0) {
      lines.push(TerminalTheme.colors.dim('  No variants found.'));
    } else {
      filtered.forEach((option, index) => {
        const isSelected = index === state.selectedIndex;
        const isCurrent = (state.currentVariant || 'medium').toLowerCase() === option.id.toLowerCase();
        const marker = isCurrent ? '• ' : '  ';
        const labelText = `${marker}${option.label}`;

        if (isSelected) {
          const padded = ` ${labelText}${' '.repeat(Math.max(1, width - labelText.length - 2))} `;
          lines.push(TerminalTheme.colors.highlight(padded));
        } else if (isCurrent) {
          lines.push(` ${TerminalTheme.colors.warning(labelText)}`);
        } else {
          lines.push(` ${labelText}`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Renders static variant list for CLI output.
   */
  static renderVariantTable(currentVariant: string = 'medium'): string {
    const lines: string[] = [];
    lines.push(TerminalTheme.colors.primary('=== Model Reasoning Variants ==='));
    lines.push('');

    const options = this.getAvailableVariants();
    for (const opt of options) {
      const isCurrent = opt.id.toLowerCase() === currentVariant.toLowerCase();
      const marker = isCurrent ? TerminalTheme.colors.warning('• ') : '  ';
      const label = isCurrent ? TerminalTheme.colors.warning(opt.label) : opt.label;
      lines.push(`${marker}${label} - ${TerminalTheme.colors.dim(opt.description)}`);
    }

    lines.push('');
    lines.push(TerminalTheme.colors.dim('Use /variants <level> to switch (e.g. /variants high)'));

    return lines.join('\n');
  }
}
