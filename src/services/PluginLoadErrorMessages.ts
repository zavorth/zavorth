import {
  formatPluginLoadTip,
  resolvePluginLoadLocale,
  type PluginLoadTipId,
} from './plugin-i18n/PluginLoadTipsI18n.js';

export type PluginLoadErrorContext = {
  pluginId?: string | null;
  packageDir?: string | null;
  status?: string | null;
  capabilityId?: string | null;
  /** BCP-47 / ISO locale preference (falls back to ZAVORTH_LOCALE / LANG / en). */
  locale?: string | null;
};

/**
 * Map technical Plugin OS load findings to short, actionable human tips.
 * Returns only human tips (does not strip technical findings).
 * Tips are localized; technical findings remain English.
 */
export function humanizePluginLoadFailure(
  findings: string[],
  context: PluginLoadErrorContext = {},
): string[] {
  const list = Array.isArray(findings) ? findings : [];
  const tips: string[] = [];
  const pluginId = String(context.pluginId || '').trim() || '<plugin-id>';
  const locale = resolvePluginLoadLocale(context.locale);

  const tip = (id: PluginLoadTipId, vars: Record<string, string> = {}) =>
    formatPluginLoadTip(id, { pluginId, ...vars }, locale);

  for (const raw of list) {
    const finding = String(raw || '');
    const lower = finding.toLowerCase();

    if (lower.includes('entrypoint export not found')) {
      tips.push(tip('tip.export_register'));
      continue;
    }

    if (lower.includes('no capability handlers registered') || lower.includes('no capability handlers')) {
      tips.push(tip('tip.bind_capability'));
      continue;
    }

    if (lower.includes('bindcapability rejected undeclared')) {
      const cap = extractPluginCapabilityId(finding) || context.capabilityId || 'X';
      tips.push(tip('tip.declare_capability', { cap }));
      continue;
    }

    if (lower.includes('sandbox requires approval') || lower.includes('needs_approval') || lower.includes('requiredapprovals')) {
      tips.push(tip('tip.enable_plugin'));
      continue;
    }

    if (lower.includes('not load eligible') || lower.includes('is not selected')) {
      tips.push(tip('tip.install_enable'));
      continue;
    }

    if (lower.includes('entrypoint module not found') || lower.includes('entrypoint.module is empty')) {
      tips.push(tip('tip.entrypoint_module'));
      continue;
    }

    if (lower.includes('manifest declares no capabilities')) {
      tips.push(tip('tip.declare_capabilities'));
      continue;
    }

    if (lower.includes('missing handlers for capabilities')) {
      tips.push(tip('tip.bind_all_capabilities'));
      continue;
    }

    if (lower.includes('manifest is missing')) {
      tips.push(tip('tip.add_manifest'));
      continue;
    }

    if (lower.includes('entrypoint export is not a function')) {
      tips.push(tip('tip.export_function'));
      continue;
    }

    if (lower.includes('import timed out') || lower.includes('registration timed out')) {
      tips.push(tip('tip.fast_register'));
      continue;
    }

    if (lower.includes('blocked') && (lower.includes('sandbox') || lower.includes('plugin'))) {
      tips.push(tip('tip.clear_block'));
      continue;
    }
  }

  return unique(tips);
}

/**
 * Append human tips to technical findings for failed/blocked load results.
 */
export function withHumanizedPluginLoadFindings(
  findings: string[],
  context: PluginLoadErrorContext = {},
): string[] {
  const technical = unique((Array.isArray(findings) ? findings : []).map(String).filter(Boolean));
  const human = humanizePluginLoadFailure(technical, context);
  if (human.length === 0) {
    return technical;
  }
  return unique([
    ...technical,
    ...human.map((tip) => `tip: ${tip}`),
  ]);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractPluginCapabilityId(finding: string): string | null {
  const lower = finding.toLowerCase();
  for (const marker of ['capability:', 'undeclared capability:']) {
    const index = lower.indexOf(marker);
    if (index < 0) {
      continue;
    }
    const after = finding.slice(index + marker.length).trim();
    const end = after.indexOf(' ');
    const value = (end >= 0 ? after.slice(0, end) : after).trim();
    if (value) {
      return value;
    }
  }
  return null;
}
