import { useEffect, useMemo, useState } from 'react';
import { Search, X } from '../icons';
import { t } from '../i18n';
import {
  buildCommandCenterItems,
  filterCommandCenterItems,
  groupCommandCenterItems,
  type CommandCenterAction,
  type CommandCenterCategory,
  type CommandCenterInput,
  type CommandCenterItem,
} from './commandCenter';
import { DOMAIN_HERO_CARDS } from './domainCards';
import { DomainWizardOverlay } from './DomainWizardOverlay';
import { wizardIdFromHero, type WizardId } from './domainWizards';

const CATEGORY_I18N: Record<CommandCenterCategory, string> = {
  Daily: 'cc.domain.daily',
  Trust: 'cc.domain.trust',
  Reach: 'cc.domain.reach',
  Power: 'cc.domain.power',
  Workspace: 'cc.domain.workspace',
  Settings: 'cc.domain.settings',
  'Slash Commands': 'cc.domain.slash',
};

export type CommandCenterOverlayProps = {
  open: boolean;
  onClose(): void;
  onAction(action: CommandCenterAction): void;
  input?: CommandCenterInput;
  /** Optional controlled query; when omitted, search is local state. */
  query?: string;
  onQueryChange?(value: string): void;
};

export function CommandCenterOverlay(props: CommandCenterOverlayProps) {
  const [localQuery, setLocalQuery] = useState('');
  const [wizardId, setWizardId] = useState<WizardId | null>(null);
  const query = props.query ?? localQuery;
  const setQuery = props.onQueryChange ?? setLocalQuery;

  useEffect(() => {
    if (!props.open) {
      if (props.query === undefined) {
        setLocalQuery('');
      }
      setWizardId(null);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (wizardId) {
          setWizardId(null);
          return;
        }
        props.onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.open, props.onClose, props.query, wizardId]);

  const input: CommandCenterInput = props.input ?? { settingsGroups: [] };

  const groups = useMemo(() => {
    const items = buildCommandCenterItems(input);
    const filtered = filterCommandCenterItems(items, query);
    return groupCommandCenterItems(filtered);
  }, [input, query]);

  const heroCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOMAIN_HERO_CARDS;
    return DOMAIN_HERO_CARDS.filter(card => {
      const title = t(card.titleKey).toLowerCase();
      const subtitle = t(card.subtitleKey).toLowerCase();
      return title.includes(q) || subtitle.includes(q) || card.id.includes(q);
    });
  }, [query]);

  if (!props.open) {
    return null;
  }

  const isEmpty = heroCards.length === 0 && groups.every(group => group.items.length === 0);

  function runAction(action: CommandCenterAction) {
    props.onAction(action);
  }

  function handleHero(cardId: string, action: CommandCenterAction) {
    const wizard = wizardIdFromHero(cardId);
    if (wizard) {
      setWizardId(wizard);
      return;
    }
    runAction(action);
  }

  return (
    <>
      <div
        className="zvd-cc-overlay"
        role="presentation"
        onMouseDown={event => {
          if (event.target === event.currentTarget) {
            props.onClose();
          }
        }}
      >
        <section
          className="zvd-cc-window"
          role="dialog"
          aria-modal="true"
          aria-label={t('cc.title')}
          onMouseDown={event => event.stopPropagation()}
        >
          <header className="zvd-cc-header">
            <div className="zvd-cc-header-text">
              <h2 className="zvd-cc-title">{t('cc.title')}</h2>
            </div>
            <label className="zvd-cc-search">
              <Search aria-hidden="true" size={16} stroke={1.8} />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('cc.search')}
                aria-label={t('cc.search')}
              />
            </label>
            <button
              type="button"
              className="zvd-cc-close"
              onClick={props.onClose}
              aria-label={t('cc.close')}
              title={t('cc.close')}
            >
              <X aria-hidden="true" size={16} stroke={2} />
            </button>
          </header>

          <div className="zvd-cc-body">
            {isEmpty ? (
              <div className="zvd-cc-empty" role="status">
                {t('cc.empty')}
              </div>
            ) : (
              <>
                {heroCards.length > 0 ? (
                  <section className="zvd-cc-hero-grid" aria-label={t('cc.title')}>
                    {heroCards.map(card => (
                      <button
                        key={card.id}
                        type="button"
                        className="zvd-cc-hero"
                        onClick={() => handleHero(card.id, card.action)}
                      >
                        <strong>{t(card.titleKey)}</strong>
                        <small>{t(card.subtitleKey)}</small>
                      </button>
                    ))}
                  </section>
                ) : null}

                <div className="zvd-cc-grid">
                  {groups.map(group => (
                    <section key={group.category} className="zvd-cc-domain">
                      <h3 className="zvd-cc-domain-title">
                        {t(CATEGORY_I18N[group.category])}
                      </h3>
                      <div className="zvd-cc-domain-cards">
                        {group.items.map(item => (
                          <CommandCenterCard
                            key={item.id}
                            item={item}
                            onSelect={() => runAction(item.action)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <DomainWizardOverlay
        open={wizardId != null}
        wizardId={wizardId}
        onClose={() => setWizardId(null)}
        onFinish={action => {
          setWizardId(null);
          runAction(action);
        }}
      />
    </>
  );
}

function CommandCenterCard(props: {
  item: CommandCenterItem;
  onSelect(): void;
}) {
  const { item, onSelect } = props;
  return (
    <button
      type="button"
      className={`zvd-cc-card${item.disabled ? ' is-disabled' : ''}`}
      onClick={onSelect}
      disabled={item.disabled}
      title={item.subtitle}
    >
      <span className="zvd-cc-card-main">
        <strong>{item.title}</strong>
        <small>{item.subtitle}</small>
      </span>
      {item.statusLabel ? (
        <span className="zvd-cc-card-badge">{item.statusLabel}</span>
      ) : null}
    </button>
  );
}
