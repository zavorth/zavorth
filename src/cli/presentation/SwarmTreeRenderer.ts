/**
 * Swarm Tree Renderer.
 * Renders interactive ASCII/Unicode live execution trees for multi-agent swarm topologies.
 */

import { TerminalTheme } from './TerminalTheme.js';

export interface SwarmTreeNode {
  id: string;
  scientist: string;
  role: string;
  status: 'completed' | 'running' | 'queued' | 'failed' | 'healing';
  currentAction: string;
  durationMs?: number;
  children?: SwarmTreeNode[];
}

export class SwarmTreeRenderer {
  /**
   * Formats and renders a visual dependency tree for the swarm.
   */
  static renderTree(rootNodes: SwarmTreeNode[]): string {
    const lines: string[] = [];
    lines.push(TerminalTheme.colors.primary('=== Zavorth Live Swarm Topology & Thought Tree ==='));
    lines.push('');

    rootNodes.forEach((node, index) => {
      const isLastRoot = index === rootNodes.length - 1;
      const rootPrefix = isLastRoot ? '└── ' : '┌── ';
      lines.push(`${rootPrefix}${this.formatNode(node)}`);

      if (node.children && node.children.length > 0) {
        const childIndent = isLastRoot ? '    ' : '│   ';
        node.children.forEach((child, childIndex) => {
          const isLastChild = childIndex === node.children!.length - 1;
          const childPrefix = isLastChild ? '└── ' : '├── ';
          lines.push(`${childIndent}${childPrefix}${this.formatNode(child)}`);
        });
      }
    });

    lines.push('');
    return lines.join('\n');
  }

  private static formatNode(node: SwarmTreeNode): string {
    let statusBadge = '';
    let roleText = `${node.scientist} · ${node.role}`;

    switch (node.status) {
      case 'completed':
        statusBadge = TerminalTheme.colors.success(`(✓ ${node.durationMs || 0}ms)`);
        break;
      case 'running':
        statusBadge = TerminalTheme.colors.warning(`(⠋ active: ${node.currentAction})`);
        break;
      case 'healing':
        statusBadge = TerminalTheme.colors.error(`(🔄 self-healing: ${node.currentAction})`);
        break;
      case 'queued':
        statusBadge = TerminalTheme.colors.dim(`(⏳ queued)`);
        break;
      case 'failed':
        statusBadge = TerminalTheme.colors.error(`(✗ failed)`);
        break;
    }

    const icon = this.getRoleIcon(node.role);
    return `${icon} [${TerminalTheme.colors.bold(roleText)}] ${statusBadge}`;
  }

  private static getRoleIcon(role: string): string {
    const r = role.toLowerCase();
    if (r.includes('architect') || r.includes('planner')) return '🧑‍✈️';
    if (r.includes('coder') || r.includes('implementation') || r.includes('engineer')) return '🔨';
    if (r.includes('quality') || r.includes('auditor') || r.includes('qa') || r.includes('test')) return '🧪';
    if (r.includes('security') || r.includes('guardian') || r.includes('guard')) return '🛡️';
    if (r.includes('doc') || r.includes('writer')) return '📄';
    return '🐝';
  }
}
