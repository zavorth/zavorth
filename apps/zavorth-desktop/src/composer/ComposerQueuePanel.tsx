import type { QueuedPrompt } from './composerQueue';
import { t } from '../i18n';
import { X } from '../icons';

export function ComposerQueuePanel(props: {
  queue: QueuedPrompt[];
  onRemove(id: string): void;
  onClear(): void;
}) {
  if (!props.queue.length) {
    return null;
  }

  return (
    <div className="zvd-composer-queue" aria-label={t('composer.queue.aria')}>
      <div className="zvd-composer-queue__header">
        <strong>
          {t('composer.queue.title')} ({props.queue.length})
        </strong>
        <button
          type="button"
          className="zvd-composer-queue__clear"
          onClick={props.onClear}
          aria-label={t('composer.queue.clear')}
          title={t('composer.queue.clear')}
        >
          {t('composer.queue.clear')}
        </button>
      </div>
      <ul className="zvd-composer-queue__list">
        {props.queue.map((item, index) => (
          <li key={item.id} className="zvd-composer-queue__item">
            <span className="zvd-composer-queue__index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="zvd-composer-queue__text" title={item.text}>
              {item.text}
            </span>
            <button
              type="button"
              className="zvd-composer-queue__remove"
              onClick={() => props.onRemove(item.id)}
              aria-label={t('composer.queue.remove')}
              title={t('composer.queue.remove')}
            >
              <X aria-hidden="true" size={14} stroke={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
