import { useMemo } from 'react';
import { t } from '../i18n';
import {
  agentStripVisible,
  buildAgentStrip,
  countActiveAgents,
  type AgentStripItem,
  type AgentStripSource,
} from '../agents/agentStrip';

export type AgentStripProps = {
  agents?: AgentStripSource[] | AgentStripItem[] | null;
  /** Prebuilt items skip rebuild when provided as AgentStripItem shape. */
  items?: AgentStripItem[];
};

function isBuiltItem(value: unknown): value is AgentStripItem {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'label' in (value as object) &&
      'status' in (value as object) &&
      typeof (value as AgentStripItem).label === 'string',
  );
}

function statusLabel(status: AgentStripItem['status']): string {
  switch (status) {
    case 'running':
      return t('thread.agent.running');
    case 'blocked':
      return t('thread.agent.blocked');
    case 'done':
      return t('thread.agent.done');
    case 'error':
      return t('thread.agent.error');
    default:
      return t('thread.agent.idle');
  }
}

export function AgentStrip(props: AgentStripProps) {
  const items = useMemo(() => {
    if (props.items) return props.items;
    const sources = props.agents || [];
    if (sources.length && sources.every(isBuiltItem)) {
      return sources as AgentStripItem[];
    }
    return buildAgentStrip(sources as AgentStripSource[]);
  }, [props.agents, props.items]);

  if (!agentStripVisible(items)) return null;

  const active = countActiveAgents(items);

  return (
    <div
      className="zvd-agent-strip"
      role="region"
      aria-label={t('thread.agent.stripLabel')}
      data-active={active}
    >
      <div className="zvd-agent-strip__head">
        <strong className="zvd-agent-strip__title">{t('thread.agent.stripTitle')}</strong>
        <span className="zvd-agent-strip__count">
          {t('thread.agent.stripCount')
            .replace('{active}', String(active))
            .replace('{total}', String(items.length))}
        </span>
      </div>
      <ul className="zvd-agent-strip__list">
        {items.map(agent => (
          <li
            key={agent.id}
            className={`zvd-agent-strip__item is-${agent.status}`}
            data-agent-id={agent.id}
            title={agent.task || agent.role}
          >
            <span className="zvd-agent-strip__dot" aria-hidden="true" />
            <span className="zvd-agent-strip__label">{agent.label}</span>
            <span className="zvd-agent-strip__role">{agent.role}</span>
            <span className="zvd-agent-strip__status">{statusLabel(agent.status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
