import { useState } from 'react';
import { PageFrame } from './panelPrimitives';
import { IconPlus, IconTrash, IconUserCircle, IconChevronDown } from '@tabler/icons-react';
import type { AgentProfile } from '../../useDesktopAppState';
import { parseEffort } from '../../lib/typeGuards';
import { t } from '../../i18n';

export function ProfilesPanel(props: {
  customProfiles: AgentProfile[];
  allProfiles: AgentProfile[];
  onAddCustomProfile?: (name: string, prompt: string, effort: AgentProfile['effort'], costLimit: number) => void;
  onDeleteCustomProfile?: (id: string) => void;
  activeProfileId?: string;
  onActivateProfile?: (profile: AgentProfile) => void;
}) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [effort, setEffort] = useState<'low' | 'medium' | 'high' | 'ultra'>('medium');
  const [costLimit, setCostLimit] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim() || !props.onAddCustomProfile) return;
    props.onAddCustomProfile(name.trim(), prompt.trim(), effort, costLimit);
    setName('');
    setPrompt('');
    setEffort('medium');
    setCostLimit(10);
  };

  return (
    <PageFrame
      eyebrow={t('profileManagement')}
      description={t('profileManagementDescription')}
      meta="profiles"
      title={t('profiles')}
    >
      <style>{`
        .zvd-profiles-container {
          display: flex;
          gap: 24px;
          color: #e4e4e7;
          width: 100%;
        }

        @media (max-width: 1000px) {
          .zvd-profiles-container {
            flex-direction: column;
          }
          .zvd-profiles-left, .zvd-profiles-right {
            flex: 1 1 auto;
            width: 100% !important;
          }
        }

        .zvd-profiles-left {
          flex: 1.3;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        .zvd-profiles-right {
          flex: 1;
          min-width: 0;
        }

        .zvd-profiles-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-profiles-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: calc(100vh - 220px);
          overflow-y: auto;
          padding-right: 4px;
        }

        .zvd-profile-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 16px;
          position: relative;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .zvd-profile-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .zvd-profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .zvd-profile-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .zvd-profile-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .zvd-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .zvd-badge-native {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .zvd-badge-custom {
          background: rgba(241, 106, 33, 0.1);
          color: #f16a21;
          border: 1px solid rgba(241, 106, 33, 0.2);
        }

        .zvd-badge-effort {
          background: rgba(255, 255, 255, 0.06);
          color: #a1a1aa;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .zvd-profile-prompt {
          font-size: 12.5px;
          color: #a1a1aa;
          line-height: 1.5;
          word-wrap: break-word;
          font-style: italic;
          background: rgba(0, 0, 0, 0.15);
          padding: 8px 10px;
          border-radius: 6px;
          border-left: 3px solid rgba(255, 255, 255, 0.15);
        }

        .zvd-profile-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
        }

        .zvd-profile-cost {
          font-size: 12px;
          color: var(--zvd-accent, #f16a21);
          font-weight: 600;
        }

        .zvd-profile-delete-btn {
          background: transparent;
          border: none;
          color: #f87171;
          padding: 4px;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .zvd-profile-delete-btn:hover {
          background: rgba(248, 113, 113, 0.1);
          color: #ef4444;
        }

        .zvd-profile-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-profile-activate-btn {
          min-height: 30px;
          padding: 0 11px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 7px;
          color: #e4e4e7;
          background: rgba(255, 255, 255, 0.035);
          cursor: pointer;
        }

        .zvd-profile-activate-btn.is-active {
          color: var(--zvd-accent, #00e88f);
          border-color: color-mix(in srgb, var(--zvd-accent, #00e88f) 35%, transparent);
          background: color-mix(in srgb, var(--zvd-accent, #00e88f) 9%, transparent);
          cursor: default;
        }

        .zvd-profiles-form-card {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .zvd-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .zvd-form-label {
          font-size: 12px;
          font-weight: 600;
          color: #a1a1aa;
          text-transform: uppercase;
        }

        .zvd-form-input, .zvd-form-textarea, .zvd-form-select {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 10px 12px;
          color: #fff;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .zvd-form-input:focus, .zvd-form-textarea:focus, .zvd-form-select:focus {
          border-color: var(--zvd-accent, #f16a21);
        }

        .zvd-form-textarea {
          resize: none;
          height: 100px;
        }

        .zvd-profiles-submit-btn {
          background: var(--zvd-accent, #f16a21);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .zvd-profiles-submit-btn:hover {
          opacity: 0.9;
        }

        .zvd-profiles-empty {
          text-align: center;
          color: #71717a;
          font-size: 13px;
          padding: 32px;
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }
      `}</style>

      <div className="zvd-profiles-container">
        <div className="zvd-profiles-left">
          <h2 className="zvd-profiles-title">
            <IconUserCircle size={18} />
            {t('availableProfiles')}
          </h2>

          <div className="zvd-profiles-list">
            {props.allProfiles.map(profile => (
              <div className="zvd-profile-card" key={profile.id}>
                <div className="zvd-profile-header">
                  <div className="zvd-profile-name">
                    <span>{profile.name}</span>
                  </div>
                  <div className="zvd-profile-badges">
                    <span className={`zvd-badge ${profile.isCustom ? 'zvd-badge-custom' : 'zvd-badge-native'}`}>
                      {profile.isCustom ? t('customProfile') : t('builtInProfile')}
                    </span>
                    <span className="zvd-badge zvd-badge-effort">
                      {profile.effort}
                    </span>
                  </div>
                </div>

                <div className="zvd-profile-prompt">
                  {profile.systemPrompt}
                </div>

                <div className="zvd-profile-footer">
                  <span className="zvd-profile-cost">
                    {t('costLimit')}: ${profile.costLimit.toFixed(2)} USD
                  </span>

                  <div className="zvd-profile-actions">
                    {props.onActivateProfile ? (
                      <button
                        type="button"
                        className={`zvd-profile-activate-btn ${props.activeProfileId === profile.id ? 'is-active' : ''}`}
                        disabled={props.activeProfileId === profile.id}
                        onClick={() => props.onActivateProfile?.(profile)}
                      >
                        {props.activeProfileId === profile.id ? t('profileInUse') : t('useProfile')}
                      </button>
                    ) : null}
                    {profile.isCustom && props.onDeleteCustomProfile ? (
                      <button
                        type="button"
                        className="zvd-profile-delete-btn"
                        onClick={() => props.onDeleteCustomProfile?.(profile.id)}
                        title="Excluir profile"
                        aria-label={`Excluir profile ${profile.name}`}
                      >
                        <IconTrash size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {props.allProfiles.length === 0 && (
              <div className="zvd-profiles-empty">
                {t('noCustomProfiles')}
              </div>
            )}
          </div>
        </div>

        <div className="zvd-profiles-right">
          <h2 className="zvd-profiles-title">
            <IconPlus size={18} />
            {t('createProfile')}
          </h2>

          <form className="zvd-profiles-form-card" onSubmit={handleSubmit}>
            <div className="zvd-form-group">
              <label className="zvd-form-label">{t('name')}</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Security Auditor"
                className="zvd-form-input"
              />
            </div>

            <div className="zvd-form-group">
              <label className="zvd-form-label">{t('systemInstructions')}</label>
              <textarea
                required
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={t('systemInstructionsPlaceholder')}
                className="zvd-form-textarea"
              />
            </div>

            <div className="zvd-form-group">
              <label className="zvd-form-label">{t('schedule')}</label>
              <select
                value={effort}
                onChange={e => setEffort(parseEffort(e.target.value))}
                className="zvd-form-select"
              >
                <option value="low">Low Effort</option>
                <option value="medium">Medium Effort</option>
                <option value="high">High Effort</option>
                <option value="ultra">Ultra Effort</option>
              </select>
            </div>

            <div className="zvd-form-group">
              <label className="zvd-form-label">{t('costLimit')} (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={costLimit}
                onChange={e => setCostLimit(parseFloat(e.target.value) || 0)}
                className="zvd-form-input"
              />
            </div>

            <button type="submit" className="zvd-profiles-submit-btn">
              <IconPlus size={16} />
              {t('createProfile')}
            </button>
          </form>
        </div>
      </div>
    </PageFrame>
  );
}
