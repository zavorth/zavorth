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

    if (/entrypoint export not found/i.test(finding)) {
      tips.push(tip('tip.export_register'));
      continue;
    }

    if (/no capability handlers registered/i.test(finding) || /no capability handlers/i.test(finding)) {
      tips.push(tip('tip.bind_capability'));
      continue;
    }

    if (/bindcapability rejected undeclared/i.test(lower) || /bindCapability rejected undeclared/i.test(finding)) {
      const match = finding.match(/capability:\s*([^\s]+)/i) || finding.match(/undeclared capability:\s*([^\s]+)/i);
      const cap = match?.[1] || context.capabilityId || 'X';
      tips.push(tip('tip.declare_capability', { cap }));
      continue;
    }

    if (/sandbox requires approval/i.test(finding) || /needs_approval/i.test(finding) || /requiredApprovals/i.test(finding)) {
      tips.push(tip('tip.enable_plugin'));
      continue;
    }

    if (/not load eligible/i.test(finding) || /is not selected/i.test(finding)) {
      tips.push(tip('tip.install_enable'));
      continue;
    }

    if (/entrypoint module not found/i.test(finding) || /entrypoint\.module is empty/i.test(finding)) {
      tips.push(tip('tip.entrypoint_module'));
      continue;
    }

    if (/manifest declares no capabilities/i.test(finding)) {
      tips.push(tip('tip.declare_capabilities'));
      continue;
    }

    if (/missing handlers for capabilities/i.test(finding)) {
      tips.push(tip('tip.bind_all_capabilities'));
      continue;
    }

    if (/manifest is missing/i.test(finding)) {
      tips.push(tip('tip.add_manifest'));
      continue;
    }

    if (/entrypoint export is not a function/i.test(finding)) {
      tips.push(tip('tip.export_function'));
      continue;
    }

    if (/import timed out/i.test(finding) || /registration timed out/i.test(finding)) {
      tips.push(tip('tip.fast_register'));
      continue;
    }

    if (/trust.*blocked|blocked/i.test(lower) && /sandbox|plugin/i.test(lower)) {
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
