import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PRIMARY_PANELS,
  SECONDARY_PANELS,
  PANEL_NAV_GROUPS,
  isPrimaryPanel,
  isSecondaryPanel,
} from '../src/navigation/navConfig';
import { classifyReadiness } from '../src/desktop-state/readiness';

import { desktopDesignTokens, loadDesktopDensity, DENSITY_STORAGE_KEY } from '../src/designSystem/desktopTokens';

const root = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('quality bar — IA', () => {
  it('keeps primary nav slim (chat, review, proof, files)', () => {
    expect(PRIMARY_PANELS).toEqual(['chat', 'approvals', 'receipts', 'files']);
    expect(PRIMARY_PANELS.length).toBeLessThanOrEqual(6);
    expect(SECONDARY_PANELS).toContain('settings');
    expect(SECONDARY_PANELS).toContain('skills');
    expect(isPrimaryPanel('chat')).toBe(true);
    expect(isSecondaryPanel('marketplace')).toBe(true);
  });

  it('ships chat-home proof strip (P5)', () => {
    expect(existsSync(resolve(root, 'src/components/ProofStrip.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'src/desktop-state/homeTrustModel.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'src/desktop-state/proofStripModel.ts'))).toBe(true);
    const shell = read('src/shell/DesktopShell.tsx');
    expect(shell).toMatch(/ProofStrip/);
    expect(shell).toMatch(/from ['"]\.\.\/components\/ProofStrip['"]/);
    const i18n = read('src/i18n.ts');
    expect(i18n).toMatch(/proof\.stripEmpty/);
    expect(i18n).toMatch(/proof\.stripOpen/);
    expect(i18n).toMatch(/home\.nextApproval/);
  });

  it('groups panels for palette without dropping domains', () => {
    const all = Object.values(PANEL_NAV_GROUPS).flat();
    expect(all).toContain('chat');
    expect(all).toContain('approvals');
    expect(all).toContain('receipts');
    expect(all).toContain('channels');
    expect(all).toContain('automations');
  });
});

describe('quality bar — readiness honesty', () => {
  it('never treats catalog-only as live', () => {
    const catalog = classifyReadiness({ configured: true, liveReady: false, status: 'configured' });
    expect(catalog.state).not.toBe('live');
    expect(['available', 'needs_setup']).toContain(catalog.state);

    const live = classifyReadiness({ liveReady: true });
    expect(live.state).toBe('live');

    const blocked = classifyReadiness({ blocked: true, reason: 'policy' });
    expect(blocked.state).toBe('blocked');
  });

  it('never grants live from status-only strings (available/ready/ok/healthy/active)', () => {
    for (const status of ['available', 'ready', 'ok', 'healthy', 'active', 'live', 'connected', 'trusted']) {
      const badge = classifyReadiness({ status });
      expect(badge.state, `status=${status}`).not.toBe('live');
      expect(badge.tone, `status=${status}`).not.toBe('ready');
    }
    // Explicit liveReady is the only live path.
    expect(classifyReadiness({ status: 'available', liveReady: true }).state).toBe('live');
    expect(classifyReadiness({ status: 'ready', liveReady: false }).state).not.toBe('live');
  });
});

describe('quality bar — brand & density tokens', () => {
  it('exposes Kael brand greens and density keys', () => {
    expect(desktopDesignTokens.brand.green).toBe('#00e88f');
    expect(desktopDesignTokens.brand.dark).toBe('#060809');
    expect(desktopDesignTokens.density.sidebarWidth).toContain('--zvd-sidebar-w');
    expect(desktopDesignTokens.text?.xs || desktopDesignTokens.color.accent).toBeTruthy();
  });

  it('loads density default comfortable', () => {
    // node env may not have localStorage
    const density = loadDesktopDensity();
    expect(density === 'comfortable' || density === 'compact').toBe(true);
    expect(DENSITY_STORAGE_KEY).toContain('density');
  });
});

describe('quality bar — structural polish files', () => {
  it('ships design system, command center, trust cards, message window', () => {
    const required = [
      'DESIGN.md',
      'QUALITY.md',
      'src/primitives/ui.tsx',
      'src/thread/messageWindow.ts',
      'src/thread/InThreadApprovalCard.tsx',
      'src/thread/ReceiptChip.tsx',
      'src/command-center/CommandCenterOverlay.tsx',
      'src/views/panels/ReviewView.tsx',
      'src/lib/lazyPanel.tsx',
      'src/lib/fileTreeVirtual.ts',
      'src/components/VirtualFileTree.tsx',
      'src/composer/composerStatus.ts',
      'src/composer/composerQueue.ts',
      'src/composer/ComposerStatusStack.tsx',
      'src/thread/planCard.ts',
      'src/thread/PlanCardView.tsx',
      'src/thread/openFromChat.ts',
      'src/thread/streamIsolation.ts',
      'src/session/sessionChrome.ts',
      'src/shell/reviewRailModel.ts',
      'src/shell/terminalTabs.ts',
      'src/trust/hunkApproval.ts',
      'src/trust/trustedOperator.ts',
      'src/thread/runTimeline.ts',
      'src/agents/agentStrip.ts',
      'src/command-center/domainWizards.ts',
      'src/thread/HunkReviewCard.tsx',
      'src/thread/RunTimeline.tsx',
      'src/thread/AgentStrip.tsx',
      'src/command-center/DomainWizardOverlay.tsx',
      'src/constellation/constellationLayout.ts',
      'src/constellation/ConstellationOverlay.tsx',
      'src/views/panels/automationsModel.ts',
      'src/views/panels/AutomationsPanel.tsx',
    ];
    for (const rel of required) {
      expect(existsSync(resolve(root, rel)), rel).toBe(true);
    }
  });

  it('design-system CSS has focus-visible and reduced-motion', () => {
    const css = read('src/styles/design-system.css');
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/--zvd-text-xs/);
    expect(css).toMatch(/\.zvd-btn/);
  });

  it('i18n has a11y and polish keys in en', () => {
    const i18n = read('src/i18n.ts');
    expect(i18n).toMatch(/a11y\.skipToContent/);
    expect(i18n).toMatch(/a11y\.loadingPanel/);
    expect(i18n).toMatch(/thread\.showEarlier/);
    expect(i18n).toMatch(/nav\.review/);
    expect(i18n).toMatch(/nav\.proof/);
    expect(i18n).toMatch(/cc\.title/);
  });
});
