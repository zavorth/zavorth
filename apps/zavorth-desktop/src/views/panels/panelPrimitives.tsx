import type { ReactNode } from 'react';

export type DetailRowTone = 'ready' | 'warning' | 'danger' | 'muted';

export type DetailRow = {
  id: string;
  title: string;
  meta?: string;
  description?: string;
  tone?: DetailRowTone;
  actions?: ReactNode;
};

export function PageFrame(props: {
  title: string;
  eyebrow?: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="zvd-page zvd-hub-page" aria-label={props.title}>
      <header className="zvd-page-header">
        <div>
          {props.eyebrow && <span className="zvd-page-eyebrow">{props.eyebrow}</span>}
          <h1>{props.title}</h1>
          <p>{props.description}</p>
        </div>
        <div className="zvd-page-header-side">
          {props.meta && <span className="zvd-page-meta">{props.meta}</span>}
          {props.actions}
        </div>
      </header>
      {props.children}
    </section>
  );
}

export function SearchBox(props: {
  value: string;
  placeholder: string;
  onChange(value: string): void;
}) {
  return (
    <label className="zvd-page-search">
      <span>Search</span>
      <input value={props.value} onChange={event => props.onChange(event.target.value)} placeholder={props.placeholder} />
    </label>
  );
}

export function TextTabs<T extends string>(props: {
  value: T;
  items: Array<{ value: T; label: string; count?: number }>;
  onChange(value: T): void;
}) {
  return (
    <div className="zvd-text-tabs" role="tablist">
      {props.items.map(item => (
        <button
          aria-selected={props.value === item.value}
          className={props.value === item.value ? 'is-active' : ''}
          key={item.value}
          onClick={() => props.onChange(item.value)}
          role="tab"
          type="button"
        >
          {item.label}
          {typeof item.count === 'number' && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyRows(props: { text: string }) {
  return <div className="zvd-empty-rows">{props.text}</div>;
}

export function DetailRows(props: { rows: DetailRow[]; empty: string }) {
  if (props.rows.length === 0) {
    return <EmptyRows text={props.empty} />;
  }

  return (
    <div className="zvd-detail-list">
      {props.rows.map(row => (
        <article className="zvd-detail-row" key={row.id}>
          <div className="zvd-detail-main">
            <span className={`zvd-row-dot tone-${row.tone || 'muted'}`} />
            <div>
              <strong>{row.title}</strong>
              {row.description && <p>{row.description}</p>}
            </div>
          </div>
          <div className="zvd-detail-side">
            {row.meta && <span>{row.meta}</span>}
            {row.actions}
          </div>
        </article>
      ))}
    </div>
  );
}
