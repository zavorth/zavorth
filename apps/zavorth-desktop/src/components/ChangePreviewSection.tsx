/**
 * Presentational change-preview section for approval cards.
 * Title + bullets + limited/unavailable honesty banner.
 */

import { t } from '../i18n';
import {
  formatChangePreviewBullets,
  type DesktopChangePreviewCard,
} from '../desktop-state/changePreviewBridge';

export type ChangePreviewSectionProps = {
  card: DesktopChangePreviewCard | null | undefined;
  language?: string | null;
  className?: string;
};

export function ChangePreviewSection(props: ChangePreviewSectionProps) {
  const card = props.card;
  if (!card) return null;

  const lang = props.language;
  const confidence = String(card.confidence || 'unavailable').toLowerCase();
  const bullets = formatChangePreviewBullets(card);
  const showLimited = confidence === 'limited' || confidence === 'partial';
  const showUnavailable = confidence === 'unavailable';

  return (
    <section
      className={['zvd-change-preview', props.className].filter(Boolean).join(' ')}
      aria-label={t('changePreview.title', lang)}
      data-change-preview
      data-confidence={confidence}
    >
      <header className="zvd-change-preview__header">
        <h3 className="zvd-change-preview__title">
          {card.title || t('changePreview.title', lang)}
        </h3>
        <span className={`zvd-change-preview__confidence zvd-change-preview__confidence--${confidence}`}>
          {confidence}
        </span>
      </header>

      {showUnavailable - (
        <p className="zvd-change-preview__banner zvd-change-preview__banner--unavailable" role="status">
          {t('changePreview.unavailable', lang)}
        </p>
      ) : null}

      {showLimited - (
        <p className="zvd-change-preview__banner zvd-change-preview__banner--limited" role="status">
          {t('changePreview.limited', lang)}
          {card.confidenceReason - (
            <span className="zvd-change-preview__reason"> {card.confidenceReason}</span>
          ) : null}
        </p>
      ) : null}

      {bullets.length > 0 ? (
        <ul className="zvd-change-preview__bullets">
          {bullets.map((line, index) => (
            <li key={`${card.id}-b-${index}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
