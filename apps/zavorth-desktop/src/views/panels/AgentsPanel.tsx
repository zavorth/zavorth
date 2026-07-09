import { useState, type CSSProperties } from 'react';
import { PageFrame } from './panelPrimitives';
import {
  IconPlus,
  IconTrash,
  IconPlayerPlay,
  IconUsers,
} from '@tabler/icons-react';
import type { ActiveSubagent } from '../../useDesktopAppState';
import { isSafeStaticSvg } from '../../lib/safeHtml';
import { t } from '../../i18n';

export function AgentsPanel(props: {
  busy: boolean;
  subagents?: ActiveSubagent[];
  onAddSubagent?: (role: string, typeName: string) => void;
  onDeleteSubagent?: (id: string) => void;
  onTriggerSubagentTask?: (id: string, task: string) => void;
}) {
  const [roleInput, setRoleInput] = useState('');
  const [typeInput, setTypeInput] = useState('research');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [taskPrompt, setTaskPrompt] = useState('');

  const selectedAgent = props.subagents?.find(a => a.id === selectedAgentId);

  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleInput.trim() || !props.onAddSubagent) return;
    props.onAddSubagent(roleInput.trim(), typeInput);
    setRoleInput('');
  };

  const handleTriggerTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !taskPrompt.trim() || !props.onTriggerSubagentTask) return;
    props.onTriggerSubagentTask(selectedAgentId, taskPrompt.trim());
    setTaskPrompt('');
  };

  const getStatusClass = (status: string) => {
    if (status === 'queued' || status === 'claimed') return 'status-queued';
    if (status === 'running') return 'status-running';
    if (status === 'completed') return 'status-success';
    if (status === 'blocked') return 'status-blocked';
    if (status === 'failed') return 'status-failed';
    return 'status-idle';
  };

  function SubagentGlyphIcon({ agent, size = 'normal' }: { agent: ActiveSubagent; size?: 'small' | 'normal' }) {
    const px = size === 'small' ? 30 : 38;
    const isMascot = agent.identity.isMascot ?? false;
    const motion = agent.identity.motion;
    const intervalMs = motion?.intervalMs ?? (isMascot ? 1320 : 1120);
    const delayMs = motion?.delayMs ?? (agent.identity.animationSeed % intervalMs);
    const statusLabel = t(agent.identity.surface?.i18nKey || `subagent.status.${agent.identity.motionState}`);
    const ariaLabel = `${agent.identity.displayName} ${statusLabel}`;

    const rawSvg = agent.identity.iconSvg;
    const svgHtml =
      rawSvg && isSafeStaticSvg(rawSvg)
        ? isMascot
          ? rawSvg.replace(/width="[^"]*"/, '').replace(/height="[^"]*"/, '')
          : rawSvg.replace(/width="[^"]*"/, `width="${px}"`).replace(/height="[^"]*"/, `height="${px}"`)
        : null;

    return (
      <span
        aria-label={ariaLabel}
        className={[
          'zvd-subagent-icon',
          size,
          agent.identity.motionState,
          agent.identity.surface?.className,
          motion?.className ?? 'zvd-motion-static',
          isMascot ? 'is-mascot' : '',
        ].filter(Boolean).join(' ')}
        style={{
          '--subagent-accent': agent.identity.palette.accent,
          '--subagent-muted': agent.identity.palette.muted,
          '--subagent-glow': agent.identity.palette.glow,
          '--subagent-icon-size': `${px}px`,
          '--subagent-motion-interval': `${intervalMs}ms`,
          '--subagent-motion-delay': `${-delayMs}ms`,
        } as CSSProperties}
        title={`${agent.identity.displayName} - ${statusLabel}`}
      >
        {svgHtml ? (
          // eslint-disable-next-line react/no-danger
          <span dangerouslySetInnerHTML={{ __html: svgHtml }} className="zvd-subagent-icon-svg" />
        ) : (
          <span className="zvd-subagent-icon-fallback">{agent.identity.glyph}</span>
        )}
      </span>
    );
  }

  return (
    <PageFrame
      eyebrow={t('orchestration')}
      description="Manage and monitor the autonomous subagent team assigned to solve problems in your workspace."
      meta="agents"
      title={t('agentTeam')}
    >
      <style>{`
        .zvd-agents-container {
          display: flex;
          gap: 20px;
          color: #e4e4e7;
        }

        @media (max-width: 1000px) {
          .zvd-agents-container {
            flex-direction: column;
          }
          .zvd-agents-left, .zvd-agents-right {
            flex: 1 1 auto;
            width: 100%;
          }
        }

        .zvd-agents-left {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        .zvd-agents-right {
          flex: 1.5;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        /* Forms and cards */
        .zvd-card {
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .zvd-card-title {
          font-size: 13.5px;
          font-weight: 600;
          color: #fff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .zvd-form-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .zvd-input-text {
          flex: 1;
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 12.5px;
          outline: none;
          height: 38px;
        }

        .zvd-input-text:focus {
          border-color: var(--zvd-accent, #f16a21);
        }

        .zvd-select {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 0 12px;
          color: #fff;
          font-size: 12.5px;
          outline: none;
          height: 38px;
          cursor: pointer;
        }

        .zvd-btn-primary {
          background: var(--zvd-accent, #f16a21);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 0 16px;
          height: 38px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }

        .zvd-btn-primary:hover {
          background: #e05b17;
        }

        /* Agents grid */
        .zvd-agents-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .zvd-agent-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 12px 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .zvd-agent-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-agent-card.active {
          border-color: var(--zvd-accent, #f16a21);
          background: rgba(241, 106, 33, 0.04);
        }

        .zvd-agent-card-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .zvd-agent-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .zvd-agent-role {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .zvd-agent-status-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }

        .zvd-agent-type {
          font-size: 10.5px;
          color: #71717a;
          text-transform: uppercase;
        }

        .status-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .status-idle {
          background: rgba(113, 113, 122, 0.15);
          color: #a1a1aa;
        }

        .status-queued {
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
        }

        .status-running {
          background: rgba(241, 106, 33, 0.18);
          color: #fb923c;
        }

        .status-success {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .status-blocked {
          background: rgba(234, 179, 8, 0.15);
          color: #f59e0b;
        }

        .status-failed {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        /* Subagent Icon wrapper matching Codex (transparent, zero container styles) */
        .zvd-subagent-icon {
          width: var(--subagent-icon-size, 38px);
          height: var(--subagent-icon-size, 38px);
          min-width: var(--subagent-icon-size, 38px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: transparent;
          border: none;
          box-shadow: none;
          overflow: visible;
          transition: opacity 0.2s;
        }

        .zvd-subagent-icon svg {
          width: 100%;
          height: 100%;
          display: block;
          background: transparent;
          image-rendering: pixelated;
          shape-rendering: crispEdges;
        }

        .zvd-subagent-icon.is-mascot {
          overflow: hidden;
        }

        .zvd-subagent-icon.completed {
          filter: none;
        }

        .zvd-subagent-icon.idle {
          opacity: 0.9;
        }

        /* Frame-by-frame 8-frame activity motion */
        .zvd-identicon-motion-frame { visibility: hidden; }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-0 {
          animation: zvd-identicon-frame-0 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-1 {
          animation: zvd-identicon-frame-1 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-2 {
          animation: zvd-identicon-frame-2 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-3 {
          animation: zvd-identicon-frame-3 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-4 {
          animation: zvd-identicon-frame-4 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-5 {
          animation: zvd-identicon-frame-5 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-6 {
          animation: zvd-identicon-frame-6 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.running .zvd-identicon-motion-frame.zvd-frame-7 {
          animation: zvd-identicon-frame-7 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }

        @keyframes zvd-identicon-frame-0 {
          0%, 12.49% { visibility: visible; }
          12.5%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-1 {
          0%, 12.49% { visibility: hidden; }
          12.5%, 24.99% { visibility: visible; }
          25%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-2 {
          0%, 24.99% { visibility: hidden; }
          25%, 37.49% { visibility: visible; }
          37.5%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-3 {
          0%, 37.49% { visibility: hidden; }
          37.5%, 49.99% { visibility: visible; }
          50%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-4 {
          0%, 49.99% { visibility: hidden; }
          50%, 62.49% { visibility: visible; }
          62.5%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-5 {
          0%, 62.49% { visibility: hidden; }
          62.5%, 74.99% { visibility: visible; }
          75%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-6 {
          0%, 74.99% { visibility: hidden; }
          75%, 87.49% { visibility: visible; }
          87.5%, 100% { visibility: hidden; }
        }
        @keyframes zvd-identicon-frame-7 {
          0%, 87.49% { visibility: hidden; }
          87.5%, 100% { visibility: visible; }
        }

        /* Zavorth mascot animation */
        .zvd-mascot-frame { visibility: hidden; }
        .zvd-mascot-frame-0 { visibility: visible; }

        .zvd-subagent-icon.is-mascot.running .zvd-mascot-frame-0 {
          animation: zvd-mascot-frame-0 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.is-mascot.running .zvd-mascot-frame-1 {
          animation: zvd-mascot-frame-1 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.is-mascot.running .zvd-mascot-frame-2 {
          animation: zvd-mascot-frame-2 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.is-mascot.running .zvd-mascot-frame-3 {
          animation: zvd-mascot-frame-3 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.is-mascot.running .zvd-mascot-frame-4 {
          animation: zvd-mascot-frame-4 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }
        .zvd-subagent-icon.is-mascot.running .zvd-mascot-frame-5 {
          animation: zvd-mascot-frame-5 var(--subagent-motion-interval) steps(1, end) infinite;
          animation-delay: var(--subagent-motion-delay);
        }

        @keyframes zvd-mascot-frame-0 {
          0%, 16.66% { visibility: visible; }
          16.67%, 100% { visibility: hidden; }
        }
        @keyframes zvd-mascot-frame-1 {
          0%, 16.66% { visibility: hidden; }
          16.67%, 33.33% { visibility: visible; }
          33.34%, 100% { visibility: hidden; }
        }
        @keyframes zvd-mascot-frame-2 {
          0%, 33.33% { visibility: hidden; }
          33.34%, 50% { visibility: visible; }
          50.01%, 100% { visibility: hidden; }
        }
        @keyframes zvd-mascot-frame-3 {
          0%, 50% { visibility: hidden; }
          50.01%, 66.66% { visibility: visible; }
          66.67%, 100% { visibility: hidden; }
        }
        @keyframes zvd-mascot-frame-4 {
          0%, 66.66% { visibility: hidden; }
          66.67%, 83.33% { visibility: visible; }
          83.34%, 100% { visibility: hidden; }
        }
        @keyframes zvd-mascot-frame-5 {
          0%, 83.33% { visibility: hidden; }
          83.34%, 100% { visibility: visible; }
        }

        .zvd-agent-card-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-icon-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .zvd-icon-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        .zvd-icon-btn.btn-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        /* Flow Map visualization */
        .zvd-flow-map {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zvd-flow-nodes {
          display: flex;
          align-items: center;
          gap: 20px;
          width: 100%;
          max-width: 400px;
        }

        .zvd-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .zvd-node-circle {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.1);
          background: #121318;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #71717a;
          transition: all 0.3s;
        }

        .zvd-node.active .zvd-node-circle {
          border-color: var(--zvd-accent, #f16a21);
          color: #fff;
          box-shadow: 0 0 15px rgba(241, 106, 33, 0.25);
        }

        .zvd-node-label {
          font-size: 11px;
          font-weight: 600;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .zvd-node.active .zvd-node-label {
          color: #fff;
        }

        .zvd-flow-arrow {
          position: relative;
          flex: 1.5;
          height: 2px;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zvd-flow-arrow.active {
          background: var(--zvd-accent, #f16a21);
          box-shadow: 0 0 8px rgba(241, 106, 33, 0.4);
        }

        .zvd-flow-arrow-head {
          position: absolute;
          right: 0;
          top: -4px;
          width: 0;
          height: 0;
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-left: 8px solid rgba(255, 255, 255, 0.1);
        }

        .zvd-flow-arrow.active .zvd-flow-arrow-head {
          border-left-color: var(--zvd-accent, #f16a21);
        }

        .zvd-flow-message {
          position: absolute;
          top: -18px;
          font-size: 10px;
          color: var(--zvd-accent, #f16a21);
          font-weight: 600;
          white-space: nowrap;
          animation: slide 1.5s infinite linear;
        }

        @keyframes slide {
          0% { transform: translateX(-20px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(20px); opacity: 0; }
        }

        /* Timeline and bubbles */
        .zvd-timeline {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 16px;
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .zvd-msg-bubble {
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12.5px;
          line-height: 1.5;
          max-width: 85%;
        }

        .zvd-msg-bubble.parent {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #e4e4e7;
          align-self: flex-start;
        }

        .zvd-msg-bubble.subagent {
          background: rgba(241, 106, 33, 0.08);
          border: 1px solid rgba(241, 106, 33, 0.15);
          color: #fff;
          align-self: flex-end;
        }

        .zvd-msg-header {
          font-size: 10.5px;
          font-weight: 600;
          color: #71717a;
          text-transform: uppercase;
        }

        .zvd-msg-bubble.subagent .zvd-msg-header {
          color: var(--zvd-accent, #f16a21);
        }
      `}</style>

      <div className="zvd-agents-container">
        {/* Left Side: Create and display active subagents */}
        <div className="zvd-agents-left">
          {/* Create new subagent card */}
          <form onSubmit={handleAddAgent} className="zvd-card">
            <h4 className="zvd-card-title">
              <IconPlus size={16} />
              <span>{t('instantiateSubagent')}</span>
            </h4>
            <div className="zvd-form-row">
              <input
                type="text"
                className="zvd-input-text"
                placeholder="Ex: Security Auditor..."
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                required
              />
              <select
                className="zvd-select"
                value={typeInput}
                onChange={e => setTypeInput(e.target.value)}
              >
                <option value="research">research</option>
                <option value="debugger">debugger</option>
                <option value="auditor">auditor</option>
                <option value="self">self</option>
              </select>
              <button type="submit" className="zvd-btn-primary">
                <span>{t('create')}</span>
              </button>
            </div>
          </form>

          {/* Subagents Grid */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#71717a', margin: '12px 0 8px 4px' }}>
              {t('activeSubagents')}
            </h4>
            <div className="zvd-agents-list">
              {(!props.subagents || props.subagents.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
                  {t('noSubagents')}
                </div>
              ) : (
                props.subagents.map(agent => (
                  <div
                    key={agent.id}
                    className={`zvd-agent-card ${selectedAgentId === agent.id ? 'active' : ''}`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="zvd-agent-card-left">
                      <SubagentGlyphIcon agent={agent} size="small" />
                      <div className="zvd-agent-copy">
                        <span className="zvd-agent-role">{agent.identity.displayName}</span>
                        <div className="zvd-agent-status-row">
                          <span className="zvd-agent-type">{agent.typeName}</span>
                          <span className={`status-badge ${getStatusClass(agent.status)}`}>
                            {t(agent.identity.surface?.i18nKey || `subagent.status.${agent.status}`)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="zvd-agent-card-right" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="zvd-icon-btn btn-delete"
                        onClick={() => props.onDeleteSubagent && props.onDeleteSubagent(agent.id)}
                        title="Delete agent"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Visual flow map and interactive timeline */}
        <div className="zvd-agents-right">
          {selectedAgent ? (
            <div className="zvd-card" style={{ flex: 1 }}>
              <h4 className="zvd-card-title">
                <IconUsers size={16} />
                <span>{t('orchestration')}: {selectedAgent.identity.displayName}</span>
              </h4>

              {/* Dynamic Flow Map */}
              <div className="zvd-flow-map">
                <div className="zvd-flow-nodes">
                  {/* Parent Node */}
                  <div className="zvd-node active">
                    <div className="zvd-node-circle">
                      <IconUsers size={22} />
                    </div>
                    <span className="zvd-node-label">{t('parentAgent')}</span>
                  </div>

                  {/* Flow Arrow */}
                  <div className={`zvd-flow-arrow ${selectedAgent.status === 'running' ? 'active' : ''}`}>
                    {selectedAgent.status === 'running' && (
                      <span className="zvd-flow-message">{t('delegatingTask')}</span>
                    )}
                    <div className="zvd-flow-arrow-head" />
                  </div>

                  {/* Subagent Node */}
                  <div className={`zvd-node ${selectedAgent.status !== 'idle' ? 'active' : ''}`}>
                    <div className="zvd-node-circle" style={{ borderColor: selectedAgent.status === 'completed' ? '#4ade80' : undefined }}>
                      <SubagentGlyphIcon agent={selectedAgent} />
                    </div>
                    <span className="zvd-node-label">{selectedAgent.identity.displayName}</span>
                  </div>
                </div>
              </div>

              {/* Chat Timeline logs */}
              <div>
                <h5 style={{ fontSize: '11px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', margin: '4px 0' }}>
                  {t('communicationHistory')}
                </h5>
                <div className="zvd-timeline">
                  {selectedAgent.messages.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
                      {t('noTasksExecuted')}
                    </div>
                  ) : (
                    selectedAgent.messages.map((msg, index) => (
                      <div key={index} className={`zvd-msg-bubble ${msg.role}`}>
                        <div className="zvd-msg-header">
                          <span>{msg.role === 'parent' ? t('parentAgent') : selectedAgent.role}</span>
                        </div>
                        <div style={{ marginTop: '4px' }}>{msg.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Trigger Task Form */}
              <form onSubmit={handleTriggerTask} className="zvd-form-row" style={{ marginTop: 'auto' }}>
                <input
                  type="text"
                  className="zvd-input-text"
                  placeholder={t('delegateTaskPlaceholder')}
                  value={taskPrompt}
                  onChange={e => setTaskPrompt(e.target.value)}
                  disabled={selectedAgent.status === 'running'}
                  required
                />
                <button
                  type="submit"
                  className="zvd-btn-primary"
                  disabled={selectedAgent.status === 'running'}
                >
                  <IconPlayerPlay size={16} />
                  <span>{t('delegate')}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="zvd-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '13px', textAlign: 'center', padding: '30px' }}>
              {t('selectSubagentInstructions')}
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}

