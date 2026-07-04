import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_IDENTITY_STUDIO_PROFILE,
  buildIdentityStudioPrompt,
  loadIdentityStudioProfile,
  resetIdentityStudioProfile,
  saveIdentityStudioProfile,
  type IdentityMemoryMode,
  type IdentitySessionPreset,
  type IdentityStudioProfile,
} from '../identity/identityStudio';

export function IdentityStudioPanel(props: { sessionId?: string | null }) {
  const [profile, setProfile] = useState<IdentityStudioProfile>(() => loadIdentityStudioProfile(undefined, props.sessionId));
  const [savedAt, setSavedAt] = useState<string>('');
  const promptPreview = useMemo(() => buildIdentityStudioPrompt(profile), [profile]);

  useEffect(() => {
    setProfile(loadIdentityStudioProfile(undefined, props.sessionId));
    setSavedAt('');
  }, [props.sessionId]);

  const update = <K extends keyof IdentityStudioProfile>(key: K, value: IdentityStudioProfile[K]) => {
    setProfile(current => ({ ...current, [key]: value }));
  };

  const handleRulesChange = (value: string) => {
    update('rules', value.split('\n'));
  };

  const handleSave = () => {
    const saved = saveIdentityStudioProfile(profile, undefined, props.sessionId);
    setProfile(saved);
    setSavedAt(new Date().toLocaleTimeString());
    window.dispatchEvent(new CustomEvent('zvd:identity-studio:update', {
      detail: { sessionId: props.sessionId || 'global', profile: saved, prompt: buildIdentityStudioPrompt(saved) },
    }));
  };

  const handleReset = () => {
    const next = resetIdentityStudioProfile(undefined, props.sessionId);
    setProfile(next);
    setSavedAt('');
  };

  return (
    <div className="zvd-identity-studio">
      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Identity Studio</div>
        <div className="zvd-settings-card-desc">
          Configure agent identity, voice, user profile, rules, memory and session presets.
        </div>
      </div>

      <div className="zvd-identity-grid">
        <div className="zvd-settings-card">
          <div className="zvd-settings-form-group">
            <label>Agent name</label>
            <input
              className="zvd-settings-input"
              value={profile.agentName}
              onChange={event => update('agentName', event.target.value)}
              placeholder={DEFAULT_IDENTITY_STUDIO_PROFILE.agentName}
            />
          </div>

          <div className="zvd-settings-form-group">
            <label>Voice</label>
            <textarea
              className="zvd-settings-textarea"
              value={profile.voice}
              onChange={event => update('voice', event.target.value)}
              rows={3}
            />
          </div>

          <div className="zvd-settings-form-group">
            <label>User profile</label>
            <textarea
              className="zvd-settings-textarea"
              value={profile.userProfile}
              onChange={event => update('userProfile', event.target.value)}
              placeholder="Preferences, work context and decision style."
              rows={4}
            />
          </div>
        </div>

        <div className="zvd-settings-card">
          <div className="zvd-settings-form-group">
            <label>Rules</label>
            <textarea
              className="zvd-settings-textarea zvd-identity-rules"
              value={profile.rules.join('\n')}
              onChange={event => handleRulesChange(event.target.value)}
              rows={7}
            />
          </div>

          <div className="zvd-identity-row">
            <div className="zvd-settings-form-group">
              <label>Memory</label>
              <select
                className="zvd-settings-select"
                value={profile.memoryMode}
                onChange={event => update('memoryMode', event.target.value as IdentityMemoryMode)}
              >
                <option value="off">Off</option>
                <option value="session">Session</option>
                <option value="balanced">Balanced</option>
                <option value="long-term">Long term</option>
              </select>
            </div>

            <div className="zvd-settings-form-group">
              <label>Session preset</label>
              <select
                className="zvd-settings-select"
                value={profile.sessionPreset}
                onChange={event => update('sessionPreset', event.target.value as IdentitySessionPreset)}
              >
                <option value="default">Default</option>
                <option value="developer">Developer</option>
                <option value="creator">Creator</option>
                <option value="business">Business</option>
                <option value="research">Research</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Generated context</div>
        <pre className="zvd-identity-preview">{promptPreview}</pre>
      </div>

      <div className="zvd-identity-actions">
        <button type="button" className="zvd-onboarding-button zvd-onboarding-button--secondary" onClick={handleReset}>
          Reset
        </button>
        <span className="zvd-identity-saved">{savedAt ? `Saved at ${savedAt}` : `Session: ${props.sessionId || 'global'}`}</span>
        <button type="button" className="zvd-onboarding-button" onClick={handleSave}>
          Save Identity Studio
        </button>
      </div>
    </div>
  );
}
