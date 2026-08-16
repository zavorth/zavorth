/**
 * Zavorth Interactive Session Picker Modal.
 * Renders a session selector matching the OpenCode / Zavorth TUI layout.
 */

import { TerminalTheme } from './TerminalTheme.js';
import {
  SessionPersistenceService,
  type SessionRecord,
} from '../../storage/SessionPersistenceService.js';
import { DynamicCostEstimator } from '../../services/pricing/DynamicCostEstimator.js';

export interface SessionPickerModalState {
  searchQuery: string;
  selectedIndex: number;
  currentSessionId?: string;
  sessions: SessionRecord[];
}

export class SessionPickerModal {
  /**
   * Filters session items based on search query.
   */
  static filterSessions(sessions: SessionRecord[], query: string): SessionRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q) ||
        s.directory.toLowerCase().includes(q)
    );
  }

  /**
   * Formats relative time (e.g. "2m ago", "1h ago", "yesterday").
   */
  static formatRelativeTime(dateStr: string): string {
    const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Renders the interactive ASCII session picker modal view.
   */
  static renderModal(state: SessionPickerModalState): string {
    const lines: string[] = [];
    const width = 58;

    // Header
    const title = 'Select session';
    const esc = TerminalTheme.colors.dim('esc');
    const headerPad = ' '.repeat(Math.max(0, width - title.length - 3));
    lines.push(`${TerminalTheme.colors.bold(title)}${headerPad}${esc}`);
    lines.push('');

    // Search bar
    const searchLabel = TerminalTheme.colors.warning('S') + 'earch';
    const queryDisplay = state.searchQuery ? ` ${state.searchQuery}` : '';
    lines.push(`${searchLabel}${queryDisplay}`);
    lines.push('');

    const filtered = this.filterSessions(state.sessions, state.searchQuery);

    if (filtered.length === 0) {
      lines.push(TerminalTheme.colors.dim('  No sessions found.'));
    } else {
      filtered.slice(0, 12).forEach((session, index) => {
        const isSelected = index === state.selectedIndex;
        const isCurrent = state.currentSessionId === session.id;
        const marker = isCurrent ? '• ' : '  ';

        const costDisplay = DynamicCostEstimator.formatUsd(session.cost);
        const timeDisplay = this.formatRelativeTime(session.timeUpdated);
        const tag = `${costDisplay} · ${timeDisplay}`;

        const leftText = `${marker}${session.title}`;
        const padding = ' '.repeat(Math.max(1, width - leftText.length - tag.length - 2));

        if (isSelected) {
          const row = ` ${leftText}${padding}${tag} `;
          lines.push(TerminalTheme.colors.highlight(row));
        } else if (isCurrent) {
          lines.push(` ${TerminalTheme.colors.warning(leftText)}${padding}${TerminalTheme.colors.dim(tag)}`);
        } else {
          lines.push(` ${leftText}${padding}${TerminalTheme.colors.dim(tag)}`);
        }
      });
    }

    lines.push('');
    // Footer shortcuts
    const res = `${TerminalTheme.colors.dim('Resume')} ${TerminalTheme.colors.dim('enter')}`;
    const fork = `${TerminalTheme.colors.dim('Fork')} ${TerminalTheme.colors.dim('ctrl+f')}`;
    const del = `${TerminalTheme.colors.dim('Delete')} ${TerminalTheme.colors.dim('ctrl+d')}`;
    lines.push(`${res}  ${fork}  ${del}`);

    return lines.join('\n');
  }

  /**
   * Renders a clean non-interactive summary table for CLI output.
   */
  static renderSessionTable(currentSessionId?: string): string {
    const sessions = SessionPersistenceService.listSessions();
    const lines: string[] = [];
    lines.push(TerminalTheme.colors.primary('=== Zavorth Persistent Sessions ==='));
    lines.push('');

    if (sessions.length === 0) {
      lines.push(TerminalTheme.colors.dim('  No saved sessions found.'));
      return lines.join('\n');
    }

    for (const session of sessions) {
      const isCurrent = session.id === currentSessionId;
      const marker = isCurrent ? TerminalTheme.colors.warning('• ') : '  ';
      const cost = DynamicCostEstimator.formatUsd(session.cost);
      const time = this.formatRelativeTime(session.timeUpdated);
      const forkBadge = session.parentId ? TerminalTheme.colors.dim(' [fork]') : '';

      lines.push(
        `${marker}${TerminalTheme.colors.bold(session.title)}${forkBadge} ${TerminalTheme.colors.dim(`(${session.id})`)}`
      );
      lines.push(
        `    ${TerminalTheme.colors.dim(`Model: ${session.model} · ${cost} spent · Updated: ${time}`)}`
      );
    }

    lines.push('');
    lines.push(TerminalTheme.colors.dim('Use /resume <id> to switch or /fork to branch.'));
    return lines.join('\n');
  }
}
