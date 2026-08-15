import { useMemo, useState } from 'react';
import type { ToolItem } from '../../apiClient';
import { readinessFromTool } from '../../desktop-state/readiness';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame, SearchBox, TextTabs } from './panelPrimitives';
import { SkillRegistryOpsPanel } from './SkillRegistryOpsPanel';

type ToolWithLive = ToolItem & { liveReady?: boolean | null };
type Mode = 'all' | 'live' | 'review' | 'registry';

function toolBadge(tool: ToolItem) {
  return readinessFromTool({
    status: tool.status,
    risk: tool.risk,
    liveReady: (tool as ToolWithLive).liveReady,
  });
}

export function SkillsPanel(props: { tools: ToolItem[] }) {
  const [mode, setMode] = useState<Mode>('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    if (mode === 'registry') return [] as Array<[string, ToolItem[]]>;
    const q = query.trim().toLowerCase();
    const filtered = props.tools.filter((tool) => {
      const badge = toolBadge(tool);
      const haystackstack =
        `${tool.title || ''} ${tool.name || ''} ${tool.id || ''} ${tool.description || ''} ${tool.source || ''} ${tool.status || ''} ${tool.risk || ''} ${badge.label}`.toLowerCase();
      if (q && !haystackstack.includes(q)) {
        return false;
      }
      if (mode === 'live') {
        return badge.state === 'live';
      }
      if (mode === 'review') {
        return (
          badge.state === 'blocked' ||
          badge.state === 'needs_setup' ||
          badge.tone === 'warning' ||
          badge.tone === 'danger'
        );
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

  const liveCount = props.tools.filter((tool) => toolBadge(tool).state === 'live').length;

  const rows = groups.flatMap(([source, tools]) => [
    {
      id: `group-${source}`,
      title: source,
      description: `${tools.length} ${tools.length === 1 ? 'skill' : 'skills'}`,
      meta: 'source',
      tone: 'muted' as const,
    },
    ...tools.map((tool, index) => {
      const badge = toolBadge(tool);
      return {
        id: itemId(tool, `tool-${source}-${index}`),
        title: tool.title || tool.name || tool.id || 'Skill',
        description: tool.description || 'Available through the local runtime.',
        meta: badge.label,
        tone: badge.tone,
      };
    }),
  ]);

  const tabs = (
    <TextTabs<Mode>
      value={mode}
      onChange={setMode}
      items={[
        { value: 'all', label: 'All', count: props.tools.length },
        { value: 'live', label: 'Live', count: liveCount },
        { value: 'review', label: 'Needs review' },
        { value: 'registry', label: 'Registry ops' },
      ]}
    />
  );

  if (mode === 'registry') {
    return (
      <div>
        <div style={{ marginBottom: '0.75rem' }}>{tabs}</div>
        <SkillRegistryOpsPanel />
      </div>
    );
  }

  return (
    <PageFrame
      description="Runtime skills, plugin-like tools, sources, and trust state. Registry ops: sign / verify / export / publish-plan."
      meta={`${props.tools.length} projected`}
      title={panelLabels.skills}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search skills" />}
    >
      {tabs}
      <DetailRows rows={rows} empty="No skills are projected by the runtime yet." />
    </PageFrame>
  );
}
