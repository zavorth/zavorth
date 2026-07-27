import type { ReactNode } from 'react';
import type { ApprovalItem, ChatMessage, LearningItem, MemoryItem, ToolItem } from '../apiClient';
import type { DesktopPanel } from '../slashCommands';

export const profileLabels = ['personal', 'creator', 'developer', 'business', 'power'] as const;
export const effortLabels = ['low', 'medium', 'high', 'ultra'] as const;

export const responseProfileByExperience: Record<string, string> = {
  personal: 'short',
  creator: 'mentor',
  developer: 'dev',
  business: 'executive',
  power: 'dev',
};

export const panelLabels: Record<DesktopPanel, string> = {
  chat: 'Chat',
  approvals: 'Review',
  memory: 'Memory',
  skills: 'Skills',
  channels: 'Channels',
  settings: 'Settings',
  files: 'Files',
  preview: 'Preview',
  automations: 'Automations',
  agents: 'Agents',
  profiles: 'Profiles',
  analytics: 'Analytics',
  marketplace: 'Marketplace',
  workboard: 'Workboard',
  receipts: 'Proof',
  vibe: 'Vibe coding',
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeMessage(raw: unknown, index: number): ChatMessage {
  const record = asRecord(raw);
  const role = String(record.role || record.kind || 'assistant');
  const normalizedRole: ChatMessage['role'] =
    role === 'user' || role === 'system' || role === 'tool' ? role : 'assistant';
  const content = String(record.content || record.text || record.message || record.markdown || '').trim();
  return {
    id: String(record.id || record.messageId || `message-${index}-${Date.now()}`),
    role: normalizedRole,
    content: content || '(empty message)',
    at: String(record.at || record.createdAt || record.generatedAt || new Date().toISOString()),
    title: typeof record.title === 'string' ? record.title : undefined,
  };
}

export function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeMessage).filter((message) => message.content);
}

export function itemId(item: ApprovalItem | LearningItem | MemoryItem | ToolItem, fallback: string): string {
  return String(
    item.id ??       ('approvalId' in item ? item.approvalId : undefined) ??       ('candidateId' in item ? item.candidateId : undefined) ??       fallback,
  );
}

export function PanelScaffold(props: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <>
      <div className="zvd-panel-heading">
        <h2>{props.title}</h2>
        <p>{props.subtitle}</p>
      </div>
      <div className="zvd-panel-list">{props.children}</div>
    </>
  );
}

export function EmptyPanel(props: { text: string; title?: string }) {
  if (props.title) {
    return (
      <div className="zvd-empty">
        <div className="zvd-empty-title">{props.title}</div>
        <p className="zvd-empty-body">{props.text}</p>
      </div>
    );
  }
  return <div className="zvd-empty-panel zvd-empty">{props.text}</div>;
}
