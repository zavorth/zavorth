import type { ReactNode } from "react";
import {
  IconBook,
  IconCard,
  IconChat,
  IconClock,
  IconGrid,
  IconMoon,
  IconNetwork,
  IconServer,
  IconSettings,
  IconStar,
  IconUsage,
  IconUsers,
  IconWifi,
} from "./ZavorthControlIcons";

type DockNodeProps = {
  active?: boolean;
  children: ReactNode;
  label: string;
  sector: string;
  title: string;
};

function DockNode({ active = false, children, label, sector, title }: DockNodeProps) {
  return (
    <a className={`dock-node${active ? " active" : ""}`} data-sector={sector} href="#" title={title}>
      <span className="dock-node__glyph">{children}</span>
      <span className="dock-node__label">{label}</span>
    </a>
  );
}

function HiddenDockNode({ children, label, sector, title }: DockNodeProps) {
  return (
    <a
      className="dock-node"
      data-sector={sector}
      href="#"
      title={title}
      style={{ display: "none" }}
      aria-hidden="true"
      tabIndex={-1}
    >
      <span className="dock-node__glyph">{children}</span>
      <span className="dock-node__label">{label}</span>
    </a>
  );
}

function DockDivider() {
  return <span className="dock-divider" />;
}

function IconCanvas() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 18v2" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

export function ZavorthControlDock() {
  return (
    <nav className="nexus-dock" id="nexus-dock">
      <div className="nexus-dock__rail">
        <div className="dock-group">
          <DockNode active sector="terminal" title="Inbox" label="Inbox">
            <IconChat />
          </DockNode>
          <DockNode sector="overview" title="Work" label="Work">
            <IconGrid />
          </DockNode>
          <DockNode sector="nodes" title="Memory" label="Memory">
            <IconNetwork />
          </DockNode>
          <DockNode sector="dreams" title="Learning" label="Learning">
            <IconMoon />
          </DockNode>
          <DockNode sector="canvas" title="Canvas" label="Canvas">
            <IconCanvas />
          </DockNode>
          <DockNode sector="skills" title="Tools" label="Tools">
            <IconStar />
          </DockNode>
          <DockNode sector="usage" title="Models" label="Models">
            <IconUsage />
          </DockNode>
          <DockNode sector="config" title="Settings" label="Settings">
            <IconSettings />
          </DockNode>
        </div>
        <div className="dock-group" aria-hidden="true" style={{ display: "none" }}>
          <HiddenDockNode sector="channels" title="Channels" label="Channels">
            <IconWifi />
          </HiddenDockNode>
          <HiddenDockNode sector="sales-os" title="Approvals" label="Approvals">
            <IconCard />
          </HiddenDockNode>
          <HiddenDockNode sector="instances" title="History" label="History">
            <IconServer />
          </HiddenDockNode>
          <HiddenDockNode sector="sessions" title="History" label="History">
            <IconClock />
          </HiddenDockNode>
          <HiddenDockNode sector="agents" title="Review" label="Review">
            <IconUsers />
          </HiddenDockNode>
          <HiddenDockNode sector="dreams" title="Learning" label="Learning">
            <IconMoon />
          </HiddenDockNode>
          <HiddenDockNode sector="docs" title="Docs" label="Docs">
            <IconBook />
          </HiddenDockNode>
          <HiddenDockNode sector="cron" title="Scheduled" label="Cron">
            <IconClock />
          </HiddenDockNode>
        </div>
      </div>
      <div className="dock-sys-info">
        <span className="dock-sys-info__version">v2026.4</span>
        <span className="dock-sys-info__status dock-sys-info__status--live" />
      </div>
    </nav>
  );
}
