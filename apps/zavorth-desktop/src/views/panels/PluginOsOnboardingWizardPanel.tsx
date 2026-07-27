import { useMemo, useState } from 'react';

export type PluginOsWizardProfile = {
  id: string;
  label: string;
  summary: string;
};

export type PluginOsWizardOptional = {
  id: string;
  name: string;
  summary: string;
  selected: boolean;
  available?: boolean;
};

export type PluginOsWizardStep = 'welcome' | 'profile' | 'optionals' | 'review' | 'done';

const STEP_ORDER: PluginOsWizardStep[] = ['welcome', 'profile', 'optionals', 'review', 'done'];

export type PluginOsOnboardingWizardPanelProps = {
  profiles: PluginOsWizardProfile[];
  optionals: PluginOsWizardOptional[];
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
  onOptionalToggle: (pluginId: string, selected: boolean) => void;
  onNext?: () => void;
  onBack?: () => void;
  onApply: (profile: string) => void | Promise<void>;
  onSkip?: () => void;
  labels?: Partial<Record<string, string>>;
  /** Controlled step; when omitted, the panel keeps local step state. */
  step?: PluginOsWizardStep;
  onStepChange?: (step: PluginOsWizardStep) => void;
};

const DEFAULT_LABELS: Record<string, string> = {
  wizardTitle: 'Plugin setup',
  wizardSubtitle: 'Pick a starting pack. You can change this anytime.',
  wizardWelcomeTitle: 'Welcome to Plugin OS',
  wizardWelcomeBody:
    'Plugins extend what Zavorth can do — from web search to mail and project tools. Choose a pack that matches how you work.',
  wizardProfileTitle: 'Choose a starting pack',
  wizardProfileBody: 'Each pack enables a different set of built-in plugins. You stay in control.',
  wizardOptionalsTitle: 'Optional add-ons',
  wizardOptionalsBody: 'These usually need sign-in or extra setup. Skip any you do not need.',
  wizardOptionalsEmpty: 'No optional plugins for this pack.',
  wizardReviewTitle: 'Review your choices',
  wizardReviewBody: 'Confirm the pack and optionals before applying. Nothing is enabled until you apply.',
  wizardDoneTitle: 'You are set',
  wizardDoneBody: 'Your pack request was sent. Refresh the list if plugins do not appear yet.',
  wizardNext: 'Next',
  wizardBack: 'Back',
  wizardSkip: 'Skip setup',
  wizardApply: 'Apply pack',
  wizardClose: 'Done',
  wizardStepOf: 'Step {current} of {total}',
  wizardSelectedProfile: 'Pack',
  wizardSelectedOptionals: 'Optionals',
  wizardNoneSelected: 'None',
  emptyNeverAuto: 'Never auto-enables plugins — you approve every change.',
};

export function defaultPluginOsWizardProfiles(labels?: Partial<Record<string, string>>): PluginOsWizardProfile[] {
  const L = labels || {};
  return [
    {
      id: 'minimal',
      label: L.wizardProfileMinimal || 'Minimal',
      summary: L.wizardProfileMinimalSummary || 'Router, security guidance, and MCP bridge only.',
    },
    {
      id: 'core',
      label: L.wizardProfileCore || 'Core',
      summary: L.wizardProfileCoreSummary || 'Safe built-in defaults without credential-heavy tools.',
    },
    {
      id: 'recommended',
      label: L.wizardProfileRecommended || 'Recommended',
      summary: L.wizardProfileRecommendedSummary || 'Balanced first-party pack for most people.',
    },
    {
      id: 'full',
      label: L.wizardProfileFull || 'Full',
      summary: L.wizardProfileFullSummary || 'Every built-in plugin, including optional integrations.',
    },
  ];
}

function stepIndex(step: PluginOsWizardStep): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx < 0 ? 0 : idx;
}

