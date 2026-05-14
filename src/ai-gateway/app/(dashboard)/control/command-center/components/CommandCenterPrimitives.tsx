"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type {
  DashboardNavigationSector,
  DashboardRuntimeSnapshot,
  DashboardRuntimeStatus,
} from "../contracts";

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export type CommandCenterShellProps = {
  bridge?: ReactNode;
  dock?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CommandCenterShell({
  bridge,
  dock,
  children,
  className,
}: CommandCenterShellProps) {
  return (
    <div className={cx("bsk-command-center", className)}>
      <div className="bcc-shell">
        {bridge}
        <main className="bcc-viewport">{children}</main>
        {dock}
      </div>
    </div>
  );
}

export type CommandCenterBridgeProps = {
  runtime: DashboardRuntimeSnapshot;
  currentTitle?: string;
  onSearch?: () => void;
};

export function CommandCenterBridge({
  runtime,
  currentTitle = "Chat",
  onSearch,
}: CommandCenterBridgeProps) {
  return (
    <header className="bcc-bridge">
      <div className="bcc-bridge__brand">
        <CommandCenterMascot compact />
        <div>
          <span className="bcc-bridge__eyebrow">Command Center</span>
          <span className="bcc-bridge__title">Zavorth</span>
        </div>
      </div>
      <div className="bcc-bridge__center" aria-label="Localizacao atual">
        <span className="bcc-bridge__path">Zavorth</span>
        <span className="bcc-bridge__path-sep">/</span>
        <span className="bcc-bridge__path-current">{currentTitle}</span>
      </div>
      <div className="bcc-bridge__right">
        <CommandCenterBadge tone={statusToTone(runtime.status)}>
          {runtime.currentModelLabel}
        </CommandCenterBadge>
        <span className="bcc-runtime-pulse" data-status={runtime.status}>
          {runtime.status === "ready" ? "Pronto" : runtime.status}
        </span>
        {onSearch ? (
          <CommandCenterButton onClick={onSearch}>
            Buscar
          </CommandCenterButton>
        ) : null}
      </div>
    </header>
  );
}

export type CommandCenterDockProps = {
  sectors: DashboardNavigationSector[];
  activeSectorId: DashboardNavigationSector["id"];
  onSelect?: (sectorId: DashboardNavigationSector["id"]) => void;
};

export function CommandCenterDock({
  sectors,
  activeSectorId,
  onSelect,
}: CommandCenterDockProps) {
  return (
    <nav className="bcc-dock" aria-label="Command Center">
      <div className="bcc-dock__rail">
        {sectors.filter((sector) => sector.enabled).map((sector) => (
          <button
            key={sector.id}
            type="button"
            className="bcc-dock__node"
            data-active={sector.id === activeSectorId}
            title={sector.title}
            onClick={() => onSelect?.(sector.id)}
          >
            <span className="bcc-dock__glyph" aria-hidden="true">
              {sectorGlyph(sector.id)}
            </span>
            <span className="bcc-dock__label">{sector.label}</span>
            {sector.badgeCount ? <span className="bcc-dock__count">{sector.badgeCount}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}

export type CommandCenterCardProps = {
  label?: string;
  title: string;
  children?: ReactNode;
  className?: string;
};

export function CommandCenterCard({
  label,
  title,
  children,
  className,
}: CommandCenterCardProps) {
  return (
    <section className={cx("bcc-card", className)}>
      {label ? <p className="bcc-card__label">{label}</p> : null}
      <h2 className="bcc-card__title">{title}</h2>
      {children ? <div className="bcc-card__body">{children}</div> : null}
    </section>
  );
}

export type CommandCenterButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
};

export function CommandCenterButton({
  variant = "default",
  className,
  ...props
}: CommandCenterButtonProps) {
  return (
    <button
      {...props}
      className={cx("bcc-button", className)}
      data-variant={variant}
    />
  );
}

export type CommandCenterBadgeProps = {
  tone?: "info" | "ok" | "warn" | "danger";
  children: ReactNode;
};

export function CommandCenterBadge({
  tone = "info",
  children,
}: CommandCenterBadgeProps) {
  return (
    <span className="bcc-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export type CommandCenterMascotProps = {
  src?: string;
  alt?: string;
  compact?: boolean;
};

export function CommandCenterMascot({
  src,
  alt = "Mascote Zavorth",
  compact,
}: CommandCenterMascotProps) {
  return (
    <div
      className="bcc-mascot"
      aria-label={src ? undefined : alt}
      style={compact ? { width: 46, height: 46, borderRadius: 16, fontSize: 24 } : undefined}
    >
      {src ? <img src={src} alt={alt} /> : <CommandCenterFoxMark compact={compact} />}
    </div>
  );
}

export type CommandCenterHeroProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  mascotSrc?: string;
  actions?: ReactNode;
};

export function CommandCenterHero({
  eyebrow = "Ola, Operador",
  title = "O que vamos fazer hoje?",
  subtitle = "Escreva como falaria com um copiloto. O Zavorth cuida do resto.",
  mascotSrc,
  actions,
}: CommandCenterHeroProps) {
  return (
    <section className="bcc-hero">
      <CommandCenterMascot src={mascotSrc} />
      <div>
        <span className="bcc-hero__eyebrow">{eyebrow}</span>
        <h1 className="bcc-hero__title">{title}</h1>
        <p className="bcc-hero__subtitle">{subtitle}</p>
      </div>
      {actions}
    </section>
  );
}

export type CommandCenterLogicCellProps = {
  title: string;
  detail?: string;
  status?: "pending" | "running" | "done" | "failed";
};

export function CommandCenterLogicCell({
  title,
  detail,
  status = "done",
}: CommandCenterLogicCellProps) {
  return (
    <article className="bcc-logic-cell" data-status={status}>
      <div className="bcc-logic-cell__title">{title}</div>
      {detail ? <div className="bcc-logic-cell__detail">{detail}</div> : null}
    </article>
  );
}

function statusToTone(status: DashboardRuntimeStatus): CommandCenterBadgeProps["tone"] {
  if (status === "ready") {
    return "ok";
  }
  if (status === "degraded") {
    return "warn";
  }
  if (status === "blocked" || status === "offline") {
    return "danger";
  }
  return "info";
}

function sectorGlyph(id: DashboardNavigationSector["id"]): string {
  const glyphs: Record<DashboardNavigationSector["id"], string> = {
    gateway: "GW",
    workspace: "WS",
    terminal: "⌁",
    overview: "▦",
    channels: "◌",
    instances: "▤",
    sessions: "◷",
    usage: "↯",
    agents: "✦",
    skills: "✧",
    nodes: "⬡",
    dreams: "☾",
    config: "⚙",
    docs: "§",
    cron: "⏱",
  };

  return glyphs[id];
}

function CommandCenterFoxMark({ compact }: { compact?: boolean }) {
  return (
    <svg
      className="bcc-mascot__svg"
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      focusable="false"
      data-compact={compact ? "true" : "false"}
    >
      <path className="bcc-mascot__ear" d="M14 24 9 7l18 10Z" />
      <path className="bcc-mascot__ear" d="m50 24 5-17-18 10Z" />
      <path className="bcc-mascot__face" d="M32 57c-13 0-23-10-23-23S19 11 32 11s23 10 23 23-10 23-23 23Z" />
      <path className="bcc-mascot__cheek" d="M15 38c5 12 14 16 17 16s12-4 17-16c-6 5-11 7-17 7s-11-2-17-7Z" />
      <path className="bcc-mascot__eye" d="M22 29c3-3 6-3 8 0" />
      <path className="bcc-mascot__eye" d="M42 29c-3-3-6-3-8 0" />
      <path className="bcc-mascot__snout" d="M27 38c2 4 8 4 10 0" />
      <circle className="bcc-mascot__nose" cx="32" cy="36" r="2.4" />
    </svg>
  );
}
