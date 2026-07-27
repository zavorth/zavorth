import { useEffect, useMemo, useState } from 'react';
import { X } from '../icons';
import { Button } from '../primitives/ui';
import { t } from '../i18n';
import type { CommandCenterAction } from './commandCenter';
import {
  getWizard,
  nextWizardStep,
  prevWizardStep,
  wizardProgress,
  type WizardId,
} from './domainWizards';

export type DomainWizardOverlayProps = {
  wizardId: WizardId | null;
  open: boolean;
  onClose(): void;
  onFinish(action: CommandCenterAction): void;
};

export function DomainWizardOverlay(props: DomainWizardOverlayProps) {
  const wizard = useMemo(
    () => (props.wizardId ? getWizard(props.wizardId) : null),
    [props.wizardId],
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (props.open) setStep(0);
  }, [props.open, props.wizardId]);

  useEffect(() => {
    if (!props.open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        props.onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open || !wizard) return null;

  const progress = wizardProgress(step, wizard.steps.length);
  const current = wizard.steps[progress.current];

  function handleNext() {
    if (progress.isLast) {
      props.onFinish(wizard!.completeAction);
      props.onClose();
      return;
    }
    setStep(value => nextWizardStep(value, wizard!.steps.length));
  }

  function handleBack() {
    setStep(value => prevWizardStep(value));
  }

  return (
    <div
      className="zvd-wizard-overlay"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        className="zvd-wizard-window"
        role="dialog"
        aria-modal="true"
        aria-label={t(wizard.titleKey)}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="zvd-wizard-header">
          <div className="zvd-wizard-header-text">
            <h2 className="zvd-wizard-title">{t(wizard.titleKey)}</h2>
            {wizard.subtitleKey - (
              <p className="zvd-wizard-subtitle">{t(wizard.subtitleKey)}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="zvd-wizard-close"
            onClick={props.onClose}
            aria-label={t('wizard.close')}
            title={t('wizard.close')}
          >
            <X aria-hidden="true" size={16} stroke={2} />
          </button>
        </header>

        <div className="zvd-wizard-progress" aria-hidden="true">
          <div
            className="zvd-wizard-progress__bar"
            style={{ width: `${Math.round(progress.ratio * 100)}%` }}
          />
        </div>
        <p className="zvd-wizard-step-meta">
          {t('wizard.stepOf')
            .replace('{current}', String(progress.current + 1))
            .replace('{total}', String(progress.total))}
        </p>

        {current - (
          <div className="zvd-wizard-body">
            <h3 className="zvd-wizard-step-title">{t(current.titleKey)}</h3>
            <p className="zvd-wizard-step-body">{t(current.bodyKey)}</p>
            {current.optional - (
              <p className="zvd-wizard-optional">{t('wizard.optional')}</p>
            ) : null}
          </div>
        ) : null}

        <footer className="zvd-wizard-footer">
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            {t('wizard.cancel')}
          </Button>
          <div className="zvd-wizard-footer-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={progress.isFirst}
              onClick={handleBack}
            >
              {t('wizard.back')}
            </Button>
            <Button variant="default" size="sm" onClick={handleNext}>
              {progress.isLast ? t('wizard.finish') : t('wizard.next')}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
