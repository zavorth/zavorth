"use client";

type HealthPageHeaderProps = {
  description: string;
  lastRefresh: Date | null;
  onRefresh: () => void;
  refreshTitle: string;
  title: string;
  updatedAtLabel: string;
};

export function HealthPageHeader(props: HealthPageHeaderProps) {
  const { description, lastRefresh, onRefresh, refreshTitle, title, updatedAtLabel } = props;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text-main">{title}</h1>
        <p className="text-sm text-text-muted mt-1">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {lastRefresh && <span className="text-xs text-text-muted">{updatedAtLabel}</span>}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-surface hover:bg-surface/80 text-text-muted hover:text-text-main transition-colors"
          title={refreshTitle}
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </div>
    </div>
  );
}
