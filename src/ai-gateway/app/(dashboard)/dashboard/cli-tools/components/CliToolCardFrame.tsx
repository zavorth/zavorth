"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Card } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

type CliToolCardTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

interface CliToolDescriptor {
  id?: string;
  name: string;
  description?: string;
  image?: string;
  icon?: string;
  color?: string;
}

interface CliToolCardFrameProps {
  tool: CliToolDescriptor;
  toolKey?: string;
  isExpanded: boolean;
  onToggle: () => void;
  eyebrow?: ReactNode;
  summary?: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}

interface CliToolMetaPillProps {
  children?: ReactNode;
  icon?: string;
  tone?: CliToolCardTone;
  className?: string;
}

interface CliToolCardSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: string;
  action?: ReactNode;
  tone?: CliToolCardTone;
  children?: ReactNode;
  className?: string;
}

interface CliToolNoticeProps {
  title?: ReactNode;
  icon?: string;
  tone?: Exclude<CliToolCardTone, "muted">;
  children?: ReactNode;
  className?: string;
}

interface CliToolLabeledFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const metaToneClasses: Record<CliToolCardTone, string> = {
  neutral:
    "border-black/10 bg-black/[0.03] text-text-muted dark:border-white/10 dark:bg-white/[0.04]",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  muted:
    "border-zinc-500/15 bg-zinc-500/10 text-zinc-600 dark:border-zinc-400/15 dark:text-zinc-300",
};

const sectionToneClasses: Record<CliToolCardTone, string> = {
  neutral:
    "border-black/8 bg-white/70 dark:border-white/8 dark:bg-white/[0.03] backdrop-blur-sm",
  info: "border-blue-500/15 bg-blue-500/[0.06]",
  success: "border-emerald-500/15 bg-emerald-500/[0.06]",
  warning: "border-amber-500/15 bg-amber-500/[0.06]",
  danger: "border-red-500/15 bg-red-500/[0.06]",
  muted:
    "border-zinc-500/15 bg-zinc-500/[0.05] dark:border-zinc-400/10 dark:bg-zinc-400/[0.04]",
};

const noticeToneClasses: Record<Exclude<CliToolCardTone, "muted">, string> = {
  neutral:
    "border-black/10 bg-black/[0.04] text-text-main dark:border-white/10 dark:bg-white/[0.05]",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
};

function buildAccentSurface(color: string): CSSProperties {
  return {
    backgroundColor: `${color}14`,
    borderColor: `${color}2e`,
    color,
  };
}

function renderToolVisual(tool: CliToolDescriptor, toolKey?: string) {
  const imageSrc = tool.image || (!tool.icon && toolKey ? `/providers/${toolKey}.png` : null);

  if (imageSrc) {
    return (
      <Image
        src={imageSrc}
        alt={tool.name}
        width={40}
        height={40}
        className="size-10 object-contain rounded-xl"
        sizes="40px"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }

  if (tool.icon) {
    return (
      <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
        {tool.icon}
      </span>
    );
  }

  return (
    <span className="material-symbols-outlined text-[24px] text-text-main" aria-hidden="true">
      terminal
    </span>
  );
}

export default function CliToolCardFrame({
  tool,
  toolKey,
  isExpanded,
  onToggle,
  eyebrow,
  summary,
  status,
  meta,
  children,
}: CliToolCardFrameProps) {
  const accent = tool.color || "#5B7CFA";

  return (
    <Card
      padding="none"
      className="overflow-hidden border-black/10 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.75)] dark:border-white/10"
    >
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 84%)` }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full p-4 text-left sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner"
            style={buildAccentSurface(accent)}
          >
            {renderToolVisual(tool, toolKey)}
          </div>
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                {eyebrow}
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-text-main">{tool.name}</h3>
                {summary || tool.description ? (
                  <p className="mt-1 text-sm leading-5 text-text-muted">
                    {summary || tool.description}
                  </p>
                ) : null}
              </div>

              <span
                className={cn(
                  "material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-text-muted transition-transform",
                  isExpanded && "rotate-180"
                )}
                aria-hidden="true"
              >
                expand_more
              </span>
            </div>

            {status || meta ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {status}
                {meta}
              </div>
            ) : null}
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-black/5 bg-black/[0.015] px-4 pb-4 pt-4 dark:border-white/5 dark:bg-white/[0.02] sm:px-5">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      ) : null}
    </Card>
  );
}

export function CliToolMetaPill({
  children,
  icon,
  tone = "neutral",
  className,
}: CliToolMetaPillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        metaToneClasses[tone],
        className
      )}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function CliToolCardSection({
  title,
  description,
  icon,
  action,
  tone = "neutral",
  children,
  className,
}: CliToolCardSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        sectionToneClasses[tone],
        className
      )}
    >
      {title || action ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {icon ? (
                <span className="material-symbols-outlined text-[18px] text-text-muted" aria-hidden="true">
                  {icon}
                </span>
              ) : null}
              {title ? <h4 className="text-sm font-semibold text-text-main">{title}</h4> : null}
            </div>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-text-muted">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function CliToolNotice({
  title,
  icon = "info",
  tone = "info",
  children,
  className,
}: CliToolNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3 text-sm",
        noticeToneClasses[tone],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium">{title}</p> : null}
          <div className={cn(title && "mt-1", "leading-5")}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function CliToolLabeledField({
  label,
  hint,
  children,
  className,
}: CliToolLabeledFieldProps) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03] sm:grid-cols-[minmax(0,168px),1fr] sm:items-start",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-main">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-text-muted">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