export default function PluginOsOnboardingWizardPanel(props: PluginOsOnboardingWizardPanelProps) {
  const labels = { ...DEFAULT_LABELS, ...(props.labels || {}) };
  const [localStep, setLocalStep] = useState<PluginOsWizardStep>('welcome');
  const [applied, setApplied] = useState(false);

  const step = props.step ?? localStep;
  const setStep = (next: PluginOsWizardStep) => {
    if (props.onStepChange) props.onStepChange(next);
    else setLocalStep(next);
  };

  const index = stepIndex(step);
  const total = STEP_ORDER.length;
  const profiles = props.profiles.length > 0
    ? props.profiles
    : defaultPluginOsWizardProfiles(labels);

  const selectedProfileMeta = useMemo(
    () => profiles.find((p) => p.id === props.selectedProfile) || profiles[0] || null,
    [profiles, props.selectedProfile],
  );

  const selectedOptionals = useMemo(
    () => props.optionals.filter((item) => item.selected),
    [props.optionals],
  );

  const stepLabel = String(labels.wizardStepOf || '')
    .replace('{current}', String(index + 1))
    .replace('{total}', String(total));

  function goNext() {
    props.onNext?.();
    if (step === 'review') {
      // Apply there isppens via dedicated button; next from review is not used.
      return;
    }
    const next = STEP_ORDER[Math.min(index + 1, total - 1)];
    if (next) setStep(next);
  }

  function goBack() {
    props.onBack?.();
    if (index <= 0) return;
    const prev = STEP_ORDER[index - 1];
    if (prev) setStep(prev);
  }

  async function handleApply() {
    const profile = props.selectedProfile || selectedProfileMeta?.id || 'recommended';
    try {
      await props.onApply(profile);
      setApplied(true);
      setStep('done');
    } catch {
      // Soft-fail: stay on review so the user can retry or skip.
    }
  }

  return (
    <section
      className="zvd-plugin-os-wizard"
      aria-label={labels.wizardTitle}
      style={{
        border: '1px solid var(--zvd-border, rgba(255,255,255,0.08))',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: 'var(--zvd-surface-raised, rgba(255,255,255,0.03))',
      }}
    >
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{labels.wizardTitle}</h2>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>{labels.wizardSubtitle}</p>
        <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.7 }} aria-live="polite">
          {stepLabel}
        </p>
        <div
          aria-hidden="true"
          style={{
            marginTop: 8,
            height: 4,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(((index + 1) / total) * 100)}%`,
              height: '100%',
              background: 'var(--zvd-accent, #6ea8fe)',
              transition: 'width 160ms ease',
            }}
          />
        </div>
      </header>

      <div className="zvd-plugin-os-wizard-body" style={{ minHeight: 120 }}>
        {step === 'welcome' ? (
          <div>
            <h3 style={{ marginTop: 0 }}>{labels.wizardWelcomeTitle}</h3>
            <p style={{ opacity: 0.9 }}>{labels.wizardWelcomeBody}</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>{labels.emptyNeverAuto}</p>
          </div>
        ) : null}

        {step === 'profile' ? (
          <div>
            <h3 style={{ marginTop: 0 }}>{labels.wizardProfileTitle}</h3>
            <p style={{ opacity: 0.9 }}>{labels.wizardProfileBody}</p>
            <div
              role="radiogroup"
              aria-label={labels.wizardProfileTitle}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
                marginTop: 12,
              }}
            >
              {profiles.map((profile) => {
                const selected = profile.id === props.selectedProfile;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`zvd-btn ${selected ? 'zvd-btn-primary' : 'zvd-btn-secondary'}`}
                    onClick={() => props.onProfileChange(profile.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      gap: 4,
                      padding: 12,
                      height: 'auto',
                      whiteSpace: 'normal',
                    }}
                  >
                    <strong>{profile.label}</strong>
                    <small style={{ opacity: 0.85, fontWeight: 400 }}>{profile.summary}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 'optionals' ? (
          <div>
            <h3 style={{ marginTop: 0 }}>{labels.wizardOptionalsTitle}</h3>
            <p style={{ opacity: 0.9 }}>{labels.wizardOptionalsBody}</p>
            {props.optionals.length === 0 ? (
              <p style={{ opacity: 0.75 }}>{labels.wizardOptionalsEmpty}</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {props.optionals.map((item) => (
                  <li
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}
                  >
                    <input
                      id={`plugin-os-opt-${item.id}`}
                      type="checkbox"
                      checked={item.selected}
                      disabled={item.available === false}
                      onChange={(event) => props.onOptionalToggle(item.id, event.target.checked)}
                    />
                    <label htmlFor={`plugin-os-opt-${item.id}`} style={{ cursor: 'pointer' }}>
                      <strong>{item.name}</strong>
                      <small style={{ display: 'block', opacity: 0.8 }}>{item.summary}</small>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === 'review' ? (
          <div>
            <h3 style={{ marginTop: 0 }}>{labels.wizardReviewTitle}</h3>
            <p style={{ opacity: 0.9 }}>{labels.wizardReviewBody}</p>
            <dl className="zvd-capability-meta" style={{ marginTop: 12 }}>
              <div>
                <dt>{labels.wizardSelectedProfile}</dt>
                <dd>{selectedProfileMeta?.label || props.selectedProfile}</dd>
              </div>
              <div>
                <dt>{labels.wizardSelectedOptionals}</dt>
                <dd>
                  {selectedOptionals.length > 0
                    ? selectedOptionals.map((item) => item.name).join(', ')
                    : labels.wizardNoneSelected}
                </dd>
              </div>
            </dl>
            <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>{labels.emptyNeverAuto}</p>
          </div>
        ) : null}

        {step === 'done' ? (
          <div>
            <h3 style={{ marginTop: 0 }}>{labels.wizardDoneTitle}</h3>
            <p style={{ opacity: 0.9 }}>{labels.wizardDoneBody}</p>
            {applied ? null : (
              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>{labels.emptyNeverAuto}</p>
            )}
          </div>
        ) : null}
      </div>

      <footer
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'space-between',
          marginTop: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {props.onSkip && step !== 'done' ? (
            <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" type="button" onClick={() => props.onSkip?.()}>
              {labels.wizardSkip}
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {step !== 'welcome' && step !== 'done' ? (
            <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" type="button" onClick={goBack}>
              {labels.wizardBack}
            </button>
          ) : null}
          {step === 'welcome' || step === 'profile' || step === 'optionals' ? (
            <button className="zvd-btn zvd-btn-primary zvd-btn-sm" type="button" onClick={goNext}>
              {labels.wizardNext}
            </button>
          ) : null}
          {step === 'review' ? (
            <button className="zvd-btn zvd-btn-primary zvd-btn-sm" type="button" onClick={() => void handleApply()}>
              {labels.wizardApply}
            </button>
          ) : null}
          {step === 'done' && props.onSkip ? (
            <button className="zvd-btn zvd-btn-primary zvd-btn-sm" type="button" onClick={() => props.onSkip?.()}>
              {labels.wizardClose}
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
