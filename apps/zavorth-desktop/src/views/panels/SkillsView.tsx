import { useMemo, useState } from 'react';
import type { ToolItem } from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { readinessFromTool } from '../../desktop-state/readiness';
import { DetailRows, PageFrame, SearchBox } from '../panelChrome';

export function SkillsView(props: { tools: ToolItem[] }) {
  const [mode, setMode] = useState<'all' | 'ready' | 'review'>('all');
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = props.tools.filter(tool => {
      const status = String(tool.status || '').toLowerCase();
      const risk = String(tool.risk || '').toLowerCase();
      const hay = `${tool.title || ''} ${tool.name || ''} ${tool.id || ''} ${tool.description || ''} ${tool.source || ''} ${status} ${risk}`.toLowerCase();
      if (q && !hay.includes(q)) {
        return false;
      }
      if (mode === 'ready') {
        return status.includes('ready') || status.includes('trusted') || !status;
      }
      if (mode === 'review') {
        return status.includes('review') || status.includes('draft') || risk.includes('high') || risk.includes('medium');
      }
      return true;
    });

    const map = new Map<string, ToolItem[]>();
    for (const tool of filtered) {
      const source = tool.source || tool.status || 'runtime';
      map.set(source, [...(map.get(source) || []), tool]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [mode, props.tools, query]);

  const rows = groups.flatMap(([source, tools]) => [
    {
      id: `group-${source}`,
      title: source,
      description: `${tools.length} ${tools.length === 1 ? 'skill' : 'skills'}`,
      meta: 'source',
      tone: 'muted' as const,
    },
    ...tools.map((tool, index) => {
      const badge = readinessFromTool({ status: tool.status, risk: tool.risk });
      return {
        id: itemId(tool, `tool-${source}-${index}`),
        title: tool.title || tool.name || tool.id || 'Skill',
        description: tool.description || badge.detail || 'Available through the local runtime.',
        meta: badge.label,
        tone: badge.tone,
      };
    }),
  ]);

  return (
    <PageFrame
      description="Runtime skills, toolsets, sources, and trust state in one workspace view."
      meta={`${props.tools.length} projected`}
      title={panelLabels.skills}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search skills" />}
    >
      <TextTabs<'all' | 'ready' | 'review'>
        value={mode}
        onChange={setMode}
        items={[
          { value: 'all', label: 'All', count: props.tools.length },
          { value: 'ready', label: 'Ready' },
          { value: 'review', label: 'Needs review' },
        ]}
      />
      <DetailRows rows={rows} empty="No skills are projected by the runtime yet." />
    </PageFrame>
  );
}

