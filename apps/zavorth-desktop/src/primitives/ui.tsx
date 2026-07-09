import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'destructive'
  | 'text';

export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon node */
  icon?: ReactNode;
};

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: 'zvd-btn-default',
  secondary: 'zvd-btn-secondary',
  ghost: 'zvd-btn-ghost',
  outline: 'zvd-btn-outline',
  destructive: 'zvd-btn-destructive',
  text: 'zvd-btn-text',
};

const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'zvd-btn-sm',
  default: '',
  lg: 'zvd-btn-lg',
  icon: 'zvd-btn-icon',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'default', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('zvd-btn', BUTTON_VARIANT_CLASS[variant], BUTTON_SIZE_CLASS[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: 'sm' | 'default' | 'lg';
  active?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'default', active, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      className={cx(
        'zvd-icon-btn',
        size === 'sm' && 'zvd-icon-btn-sm',
        size === 'lg' && 'zvd-icon-btn-lg',
        active && 'is-active',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export type ListRowProps = {
  label: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  active?: boolean;
  /** Renders as button when interactive (default true if onClick provided) */
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  id?: string;
};

export function ListRow(props: ListRowProps) {
  const {
    label,
    description,
    action,
    active,
    interactive,
    onClick,
    className,
    id,
  } = props;
  const isInteractive = interactive ?? typeof onClick === 'function';
  const classNames = cx(
    'zvd-list-row',
    isInteractive && 'is-interactive',
    active && 'is-active',
    className,
  );

  const body = (
    <>
      <div className="zvd-list-row__body">
        <div className="zvd-list-row__label">{label}</div>
        {description != null && description !== false && (
          <p className="zvd-list-row__description">{description}</p>
        )}
      </div>
      {action != null && <div className="zvd-list-row__action">{action}</div>}
    </>
  );

  if (isInteractive) {
    return (
      <button type="button" id={id} className={classNames} onClick={onClick}>
        {body}
      </button>
    );
  }

  return (
    <div id={id} className={classNames}>
      {body}
    </div>
  );
}

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: string;
  onChange(value: string): void;
  onClear?: () => void;
  icon?: ReactNode;
  label?: string;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, onClear, icon, label = 'Search', className, placeholder = 'Search…', id, ...rest },
  ref,
) {
  const inputId = id;
  return (
    <div className={cx('zvd-search-field', className)}>
      <span className="zvd-search-field__icon" aria-hidden="true">
        {icon ?? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        )}
      </span>
      <input
        ref={ref}
        id={inputId}
        type="search"
        className="zvd-search-field__input"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={event => onChange(event.target.value)}
        {...rest}
      />
      {Boolean(value) && (
        <button
          type="button"
          className="zvd-search-field__clear"
          aria-label="Clear search"
          onClick={() => {
            if (onClear) onClear();
            else onChange('');
          }}
        >
          ×
        </button>
      )}
    </div>
  );
});

export type SegmentedItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string = string> = {
  value: T;
  items: Array<SegmentedItem<T>>;
  onChange(value: T): void;
  className?: string;
  'aria-label'?: string;
};

export function SegmentedControl<T extends string = string>(props: SegmentedControlProps<T>) {
  return (
    <div
      className={cx('zvd-segmented', props.className)}
      role="tablist"
      aria-label={props['aria-label']}
    >
      {props.items.map(item => {
        const selected = item.value === props.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={item.disabled}
            className={cx('zvd-segmented__item', selected && 'is-active')}
            onClick={() => props.onChange(item.value)}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className="zvd-segmented__count">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState(props: EmptyStateProps) {
  return (
    <div className={cx('zvd-empty', props.className)} role="status">
      {props.icon != null && <div className="zvd-empty__icon">{props.icon}</div>}
      <h2 className="zvd-empty__title">{props.title}</h2>
      {props.description != null && (
        <p className="zvd-empty__description">{props.description}</p>
      )}
      {props.actions != null && <div className="zvd-empty__actions">{props.actions}</div>}
    </div>
  );
}

export type ErrorStateProps = {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ErrorState(props: ErrorStateProps) {
  return (
    <div className={cx('zvd-error', props.className)} role="alert">
      <h2 className="zvd-error__title">{props.title ?? 'Something went wrong'}</h2>
      {props.description != null && (
        <p className="zvd-error__description">{props.description}</p>
      )}
      {props.actions != null && <div className="zvd-error__actions">{props.actions}</div>}
    </div>
  );
}

export type LoaderProps = {
  label?: string;
  size?: 'default' | 'lg';
  /** Stretch as a block placeholder */
  block?: boolean;
  className?: string;
};

export function Loader(props: LoaderProps) {
  const label = props.label ?? 'Loading';
  return (
    <div
      className={cx('zvd-loader', props.block && 'is-block', props.className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <span
        className={cx('zvd-loader__spinner', props.size === 'lg' && 'is-lg')}
        aria-hidden="true"
      />
      {props.label != null && <p className="zvd-loader__label">{props.label}</p>}
    </div>
  );
}

export type BadgeTone =
  | 'muted'
  | 'ready'
  | 'live'
  | 'warning'
  | 'needs_setup'
  | 'danger'
  | 'blocked'
  | 'available'
  | 'catalog'
  | 'accent';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
};

export function Badge(props: BadgeProps) {
  const { tone = 'muted', dot, className, children, ...rest } = props;
  return (
    <span className={cx('zvd-badge', `zvd-badge-tone-${tone}`, className)} {...rest}>
      {dot && <span className="zvd-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** StatusBadge encodes catalog ≠ live readiness labels. */
export type StatusBadgeState =
  | 'live'
  | 'needs_setup'
  | 'available'
  | 'blocked'
  | 'unknown';

const STATUS_BADGE_META: Record<
  StatusBadgeState,
  { tone: BadgeTone; label: string }
> = {
  live: { tone: 'live', label: 'Live' },
  needs_setup: { tone: 'needs_setup', label: 'Needs setup' },
  available: { tone: 'catalog', label: 'Available' },
  blocked: { tone: 'blocked', label: 'Blocked' },
  unknown: { tone: 'muted', label: 'Unknown' },
};

export type StatusBadgeProps = {
  state: StatusBadgeState;
  /** Override default label */
  label?: string;
  className?: string;
  showDot?: boolean;
};

export function StatusBadge(props: StatusBadgeProps) {
  const meta = STATUS_BADGE_META[props.state] ?? STATUS_BADGE_META.unknown;
  return (
    <Badge
      tone={meta.tone}
      dot={props.showDot !== false}
      className={props.className}
      title={
        props.state === 'available' || props.state === 'unknown'
          ? 'Catalog support — not proven live yet'
          : undefined
      }
    >
      {props.label ?? meta.label}
    </Badge>
  );
}

export type KbdProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Kbd(props: KbdProps) {
  const { className, children, ...rest } = props;
  return (
    <kbd className={cx('zvd-kbd', className)} {...rest}>
      {children}
    </kbd>
  );
}
